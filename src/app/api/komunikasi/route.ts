import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

const WA_ADMIN_ROLES = ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU'] as const;

function isSafeOptionalUrl(val: string | null | undefined): boolean {
  if (!val || !val.trim()) return true;
  const trimmed = val.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

async function getLinkedStudentIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<string[]> {
  const [{ data: guardians }, { data: ownSt }] = await Promise.all([
    supabase.from('student_guardians').select('student_id').eq('profile_id', userId),
    supabase.from('students').select('id').eq('profile_id', userId),
  ]);
  return Array.from(
    new Set([
      ...(guardians || []).map((g) => g.student_id as string),
      ...(ownSt || []).map((s) => s.id as string),
    ])
  );
}

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      isAdmin: false,
      isStaff: false,
      hasWaEnvToken: false,
      messages: [],
      leaveRequests: [],
      students: [],
      waConfig: null,
    });
  }

  const supabase = createSupabaseAdminClient();
  const isAdmin = hasAnyRole(session, WA_ADMIN_ROLES);
  const isStaff = hasAnyRole(session, PERMISSIONS.KOMUNIKASI_STAFF);

  const linkedStudentIds = !isStaff ? await getLinkedStudentIds(supabase, session.userId) : [];

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

  const isAdmin = hasAnyRole(session, WA_ADMIN_ROLES);
  const isStaff = hasAnyRole(session, PERMISSIONS.KOMUNIKASI_STAFF);
  const supabase = createSupabaseAdminClient();

  try {
    const body = await request.json();

    if (body.action === 'SEND_MESSAGE') {
      const p = z
        .object({
          student_id: z.string().uuid('Siswa / anak wajib dipilih.'),
          recipient_role: z.enum(['WALI_KELAS', 'GURU_WALI', 'GURU_BK']).default('WALI_KELAS'),
          subject: z.string().trim().min(3, 'Perihal konsultasi minimal 3 karakter.'),
          message: z.string().trim().min(5, 'Isi pesan minimal 5 karakter.'),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Pesan konsultasi tidak valid.' },
          { status: 400 }
        );
      }

      if (!isStaff) {
        const linkedIds = await getLinkedStudentIds(supabase, session.userId);
        if (!linkedIds.includes(p.data.student_id)) {
          return NextResponse.json(
            { error: 'Anda hanya dapat mengirim pesan untuk akun siswa/anak Anda sendiri.' },
            { status: 403 }
          );
        }
      }

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
          reply_text: z.string().trim().min(3, 'Isi balasan minimal 3 karakter.'),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Isi balasan minimal 3 karakter.' },
          { status: 400 }
        );
      }

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
          student_id: z.string().uuid('Siswa / anak wajib dipilih.'),
          leave_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal izin tidak valid.'),
          leave_type: z.enum(['SAKIT', 'IZIN']).default('SAKIT'),
          reason: z.string().trim().min(3, 'Keterangan izin minimal 3 karakter.'),
          attachment_url: z
            .string()
            .optional()
            .nullable()
            .refine((val) => isSafeOptionalUrl(val), {
              message: 'URL lampiran harus diawali http://, https://, atau /.',
            }),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data izin tidak masuk tidak valid.' },
          { status: 400 }
        );
      }

      if (!isStaff) {
        const linkedIds = await getLinkedStudentIds(supabase, session.userId);
        if (!linkedIds.includes(p.data.student_id)) {
          return NextResponse.json(
            { error: 'Anda hanya dapat mengajukan izin untuk akun siswa/anak Anda sendiri.' },
            { status: 403 }
          );
        }
      }

      const { data, error } = await supabase
        .from('student_leave_requests')
        .insert({
          ...p.data,
          attachment_url: p.data.attachment_url?.trim() || null,
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
        .maybeSingle();
      if (!reqRow) return NextResponse.json({ error: 'Permohonan izin tidak ditemukan.' }, { status: 404 });
      if (reqRow.status !== 'MENUNGGU') {
        return NextResponse.json(
          { error: `Permohonan izin ini sudah berstatus ${reqRow.status}.` },
          { status: 409 }
        );
      }

      const { data, error } = await supabase
        .from('student_leave_requests')
        .update({
          status: p.data.status,
          reviewed_by: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', p.data.id)
        .eq('status', 'MENUNGGU')
        .select('*')
        .maybeSingle();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      if (!data) {
        return NextResponse.json(
          { error: 'Permohonan izin sudah diproses oleh petugas lain.' },
          { status: 409 }
        );
      }

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
          api_url: z
            .string()
            .optional()
            .nullable()
            .refine(
              (val) => !val || !val.trim() || /^https?:\/\//i.test(val.trim()),
              { message: 'Endpoint URL harus diawali http:// atau https://.' }
            ),
          is_enabled: z.boolean().default(false),
          notify_alpha: z.boolean().default(true),
          notify_spp: z.boolean().default(true),
          notify_ppdb: z.boolean().default(true),
          notify_qr_arrival: z.boolean().default(true),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Pengaturan WhatsApp Gateway tidak valid.' },
          { status: 400 }
        );
      }

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
