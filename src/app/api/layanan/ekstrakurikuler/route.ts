import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const VIEW_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_KESISWAAN',
  'WAKA_KURIKULUM',
  'PEMBINA_EKSTRAKURIKULER',
  'PEMBINA_OSIM',
  'WALI_KELAS',
  'GURU',
  'SISWA',
  'ORANG_TUA',
] as const;

const MANAGE_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'WAKA_KESISWAAN',
  'PEMBINA_EKSTRAKURIKULER',
  'PEMBINA_OSIM',
  'KEPALA_TU',
] as const;

export async function GET() {
  const guard = await requireApiRoles([...VIEW_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ extracurriculars: [], members: [], portfolios: [], students: [], teachers: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [ekskulRes, memRes, portRes, stRes, tRes] = await Promise.all([
    supabase
      .from('extracurriculars')
      .select('*, coach:teachers_staff(id, full_name)')
      .order('name'),
    supabase
      .from('extracurricular_members')
      .select('*, student:students(id, full_name, nis), extracurricular:extracurriculars(id, name)')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('student_portfolios')
      .select('*, student:students(id, full_name, nis)')
      .order('achieved_date', { ascending: false })
      .limit(200),
    supabase.from('students').select('id, full_name, nis').eq('status', 'AKTIF').order('full_name').limit(300),
    supabase.from('teachers_staff').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  return NextResponse.json({
    extracurriculars: ekskulRes.error ? [] : ekskulRes.data || [],
    members: memRes.error ? [] : memRes.data || [],
    portfolios: portRes.error ? [] : portRes.data || [],
    students: stRes.data || [],
    teachers: tRes.data || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles([...MANAGE_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_EKSKUL') {
      const p = z
        .object({
          name: z.string().trim().min(2),
          category: z.string().trim().default('UMUM'),
          coach_teacher_id: z.string().uuid().optional().nullable(),
          schedule_info: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data ekskul tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('extracurriculars')
        .insert({ ...p.data, coach_teacher_id: p.data.coach_teacher_id || null })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ extracurricular: data });
    }

    if (body.action === 'ENROLL_MEMBER') {
      const p = z
        .object({
          extracurricular_id: z.string().uuid(),
          student_id: z.string().uuid(),
          grade: z.string().default('Baik'),
          attendance_count: z.number().int().min(0).default(0),
          notes: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data anggota ekskul tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('extracurricular_members')
        .upsert(p.data, { onConflict: 'extracurricular_id,student_id' })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ member: data });
    }

    if (body.action === 'CREATE_PORTFOLIO') {
      const p = z
        .object({
          student_id: z.string().uuid(),
          title: z.string().trim().min(3),
          category: z.string().trim().default('AKADEMIK'),
          level: z.string().trim().default('KABUPATEN'),
          achieved_date: z.string().min(8),
          organizer: z.string().optional().nullable(),
          certificate_url: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data portofolio prestasi tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('student_portfolios')
        .insert({ ...p.data, created_by: guard.session.userId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ portfolio: data });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles([...MANAGE_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const target = searchParams.get('target') || 'ekskul';
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const table =
    target === 'member'
      ? 'extracurricular_members'
      : target === 'portfolio'
      ? 'student_portfolios'
      : 'extracurriculars';
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
