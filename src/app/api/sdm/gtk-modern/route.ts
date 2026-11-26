import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ teachers: [], leaves: [], histories: [], evaluations: [] });
  }

  const supabase = createSupabaseAdminClient();
  const isAdmin = hasAnyRole(session, PERMISSIONS.SDM_GTK_VIEW);
  const myTeacherId = session.teacherAssignments?.teacherId || null;

  const [tRes, lRes, hRes, eRes] = await Promise.all([
    supabase
      .from('teachers_staff')
      .select('id, full_name, nip, nuptk, staff_type, employment_status, photo_url')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('gtk_leaves')
      .select('*, teacher:teachers_staff(id, full_name, nip)')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('employment_histories')
      .select('*, teacher:teachers_staff(id, full_name)')
      .order('start_date', { ascending: false })
      .limit(150),
    supabase
      .from('gtk_evaluations')
      .select('*, teacher:teachers_staff(id, full_name)')
      .order('period_year', { ascending: false })
      .limit(150),
  ]);

  const filterScoped = <T extends { teacher_id?: string }>(rows: T[]) =>
    isAdmin ? rows : myTeacherId ? rows.filter((r) => r.teacher_id === myTeacherId) : [];

  return NextResponse.json({
    isAdmin,
    myTeacherId,
    teachers: isAdmin
      ? tRes.data || []
      : (tRes.data || []).filter((t) => t.id === myTeacherId),
    leaves: filterScoped(lRes.error ? [] : lRes.data || []),
    histories: filterScoped(hRes.error ? [] : hRes.data || []),
    evaluations: filterScoped(eRes.error ? [] : eRes.data || []),
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const isAdmin = hasAnyRole(session, PERMISSIONS.SDM_MANAGE);
  const myTeacherId = session.teacherAssignments?.teacherId || null;

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_LEAVE') {
      const p = z
        .object({
          teacher_id: z.string().uuid().optional(),
          leave_type: z.enum(['TAHUNAN', 'SAKIT', 'MELAHIRKAN', 'DINAS', 'LAINNYA']).default('TAHUNAN'),
          start_date: z.string().min(8),
          end_date: z.string().min(8),
          reason: z.string().trim().min(3),
          attachment_url: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data pengajuan cuti tidak valid.' }, { status: 400 });

      const targetTeacherId = isAdmin ? p.data.teacher_id || myTeacherId : myTeacherId;
      if (!targetTeacherId) {
        return NextResponse.json({ error: 'Profil GTK tidak ditemukan.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('gtk_leaves')
        .insert({
          teacher_id: targetTeacherId,
          leave_type: p.data.leave_type,
          start_date: p.data.start_date,
          end_date: p.data.end_date,
          reason: p.data.reason,
          attachment_url: p.data.attachment_url || null,
          status: 'MENUNGGU',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ leave: data });
    }

    if (body.action === 'REVIEW_LEAVE') {
      if (!isAdmin) return NextResponse.json({ error: 'Hanya Admin/TU yang dapat menyetujui cuti.' }, { status: 403 });
      const p = z
        .object({
          id: z.string().uuid(),
          status: z.enum(['DISETUJUI', 'DITOLAK']),
          reviewer_notes: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data persetujuan cuti tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('gtk_leaves')
        .update({
          status: p.data.status,
          reviewer_notes: p.data.reviewer_notes || null,
          reviewed_by: session.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ leave: data });
    }

    if (body.action === 'CREATE_HISTORY') {
      if (!isAdmin) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z
        .object({
          teacher_id: z.string().uuid(),
          position_title: z.string().trim().min(2),
          unit_or_institution: z.string().optional().nullable(),
          start_date: z.string().optional().nullable(),
          end_date: z.string().optional().nullable(),
          decree_number: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data riwayat kepegawaian tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('employment_histories')
        .insert(p.data)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ history: data });
    }

    if (body.action === 'CREATE_EVALUATION') {
      if (!isAdmin) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z
        .object({
          teacher_id: z.string().uuid(),
          record_type: z.enum(['PKG', 'SUPERVISI', 'DIKLAT', 'SERTIFIKASI']).default('PKG'),
          title: z.string().trim().min(3),
          period_year: z.number().int().min(2000).max(2100),
          score: z.number().min(0).max(100).optional().nullable(),
          organizer: z.string().optional().nullable(),
          certificate_url: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data PKG/Diklat tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('gtk_evaluations')
        .insert({ ...p.data, evaluated_by: session.userId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ evaluation: data });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data SDM GTK.' }, { status: 500 });
  }
}
