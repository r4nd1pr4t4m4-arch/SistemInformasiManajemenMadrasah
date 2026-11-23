import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { calculateLateJtm } from '@/lib/domain/jtm-late-penalty';
import { sanitizeApiError } from '@/lib/security/api-error';

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
  committee_attendance_id: z.string().uuid(),
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

const SubmitCommitteeReportSchema = z.object({
  action: z.literal('SUBMIT_COMMITTEE_REPORT'),
  attendance_id: z.string().uuid(),
  activities_summary: z.string().min(5, 'Ringkasan pertanggungjawaban minimal 5 karakter.'),
  logistics_notes: z.string().optional().nullable(),
  issues_and_solutions: z.string().optional().nullable(),
});

const SubstituteSupervisorSchema = z.object({
  action: z.literal('SUBSTITUTE_SUPERVISOR'),
  exam_supervisor_id: z.string().uuid(),
  committee_attendance_id: z.string().uuid(),
  substitute_teacher_id: z.string().uuid(),
  reason: z.string().optional().nullable(),
});

const SubstituteCommitteeSchema = z.object({
  action: z.literal('SUBSTITUTE_COMMITTEE'),
  exam_committee_id: z.string().uuid(),
  substitute_teacher_id: z.string().uuid(),
  reason: z.string().optional().nullable(),
});

const AssignExamRoomStudentsSchema = z.object({
  action: z.literal('ASSIGN_EXAM_ROOM_STUDENTS'),
  exam_period_id: z.string().uuid(),
  exam_room_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 siswa.'),
});

const RemoveExamRoomStudentSchema = z.object({
  action: z.literal('REMOVE_EXAM_ROOM_STUDENT'),
  exam_room_student_id: z.string().uuid().optional(),
  exam_period_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.UJIAN_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      periods: [],
      rooms: [],
      supervisors: [],
      committees: [],
      studentAttendances: [],
      bapReports: [],
      committeeDailyReports: [],
      supervisorAttendances: [],
      committeeAttendances: [],
      dailyGeofenceAttendances: [],
      supervisorSessionConfirmations: [],
      students: [],
      examRoomStudents: [],
      canManageCommittees: false,
      geofenceEnabled: true,
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
    { data: committeeDailyReports },
    { data: supervisorAttendances },
    { data: committeeAttendances },
    { data: dailyGeofenceAttendances },
    { data: supervisorSessionConfirmations },
    { data: students },
    { data: classrooms },
    { data: enrollments },
    { data: settingsRow },
    { data: examRoomStudents },
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
      .select(
        '*, teacher:teachers_staff!exam_committees_teacher_id_fkey(full_name), original_teacher:teachers_staff!exam_committees_original_teacher_id_fkey(full_name), period:exam_periods(name)'
      ),
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
      .from('exam_committee_daily_reports')
      .select('*, teacher:teachers_staff(full_name), committee:exam_committees(committee_role)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('teacher_attendances')
      .select('id, teacher_id, exam_supervisor_id, attendance_date, is_within_geofence, admin_confirmed, approved_jtm, teacher:teachers_staff(full_name), exam_supervisor:exam_supervisors(jtm_allocated, exam_date, session_name)')
      .eq('attendance_type', 'PENGAWAS_UJIAN')
      .eq('is_within_geofence', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('teacher_attendances')
      .select('id, teacher_id, exam_committee_id, attendance_date, is_within_geofence, admin_confirmed, approved_jtm, teacher:teachers_staff(full_name)')
      .eq('attendance_type', 'PANITIA_UJIAN')
      .eq('is_within_geofence', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('teacher_attendances')
      .select('id, teacher_id, attendance_date, is_within_geofence')
      .eq('is_within_geofence', true)
      .order('attendance_date', { ascending: false })
      .limit(200),
    supabase
      .from('schedule_session_confirmations')
      .select('*')
      .eq('session_type', 'PENGAWAS_UJIAN')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase.from('students').select('id, full_name, nis').eq('status', 'AKTIF').order('full_name').limit(300),
    supabase.from('classrooms').select('id, name').order('name').limit(100),
    supabase
      .from('student_enrollments')
      .select('student_id, classroom_id, student:students(id, full_name, nis, status)')
      .limit(1000),
    supabase.from('institution_settings').select('geofence_enabled').limit(1).maybeSingle(),
    supabase
      .from('exam_room_students')
      .select('*, student:students(id, full_name, nis, status), room:exam_rooms(id, room_name, exam_period_id)')
      .limit(2000),
  ]);

  const canManageCommittees = hasAnyRole(guard.session, PERMISSIONS.ADMIN_CONFIRM);
  const isGlobalExamViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ]);
  const ta = guard.session.teacherAssignments;
  const isFullExamActor = isGlobalExamViewer || Boolean(ta?.isExamCommittee);

  const scopedSupervisors = !isFullExamActor
    ? ta?.teacherId
      ? (supervisors || []).filter(
          (s) => s.teacher_id === ta.teacherId || s.original_teacher_id === ta.teacherId
        )
      : []
    : supervisors || [];

  const scopedCommittees = !isFullExamActor
    ? ta?.teacherId
      ? (committees || []).filter(
          (c) => c.teacher_id === ta.teacherId || c.original_teacher_id === ta.teacherId
        )
      : []
    : committees || [];

  const scopedBapReports = !isFullExamActor
    ? ta?.teacherId
      ? (bapReports || []).filter((b) => b.teacher_id === ta.teacherId)
      : []
    : bapReports || [];

  const scopedCommitteeDailyReports = !isGlobalExamViewer
    ? ta?.teacherId
      ? (committeeDailyReports || []).filter((r) => r.teacher_id === ta.teacherId)
      : []
    : committeeDailyReports || [];

  const scopedSupervisorAttendances = !isFullExamActor
    ? ta?.teacherId
      ? (supervisorAttendances || []).filter((a) => a.teacher_id === ta.teacherId)
      : []
    : supervisorAttendances || [];

  const scopedCommitteeAttendances = !isGlobalExamViewer
    ? ta?.teacherId
      ? (committeeAttendances || []).filter((a) => a.teacher_id === ta.teacherId)
      : []
    : committeeAttendances || [];

  const scopedSupervisorConfirmations = !isFullExamActor
    ? ta?.teacherId
      ? (supervisorSessionConfirmations || []).filter((c) => c.teacher_id === ta.teacherId)
      : []
    : supervisorSessionConfirmations || [];

  const supervisedRoomIds = new Set(
    scopedSupervisors.map((s) => s.exam_room_id).filter(Boolean)
  );
  const homeroomStudentIds = new Set(
    (enrollments || [])
      .filter((e) => (ta?.homeroomClassroomIds || []).includes(e.classroom_id))
      .map((e) => e.student_id)
  );

  const scopedStudentAttendances = !isFullExamActor
    ? ta?.teacherId
      ? (studentAttendances || []).filter(
          (a) =>
            (a.exam_room_id && supervisedRoomIds.has(a.exam_room_id)) ||
            homeroomStudentIds.has(a.student_id)
        )
      : []
    : studentAttendances || [];

  return NextResponse.json({
    periods: periods || [],
    rooms: rooms || [],
    supervisors: scopedSupervisors,
    committees: scopedCommittees,
    studentAttendances: scopedStudentAttendances,
    bapReports: scopedBapReports,
    committeeDailyReports: scopedCommitteeDailyReports,
    supervisorAttendances: scopedSupervisorAttendances,
    committeeAttendances: scopedCommitteeAttendances,
    dailyGeofenceAttendances: dailyGeofenceAttendances || [],
    supervisorSessionConfirmations: scopedSupervisorConfirmations,
    students: students || [],
    classrooms: classrooms || [],
    enrollments: enrollments || [],
    examRoomStudents: examRoomStudents || [],
    canManageCommittees,
    geofenceEnabled: settingsRow?.geofence_enabled ?? true,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.UJIAN_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const canManageExam = hasAnyRole(guard.session, PERMISSIONS.UJIAN_MANAGE);

    if (
      (body.action === 'CREATE_PERIOD' ||
        body.action === 'CREATE_ROOM' ||
        body.action === 'ASSIGN_EXAM_ROOM_STUDENTS' ||
        body.action === 'REMOVE_EXAM_ROOM_STUDENT' ||
        body.action === 'ASSIGN_SUPERVISOR' ||
        body.action === 'ASSIGN_COMMITTEE') &&
      !canManageExam
    ) {
      return NextResponse.json(
        { error: 'Peran Anda tidak memiliki izin untuk mengelola periode/ruang/pengawas/panitia ujian.' },
        { status: 403 }
      );
    }

    if (body.action === 'CREATE_PERIOD') {
      const parsed = PeriodSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data periode ujian tidak valid.' }, { status: 400 });
      }
      const academicYearId = await getActiveAcademicYearId(supabase);
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('exam_periods')
        .insert({ ...payload, academic_year_id: academicYearId, is_active: true })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ period: data });
    }

    if (body.action === 'CREATE_ROOM') {
      const parsed = RoomSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data ruang ujian tidak valid.' }, { status: 400 });
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('exam_rooms')
        .insert(payload)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ room: data });
    }

    if (body.action === 'ASSIGN_EXAM_ROOM_STUDENTS') {
      const parsed = AssignExamRoomStudentsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Pilih periode ujian, ruang ujian, dan minimal 1 siswa.' },
          { status: 400 }
        );
      }
      const { data: roomRow, error: roomErr } = await supabase
        .from('exam_rooms')
        .select('id, exam_period_id')
        .eq('id', parsed.data.exam_room_id)
        .maybeSingle();

      if (roomErr || !roomRow || roomRow.exam_period_id !== parsed.data.exam_period_id) {
        return NextResponse.json(
          { error: 'Ruang ujian tidak sesuai dengan periode ujian yang dipilih.' },
          { status: 400 }
        );
      }

      const uniqueStudentIds = Array.from(new Set(parsed.data.student_ids));
      const rows = uniqueStudentIds.map((student_id) => ({
        exam_period_id: parsed.data.exam_period_id,
        exam_room_id: parsed.data.exam_room_id,
        student_id,
      }));
      const { data, error } = await supabase
        .from('exam_room_students')
        .upsert(rows, { onConflict: 'exam_period_id,student_id' })
        .select('*');
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ examRoomStudents: data || [], count: rows.length });
    }

    if (body.action === 'REMOVE_EXAM_ROOM_STUDENT') {
      const parsed = RemoveExamRoomStudentSchema.safeParse(body);
      if (
        !parsed.success ||
        (!parsed.data.exam_room_student_id &&
          !(parsed.data.exam_period_id && parsed.data.student_id))
      ) {
        return NextResponse.json(
          { error: 'Parameter keluarkan peserta ruang ujian tidak valid.' },
          { status: 400 }
        );
      }
      let delQuery = supabase.from('exam_room_students').delete();
      if (parsed.data.exam_room_student_id) {
        delQuery = delQuery.eq('id', parsed.data.exam_room_student_id);
      } else if (parsed.data.exam_period_id && parsed.data.student_id) {
        delQuery = delQuery
          .eq('exam_period_id', parsed.data.exam_period_id)
          .eq('student_id', parsed.data.student_id);
      }
      const { error } = await delQuery;
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'ASSIGN_SUPERVISOR') {
      const parsed = SupervisorSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pengawas ujian tidak valid.' }, { status: 400 });
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('exam_supervisors')
        .insert({ ...payload, exam_room_id: parsed.data.exam_room_id || null })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ supervisor: data });
    }

    if (body.action === 'ASSIGN_COMMITTEE') {
      const parsed = CommitteeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data panitia ujian tidak valid.' }, { status: 400 });
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('exam_committees')
        .insert(payload)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ committee: data });
    }

    if (body.action === 'EXAM_STUDENT_ATTENDANCE') {
      const parsed = ExamStudentAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              'Data presensi ujian siswa tidak valid. Pilih presensi Panitia Ujian / Pengganti terkonfirmasi Admin.',
          },
          { status: 400 }
        );
      }

      const {
        committee_attendance_id,
        exam_period_id,
        exam_room_id,
        student_id,
        exam_date,
        session_name,
        status,
      } = parsed.data;

      const { data: comAtt } = await supabase
        .from('teacher_attendances')
        .select('id, attendance_type, is_within_geofence, admin_confirmed')
        .eq('id', committee_attendance_id)
        .maybeSingle();

      if (
        !comAtt ||
        comAtt.attendance_type !== 'PANITIA_UJIAN' ||
        !comAtt.is_within_geofence ||
        !comAtt.admin_confirmed
      ) {
        return NextResponse.json(
          {
            error:
              'Hanya Panitia Ujian / Panitia Pengganti yang kehadirannya sudah dikonfirmasi Admin yang dapat melakukan absensi siswa ujian.',
          },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from('exam_student_attendances')
        .insert({
          exam_period_id,
          exam_room_id: exam_room_id || null,
          student_id,
          exam_date,
          session_name,
          status,
          recorded_by: guard.session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ studentAttendance: data });
    }

    if (body.action === 'BATCH_EXAM_STUDENT_ATTENDANCE') {
      const schema = z.object({
        exam_supervisor_id: z.string().uuid(),
        records: z
          .array(
            z.object({
              student_id: z.string().uuid(),
              status: z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPA']),
            })
          )
          .min(1),
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Data absensi batch siswa ujian tidak valid.' },
          { status: 400 }
        );
      }

      const { data: supervisor, error: supErr } = await supabase
        .from('exam_supervisors')
        .select('id, exam_period_id, exam_room_id, exam_date, session_name, teacher_id')
        .eq('id', parsed.data.exam_supervisor_id)
        .single();

      if (supErr || !supervisor) {
        return NextResponse.json({ error: 'Jadwal pengawas ujian tidak ditemukan.' }, { status: 404 });
      }

      const ta = guard.session.teacherAssignments;
      const canBypassSupervisorOwner =
        hasAnyRole(guard.session, PERMISSIONS.ADMIN_CONFIRM) || Boolean(ta?.isExamCommittee);
      if (!canBypassSupervisorOwner && supervisor.teacher_id !== ta?.teacherId) {
        return NextResponse.json(
          { error: 'Anda hanya dapat menginput absensi siswa ujian untuk sesi pengawasan Anda sendiri.' },
          { status: 403 }
        );
      }

      let delQuery = supabase
        .from('exam_student_attendances')
        .delete()
        .eq('exam_period_id', supervisor.exam_period_id)
        .eq('exam_date', supervisor.exam_date)
        .eq('session_name', supervisor.session_name);
      if (supervisor.exam_room_id) {
        delQuery = delQuery.eq('exam_room_id', supervisor.exam_room_id);
      } else {
        delQuery = delQuery.is('exam_room_id', null);
      }
      await delQuery;

      const rowsToInsert = parsed.data.records.map((r) => ({
        exam_period_id: supervisor.exam_period_id,
        exam_room_id: supervisor.exam_room_id || null,
        student_id: r.student_id,
        exam_date: supervisor.exam_date,
        session_name: supervisor.session_name,
        status: r.status,
        recorded_by: guard.session.userId,
      }));

      const { error: insErr } = await supabase
        .from('exam_student_attendances')
        .insert(rowsToInsert);
      if (insErr) return NextResponse.json({ error: sanitizeApiError(insErr) }, { status: 500 });

      return NextResponse.json({ ok: true, savedCount: rowsToInsert.length });
    }

    if (body.action === 'SUBMIT_BAP') {
      const parsed = SubmitBapSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data Berita Acara Pengawasan (BAP) tidak valid.' }, { status: 400 });
      }

      const { data: supervisor, error: supErr } = await supabase
        .from('exam_supervisors')
        .select('id, exam_period_id, exam_room_id, session_name, teacher_id, exam_date, jtm_allocated')
        .eq('id', parsed.data.exam_supervisor_id)
        .single();

      if (supErr || !supervisor) {
        return NextResponse.json({ error: 'Jadwal pengawas ujian tidak ditemukan.' }, { status: 404 });
      }

      const ta = guard.session.teacherAssignments;
      const canBypassBapOwner =
        hasAnyRole(guard.session, PERMISSIONS.ADMIN_CONFIRM) || Boolean(ta?.isExamCommittee);
      if (!canBypassBapOwner && supervisor.teacher_id !== ta?.teacherId) {
        return NextResponse.json(
          { error: 'Anda hanya dapat mengisi Berita Acara (BAP) untuk jadwal pengawasan Anda sendiri.' },
          { status: 403 }
        );
      }

      // Cek konfirmasi per jadwal di schedule_session_confirmations (atau fallback ke teacher_attendances)
      const { data: sessionConf } = await supabase
        .from('schedule_session_confirmations')
        .select('id, daily_attendance_id, approved_jtm')
        .eq('exam_supervisor_id', supervisor.id)
        .eq('teacher_id', supervisor.teacher_id)
        .eq('session_type', 'PENGAWAS_UJIAN')
        .maybeSingle();

      const { data: supAtt } = !sessionConf
        ? await supabase
            .from('teacher_attendances')
            .select('id, teacher_id, is_within_geofence, admin_confirmed, approved_jtm')
            .eq('exam_supervisor_id', supervisor.id)
            .eq('teacher_id', supervisor.teacher_id)
            .eq('attendance_type', 'PENGAWAS_UJIAN')
            .eq('is_within_geofence', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };

      if (!sessionConf && !supAtt) {
        return NextResponse.json(
          {
            error:
              'Pengawas ujian wajib melakukan presensi geofencing (1x/hari) dan dikonfirmasi kehadirannya pada jadwal ini sebelum mengisi BAP.',
          },
          { status: 400 }
        );
      }

      if (!sessionConf && supAtt && !supAtt.admin_confirmed) {
        return NextResponse.json(
          {
            error:
              'Kehadiran Pengawas Ujian belum dikonfirmasi oleh Admin atau Panitia Ujian/Panitia Pengganti. BAP hanya dapat diisi setelah kehadiran dikonfirmasi.',
          },
          { status: 403 }
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

      const baseSupervisorJtm = sessionConf
        ? Number(sessionConf.approved_jtm)
        : supAtt?.approved_jtm != null
        ? Number(supAtt.approved_jtm)
        : supervisor.jtm_allocated;
      const lateCalc = calculateLateJtm(baseSupervisorJtm, supervisor.exam_date);
      if (!lateCalc.allowed) {
        return NextResponse.json({ error: lateCalc.reason }, { status: 400 });
      }

      const jtmCredited = lateCalc.creditedJtm;
      const resolvedAttId = sessionConf?.daily_attendance_id || supAtt!.id;

      const { data: bap, error: bapErr } = await supabase
        .from('exam_bap_reports')
        .insert({
          exam_supervisor_id: supervisor.id,
          attendance_id: resolvedAttId,
          teacher_id: supervisor.teacher_id,
          report_date: supervisor.exam_date,
          present_students_count: parsed.data.present_students_count,
          absent_students_count: parsed.data.absent_students_count,
          incidents: parsed.data.incidents?.trim() || null,
          jtm_credited: jtmCredited,
          delay_days: lateCalc.delayDays,
          jtm_percentage: lateCalc.percentage,
          submitted_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (bapErr || !bap) {
        return NextResponse.json({ error: bapErr?.message || 'Gagal menyimpan BAP.' }, { status: 500 });
      }

      if (!sessionConf && supAtt) {
        await supabase
          .from('teacher_attendances')
          .update({ jtm_earned: jtmCredited })
          .eq('id', supAtt.id);
      }

      return NextResponse.json({
        bap,
        jtmCredited,
        delayDays: lateCalc.delayDays,
        percentage: lateCalc.percentage,
      });
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

      if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });
      return NextResponse.json({ supervisor: updated });
    }

    if (body.action === 'SUBSTITUTE_COMMITTEE') {
      if (!hasAnyRole(guard.session, PERMISSIONS.ADMIN_CONFIRM)) {
        return NextResponse.json(
          { error: 'Hanya Admin / Kurikulum / Kesiswaan / TU yang dapat menunjuk Panitia Ujian Pengganti.' },
          { status: 403 }
        );
      }

      const parsed = SubstituteCommitteeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data panitia pengganti tidak valid.' }, { status: 400 });
      }

      const { data: committee, error: comErr } = await supabase
        .from('exam_committees')
        .select('id, teacher_id, original_teacher_id')
        .eq('id', parsed.data.exam_committee_id)
        .single();

      if (comErr || !committee) {
        return NextResponse.json({ error: 'Data panitia ujian tidak ditemukan.' }, { status: 404 });
      }

      if (committee.teacher_id === parsed.data.substitute_teacher_id) {
        return NextResponse.json(
          { error: 'Panitia pengganti tidak boleh sama dengan panitia saat ini.' },
          { status: 400 }
        );
      }

      const { data: updated, error: updErr } = await supabase
        .from('exam_committees')
        .update({
          original_teacher_id: committee.original_teacher_id || committee.teacher_id,
          teacher_id: parsed.data.substitute_teacher_id,
          substituted_by_profile_id: guard.session.userId,
          substitution_reason: parsed.data.reason?.trim() || null,
          substituted_at: new Date().toISOString(),
        })
        .eq('id', committee.id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });
      return NextResponse.json({ committee: updated });
    }

    if (body.action === 'SUBMIT_COMMITTEE_REPORT') {
      const parsed = SubmitCommitteeReportSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data LPJ Harian Panitia tidak valid.' },
          { status: 400 }
        );
      }

      const { data: att, error: attErr } = await supabase
        .from('teacher_attendances')
        .select('*')
        .eq('id', parsed.data.attendance_id)
        .single();

      if (attErr || !att || att.attendance_type !== 'PANITIA_UJIAN' || !att.exam_committee_id) {
        return NextResponse.json(
          { error: 'Data presensi Panitia Ujian tidak ditemukan.' },
          { status: 404 }
        );
      }
      const canAdminConfirm = hasAnyRole(guard.session, PERMISSIONS.ADMIN_CONFIRM);
      const ta = guard.session.teacherAssignments;
      if (!canAdminConfirm && att.teacher_id !== ta?.teacherId) {
        return NextResponse.json(
          { error: 'Anda hanya dapat mengisi LPJ Harian Panitia untuk kehadiran Anda sendiri.' },
          { status: 403 }
        );
      }
      if (!att.is_within_geofence || !att.admin_confirmed) {
        return NextResponse.json(
          {
            error:
              'Kehadiran Panitia Ujian / Panitia Pengganti harus dikonfirmasi Admin terlebih dahulu sebelum mengisi LPJ Harian.',
          },
          { status: 403 }
        );
      }

      const { data: existingReport } = await supabase
        .from('exam_committee_daily_reports')
        .select('id')
        .eq('attendance_id', att.id)
        .maybeSingle();

      if (existingReport) {
        return NextResponse.json(
          { error: 'Laporan Pertanggungjawaban Harian untuk presensi ini sudah pernah diisi.' },
          { status: 400 }
        );
      }

      let jtmCredited = att.approved_jtm != null ? Number(att.approved_jtm) : 0;
      if (att.approved_jtm == null) {
        const { data: comRow } = await supabase
          .from('exam_committees')
          .select('jtm_allocated')
          .eq('id', att.exam_committee_id)
          .maybeSingle();
        jtmCredited = Number(comRow?.jtm_allocated ?? 4);
      }

      const { data: report, error: repErr } = await supabase
        .from('exam_committee_daily_reports')
        .insert({
          attendance_id: att.id,
          exam_committee_id: att.exam_committee_id,
          teacher_id: att.teacher_id,
          report_date: att.attendance_date,
          activities_summary: parsed.data.activities_summary.trim(),
          logistics_notes: parsed.data.logistics_notes?.trim() || null,
          issues_and_solutions: parsed.data.issues_and_solutions?.trim() || null,
          jtm_credited: jtmCredited,
          submitted_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (repErr || !report) {
        return NextResponse.json(
          { error: repErr?.message || 'Gagal menyimpan LPJ Harian Panitia Ujian.' },
          { status: 500 }
        );
      }

      await supabase
        .from('teacher_attendances')
        .update({ jtm_earned: jtmCredited })
        .eq('id', att.id);

      return NextResponse.json({ report, jtmCredited });
    }

    if (body.action === 'CONFIRM_COMMITTEE_WITHOUT_GEOFENCE') {
      if (!hasAnyRole(guard.session, PERMISSIONS.ADMIN_CONFIRM)) {
        return NextResponse.json(
          { error: 'Hanya Admin / Kurikulum / Kesiswaan / TU yang dapat mengonfirmasi Panitia Ujian.' },
          { status: 403 }
        );
      }

      const { data: settingsRow } = await supabase
        .from('institution_settings')
        .select('geofence_enabled')
        .limit(1)
        .maybeSingle();
      const geofenceEnabled = settingsRow?.geofence_enabled ?? true;
      if (geofenceEnabled) {
        return NextResponse.json(
          {
            error:
              'Fitur geofencing aktif. Panitia Ujian / Panitia Pengganti wajib melakukan presensi GPS geofencing terlebih dahulu.',
          },
          { status: 403 }
        );
      }

      const schema = z.object({
        exam_committee_id: z.string().uuid(),
        attendance_date: z.string().min(8),
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data konfirmasi panitia ujian tidak valid.' }, { status: 400 });
      }

      const { data: comRow } = await supabase
        .from('exam_committees')
        .select('id, teacher_id, jtm_allocated')
        .eq('id', parsed.data.exam_committee_id)
        .maybeSingle();

      if (!comRow) {
        return NextResponse.json({ error: 'Data Panitia Ujian tidak ditemukan.' }, { status: 404 });
      }

      const { data: existingAtt } = await supabase
        .from('teacher_attendances')
        .select('id, admin_confirmed')
        .eq('teacher_id', comRow.teacher_id)
        .eq('exam_committee_id', comRow.id)
        .eq('attendance_date', parsed.data.attendance_date)
        .eq('attendance_type', 'PANITIA_UJIAN')
        .maybeSingle();

      if (existingAtt) {
        if (existingAtt.admin_confirmed) {
          return NextResponse.json(
            { error: 'Panitia Ujian ini sudah dikonfirmasi hadir pada tanggal tersebut.' },
            { status: 400 }
          );
        }
        const { data: updated, error: updErr } = await supabase
          .from('teacher_attendances')
          .update({
            is_within_geofence: true,
            admin_confirmed: true,
            confirmed_by: guard.session.userId,
            confirmed_at: new Date().toISOString(),
            approved_jtm: comRow.jtm_allocated,
          })
          .eq('id', existingAtt.id)
          .select('*')
          .single();

        if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });
        return NextResponse.json({ attendance: updated });
      }

      const { data: inserted, error: insErr } = await supabase
        .from('teacher_attendances')
        .insert({
          teacher_id: comRow.teacher_id,
          attendance_date: parsed.data.attendance_date,
          attendance_type: 'PANITIA_UJIAN',
          exam_committee_id: comRow.id,
          jtm_earned: 0,
          approved_jtm: comRow.jtm_allocated,
          distance_meters: 0,
          is_within_geofence: true,
          admin_confirmed: true,
          confirmed_by: guard.session.userId,
          confirmed_at: new Date().toISOString(),
          notes: 'Konfirmasi Panitia Ujian tanpa geofencing (fitur geofencing nonaktif)',
        })
        .select('*')
        .single();

      if (insErr) return NextResponse.json({ error: sanitizeApiError(insErr) }, { status: 500 });
      return NextResponse.json({ attendance: inserted });
    }

    return NextResponse.json({ error: 'Aksi ujian tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data ujian.' }, { status: 500 });
  }
}
