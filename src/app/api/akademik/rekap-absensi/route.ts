import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';

function firstOfMonthWib(): string {
  const today = getWibTodayDateString();
  return `${today.slice(0, 7)}-01`;
}

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.REKAP_ABSENSI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      teacherRecap: [],
      dailyStudentRecap: [],
      subjectStudentRecap: [],
      filters: { classrooms: [], subjects: [], teachers: [] },
    });
  }

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get('startDate') || firstOfMonthWib();
  const endDate = sp.get('endDate') || getWibTodayDateString();
  const classroomId = sp.get('classroomId') || '';
  const subjectId = sp.get('subjectId') || '';
  const teacherId = sp.get('teacherId') || '';

  const supabase = createSupabaseAdminClient();

  const [
    { data: teacherAtts },
    { data: shortLeaves },
    { data: studentAtts },
    { data: classrooms },
    { data: subjects },
    { data: teachers },
    { data: teacherSchedules },
    { data: teacherPickets },
    { data: calendarHolidays },
  ] = await Promise.all([
    supabase
      .from('teacher_attendances')
      .select(
        'id, teacher_id, attendance_date, attendance_type, admin_confirmed, jtm_earned, teacher:teachers_staff(id, full_name, nip)'
      )
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate),
    supabase
      .from('teacher_short_leaves')
      .select('teacher_id, leave_date, duration_minutes')
      .gte('leave_date', startDate)
      .lte('leave_date', endDate),
    supabase
      .from('student_attendances')
      .select(
        'id, student_id, classroom_id, schedule_id, attendance_date, status, student:students(id, full_name, nis, nisn), classroom:classrooms(id, name), schedule:schedules(id, subject_id, teacher_id, subject:subjects(id, name), teacher:teachers_staff(id, full_name))'
      )
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate),
    supabase.from('classrooms').select('id, name').order('name'),
    supabase.from('subjects').select('id, name, code').order('name'),
    supabase.from('teachers_staff').select('id, full_name, nip').eq('is_active', true).order('full_name'),
    supabase.from('schedules').select('teacher_id, day_of_week'),
    supabase.from('picket_schedules').select('teacher_id, day_of_week'),
    supabase
      .from('academic_calendar_events')
      .select('event_date, category')
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .in('category', ['LIBUR_BERBAYAR', 'LIBUR_TIDAK_BERBAYAR']),
  ]);

  // Hitung jumlah kemunculan setiap hari (1=Senin..6=Sabtu) pada rentang tanggal di luar hari libur kalender
  const holidaySet = new Set((calendarHolidays || []).map((h) => String(h.event_date)));
  const dayCountInRange = new Map<number, number>();
  const startDt = new Date(`${startDate}T00:00:00Z`);
  const endDt = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isNaN(startDt.getTime()) && !Number.isNaN(endDt.getTime()) && startDt <= endDt) {
    const cursor = new Date(startDt);
    let safety = 0;
    while (cursor <= endDt && safety < 400) {
      const iso = cursor.toISOString().slice(0, 10);
      const utcDay = cursor.getUTCDay();
      const isoDay = utcDay === 0 ? 7 : utcDay;
      if (isoDay !== 7 && !holidaySet.has(iso)) {
        dayCountInRange.set(isoDay, (dayCountInRange.get(isoDay) || 0) + 1);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      safety++;
    }
  }

  const teacherScheduledDaysMap = new Map<string, Set<number>>();
  for (const s of [...(teacherSchedules || []), ...(teacherPickets || [])]) {
    if (!s.teacher_id || !s.day_of_week) continue;
    if (!teacherScheduledDaysMap.has(s.teacher_id)) {
      teacherScheduledDaysMap.set(s.teacher_id, new Set());
    }
    teacherScheduledDaysMap.get(s.teacher_id)!.add(Number(s.day_of_week));
  }

  const isGlobalRecapViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
    'GURU_BK',
  ]);
  const ta = guard.session.teacherAssignments;
  const myTeacherId = ta?.teacherId || null;
  const homeroomSet = new Set(ta?.homeroomClassroomIds || []);
  const taughtClassSet = new Set(ta?.taughtClassroomIds || []);
  const taughtSubjectSet = new Set(ta?.taughtSubjectIds || []);
  const guruWaliStudentSet = new Set(ta?.guruWaliStudentIds || []);

  // 1. Rekap Absensi Guru
  const leaveMap = new Map<string, number>();
  for (const sl of shortLeaves || []) {
    leaveMap.set(sl.teacher_id, (leaveMap.get(sl.teacher_id) || 0) + Number(sl.duration_minutes || 0));
  }

  const teacherMap = new Map<
    string,
    {
      teacher_id: string;
      full_name: string;
      nip: string | null;
      dates: Set<string>;
      teaching_sessions: number;
      picket_sessions: number;
      exam_sessions: number;
      event_sessions: number;
      confirmed_sessions: number;
      total_jtm: number;
    }
  >();

  for (const row of teacherAtts || []) {
    if (!isGlobalRecapViewer && (!myTeacherId || row.teacher_id !== myTeacherId)) continue;
    if (teacherId && row.teacher_id !== teacherId) continue;
    const tObj = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
    if (!teacherMap.has(row.teacher_id)) {
      teacherMap.set(row.teacher_id, {
        teacher_id: row.teacher_id,
        full_name: tObj?.full_name || 'Guru',
        nip: tObj?.nip || null,
        dates: new Set(),
        teaching_sessions: 0,
        picket_sessions: 0,
        exam_sessions: 0,
        event_sessions: 0,
        confirmed_sessions: 0,
        total_jtm: 0,
      });
    }
    const acc = teacherMap.get(row.teacher_id)!;
    acc.dates.add(row.attendance_date);
    if (row.attendance_type === 'MENGAJAR') acc.teaching_sessions++;
    else if (row.attendance_type === 'PIKET') acc.picket_sessions++;
    else if (row.attendance_type === 'PENGAWAS_UJIAN' || row.attendance_type === 'PANITIA_UJIAN') {
      acc.exam_sessions++;
    } else if (row.attendance_type === 'ACARA' || row.attendance_type === 'UPACARA') {
      acc.event_sessions++;
    }
    if (row.admin_confirmed) acc.confirmed_sessions++;
    acc.total_jtm += Number(row.jtm_earned || 0);
  }

  const teacherRecap = Array.from(teacherMap.values())
    .map((t) => {
      const scheduledDays = teacherScheduledDaysMap.get(t.teacher_id);
      let expectedDays = 0;
      if (scheduledDays && scheduledDays.size > 0) {
        for (const d of scheduledDays) {
          expectedDays += dayCountInRange.get(d) || 0;
        }
      }
      const avgPresencePct =
        expectedDays > 0
          ? Math.min(100, Math.round((t.dates.size / expectedDays) * 1000) / 10)
          : null;

      return {
        teacher_id: t.teacher_id,
        full_name: t.full_name,
        nip: t.nip,
        total_days_present: t.dates.size,
        teaching_sessions: t.teaching_sessions,
        picket_sessions: t.picket_sessions,
        exam_sessions: t.exam_sessions,
        event_sessions: t.event_sessions,
        confirmed_sessions: t.confirmed_sessions,
        total_jtm: Number(t.total_jtm.toFixed(2)),
        total_short_leave_minutes: leaveMap.get(t.teacher_id) || 0,
        avg_presence_pct: avgPresencePct,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // 2 & 3. Rekap Absensi Siswa Harian (schedule_id IS NULL) & Per Mapel (schedule_id IS NOT NULL)
  const dailyMap = new Map<
    string,
    {
      student_id: string;
      full_name: string;
      nis: string | null;
      nisn: string | null;
      classroom_id: string;
      classroom_name: string;
      hadir: number;
      sakit: number;
      izin: number;
      alpa: number;
    }
  >();

  const subjectMap = new Map<
    string,
    {
      key: string;
      student_id: string;
      full_name: string;
      nis: string | null;
      classroom_id: string;
      classroom_name: string;
      subject_id: string;
      subject_name: string;
      teacher_id: string;
      teacher_name: string;
      hadir: number;
      sakit: number;
      izin: number;
      alpa: number;
    }
  >();

  for (const row of studentAtts || []) {
    if (classroomId && row.classroom_id !== classroomId) continue;

    const stObj = Array.isArray(row.student) ? row.student[0] : row.student;
    const clsObj = Array.isArray(row.classroom) ? row.classroom[0] : row.classroom;

    if (!row.schedule_id) {
      if (
        !isGlobalRecapViewer &&
        !ta?.isPicketTeacher &&
        !homeroomSet.has(row.classroom_id) &&
        !guruWaliStudentSet.has(row.student_id)
      ) {
        continue;
      }
      const key = `${row.student_id}::${row.classroom_id}`;
      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          student_id: row.student_id,
          full_name: stObj?.full_name || 'Siswa',
          nis: stObj?.nis || null,
          nisn: stObj?.nisn || null,
          classroom_id: row.classroom_id,
          classroom_name: clsObj?.name || '-',
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
        });
      }
      const d = dailyMap.get(key)!;
      if (row.status === 'HADIR') d.hadir++;
      else if (row.status === 'SAKIT') d.sakit++;
      else if (row.status === 'IZIN') d.izin++;
      else if (row.status === 'ALPA') d.alpa++;
    } else {
      const schObj = Array.isArray(row.schedule) ? row.schedule[0] : row.schedule;
      const subObj = schObj?.subject
        ? Array.isArray(schObj.subject)
          ? schObj.subject[0]
          : schObj.subject
        : null;
      const tchrObj = schObj?.teacher
        ? Array.isArray(schObj.teacher)
          ? schObj.teacher[0]
          : schObj.teacher
        : null;

      const rowSubjectId = schObj?.subject_id || subObj?.id || 'UNKNOWN';
      const rowTeacherId = schObj?.teacher_id || tchrObj?.id || 'UNKNOWN';
      if (
        !isGlobalRecapViewer &&
        (!myTeacherId || (rowTeacherId !== myTeacherId && !homeroomSet.has(row.classroom_id)))
      ) {
        continue;
      }
      if (subjectId && rowSubjectId !== subjectId) continue;
      if (teacherId && rowTeacherId !== teacherId) continue;

      const key = `${row.student_id}::${row.classroom_id}::${rowSubjectId}::${rowTeacherId}`;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          key,
          student_id: row.student_id,
          full_name: stObj?.full_name || 'Siswa',
          nis: stObj?.nis || null,
          classroom_id: row.classroom_id,
          classroom_name: clsObj?.name || '-',
          subject_id: rowSubjectId,
          subject_name: subObj?.name || 'Mata Pelajaran',
          teacher_id: rowTeacherId,
          teacher_name: tchrObj?.full_name || '-',
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
        });
      }
      const s = subjectMap.get(key)!;
      if (row.status === 'HADIR') s.hadir++;
      else if (row.status === 'SAKIT') s.sakit++;
      else if (row.status === 'IZIN') s.izin++;
      else if (row.status === 'ALPA') s.alpa++;
    }
  }

  const dailyStudentRecap = Array.from(dailyMap.values())
    .map((d) => {
      const total = d.hadir + d.sakit + d.izin + d.alpa;
      return {
        ...d,
        total,
        presence_pct: total > 0 ? Math.round((d.hadir / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => a.classroom_name.localeCompare(b.classroom_name) || a.full_name.localeCompare(b.full_name));

  const subjectStudentRecap = Array.from(subjectMap.values())
    .map((s) => {
      const total = s.hadir + s.sakit + s.izin + s.alpa;
      return {
        ...s,
        total,
        presence_pct: total > 0 ? Math.round((s.hadir / total) * 1000) / 10 : 0,
      };
    })
    .sort(
      (a, b) =>
        a.classroom_name.localeCompare(b.classroom_name) ||
        a.subject_name.localeCompare(b.subject_name) ||
        a.full_name.localeCompare(b.full_name)
    );

  const allowedFilterClassIds = new Set([...homeroomSet, ...taughtClassSet]);
  const scopedFilterClassrooms =
    isGlobalRecapViewer || ta?.isPicketTeacher
      ? classrooms || []
      : (classrooms || []).filter((c) => allowedFilterClassIds.has(c.id));

  const scopedFilterSubjects = isGlobalRecapViewer
    ? subjects || []
    : (subjects || []).filter((s) => taughtSubjectSet.has(s.id) || homeroomSet.size > 0);

  const scopedFilterTeachers = !isGlobalRecapViewer
    ? myTeacherId
      ? (teachers || []).filter((t) => t.id === myTeacherId)
      : []
    : teachers || [];

  return NextResponse.json({
    startDate,
    endDate,
    teacherRecap,
    dailyStudentRecap,
    subjectStudentRecap,
    filters: {
      classrooms: scopedFilterClassrooms,
      subjects: scopedFilterSubjects,
      teachers: scopedFilterTeachers,
    },
  });
}
