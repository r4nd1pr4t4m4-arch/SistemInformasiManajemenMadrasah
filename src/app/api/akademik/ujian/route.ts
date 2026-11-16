import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

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

const PeriodSchema = z.object({
  action: z.literal('CREATE_PERIOD'),
  name: z.string().min(3),
  start_date: z.string(),
  end_date: z.string(),
});

const RoomSchema = z.object({
  action: z.literal('CREATE_ROOM'),
  exam_period_id: z.string().uuid(),
  room_name: z.string().min(1),
  capacity: z.number().min(1).default(30),
});

const SupervisorSchema = z.object({
  action: z.literal('ASSIGN_SUPERVISOR'),
  exam_period_id: z.string().uuid(),
  exam_room_id: z.string().uuid().optional().nullable(),
  teacher_id: z.string().uuid(),
  exam_date: z.string(),
  session_name: z.string().min(1),
  subject_name: z.string().optional().nullable(),
  jtm_allocated: z.number().min(1).max(24).default(2),
});

const CommitteeSchema = z.object({
  action: z.literal('ASSIGN_COMMITTEE'),
  exam_period_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  committee_role: z.string().min(2),
  jtm_allocated: z.number().min(1).max(40).default(4),
});

const ExamStudentAttendanceSchema = z.object({
  action: z.literal('EXAM_STUDENT_ATTENDANCE'),
  exam_period_id: z.string().uuid(),
  exam_room_id: z.string().uuid().optional().nullable(),
  student_id: z.string().uuid(),
  exam_date: z.string(),
  session_name: z.string().min(1),
  status: z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPA']),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.AKADEMIK);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      periods: [],
      rooms: [],
      supervisors: [],
      committees: [],
      studentAttendances: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: periods },
    { data: rooms },
    { data: supervisors },
    { data: committees },
    { data: studentAttendances },
  ] = await Promise.all([
    supabase.from('exam_periods').select('*').order('start_date', { ascending: false }),
    supabase.from('exam_rooms').select('*, period:exam_periods(name)'),
    supabase
      .from('exam_supervisors')
      .select('*, teacher:teachers_staff(full_name), room:exam_rooms(room_name), period:exam_periods(name)')
      .order('exam_date', { ascending: false }),
    supabase
      .from('exam_committees')
      .select('*, teacher:teachers_staff(full_name), period:exam_periods(name)'),
    supabase
      .from('exam_student_attendances')
      .select('*, student:students(full_name), room:exam_rooms(room_name)')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    periods: periods || [],
    rooms: rooms || [],
    supervisors: supervisors || [],
    committees: committees || [],
    studentAttendances: studentAttendances || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.AKADEMIK);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_PERIOD') {
      const parsed = PeriodSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data periode ujian tidak valid.' }, { status: 400 });
      }
      const academicYearId = await getActiveAcademicYearId(supabase);
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('exam_periods')
        .insert({ ...payload, academic_year_id: academicYearId, is_active: true })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ period: data });
    }

    if (body.action === 'CREATE_ROOM') {
      const parsed = RoomSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data ruang ujian tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('exam_rooms')
        .insert(payload)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ room: data });
    }

    if (body.action === 'ASSIGN_SUPERVISOR') {
      const parsed = SupervisorSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pengawas ujian tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('exam_supervisors')
        .insert({ ...payload, exam_room_id: payload.exam_room_id || null })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ supervisor: data });
    }

    if (body.action === 'ASSIGN_COMMITTEE') {
      const parsed = CommitteeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data panitia ujian tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('exam_committees')
        .insert(payload)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ committee: data });
    }

    if (body.action === 'EXAM_STUDENT_ATTENDANCE') {
      const parsed = ExamStudentAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data presensi ujian siswa tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('exam_student_attendances')
        .insert({ ...payload, exam_room_id: payload.exam_room_id || null })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ studentAttendance: data });
    }

    return NextResponse.json({ error: 'Aksi ujian tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data ujian.' }, { status: 500 });
  }
}
