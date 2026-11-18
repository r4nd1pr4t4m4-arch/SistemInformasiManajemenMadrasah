import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';

async function getActiveAcademicYearId(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<string> {
  const { data } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (data) return data.id;

  const { data: created } = await supabase
    .from('academic_years')
    .insert({ name: '2026/2027', semester: 'GANJIL', is_active: true })
    .select('id')
    .single();
  return created!.id;
}

const AssignSchema = z.object({
  action: z.literal('ASSIGN_GURU_WALI'),
  teacher_id: z.string().uuid(),
  student_id: z.string().uuid(),
});

const LogSchema = z.object({
  action: z.literal('ADD_MENTORING_LOG'),
  assignment_id: z.string().uuid(),
  mentoring_date: z.string().optional(),
  topic: z.string().min(2),
  aspect: z.enum(['AKADEMIK', 'IBADAH_KARAKTER', 'SOSIAL', 'KESEHATAN', 'LAINNYA']).default('AKADEMIK'),
  notes: z.string().min(3),
  recommendation: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.GURU_WALI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ assignments: [], logs: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: assignments }, { data: logs }] = await Promise.all([
    supabase
      .from('guru_wali_assignments')
      .select('*, teacher:teachers_staff(full_name), student:students(full_name, nis)'),
    supabase
      .from('guru_wali_mentoring_logs')
      .select(
        '*, assignment:guru_wali_assignments(teacher:teachers_staff(full_name), student:students(full_name))'
      )
      .order('mentoring_date', { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    assignments: assignments || [],
    logs: logs || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.GURU_WALI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'ASSIGN_GURU_WALI') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_ASSIGN)) {
        return NextResponse.json(
          { error: 'Peran Anda tidak memiliki izin untuk menetapkan Guru Wali.' },
          { status: 403 }
        );
      }
      const parsed = AssignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data penugasan Guru Wali tidak valid.' }, { status: 400 });
      }
      const academicYearId = await getActiveAcademicYearId(supabase);
      const { data, error } = await supabase
        .from('guru_wali_assignments')
        .upsert(
          {
            academic_year_id: academicYearId,
            teacher_id: parsed.data.teacher_id,
            student_id: parsed.data.student_id,
          },
          { onConflict: 'academic_year_id,student_id' }
        )
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ assignment: data });
    }

    if (body.action === 'ADD_MENTORING_LOG') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_LOG)) {
        return NextResponse.json(
          { error: 'Peran Anda tidak memiliki izin untuk mencatat log bimbingan Guru Wali.' },
          { status: 403 }
        );
      }
      const parsed = LogSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data bimbingan Guru Wali tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('guru_wali_mentoring_logs')
        .insert({
          ...payload,
          mentoring_date: payload.mentoring_date || new Date().toISOString().slice(0, 10),
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ log: data });
    }

    return NextResponse.json({ error: 'Aksi Guru Wali tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data Guru Wali.' }, { status: 500 });
  }
}
