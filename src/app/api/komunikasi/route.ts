import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      isAdmin: false,
      isStaff: false,
      messages: [],
      leaveRequests: [],
      students: [],
      waConfig: null,
    });
  }

  const supabase = createSupabaseAdminClient();
  const isAdmin = hasAnyRole(session, ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU']);
  const isStaff = hasAnyRole(session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'WAKA_KURIKULUM',
    'WALI_KELAS',
    'GURU_WALI',
    'GURU_BK',
    'KEPALA_TU',
    'STAF_TU',
  ]);

  let linkedStudentIds: string[] = [];
  if (!isStaff) {
    const [{ data: guardians }, { data: ownSt }] = await Promise.all([
      supabase.from('student_guardians').select('student_id').eq('profile_id', session.userId),
      supabase.from('students').select('id').eq('profile_id', session.userId),
    ]);
    linkedStudentIds = Array.from(
      new Set([
        ...(guardians || []).map((g) => g.student_id as string),
        ...(ownSt || []).map((s) => s.id as string),
      ])
    );
  }

  const [msgRes, leaveRes, stRes, waRes] = await Promise.all([
    supabase
      .from('parent_teacher_messages')
      .select('*, student:students(id, full_name, nis)')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('student_leave_requests')
      .select('*, student:students(id, full_name, nis)')
      .order('created_at', { ascending: false })
      .limit(150),
    isStaff
      ? supabase.from('students').select('id, full_name, nis').eq('status', 'AKTIF').order('full_name').limit(300)
      : linkedStudentIds.length > 0
      ? supabase.from('students').select('id, full_name, nis').in('id', linkedStudentIds)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('whatsapp_gateway_settings').select('*').limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const filterByScope = <T extends { student_id?: string; sender_id?: string; submitted_by?: string }>(
    rows: T[]
  ) =>
    isStaff
      ? rows
      : rows.filter(
          (r) =>
            r.sender_id === session.userId ||
            r.submitted_by === session.userId ||
            (r.student_id && linkedStudentIds.includes(r.student_id))
        );

  return NextResponse.json({
    isAdmin,
    isStaff,
    hasWaEnvToken: Boolean(process.env.WHATSAPP_GATEWAY_TOKEN?.trim()),
    messages: filterByScope(msgRes.error ? [] : msgRes.data || []),
    leaveRequests: filterByScope(leaveRes.error ? [] : leaveRes.data || []),
    students: stRes.data || [],
    waConfig: waRes.error ? null : waRes.data || null,
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const isAdmin = hasAnyRole(session, ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU']);
  const isStaff = hasAnyRole(session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'WALI_KELAS',
    'GURU_WALI',
    'GURU_BK',
    'KEPALA_TU',
    'STAF_TU',
  ]);
  const supabase = createSupabaseAdminClient();

  try {
    const body = await request.json();

    if (body.action === 'SEND_MESSAGE') {
      const p = z
        .object({
          student_id: z.string().uuid(),
          recipient_role: z.enum(['WALI_KELAS', 'GURU_WALI', 'GURU_BK']).default('WALI_KELAS'),
          subject: z.string().trim().min(3),
          message: z.string().trim().min(5),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Pesan konsultasi tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('parent_teacher_messages')
        .insert({
          ...p.data,
          sender_id: session.userId,
          status: 'TERKIRIM',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ message: data });
    }

    if (body.action === 'REPLY_MESSAGE') {
      if (!isStaff) return NextResponse.json({ error: 'Hanya GTK/Admin yang dapat membalas.' }, { status: 403 });
      const p = z
        .object({
          id: z.string().uuid(),
          reply_text: z.string().trim().min(3),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Isi balasan minimal 3 karakter.' }, { status: 400 });

      const { data, error } = await supabase
        .from('parent_teacher_messages')
        .update({
          reply_text: p.data.reply_text,
          replied_by: session.userId,
          replied_at: new Date().toISOString(),
          status: 'DIBALAS',
        })
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ message: data });
    }

    if (body.action === 'SUBMIT_QUICK_LEAVE') {
      const p = z
        .object({
          student_id: z.string().uuid(),
          leave_date: z.string().min(8),
          leave_type: z.enum(['SAKIT', 'IZIN']).default('SAKIT'),
          reason: z.string().trim().min(3),
          attachment_url: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data izin tidak masuk tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('student_leave_requests')
        .insert({
          ...p.data,
          attachment_url: p.data.attachment_url || null,
          submitted_by: session.userId,
          status: 'MENUNGGU',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ leaveRequest: data });
    }

    if (body.action === 'REVIEW_QUICK_LEAVE') {
      if (!isStaff) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z
        .object({
          id: z.string().uuid(),
          status: z.enum(['DISETUJUI', 'DITOLAK']),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data persetujuan izin tidak valid.' }, { status: 400 });

      const { data: reqRow } = await supabase
        .from('student_leave_requests')
        .select('*')
        .eq('id', p.data.id)
        .single();
      if (!reqRow) return NextResponse.json({ error: 'Permohonan izin tidak ditemukan.' }, { status: 404 });

      const { data, error } = await supabase
        .from('student_leave_requests')
        .update({
          status: p.data.status,
          reviewed_by: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });

      if (p.data.status === 'DISETUJUI') {
        const { data: enr } = await supabase
          .from('student_enrollments')
          .select('classroom_id')
          .eq('student_id', reqRow.student_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enr?.classroom_id) {
          await supabase.from('student_attendances').insert({
            student_id: reqRow.student_id,
            classroom_id: enr.classroom_id,
            attendance_date: reqRow.leave_date,
            status: reqRow.leave_type,
            notes: `Izin cepat disetujui: ${reqRow.reason}`,
          });
        }
      }

      await notifyStudentFamilyEvent({
        studentId: reqRow.student_id,
        categoryKey: 'PRESENSI_SISWA',
        title: `Izin Tidak Masuk ${p.data.status}`,
        body: `Permohonan ${reqRow.leave_type} tanggal ${reqRow.leave_date} untuk {studentName} telah ${p.data.status}.`,
        url: '/portal/komunikasi',
        createdBy: session.userId,
      });

      return NextResponse.json({ leaveRequest: data });
    }

    if (body.action === 'SAVE_WA_CONFIG') {
      if (!isAdmin) return NextResponse.json({ error: 'Hanya Admin yang dapat mengubah WhatsApp Gateway.' }, { status: 403 });
      const p = z
        .object({
          provider: z.enum(['DISABLED', 'FONNTE', 'WABLAS', 'WA_CLOUD']).default('DISABLED'),
          api_url: z.string().optional().nullable(),
          is_enabled: z.boolean().default(false),
          notify_alpha: z.boolean().default(true),
          notify_spp: z.boolean().default(true),
          notify_ppdb: z.boolean().default(true),
          notify_qr_arrival: z.boolean().default(true),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Pengaturan WhatsApp Gateway tidak valid.' }, { status: 400 });

      const { data: existing } = await supabase
        .from('whatsapp_gateway_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      const payload = {
        ...p.data,
        api_url: p.data.api_url?.trim() || null,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = existing?.id
        ? await supabase
            .from('whatsapp_gateway_settings')
            .update(payload)
            .eq('id', existing.id)
            .select('*')
            .single()
        : await supabase.from('whatsapp_gateway_settings').insert(payload).select('*').single();

      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ waConfig: data });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses komunikasi.' }, { status: 500 });
  }
}
