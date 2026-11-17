import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { verifyGeofence } from '@/lib/domain/geofence';
import { calculateLateJtm, getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';

const StudentAttendanceSchema = z.object({
  action: z.literal('STUDENT_ATTENDANCE'),
  picket_attendance_id: z.string().uuid(),
  student_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional().nullable(),
  attendance_date: z.string().optional(),
  status: z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPA']),
  notes: z.string().optional().nullable(),
});

const TeacherAttendanceSchema = z.object({
  action: z.literal('TEACHER_ATTENDANCE'),
  teacher_id: z.string().uuid(),
  attendance_type: z.enum(['HARIAN', 'MENGAJAR', 'PIKET', 'PENGAWAS_UJIAN', 'PANITIA_UJIAN']),
  schedule_id: z.string().uuid().optional().nullable(),
  delegation_id: z.string().uuid().optional().nullable(),
  exam_supervisor_id: z.string().uuid().optional().nullable(),
  exam_committee_id: z.string().uuid().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const SubmitJournalSchema = z.object({
  action: z.literal('SUBMIT_JOURNAL'),
  session_confirmation_id: z.string().uuid().optional().nullable(),
  attendance_id: z.string().uuid().optional().nullable(),
  topic: z.string().min(3, 'Topik/materi pembelajaran minimal 3 karakter.'),
  learning_activities: z.string().optional().nullable(),
  present_students_count: z.number().min(0).default(0),
  absent_students_count: z.number().min(0).default(0),
  student_attendance_notes: z.string().optional().nullable(),
  jtm_fallback: z.number().min(1).max(12).optional().default(2),
});

const ConfirmScheduleSessionSchema = z.object({
  action: z.literal('CONFIRM_SCHEDULE_SESSION'),
  session_type: z.enum(['MENGAJAR', 'PENGAWAS_UJIAN']),
  session_date: z.string(),
  teacher_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional().nullable(),
  delegation_id: z.string().uuid().optional().nullable(),
  exam_supervisor_id: z.string().uuid().optional().nullable(),
  picket_attendance_id: z.string().uuid().optional().nullable(),
  committee_attendance_id: z.string().uuid().optional().nullable(),
  approved_jtm: z.number().min(0).max(24).optional().nullable(),
  diff_recipient_teacher_id: z.string().uuid().optional().nullable(),
  diff_reason: z.string().optional().nullable(),
});

const ConfirmAttendanceSchema = z.object({
  action: z.literal('CONFIRM_ATTENDANCE'),
  attendance_id: z.string().uuid(),
  picket_jtm: z.number().min(0).max(24).optional(),
  picket_attendance_id: z.string().uuid().optional().nullable(),
  committee_attendance_id: z.string().uuid().optional().nullable(),
  approved_jtm: z.number().min(0).max(24).optional().nullable(),
  diff_recipient_teacher_id: z.string().uuid().optional().nullable(),
  diff_reason: z.string().optional().nullable(),
});

const SubmitPicketReportSchema = z.object({
  action: z.literal('SUBMIT_PICKET_REPORT'),
  attendance_id: z.string().uuid(),
  summary: z.string().min(5, 'Ringkasan laporan piket minimal 5 karakter.'),
  late_students_notes: z.string().optional().nullable(),
  teacher_substitution_notes: z.string().optional().nullable(),
  incidents: z.string().optional().nullable(),
});

const DelegationSchema = z.object({
  action: z.literal('CREATE_DELEGATION'),
  picket_attendance_id: z.string().uuid(),
  delegation_date: z.string(),
  delegation_type: z.enum(['MENGAJAR', 'PIKET']).default('MENGAJAR'),
  original_teacher_id: z.string().uuid(),
  substitute_teacher_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional().nullable(),
  jtm_transferred: z.number().min(1).max(12).default(2),
  reason: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.AKADEMIK);
  if (guard.errorResponse) return guard.errorResponse;

  const canAdminConfirm = hasAnyRole(guard.session, ROLE_GROUPS.ADMIN_CONFIRM);

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      studentAttendances: [],
      teacherAttendances: [],
      delegations: [],
      journals: [],
      picketReports: [],
      sessionConfirmations: [],
      schedules: [],
      students: [],
      classrooms: [],
      examSupervisors: [],
      examCommittees: [],
      todayDate: getWibTodayDateString(),
      geofenceConfig: { enabled: true, latitude: -6.2, longitude: 106.816666, radiusMeters: 100 },
      canAdminConfirm,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: studentAtt },
    { data: teacherAtt },
    { data: delegations },
    { data: journals },
    { data: picketReports },
    { data: sessionConfirmations },
    { data: schedules },
    { data: students },
    { data: classrooms },
    { data: examSupervisors },
    { data: examCommittees },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from('student_attendances')
      .select('*, student:students(full_name), classroom:classrooms(name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('teacher_attendances')
      .select(
        '*, teacher:teachers_staff(full_name), schedule:schedules(classroom_id, day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name)), delegation:teacher_delegations(jtm_transferred)'
      )
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('teacher_delegations')
      .select(
        '*, original:teachers_staff!teacher_delegations_original_teacher_id_fkey(full_name), substitute:teachers_staff!teacher_delegations_substitute_teacher_id_fkey(full_name), schedule:schedules(classroom_id, day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name))'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('teaching_journals')
      .select(
        '*, teacher:teachers_staff(full_name), schedule:schedules(day_of_week, classroom:classrooms(name), subject:subjects(name))'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('picket_daily_reports')
      .select('*, teacher:teachers_staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('schedule_session_confirmations')
      .select(
        '*, teacher:teachers_staff(full_name), schedule:schedules(day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name)), delegation:teacher_delegations(jtm_transferred, reason, original:teachers_staff!teacher_delegations_original_teacher_id_fkey(full_name)), exam_supervisor:exam_supervisors(exam_date, session_name, jtm_allocated)'
      )
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('schedules')
      .select('id, teacher_id, classroom_id, day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name), teacher:teachers_staff(full_name)')
      .order('day_of_week')
      .limit(200),
    supabase.from('students').select('id, full_name, nis').eq('status', 'AKTIF').order('full_name').limit(300),
    supabase.from('classrooms').select('id, name').order('name').limit(100),
    supabase
      .from('exam_supervisors')
      .select('id, teacher_id, exam_date, session_name, subject_name, jtm_allocated, teacher:teachers_staff(full_name), room:exam_rooms(room_name)')
      .order('exam_date', { ascending: false })
      .limit(100),
    supabase
      .from('exam_committees')
      .select('id, teacher_id, committee_role, jtm_allocated, teacher:teachers_staff(full_name), period:exam_periods(name)')
      .limit(100),
    supabase
      .from('institution_settings')
      .select('geofence_enabled, geofence_lat, geofence_lng, geofence_radius_meters')
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    studentAttendances: studentAtt || [],
    teacherAttendances: teacherAtt || [],
    delegations: delegations || [],
    journals: journals || [],
    picketReports: picketReports || [],
    sessionConfirmations: sessionConfirmations || [],
    schedules: schedules || [],
    students: students || [],
    classrooms: classrooms || [],
    examSupervisors: examSupervisors || [],
    examCommittees: examCommittees || [],
    todayDate: getWibTodayDateString(),
    geofenceConfig: {
      enabled: settings?.geofence_enabled ?? true,
      latitude: settings?.geofence_lat ?? -6.2,
      longitude: settings?.geofence_lng ?? 106.816666,
      radiusMeters: settings?.geofence_radius_meters ?? 100,
    },
    canAdminConfirm,
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

    if (body.action === 'STUDENT_ATTENDANCE') {
      const parsed = StudentAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              'Data presensi siswa tidak valid. Pilih presensi Guru Piket / Pengganti terkonfirmasi Admin.',
          },
          { status: 400 }
        );
      }

      const {
        picket_attendance_id,
        student_id,
        classroom_id,
        schedule_id,
        attendance_date,
        status,
        notes,
      } = parsed.data;

      const { data: picketAtt } = await supabase
        .from('teacher_attendances')
        .select('id, attendance_type, attendance_date, is_within_geofence, admin_confirmed')
        .eq('id', picket_attendance_id)
        .maybeSingle();

      if (
        !picketAtt ||
        picketAtt.attendance_type !== 'PIKET' ||
        !picketAtt.is_within_geofence ||
        !picketAtt.admin_confirmed
      ) {
        return NextResponse.json(
          {
            error:
              'Hanya Guru Piket / Guru Piket Pengganti yang kehadirannya sudah dikonfirmasi Admin yang dapat melakukan absensi siswa.',
          },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from('student_attendances')
        .insert({
          student_id,
          classroom_id,
          schedule_id: schedule_id || null,
          attendance_date: attendance_date || picketAtt.attendance_date,
          status,
          notes: notes || null,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attendance: data });
    }

    if (body.action === 'TEACHER_ATTENDANCE') {
      const parsed = TeacherAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data presensi guru tidak valid.' }, { status: 400 });
      }

      if (
        parsed.data.attendance_type === 'PENGAWAS_UJIAN' &&
        !parsed.data.exam_supervisor_id
      ) {
        return NextResponse.json(
          { error: 'Pilih jadwal tugas Pengawas Ujian terlebih dahulu.' },
          { status: 400 }
        );
      }

      if (
        parsed.data.attendance_type === 'PANITIA_UJIAN' &&
        !parsed.data.exam_committee_id
      ) {
        return NextResponse.json(
          { error: 'Pilih penugasan Panitia Ujian terlebih dahulu.' },
          { status: 400 }
        );
      }

      const { data: settings } = await supabase
        .from('institution_settings')
        .select('geofence_enabled, geofence_lat, geofence_lng, geofence_radius_meters')
        .limit(1)
        .maybeSingle();

      const geofenceEnabled = settings?.geofence_enabled ?? true;
      const schoolLat = settings?.geofence_lat ?? -6.2;
      const schoolLng = settings?.geofence_lng ?? 106.816666;
      const radius = settings?.geofence_radius_meters ?? 100;

      let geoResult = {
        enabled: geofenceEnabled,
        distanceMeters: 0,
        isWithinGeofence: true,
        radiusMeters: radius,
      };

      if (geofenceEnabled) {
        if (parsed.data.latitude == null || parsed.data.longitude == null) {
          return NextResponse.json(
            { error: 'Koordinat GPS lokasi wajib disertakan karena fitur geofencing aktif.' },
            { status: 400 }
          );
        }

        const geo = verifyGeofence(
          { lat: parsed.data.latitude, lng: parsed.data.longitude },
          { lat: schoolLat, lng: schoolLng },
          radius
        );

        if (!geo.isWithinGeofence) {
          return NextResponse.json(
            {
              code: 'OUTSIDE_GEOFENCE',
              error: `Absensi geofencing hanya bisa dilakukan di dalam radius yang diizinkan (${geo.radiusMeters} m). Posisi Anda berjarak ${geo.distanceMeters} m dari titik lembaga.`,
              geofence: {
                ...geo,
                schoolLat,
                schoolLng,
                teacherLat: parsed.data.latitude,
                teacherLng: parsed.data.longitude,
              },
            },
            { status: 403 }
          );
        }

        geoResult = {
          enabled: true,
          distanceMeters: geo.distanceMeters,
          isWithinGeofence: true,
          radiusMeters: geo.radiusMeters,
        };
      }

      const todayDate = getWibTodayDateString();
      if (['HARIAN', 'MENGAJAR', 'PENGAWAS_UJIAN'].includes(parsed.data.attendance_type)) {
        const { data: existingToday } = await supabase
          .from('teacher_attendances')
          .select('id, attendance_type')
          .eq('teacher_id', parsed.data.teacher_id)
          .eq('attendance_date', todayDate)
          .eq('is_within_geofence', true)
          .in('attendance_type', ['HARIAN', 'MENGAJAR', 'PENGAWAS_UJIAN'])
          .limit(1)
          .maybeSingle();

        if (existingToday) {
          return NextResponse.json(
            {
              error:
                'Guru/pengawas ini sudah melakukan presensi geofencing hari ini. Presensi geofencing cukup 1x per hari; silakan langsung konfirmasi kehadiran pada masing-masing jadwalnya.',
            },
            { status: 400 }
          );
        }
      }

      // JTM tidak langsung dihitung saat presensi (jtm_earned = 0);
      // dihitung setelah Konfirmasi Per Jadwal & Jurnal Pembelajaran / BAP, atau Konfirmasi Admin (PIKET/PANITIA_UJIAN).
      const { data, error } = await supabase
        .from('teacher_attendances')
        .insert({
          teacher_id: parsed.data.teacher_id,
          attendance_date: todayDate,
          attendance_type: parsed.data.attendance_type,
          schedule_id: parsed.data.schedule_id || null,
          delegation_id: parsed.data.delegation_id || null,
          exam_supervisor_id: parsed.data.exam_supervisor_id || null,
          exam_committee_id: parsed.data.exam_committee_id || null,
          jtm_earned: 0,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
          distance_meters: geoResult.distanceMeters,
          is_within_geofence: true,
          admin_confirmed: false,
          status: 'HADIR',
          notes: parsed.data.notes || null,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attendance: data, geofence: geoResult });
    }

    if (body.action === 'SUBMIT_JOURNAL') {
      const parsed = SubmitJournalSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data jurnal pembelajaran tidak valid.' },
          { status: 400 }
        );
      }

      if (parsed.data.session_confirmation_id) {
        const { data: conf, error: confErr } = await supabase
          .from('schedule_session_confirmations')
          .select('*')
          .eq('id', parsed.data.session_confirmation_id)
          .single();

        if (confErr || !conf || conf.session_type !== 'MENGAJAR') {
          return NextResponse.json(
            {
              error:
                'Kehadiran pada jadwal mengajar ini belum dikonfirmasi oleh Admin atau Guru Piket/Piket Pengganti.',
            },
            { status: 403 }
          );
        }

        const { data: existingJournal } = await supabase
          .from('teaching_journals')
          .select('id')
          .eq('session_confirmation_id', conf.id)
          .maybeSingle();

        if (existingJournal) {
          return NextResponse.json(
            { error: 'Jurnal pembelajaran untuk jadwal ini sudah pernah diinput.' },
            { status: 400 }
          );
        }

        const baseJtm = Number(conf.approved_jtm ?? conf.expected_jtm ?? parsed.data.jtm_fallback);
        const lateCalc = calculateLateJtm(baseJtm, conf.session_date);
        if (!lateCalc.allowed) {
          return NextResponse.json({ error: lateCalc.reason }, { status: 400 });
        }

        const jtmCredited = lateCalc.creditedJtm;
        const { data: journal, error: journalErr } = await supabase
          .from('teaching_journals')
          .insert({
            teacher_id: conf.teacher_id,
            attendance_id: conf.daily_attendance_id,
            session_confirmation_id: conf.id,
            schedule_id: conf.schedule_id || null,
            delegation_id: conf.delegation_id || null,
            journal_date: conf.session_date,
            topic: parsed.data.topic.trim(),
            learning_activities: parsed.data.learning_activities?.trim() || null,
            present_students_count: parsed.data.present_students_count,
            absent_students_count: parsed.data.absent_students_count,
            student_attendance_notes: parsed.data.student_attendance_notes?.trim() || null,
            jtm_credited: jtmCredited,
            delay_days: lateCalc.delayDays,
            jtm_percentage: lateCalc.percentage,
            created_by: guard.session.userId,
          })
          .select('*')
          .single();

        if (journalErr || !journal) {
          return NextResponse.json(
            { error: journalErr?.message || 'Gagal menyimpan jurnal pembelajaran.' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          journal,
          jtmCredited,
          delayDays: lateCalc.delayDays,
          percentage: lateCalc.percentage,
        });
      }

      if (!parsed.data.attendance_id) {
        return NextResponse.json(
          { error: 'Pilih jadwal mengajar yang sudah dikonfirmasi terlebih dahulu.' },
          { status: 400 }
        );
      }

      const { data: att, error: attErr } = await supabase
        .from('teacher_attendances')
        .select('*')
        .eq('id', parsed.data.attendance_id)
        .single();

      if (attErr || !att) {
        return NextResponse.json({ error: 'Data presensi tidak ditemukan.' }, { status: 404 });
      }
      if (att.attendance_type !== 'MENGAJAR') {
        return NextResponse.json(
          { error: 'Jurnal pembelajaran hanya untuk presensi tipe MENGAJAR.' },
          { status: 400 }
        );
      }
      if (!att.is_within_geofence) {
        return NextResponse.json(
          { error: 'Presensi berada di luar radius geofencing.' },
          { status: 400 }
        );
      }
      if (!att.admin_confirmed) {
        return NextResponse.json(
          {
            error:
              'Kehadiran mengajar Anda belum dikonfirmasi oleh Admin atau Guru Piket/Piket Pengganti. Jurnal Pembelajaran hanya dapat diisi setelah kehadiran dikonfirmasi.',
          },
          { status: 403 }
        );
      }

      const { data: existingJournal } = await supabase
        .from('teaching_journals')
        .select('id')
        .eq('attendance_id', att.id)
        .maybeSingle();

      if (existingJournal) {
        return NextResponse.json(
          { error: 'Jurnal pembelajaran untuk presensi ini sudah pernah diinput.' },
          { status: 400 }
        );
      }

      let baseJtm = parsed.data.jtm_fallback;
      if (att.approved_jtm != null) {
        baseJtm = Number(att.approved_jtm);
      } else if (att.delegation_id) {
        const { data: delRow } = await supabase
          .from('teacher_delegations')
          .select('jtm_transferred')
          .eq('id', att.delegation_id)
          .maybeSingle();
        if (delRow?.jtm_transferred) {
          baseJtm = delRow.jtm_transferred;
        }
      } else if (att.schedule_id) {
        const { data: schedRow } = await supabase
          .from('schedules')
          .select('jtm_count')
          .eq('id', att.schedule_id)
          .maybeSingle();
        if (schedRow?.jtm_count) {
          baseJtm = schedRow.jtm_count;
        }
      }

      const lateCalc = calculateLateJtm(baseJtm, att.attendance_date);
      if (!lateCalc.allowed) {
        return NextResponse.json({ error: lateCalc.reason }, { status: 400 });
      }

      const jtmCredited = lateCalc.creditedJtm;

      const { data: journal, error: journalErr } = await supabase
        .from('teaching_journals')
        .insert({
          teacher_id: att.teacher_id,
          attendance_id: att.id,
          schedule_id: att.schedule_id || null,
          delegation_id: att.delegation_id || null,
          journal_date: att.attendance_date,
          topic: parsed.data.topic.trim(),
          learning_activities: parsed.data.learning_activities?.trim() || null,
          present_students_count: parsed.data.present_students_count,
          absent_students_count: parsed.data.absent_students_count,
          student_attendance_notes: parsed.data.student_attendance_notes?.trim() || null,
          jtm_credited: jtmCredited,
          delay_days: lateCalc.delayDays,
          jtm_percentage: lateCalc.percentage,
          created_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (journalErr || !journal) {
        return NextResponse.json(
          { error: journalErr?.message || 'Gagal menyimpan jurnal pembelajaran.' },
          { status: 500 }
        );
      }

      await supabase
        .from('teacher_attendances')
        .update({ jtm_earned: jtmCredited })
        .eq('id', att.id);

      return NextResponse.json({
        journal,
        jtmCredited,
        delayDays: lateCalc.delayDays,
        percentage: lateCalc.percentage,
      });
    }

    if (body.action === 'CONFIRM_ATTENDANCE') {
      const parsed = ConfirmAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID presensi tidak valid.' }, { status: 400 });
      }

      const { data: att } = await supabase
        .from('teacher_attendances')
        .select(
          'id, teacher_id, attendance_type, attendance_date, schedule_id, delegation_id, exam_supervisor_id, exam_committee_id, picket_schedule_id, is_within_geofence'
        )
        .eq('id', parsed.data.attendance_id)
        .single();

      if (!att) {
        return NextResponse.json({ error: 'Data presensi tidak ditemukan.' }, { status: 404 });
      }
      if (!['PIKET', 'PANITIA_UJIAN', 'MENGAJAR', 'PENGAWAS_UJIAN'].includes(att.attendance_type)) {
        return NextResponse.json(
          { error: 'Tipe presensi ini tidak memerlukan konfirmasi.' },
          { status: 400 }
        );
      }
      if (!att.is_within_geofence) {
        return NextResponse.json(
          { error: 'Presensi tidak berada dalam radius geofencing yang valid.' },
          { status: 400 }
        );
      }

      const isAdmin = hasAnyRole(guard.session, ROLE_GROUPS.ADMIN_CONFIRM);
      let confirmedByRole: 'ADMIN' | 'GURU_PIKET' | 'PANITIA_UJIAN' = 'ADMIN';
      let confirmedByAttendanceId: string | null = null;

      if (att.attendance_type === 'PIKET' || att.attendance_type === 'PANITIA_UJIAN') {
        if (!isAdmin) {
          return NextResponse.json(
            { error: 'Hanya Admin / Operator / Pimpinan / TU yang dapat mengonfirmasi Guru Piket atau Panitia Ujian.' },
            { status: 403 }
          );
        }
      } else if (att.attendance_type === 'MENGAJAR') {
        if (parsed.data.picket_attendance_id) {
          const { data: picketAtt } = await supabase
            .from('teacher_attendances')
            .select('id, attendance_type, attendance_date, is_within_geofence, admin_confirmed')
            .eq('id', parsed.data.picket_attendance_id)
            .maybeSingle();

          if (
            !picketAtt ||
            picketAtt.attendance_type !== 'PIKET' ||
            !picketAtt.is_within_geofence ||
            !picketAtt.admin_confirmed ||
            picketAtt.attendance_date !== att.attendance_date
          ) {
            return NextResponse.json(
              {
                error:
                  'Guru Piket / Piket Pengganti belum dikonfirmasi Admin pada tanggal mengajar tersebut.',
              },
              { status: 403 }
            );
          }
          confirmedByRole = 'GURU_PIKET';
          confirmedByAttendanceId = picketAtt.id;
        } else if (!isAdmin) {
          return NextResponse.json(
            {
              error:
                'Kehadiran guru mengajar hanya dapat dikonfirmasi oleh Admin atau Guru Piket/Piket Pengganti yang sudah dikonfirmasi Admin.',
            },
            { status: 403 }
          );
        }
      } else if (att.attendance_type === 'PENGAWAS_UJIAN') {
        if (parsed.data.committee_attendance_id) {
          const { data: comAtt } = await supabase
            .from('teacher_attendances')
            .select('id, attendance_type, is_within_geofence, admin_confirmed')
            .eq('id', parsed.data.committee_attendance_id)
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
                  'Panitia Ujian / Panitia Pengganti belum dikonfirmasi Admin.',
              },
              { status: 403 }
            );
          }
          confirmedByRole = 'PANITIA_UJIAN';
          confirmedByAttendanceId = comAtt.id;
        } else if (!isAdmin) {
          return NextResponse.json(
            {
              error:
                'Kehadiran Pengawas Ujian hanya dapat dikonfirmasi oleh Admin atau Panitia Ujian/Panitia Pengganti yang sudah dikonfirmasi Admin.',
            },
            { status: 403 }
          );
        }
      }

      const updateFields: Record<string, unknown> = {
        admin_confirmed: true,
        confirmed_by: guard.session.userId,
        confirmed_by_role: confirmedByRole,
        confirmed_by_attendance_id: confirmedByAttendanceId,
        confirmed_at: new Date().toISOString(),
      };

      if (
        ['MENGAJAR', 'PENGAWAS_UJIAN', 'PIKET', 'PANITIA_UJIAN'].includes(att.attendance_type) &&
        parsed.data.approved_jtm != null
      ) {
        updateFields.approved_jtm = parsed.data.approved_jtm;
      }

      if (att.attendance_type === 'PIKET' && parsed.data.approved_jtm == null) {
        let picketJtm = parsed.data.picket_jtm ?? 2;
        if (att.delegation_id) {
          const { data: delRow } = await supabase
            .from('teacher_delegations')
            .select('jtm_transferred')
            .eq('id', att.delegation_id)
            .maybeSingle();
          if (delRow?.jtm_transferred != null) {
            picketJtm = Number(delRow.jtm_transferred);
          }
        } else if (att.picket_schedule_id) {
          const { data: psRow } = await supabase
            .from('picket_schedules')
            .select('jtm_allocated')
            .eq('id', att.picket_schedule_id)
            .maybeSingle();
          if (psRow?.jtm_allocated != null) {
            picketJtm = Number(psRow.jtm_allocated);
          }
        }
        updateFields.approved_jtm = picketJtm;
      }

      if (att.attendance_type === 'PANITIA_UJIAN' && parsed.data.approved_jtm == null && att.exam_committee_id) {
        const { data: comRow } = await supabase
          .from('exam_committees')
          .select('jtm_allocated')
          .eq('id', att.exam_committee_id)
          .maybeSingle();
        if (comRow?.jtm_allocated != null) {
          updateFields.approved_jtm = Number(comRow.jtm_allocated);
        }
      }

      const { data: updated, error: updErr } = await supabase
        .from('teacher_attendances')
        .update(updateFields)
        .eq('id', att.id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      // Alokasi selisih JTM jika ada penyesuaian JTM (approved_jtm < expectedJtm)
      let allocatedDiffJtm = 0;
      if (
        parsed.data.diff_recipient_teacher_id &&
        parsed.data.approved_jtm != null &&
        ['MENGAJAR', 'PENGAWAS_UJIAN', 'PIKET', 'PANITIA_UJIAN'].includes(att.attendance_type)
      ) {
        if (parsed.data.diff_recipient_teacher_id === att.teacher_id) {
          return NextResponse.json(
            { error: 'Penerima selisih JTM tidak boleh sama dengan guru/pengawas/panitia yang bersangkutan.' },
            { status: 400 }
          );
        }

        if (att.attendance_type === 'MENGAJAR') {
          let expectedJtm = 2;
          if (att.delegation_id) {
            const { data: delRow } = await supabase
              .from('teacher_delegations')
              .select('jtm_transferred')
              .eq('id', att.delegation_id)
              .maybeSingle();
            if (delRow?.jtm_transferred != null) expectedJtm = Number(delRow.jtm_transferred);
          } else if (att.schedule_id) {
            const { data: schedRow } = await supabase
              .from('schedules')
              .select('jtm_count')
              .eq('id', att.schedule_id)
              .maybeSingle();
            if (schedRow?.jtm_count != null) expectedJtm = Number(schedRow.jtm_count);
          }

          const diffJtm = Math.max(0, Number((expectedJtm - parsed.data.approved_jtm).toFixed(2)));
          if (diffJtm > 0) {
            await supabase.from('teacher_delegations').insert({
              delegation_date: att.attendance_date,
              delegation_type: 'MENGAJAR',
              original_teacher_id: att.teacher_id,
              substitute_teacher_id: parsed.data.diff_recipient_teacher_id,
              schedule_id: att.schedule_id || null,
              jtm_transferred: Math.round(diffJtm),
              reason:
                parsed.data.diff_reason?.trim() ||
                `Alokasi selisih JTM (${diffJtm} JTM dari ${expectedJtm} JTM)`,
              status: 'APPROVED',
              created_by: guard.session.userId,
            });
            allocatedDiffJtm = diffJtm;
          }
        } else if (att.attendance_type === 'PIKET') {
          let expectedJtm = 2;
          if (att.delegation_id) {
            const { data: delRow } = await supabase
              .from('teacher_delegations')
              .select('jtm_transferred')
              .eq('id', att.delegation_id)
              .maybeSingle();
            if (delRow?.jtm_transferred != null) expectedJtm = Number(delRow.jtm_transferred);
          } else if (att.picket_schedule_id) {
            const { data: psRow } = await supabase
              .from('picket_schedules')
              .select('jtm_allocated')
              .eq('id', att.picket_schedule_id)
              .maybeSingle();
            if (psRow?.jtm_allocated != null) expectedJtm = Number(psRow.jtm_allocated);
          }

          const diffJtm = Math.max(0, Number((expectedJtm - parsed.data.approved_jtm).toFixed(2)));
          if (diffJtm > 0) {
            await supabase.from('teacher_delegations').insert({
              delegation_date: att.attendance_date,
              delegation_type: 'PIKET',
              original_teacher_id: att.teacher_id,
              substitute_teacher_id: parsed.data.diff_recipient_teacher_id,
              picket_schedule_id: att.picket_schedule_id || null,
              jtm_transferred: Math.round(diffJtm),
              reason:
                parsed.data.diff_reason?.trim() ||
                `Alokasi selisih JTM Piket (${diffJtm} JTM dari ${expectedJtm} JTM)`,
              status: 'APPROVED',
              created_by: guard.session.userId,
            });
            allocatedDiffJtm = diffJtm;
          }
        } else if (att.attendance_type === 'PANITIA_UJIAN' && att.exam_committee_id) {
          const { data: comRow } = await supabase
            .from('exam_committees')
            .select('*')
            .eq('id', att.exam_committee_id)
            .maybeSingle();

          if (comRow) {
            const expectedJtm = Number(comRow.jtm_allocated ?? 4);
            const diffJtm = Math.max(
              0,
              Number((expectedJtm - parsed.data.approved_jtm).toFixed(2))
            );
            if (diffJtm > 0) {
              await supabase.from('exam_committees').insert({
                exam_period_id: comRow.exam_period_id,
                teacher_id: parsed.data.diff_recipient_teacher_id,
                original_teacher_id: att.teacher_id,
                committee_role: `${comRow.committee_role} (Selisih JTM)`,
                jtm_allocated: Math.round(diffJtm),
                substituted_by_profile_id: guard.session.userId,
                substitution_reason:
                  parsed.data.diff_reason?.trim() ||
                  `Alokasi selisih JTM Panitia (${diffJtm} JTM dari ${expectedJtm} JTM)`,
                substituted_at: new Date().toISOString(),
              });
              allocatedDiffJtm = diffJtm;
            }
          }
        } else if (att.attendance_type === 'PENGAWAS_UJIAN' && att.exam_supervisor_id) {
          const { data: supRow } = await supabase
            .from('exam_supervisors')
            .select('*')
            .eq('id', att.exam_supervisor_id)
            .maybeSingle();

          if (supRow) {
            const expectedJtm = Number(supRow.jtm_allocated ?? 2);
            const diffJtm = Math.max(
              0,
              Number((expectedJtm - parsed.data.approved_jtm).toFixed(2))
            );
            if (diffJtm > 0) {
              await supabase.from('exam_supervisors').insert({
                exam_period_id: supRow.exam_period_id,
                exam_room_id: supRow.exam_room_id || null,
                teacher_id: parsed.data.diff_recipient_teacher_id,
                original_teacher_id: att.teacher_id,
                exam_date: supRow.exam_date,
                session_name: `${supRow.session_name} (Selisih JTM)`,
                subject_name: supRow.subject_name,
                jtm_allocated: Math.round(diffJtm),
                substitution_reason:
                  parsed.data.diff_reason?.trim() ||
                  `Alokasi selisih JTM (${diffJtm} JTM dari ${expectedJtm} JTM)`,
                substituted_at: new Date().toISOString(),
              });
              allocatedDiffJtm = diffJtm;
            }
          }
        }
      }

      return NextResponse.json({ attendance: updated, allocatedDiffJtm });
    }

    if (body.action === 'SUBMIT_PICKET_REPORT') {
      const parsed = SubmitPicketReportSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data Laporan Harian Piket tidak valid.' },
          { status: 400 }
        );
      }

      const { data: att, error: attErr } = await supabase
        .from('teacher_attendances')
        .select('*')
        .eq('id', parsed.data.attendance_id)
        .single();

      if (attErr || !att || att.attendance_type !== 'PIKET') {
        return NextResponse.json({ error: 'Data presensi Guru Piket tidak ditemukan.' }, { status: 404 });
      }
      if (!att.is_within_geofence || !att.admin_confirmed) {
        return NextResponse.json(
          {
            error:
              'Kehadiran Guru Piket / Piket Pengganti harus dikonfirmasi Admin terlebih dahulu sebelum mengisi Laporan Harian Piket.',
          },
          { status: 403 }
        );
      }

      const { data: existingReport } = await supabase
        .from('picket_daily_reports')
        .select('id')
        .eq('attendance_id', att.id)
        .maybeSingle();

      if (existingReport) {
        return NextResponse.json(
          { error: 'Laporan Harian Piket untuk presensi ini sudah pernah diisi.' },
          { status: 400 }
        );
      }

      const jtmCredited = Number(att.approved_jtm ?? 2);

      const { data: report, error: repErr } = await supabase
        .from('picket_daily_reports')
        .insert({
          attendance_id: att.id,
          teacher_id: att.teacher_id,
          report_date: att.attendance_date,
          summary: parsed.data.summary.trim(),
          late_students_notes: parsed.data.late_students_notes?.trim() || null,
          teacher_substitution_notes: parsed.data.teacher_substitution_notes?.trim() || null,
          incidents: parsed.data.incidents?.trim() || null,
          jtm_credited: jtmCredited,
          submitted_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (repErr || !report) {
        return NextResponse.json(
          { error: repErr?.message || 'Gagal menyimpan Laporan Harian Piket.' },
          { status: 500 }
        );
      }

      await supabase
        .from('teacher_attendances')
        .update({ jtm_earned: jtmCredited })
        .eq('id', att.id);

      return NextResponse.json({ report, jtmCredited });
    }

    if (body.action === 'CONFIRM_SCHEDULE_SESSION') {
      const parsed = ConfirmScheduleSessionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data konfirmasi jadwal tidak valid.' }, { status: 400 });
      }

      const d = parsed.data;
      const isAdmin = hasAnyRole(guard.session, ROLE_GROUPS.ADMIN_CONFIRM);
      let confirmedByRole: 'ADMIN' | 'GURU_PIKET' | 'PANITIA_UJIAN' = 'ADMIN';
      let confirmedByAttendanceId: string | null = null;

      // Wajib sudah presensi geofencing minimal 1x pada hari tersebut
      const { data: dailyAtt } = await supabase
        .from('teacher_attendances')
        .select('id')
        .eq('teacher_id', d.teacher_id)
        .eq('attendance_date', d.session_date)
        .eq('is_within_geofence', true)
        .limit(1)
        .maybeSingle();

      if (!dailyAtt) {
        return NextResponse.json(
          {
            error:
              'Guru/pengawas belum melakukan presensi geofencing pada tanggal tersebut (wajib 1x presensi per hari).',
          },
          { status: 400 }
        );
      }

      if (d.session_type === 'MENGAJAR') {
        if (d.picket_attendance_id) {
          const { data: picketAtt } = await supabase
            .from('teacher_attendances')
            .select('id, attendance_type, attendance_date, is_within_geofence, admin_confirmed')
            .eq('id', d.picket_attendance_id)
            .maybeSingle();

          if (
            !picketAtt ||
            picketAtt.attendance_type !== 'PIKET' ||
            !picketAtt.is_within_geofence ||
            !picketAtt.admin_confirmed ||
            picketAtt.attendance_date !== d.session_date
          ) {
            return NextResponse.json(
              {
                error:
                  'Guru Piket / Piket Pengganti belum dikonfirmasi Admin pada tanggal mengajar tersebut.',
              },
              { status: 403 }
            );
          }
          confirmedByRole = 'GURU_PIKET';
          confirmedByAttendanceId = picketAtt.id;
        } else if (!isAdmin) {
          return NextResponse.json(
            {
              error:
                'Konfirmasi jadwal mengajar hanya dapat dilakukan oleh Admin atau Guru Piket/Piket Pengganti terkonfirmasi Admin.',
            },
            { status: 403 }
          );
        }
      } else if (d.session_type === 'PENGAWAS_UJIAN') {
        if (d.committee_attendance_id) {
          const { data: comAtt } = await supabase
            .from('teacher_attendances')
            .select('id, attendance_type, is_within_geofence, admin_confirmed')
            .eq('id', d.committee_attendance_id)
            .maybeSingle();

          if (
            !comAtt ||
            comAtt.attendance_type !== 'PANITIA_UJIAN' ||
            !comAtt.is_within_geofence ||
            !comAtt.admin_confirmed
          ) {
            return NextResponse.json(
              { error: 'Panitia Ujian / Panitia Pengganti belum dikonfirmasi Admin.' },
              { status: 403 }
            );
          }
          confirmedByRole = 'PANITIA_UJIAN';
          confirmedByAttendanceId = comAtt.id;
        } else if (!isAdmin) {
          return NextResponse.json(
            {
              error:
                'Konfirmasi jadwal pengawas hanya dapat dilakukan oleh Admin atau Panitia Ujian/Panitia Pengganti terkonfirmasi Admin.',
            },
            { status: 403 }
          );
        }
      }

      let expectedJtm = 2;
      if (d.delegation_id) {
        const { data: delRow } = await supabase
          .from('teacher_delegations')
          .select('jtm_transferred')
          .eq('id', d.delegation_id)
          .maybeSingle();
        if (delRow?.jtm_transferred != null) expectedJtm = Number(delRow.jtm_transferred);
      } else if (d.schedule_id) {
        const { data: schedRow } = await supabase
          .from('schedules')
          .select('jtm_count')
          .eq('id', d.schedule_id)
          .maybeSingle();
        if (schedRow?.jtm_count != null) expectedJtm = Number(schedRow.jtm_count);
      } else if (d.exam_supervisor_id) {
        const { data: supRow } = await supabase
          .from('exam_supervisors')
          .select('jtm_allocated')
          .eq('id', d.exam_supervisor_id)
          .maybeSingle();
        if (supRow?.jtm_allocated != null) expectedJtm = Number(supRow.jtm_allocated);
      }

      const approvedJtm = d.approved_jtm != null ? Number(d.approved_jtm) : expectedJtm;

      const { data: confirmation, error: confErr } = await supabase
        .from('schedule_session_confirmations')
        .insert({
          session_type: d.session_type,
          session_date: d.session_date,
          teacher_id: d.teacher_id,
          daily_attendance_id: dailyAtt.id,
          schedule_id: d.schedule_id || null,
          delegation_id: d.delegation_id || null,
          exam_supervisor_id: d.exam_supervisor_id || null,
          expected_jtm: expectedJtm,
          approved_jtm: approvedJtm,
          confirmed_by_role: confirmedByRole,
          confirmed_by_profile_id: guard.session.userId,
          confirmed_by_attendance_id: confirmedByAttendanceId,
        })
        .select('*')
        .single();

      if (confErr) {
        if (confErr.code === '23505') {
          return NextResponse.json(
            { error: 'Jadwal tersebut pada tanggal ini sudah dikonfirmasi.' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: confErr.message }, { status: 500 });
      }

      let allocatedDiffJtm = 0;
      const diffJtm = Math.max(0, Number((expectedJtm - approvedJtm).toFixed(2)));
      if (diffJtm > 0 && d.diff_recipient_teacher_id) {
        if (d.diff_recipient_teacher_id === d.teacher_id) {
          return NextResponse.json(
            { error: 'Penerima selisih JTM tidak boleh sama dengan guru/pengawas yang bersangkutan.' },
            { status: 400 }
          );
        }
        if (d.session_type === 'MENGAJAR') {
          await supabase.from('teacher_delegations').insert({
            delegation_date: d.session_date,
            delegation_type: 'MENGAJAR',
            original_teacher_id: d.teacher_id,
            substitute_teacher_id: d.diff_recipient_teacher_id,
            schedule_id: d.schedule_id || null,
            jtm_transferred: Math.round(diffJtm),
            reason:
              d.diff_reason?.trim() ||
              `Alokasi selisih JTM (${diffJtm} JTM dari ${expectedJtm} JTM)`,
            status: 'APPROVED',
            created_by: guard.session.userId,
          });
          allocatedDiffJtm = diffJtm;
        } else if (d.session_type === 'PENGAWAS_UJIAN' && d.exam_supervisor_id) {
          const { data: supRow } = await supabase
            .from('exam_supervisors')
            .select('*')
            .eq('id', d.exam_supervisor_id)
            .maybeSingle();
          if (supRow) {
            await supabase.from('exam_supervisors').insert({
              exam_period_id: supRow.exam_period_id,
              exam_room_id: supRow.exam_room_id || null,
              teacher_id: d.diff_recipient_teacher_id,
              original_teacher_id: d.teacher_id,
              exam_date: supRow.exam_date,
              session_name: `${supRow.session_name} (Selisih JTM)`,
              subject_name: supRow.subject_name,
              jtm_allocated: Math.round(diffJtm),
              substitution_reason:
                d.diff_reason?.trim() ||
                `Alokasi selisih JTM (${diffJtm} JTM dari ${expectedJtm} JTM)`,
              substituted_at: new Date().toISOString(),
            });
            allocatedDiffJtm = diffJtm;
          }
        }
      }

      return NextResponse.json({ confirmation, allocatedDiffJtm });
    }

    if (body.action === 'CREATE_DELEGATION') {
      const parsed = DelegationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data delegasi guru tidak valid.' }, { status: 400 });
      }
      if (parsed.data.original_teacher_id === parsed.data.substitute_teacher_id) {
        return NextResponse.json(
          { error: 'Guru pengganti tidak boleh sama dengan guru yang berhalangan.' },
          { status: 400 }
        );
      }

      // Verifikasi presensi Guru Piket sudah dikonfirmasi Admin
      const { data: picketAtt } = await supabase
        .from('teacher_attendances')
        .select('id, attendance_type, is_within_geofence, admin_confirmed')
        .eq('id', parsed.data.picket_attendance_id)
        .maybeSingle();

      if (
        !picketAtt ||
        picketAtt.attendance_type !== 'PIKET' ||
        !picketAtt.is_within_geofence ||
        !picketAtt.admin_confirmed
      ) {
        return NextResponse.json(
          {
            error:
              'Guru Piket wajib melakukan presensi geofencing dan dikonfirmasi kehadirannya oleh Admin terlebih dahulu sebelum menunjuk guru pengganti.',
          },
          { status: 403 }
        );
      }

      let jtmTransferred = parsed.data.jtm_transferred;
      if (parsed.data.schedule_id) {
        const { data: sched } = await supabase
          .from('schedules')
          .select('jtm_count')
          .eq('id', parsed.data.schedule_id)
          .maybeSingle();
        if (sched?.jtm_count) {
          jtmTransferred = sched.jtm_count;
        }
      }

      const { data, error } = await supabase
        .from('teacher_delegations')
        .insert({
          delegation_date: parsed.data.delegation_date,
          delegation_type: parsed.data.delegation_type,
          original_teacher_id: parsed.data.original_teacher_id,
          substitute_teacher_id: parsed.data.substitute_teacher_id,
          schedule_id: parsed.data.schedule_id || null,
          jtm_transferred: jtmTransferred,
          reason: parsed.data.reason || null,
          status: 'APPROVED',
          created_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ delegation: data });
    }

    return NextResponse.json({ error: 'Aksi presensi tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses presensi.' }, { status: 500 });
  }
}
