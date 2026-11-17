import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { verifyGeofence } from '@/lib/domain/geofence';
import { calculateLateJtm } from '@/lib/domain/jtm-late-penalty';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';

const StudentAttendanceSchema = z.object({
  action: z.literal('STUDENT_ATTENDANCE'),
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
  latitude: z.number(),
  longitude: z.number(),
  notes: z.string().optional().nullable(),
});

const SubmitJournalSchema = z.object({
  action: z.literal('SUBMIT_JOURNAL'),
  attendance_id: z.string().uuid(),
  topic: z.string().min(3, 'Topik/materi pembelajaran minimal 3 karakter.'),
  learning_activities: z.string().optional().nullable(),
  jtm_fallback: z.number().min(1).max(12).optional().default(2),
});

const ConfirmAttendanceSchema = z.object({
  action: z.literal('CONFIRM_ATTENDANCE'),
  attendance_id: z.string().uuid(),
  picket_jtm: z.number().min(0).max(24).optional(),
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
      schedules: [],
      examSupervisors: [],
      examCommittees: [],
      geofenceConfig: { latitude: -6.2, longitude: 106.816666, radiusMeters: 100 },
      canAdminConfirm,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: studentAtt },
    { data: teacherAtt },
    { data: delegations },
    { data: journals },
    { data: schedules },
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
        '*, teacher:teachers_staff(full_name), schedule:schedules(day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name))'
      )
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('teacher_delegations')
      .select(
        '*, original:teachers_staff!teacher_delegations_original_teacher_id_fkey(full_name), substitute:teachers_staff!teacher_delegations_substitute_teacher_id_fkey(full_name), schedule:schedules(day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name))'
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
      .from('schedules')
      .select('id, teacher_id, day_of_week, start_time, end_time, jtm_count, classroom:classrooms(name), subject:subjects(name), teacher:teachers_staff(full_name)')
      .order('day_of_week')
      .limit(200),
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
      .select('geofence_lat, geofence_lng, geofence_radius_meters')
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    studentAttendances: studentAtt || [],
    teacherAttendances: teacherAtt || [],
    delegations: delegations || [],
    journals: journals || [],
    schedules: schedules || [],
    examSupervisors: examSupervisors || [],
    examCommittees: examCommittees || [],
    geofenceConfig: {
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
        return NextResponse.json({ error: 'Data presensi siswa tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('student_attendances')
        .insert({
          ...payload,
          schedule_id: payload.schedule_id || null,
          attendance_date: payload.attendance_date || new Date().toISOString().slice(0, 10),
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
        .select('geofence_lat, geofence_lng, geofence_radius_meters')
        .limit(1)
        .maybeSingle();

      const schoolLat = settings?.geofence_lat ?? -6.2;
      const schoolLng = settings?.geofence_lng ?? 106.816666;
      const radius = settings?.geofence_radius_meters ?? 100;

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

      // JTM tidak langsung dihitung saat presensi (jtm_earned = 0);
      // dihitung setelah Jurnal Pembelajaran (MENGAJAR/Pengganti), BAP (PENGAWAS_UJIAN), atau Konfirmasi Admin (PANITIA_UJIAN).
      const { data, error } = await supabase
        .from('teacher_attendances')
        .insert({
          teacher_id: parsed.data.teacher_id,
          attendance_type: parsed.data.attendance_type,
          schedule_id: parsed.data.schedule_id || null,
          delegation_id: parsed.data.delegation_id || null,
          exam_supervisor_id: parsed.data.exam_supervisor_id || null,
          exam_committee_id: parsed.data.exam_committee_id || null,
          jtm_earned: 0,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          distance_meters: geo.distanceMeters,
          is_within_geofence: true,
          admin_confirmed: false,
          status: 'HADIR',
          notes: parsed.data.notes || null,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attendance: data, geofence: geo });
    }

    if (body.action === 'SUBMIT_JOURNAL') {
      const parsed = SubmitJournalSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data jurnal pembelajaran tidak valid.' },
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
      if (att.delegation_id) {
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
      if (!hasAnyRole(guard.session, ROLE_GROUPS.ADMIN_CONFIRM)) {
        return NextResponse.json(
          { error: 'Hanya Admin / Operator / Pimpinan / TU yang dapat mengonfirmasi kehadiran.' },
          { status: 403 }
        );
      }

      const parsed = ConfirmAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID presensi tidak valid.' }, { status: 400 });
      }

      const { data: att } = await supabase
        .from('teacher_attendances')
        .select('id, attendance_type, is_within_geofence, delegation_id, picket_schedule_id')
        .eq('id', parsed.data.attendance_id)
        .single();

      if (!att) {
        return NextResponse.json({ error: 'Data presensi tidak ditemukan.' }, { status: 404 });
      }
      if (!['PIKET', 'PANITIA_UJIAN'].includes(att.attendance_type)) {
        return NextResponse.json(
          { error: 'Konfirmasi admin hanya berlaku untuk presensi Guru Piket atau Panitia Ujian.' },
          { status: 400 }
        );
      }
      if (!att.is_within_geofence) {
        return NextResponse.json(
          { error: 'Presensi tidak berada dalam radius geofencing yang valid.' },
          { status: 400 }
        );
      }

      const updateFields: Record<string, unknown> = {
        admin_confirmed: true,
        confirmed_by: guard.session.userId,
        confirmed_at: new Date().toISOString(),
      };

      if (att.attendance_type === 'PIKET') {
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
        updateFields.jtm_earned = picketJtm;
      }

      const { data: updated, error: updErr } = await supabase
        .from('teacher_attendances')
        .update(updateFields)
        .eq('id', att.id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ attendance: updated });
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
