import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

async function getOrCreateActiveAcademicYear(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<string> {
  const { data: active } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (active) return active.id;

  const { data: created, error } = await supabase
    .from('academic_years')
    .insert({
      name: '2026/2027',
      semester: 'GANJIL',
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error('Gagal menyiapkan Tahun Ajaran aktif.');
  }
  return created.id;
}

const ClassroomSchema = z.object({
  action: z.literal('CREATE_CLASSROOM'),
  name: z.string().min(1),
  grade_level: z.string().min(1),
  homeroom_teacher_id: z.string().uuid().optional().nullable(),
  room_location: z.string().optional().nullable(),
});

const SubjectSchema = z.object({
  action: z.literal('CREATE_SUBJECT'),
  code: z.string().min(2),
  name: z.string().min(2),
  subject_group: z.string().optional().default('Umum'),
});

const ScheduleSchema = z.object({
  action: z.literal('CREATE_SCHEDULE'),
  classroom_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  day_of_week: z.number().min(1).max(7),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  jtm_count: z.number().min(1).max(12).default(2),
});

const PicketSchema = z.object({
  action: z.literal('CREATE_PICKET'),
  teacher_id: z.string().uuid(),
  day_of_week: z.number().min(1).max(7),
  notes: z.string().optional().nullable(),
});

const EnrollSchema = z.object({
  action: z.literal('ENROLL_STUDENT'),
  student_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
});

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      classrooms: [],
      subjects: [],
      schedules: [],
      pickets: [],
      enrollments: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: classrooms },
    { data: subjects },
    { data: schedules },
    { data: pickets },
    { data: enrollments },
  ] = await Promise.all([
    supabase
      .from('classrooms')
      .select('*, homeroom_teacher:teachers_staff(id, full_name)')
      .order('name'),
    supabase.from('subjects').select('*').order('name'),
    supabase
      .from('schedules')
      .select(
        '*, classroom:classrooms(name), subject:subjects(name, code), teacher:teachers_staff(full_name)'
      )
      .order('day_of_week')
      .order('start_time'),
    supabase
      .from('picket_schedules')
      .select('*, teacher:teachers_staff(full_name)')
      .order('day_of_week'),
    supabase
      .from('student_enrollments')
      .select('*, student:students(full_name, nisn), classroom:classrooms(name)'),
  ]);

  return NextResponse.json({
    classrooms: classrooms || [],
    subjects: subjects || [],
    schedules: schedules || [],
    pickets: pickets || [],
    enrollments: enrollments || [],
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const academicYearId = await getOrCreateActiveAcademicYear(supabase);

    if (body.action === 'CREATE_CLASSROOM') {
      const parsed = ClassroomSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data rombel tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('classrooms')
        .insert({
          academic_year_id: academicYearId,
          name: parsed.data.name,
          grade_level: parsed.data.grade_level,
          homeroom_teacher_id: parsed.data.homeroom_teacher_id || null,
          room_location: parsed.data.room_location || null,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ classroom: data });
    }

    if (body.action === 'CREATE_SUBJECT') {
      const parsed = SubjectSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data mata pelajaran tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          code: parsed.data.code.toUpperCase(),
          name: parsed.data.name,
          subject_group: parsed.data.subject_group,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ subject: data });
    }

    if (body.action === 'CREATE_SCHEDULE') {
      const parsed = ScheduleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jadwal tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('schedules')
        .insert({ ...payload, academic_year_id: academicYearId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ schedule: data });
    }

    if (body.action === 'CREATE_PICKET') {
      const parsed = PicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jadwal piket tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('picket_schedules')
        .insert({ ...payload, academic_year_id: academicYearId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ picket: data });
    }

    if (body.action === 'ENROLL_STUDENT') {
      const parsed = EnrollSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data penempatan siswa tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('student_enrollments')
        .upsert(
          {
            student_id: parsed.data.student_id,
            classroom_id: parsed.data.classroom_id,
            academic_year_id: academicYearId,
          },
          { onConflict: 'student_id,academic_year_id' }
        )
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ enrollment: data });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses kelas/jadwal.' },
      { status: 500 }
    );
  }
}
