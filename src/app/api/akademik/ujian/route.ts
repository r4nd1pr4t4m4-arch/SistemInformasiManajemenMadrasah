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

const SubmitBapSchema = z.object({
  action: z.literal('SUBMIT_BAP'),
  exam_supervisor_id: z.string().uuid(),
  present_students_count: z.number().min(0).default(0),
  absent_students_count: z.number().min(0).default(0),
  incidents: z.string().optional().nullable(),
});

const SubstituteSupervisorSchema = z.object({
  action: z.literal('SUBSTITUTE_SUPERVISOR'),
  exam_supervisor_id: z.string().uuid(),
  committee_attendance_id: z.string().uuid(),
  substitute_teacher_id: z.string().uuid(),
  reason: z.string().optional().nullable(),
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
      bapReports: [],
      supervisorAttendances: [],
      committeeAttendances: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: periods },
    { data: rooms },
    { data: supervisors },
    { data: committees },
    { data: studentAttendances },
    { data: bapReports },
    { data: supervisorAttendances },
    { data: committeeAttendances },
  ] = await Promise.all([
    supabase.from('exam_periods').select('*').order('start_date', { ascending: false }),
    supabase.from('exam_rooms').select('*, period:exam_periods(name)'),
    supabase
      .from('exam_supervisors')
      .select(
        '*, teacher:teachers_staff!exam_supervisors_teacher_id_fkey(full_name), original_teacher:teachers_staff!exam_supervisors_original_teacher_id_fkey(full_name), room:exam_rooms(room_name), period:exam_periods(name)'
      )
      .order('exam_date', { ascending: false }),
    supabase
      .from('exam_committees')
      .select('*, teacher:teachers_staff(full_name), period:exam_periods(name)'),
    supabase
      .from('exam_student_attendances')
      .select('*, student:students(full_name), room:exam_rooms(room_name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('exam_bap_reports')
      .select('*, teacher:teachers_staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('teacher_attendances')
      .select('id, teacher_id, exam_supervisor_id, attendance_date, is_within_geofence, teacher:teachers_staff(full_name)')
      .eq('attendance_type', 'PENGAWAS_UJIAN')
      .eq('is_within_geofence', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('teacher_attendances')
      .select('id, teacher_id, exam_committee_id, attendance_date, is_within_geofence, admin_confirmed, teacher:teachers_staff(full_name)')
      .eq('attendance_type', 'PANITIA_UJIAN')
      .eq('is_within_geofence', true)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    periods: periods || [],
    rooms: rooms || [],
    supervisors: supervisors || [],
    committees: committees || [],
    studentAttendances: studentAttendances || [],
    bapReports: bapReports || [],
    supervisorAttendances: supervisorAttendances || [],
    committeeAttendances: committeeAttendances || [],
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

    if (body.action === 'SUBMIT_BAP') {
      const parsed = SubmitBapSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data Berita Acara Pengawasan (BAP) tidak valid.' }, { status: 400 });
      }

      const { data: supervisor, error: supErr } = await supabase
        .from('exam_supervisors')
        .select('id, teacher_id, exam_date, jtm_allocated')
        .eq('id', parsed.data.exam_supervisor_id)
        .single();

      if (supErr || !supervisor) {
        return NextResponse.json({ error: 'Jadwal pengawas ujian tidak ditemukan.' }, { status: 404 });
      }

      // Wajib sudah melakukan presensi GPS geofencing sebagai PENGAWAS_UJIAN
      const { data: supAtt } = await supabase
        .from('teacher_attendances')
        .select('id, teacher_id, is_within_geofence')
        .eq('exam_supervisor_id', supervisor.id)
        .eq('teacher_id', supervisor.teacher_id)
        .eq('attendance_type', 'PENGAWAS_UJIAN')
        .eq('is_within_geofence', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!supAtt) {
        return NextResponse.json(
          {
            error:
              'Pengawas ujian wajib melakukan presensi GPS geofencing terlebih dahulu sebelum mengisi Berita Acara Pengawasan (BAP).',
          },
          { status: 400 }
        );
      }

      const { data: existingBap } = await supabase
        .from('exam_bap_reports')
        .select('id')
        .eq('exam_supervisor_id', supervisor.id)
        .maybeSingle();

      if (existingBap) {
        return NextResponse.json(
          { error: 'Berita Acara Pengawasan (BAP) untuk jadwal ini sudah pernah diisi.' },
          { status: 400 }
        );
      }

      const { data: bap, error: bapErr } = await supabase
        .from('exam_bap_reports')
        .insert({
          exam_supervisor_id: supervisor.id,
          attendance_id: supAtt.id,
          teacher_id: supervisor.teacher_id,
          report_date: supervisor.exam_date,
          present_students_count: parsed.data.present_students_count,
          absent_students_count: parsed.data.absent_students_count,
          incidents: parsed.data.incidents?.trim() || null,
          submitted_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (bapErr || !bap) {
        return NextResponse.json({ error: bapErr?.message || 'Gagal menyimpan BAP.' }, { status: 500 });
      }

      await supabase
        .from('teacher_attendances')
        .update({ jtm_earned: supervisor.jtm_allocated })
        .eq('id', supAtt.id);

      return NextResponse.json({ bap, jtmCredited: supervisor.jtm_allocated });
    }

    if (body.action === 'SUBSTITUTE_SUPERVISOR') {
      const parsed = SubstituteSupervisorSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pengawas pengganti tidak valid.' }, { status: 400 });
      }

      // Verifikasi Panitia Ujian sudah presensi geofencing dan dikonfirmasi Admin
      const { data: committeeAtt } = await supabase
        .from('teacher_attendances')
        .select('id, teacher_id, attendance_type, is_within_geofence, admin_confirmed')
        .eq('id', parsed.data.committee_attendance_id)
        .maybeSingle();

      if (
        !committeeAtt ||
        committeeAtt.attendance_type !== 'PANITIA_UJIAN' ||
        !committeeAtt.is_within_geofence ||
        !committeeAtt.admin_confirmed
      ) {
        return NextResponse.json(
          {
            error:
              'Panitia Ujian wajib melakukan presensi geofencing dan dikonfirmasi kehadirannya oleh Admin terlebih dahulu sebelum menunjuk pengawas pengganti.',
          },
          { status: 403 }
        );
      }

      const { data: supervisor, error: supErr } = await supabase
        .from('exam_supervisors')
        .select('id, teacher_id, original_teacher_id')
        .eq('id', parsed.data.exam_supervisor_id)
        .single();

      if (supErr || !supervisor) {
        return NextResponse.json({ error: 'Jadwal pengawas ujian tidak ditemukan.' }, { status: 404 });
      }

      if (supervisor.teacher_id === parsed.data.substitute_teacher_id) {
        return NextResponse.json(
          { error: 'Pengawas pengganti tidak boleh sama dengan pengawas saat ini.' },
          { status: 400 }
        );
      }

      const { data: updated, error: updErr } = await supabase
        .from('exam_supervisors')
        .update({
          original_teacher_id: supervisor.original_teacher_id || supervisor.teacher_id,
          teacher_id: parsed.data.substitute_teacher_id,
          substituted_by_committee_id: committeeAtt.teacher_id,
          substitution_reason: parsed.data.reason?.trim() || null,
          substituted_at: new Date().toISOString(),
        })
        .eq('id', supervisor.id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ supervisor: updated });
    }

    return NextResponse.json({ error: 'Aksi ujian tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data ujian.' }, { status: 500 });
  }
}
