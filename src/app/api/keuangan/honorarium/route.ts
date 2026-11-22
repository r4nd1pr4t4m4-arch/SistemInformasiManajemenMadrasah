import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  calculateDailyTransportAllowance,
  calculateTeacherHonorarium,
} from '@/lib/domain/honorarium';
import { roundSavingsFee } from '@/lib/domain/tabungan-fee';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { mapDutyCodeToRole } from '@/lib/auth/rbac';

const UpdateRateSchema = z.object({
  action: z.literal('UPDATE_RATE'),
  rate_per_jtm: z.number().min(0),
  transport_rate_per_km: z.number().min(0).optional(),
  school_start_time: z.string().optional(),
  school_end_time: z.string().optional(),
});

const UpdateTeacherDistanceSchema = z.object({
  action: z.literal('UPDATE_TEACHER_DISTANCE'),
  teacher_id: z.string().uuid(),
  home_distance_km: z.number().min(0).max(500),
});

const UpdateDailyHoursSchema = z.object({
  action: z.literal('UPDATE_DAILY_HOURS'),
  daily_hours: z.array(
    z.object({
      day_of_week: z.number().min(1).max(7),
      is_active: z.boolean(),
      start_time: z.string().min(4),
      end_time: z.string().min(4),
    })
  ),
});

function getDefaultDailyHours(fallbackStart = '07:30', fallbackEnd = '12:30') {
  return [
    { day_of_week: 1, is_active: true, start_time: fallbackStart, end_time: fallbackEnd },
    { day_of_week: 2, is_active: true, start_time: fallbackStart, end_time: fallbackEnd },
    { day_of_week: 3, is_active: true, start_time: fallbackStart, end_time: fallbackEnd },
    { day_of_week: 4, is_active: true, start_time: fallbackStart, end_time: fallbackEnd },
    { day_of_week: 5, is_active: true, start_time: fallbackStart, end_time: '11:30' },
    { day_of_week: 6, is_active: true, start_time: fallbackStart, end_time: '12:00' },
    { day_of_week: 7, is_active: false, start_time: fallbackStart, end_time: '12:00' },
  ];
}

function getIsoDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

const UpdateDutyAllowanceSchema = z.object({
  action: z.literal('UPDATE_DUTY_ALLOWANCE'),
  duty_type_id: z.string().uuid(),
  monthly_allowance: z.number().min(0),
});

const UpdateStatusSchema = z.object({
  action: z.literal('UPDATE_STATUS'),
  honorarium_id: z.string().uuid(),
  status: z.enum(['DRAFT', 'APPROVED', 'PAID']),
});

const AssignDutySchema = z.object({
  action: z.literal('ASSIGN_DUTY'),
  teacher_id: z.string().uuid(),
  duty_type_id: z.string().uuid(),
  academic_year_id: z.string().uuid().optional().nullable(),
  decree_number: z.string().optional().nullable(),
});

const GenerateHonorariumSchema = z.object({
  action: z.literal('GENERATE_HONORARIUM'),
  teacher_id: z.string().uuid(),
  period_month: z.number().min(1).max(12),
  period_year: z.number().min(2020).max(2100),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.HONORARIUM_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      ratePerJtm: 25000,
      transportRatePerKm: 2000,
      schoolStartTime: '07:30',
      schoolEndTime: '12:30',
      dailyHours: getDefaultDailyHours(),
      dutyTypes: [],
      teacherDuties: [],
      academicYears: [],
      honorariums: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: rateRow },
    { data: dailyHoursRows },
    { data: dutyTypes },
    { data: teacherDuties },
    { data: academicYears },
    { data: honorariums },
  ] = await Promise.all([
    supabase
      .from('honorarium_settings')
      .select('rate_per_jtm, transport_rate_per_km, school_start_time, school_end_time')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('school_daily_hours').select('*').order('day_of_week'),
    supabase.from('additional_duty_types').select('*').order('name'),
    supabase
      .from('teacher_additional_duties')
      .select(
        '*, teacher:teachers_staff(full_name), duty_type:additional_duty_types(code, name, receives_allowance, monthly_allowance), academic_year:academic_years(id, name, semester, is_active)'
      )
      .eq('is_active', true),
    supabase
      .from('academic_years')
      .select('id, name, semester, is_active')
      .order('is_active', { ascending: false })
      .order('name', { ascending: false })
      .order('semester', { ascending: true }),
    supabase
      .from('teacher_honorariums')
      .select(
        '*, teacher:teachers_staff(full_name, nip, home_distance_km), items:teacher_honorarium_duty_items(*)'
      )
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(100),
  ]);

  const fallbackStart = String(rateRow?.school_start_time ?? '07:30').slice(0, 5);
  const fallbackEnd = String(rateRow?.school_end_time ?? '12:30').slice(0, 5);
  const dailyHours =
    dailyHoursRows && dailyHoursRows.length > 0
      ? dailyHoursRows.map((d) => ({
          day_of_week: d.day_of_week,
          is_active: Boolean(d.is_active),
          start_time: String(d.start_time).slice(0, 5),
          end_time: String(d.end_time).slice(0, 5),
        }))
      : getDefaultDailyHours(fallbackStart, fallbackEnd);

  return NextResponse.json({
    ratePerJtm: Number(rateRow?.rate_per_jtm ?? 25000),
    transportRatePerKm: Number(rateRow?.transport_rate_per_km ?? 2000),
    schoolStartTime: fallbackStart,
    schoolEndTime: fallbackEnd,
    dailyHours,
    dutyTypes: dutyTypes || [],
    teacherDuties: teacherDuties || [],
    academicYears: academicYears || [],
    honorariums: honorariums || [],
  });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.HONORARIUM_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'UPDATE_RATE') {
      const parsed = UpdateRateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Tarif per JTM / Transport tidak valid.' }, { status: 400 });
      }
      const { data: prevSetting } = await supabase
        .from('honorarium_settings')
        .select('transport_rate_per_km, school_start_time, school_end_time')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase
        .from('honorarium_settings')
        .update({ is_active: false })
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('honorarium_settings')
        .insert({
          rate_per_jtm: parsed.data.rate_per_jtm,
          transport_rate_per_km:
            parsed.data.transport_rate_per_km ?? Number(prevSetting?.transport_rate_per_km ?? 2000),
          school_start_time:
            parsed.data.school_start_time ?? String(prevSetting?.school_start_time ?? '07:30'),
          school_end_time:
            parsed.data.school_end_time ?? String(prevSetting?.school_end_time ?? '12:30'),
          is_active: true,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ setting: data });
    }

    if (body.action === 'UPDATE_TEACHER_DISTANCE') {
      const parsed = UpdateTeacherDistanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Jarak rumah guru tidak valid.' }, { status: 400 });
      }
      const roundedDistance = Math.round(parsed.data.home_distance_km * 100) / 100;
      const { data, error } = await supabase
        .from('teachers_staff')
        .update({ home_distance_km: roundedDistance })
        .eq('id', parsed.data.teacher_id)
        .select('id, full_name, home_distance_km')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ teacher: data });
    }

    if (body.action === 'UPDATE_DAILY_HOURS') {
      const parsed = UpdateDailyHoursSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jam sekolah per hari tidak valid.' }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('school_daily_hours').upsert(
        parsed.data.daily_hours.map((d) => ({
          day_of_week: d.day_of_week,
          is_active: d.is_active,
          start_time: d.start_time,
          end_time: d.end_time,
          updated_at: nowIso,
        })),
        { onConflict: 'day_of_week' }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'UPDATE_DUTY_ALLOWANCE') {
      const parsed = UpdateDutyAllowanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Nominal tunjangan tidak valid.' }, { status: 400 });
      }

      const { data: duty } = await supabase
        .from('additional_duty_types')
        .select('code, receives_allowance')
        .eq('id', parsed.data.duty_type_id)
        .single();

      if (
        !duty ||
        !duty.receives_allowance ||
        duty.code === 'BENDAHARA_KOMITE' ||
        duty.code === 'PENGELOLA_TABUNGAN'
      ) {
        return NextResponse.json(
          {
            error:
              'Bendahara Komite dan Pengelola Tabungan tidak memiliki tambahan tunjangan honorarium.',
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('additional_duty_types')
        .update({
          monthly_allowance: parsed.data.monthly_allowance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.duty_type_id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ dutyType: data });
    }

    if (body.action === 'UPDATE_STATUS') {
      const parsed = UpdateStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Status honorarium tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('teacher_honorariums')
        .update({
          status: parsed.data.status,
          paid_at: parsed.data.status === 'PAID' ? new Date().toISOString() : null,
        })
        .eq('id', parsed.data.honorarium_id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ honorarium: data });
    }

    return NextResponse.json({ error: 'Aksi PATCH honorarium tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui pengaturan honorarium.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.HONORARIUM_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'ASSIGN_DUTY') {
      const parsed = AssignDutySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data penugasan guru tidak valid.' }, { status: 400 });
      }

      let targetAcademicYearId = parsed.data.academic_year_id || null;
      if (!targetAcademicYearId) {
        const { data: activeYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        targetAcademicYearId = activeYear?.id ?? null;
      }

      if (!targetAcademicYearId) {
        return NextResponse.json(
          { error: 'Semester dan tahun ajaran belum dipilih atau belum ada yang aktif.' },
          { status: 400 }
        );
      }

      const { data: duplicateDuty } = await supabase
        .from('teacher_additional_duties')
        .select('id')
        .eq('teacher_id', parsed.data.teacher_id)
        .eq('duty_type_id', parsed.data.duty_type_id)
        .eq('academic_year_id', targetAcademicYearId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (duplicateDuty) {
        return NextResponse.json(
          {
            error:
              'Guru tersebut sudah memiliki tugas tambahan yang sama pada semester dan tahun ajaran ini.',
          },
          { status: 409 }
        );
      }

      const { data, error } = await supabase
        .from('teacher_additional_duties')
        .insert({
          teacher_id: parsed.data.teacher_id,
          duty_type_id: parsed.data.duty_type_id,
          academic_year_id: targetAcademicYearId,
          decree_number: parsed.data.decree_number || null,
          is_active: true,
        })
        .select('*')
        .single();
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            {
              error:
                'Guru tersebut sudah memiliki tugas tambahan yang sama pada semester dan tahun ajaran ini.',
            },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Sinkronkan peran otomatis ke user_roles jika guru sudah tertaut ke akun (profile_id)
      const [{ data: teacherRow }, { data: dutyTypeRow }] = await Promise.all([
        supabase
          .from('teachers_staff')
          .select('profile_id')
          .eq('id', parsed.data.teacher_id)
          .maybeSingle(),
        supabase
          .from('additional_duty_types')
          .select('code, name')
          .eq('id', parsed.data.duty_type_id)
          .maybeSingle(),
      ]);

      if (teacherRow?.profile_id && dutyTypeRow) {
        const mappedRole =
          mapDutyCodeToRole(dutyTypeRow.code) || mapDutyCodeToRole(dutyTypeRow.name);
        if (mappedRole) {
          await supabase
            .from('user_roles')
            .upsert(
              { user_id: teacherRow.profile_id, role: mappedRole },
              { onConflict: 'user_id,role' }
            );
        }
      }

      return NextResponse.json({ assignment: data });
    }

    if (body.action === 'GENERATE_HONORARIUM') {
      const parsed = GenerateHonorariumSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parameter generate honorarium tidak valid.' }, { status: 400 });
      }

      const { teacher_id, period_month, period_year } = parsed.data;
      const startDate = `${period_year}-${String(period_month).padStart(2, '0')}-01`;
      const endDateObj = new Date(period_year, period_month, 0);
      const endDate = `${period_year}-${String(period_month).padStart(2, '0')}-${String(
        endDateObj.getDate()
      ).padStart(2, '0')}`;

      const [
        { data: rateRow },
        { data: dailyHoursRows },
        { data: teacherRow },
        { data: attendanceLogs },
        { data: shortLeaveLogs },
        { data: journals },
        { data: supervisors },
        { data: bapReports },
        { data: committeeReports },
        { data: picketReports },
        { data: eventJournals },
        { data: ceremonies },
        { data: paidHolidayLogs },
        { data: duties },
      ] = await Promise.all([
        supabase
          .from('honorarium_settings')
          .select('rate_per_jtm, transport_rate_per_km, school_start_time, school_end_time')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('school_daily_hours').select('*'),
        supabase
          .from('teachers_staff')
          .select('home_distance_km')
          .eq('id', teacher_id)
          .maybeSingle(),
        supabase
          .from('teacher_attendances')
          .select('attendance_date, check_in_time, check_out_time')
          .eq('teacher_id', teacher_id)
          .eq('is_within_geofence', true)
          .not('check_out_time', 'is', null)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate),
        supabase
          .from('teacher_short_leaves')
          .select('leave_date, leave_start_time, leave_end_time')
          .eq('teacher_id', teacher_id)
          .gte('leave_date', startDate)
          .lte('leave_date', endDate),
        supabase
          .from('teaching_journals')
          .select('jtm_credited, delegation_id')
          .eq('teacher_id', teacher_id)
          .gte('journal_date', startDate)
          .lte('journal_date', endDate),
        supabase
          .from('exam_supervisors')
          .select('id, jtm_allocated')
          .eq('teacher_id', teacher_id)
          .gte('exam_date', startDate)
          .lte('exam_date', endDate),
        supabase
          .from('exam_bap_reports')
          .select('exam_supervisor_id, jtm_credited')
          .eq('teacher_id', teacher_id)
          .gte('report_date', startDate)
          .lte('report_date', endDate),
        supabase
          .from('exam_committee_daily_reports')
          .select('jtm_credited')
          .eq('teacher_id', teacher_id)
          .gte('report_date', startDate)
          .lte('report_date', endDate),
        supabase
          .from('picket_daily_reports')
          .select('jtm_credited')
          .eq('teacher_id', teacher_id)
          .gte('report_date', startDate)
          .lte('report_date', endDate),
        supabase
          .from('event_journals')
          .select('jtm_credited')
          .eq('teacher_id', teacher_id)
          .gte('journal_date', startDate)
          .lte('journal_date', endDate),
        supabase
          .from('ceremony_schedules')
          .select('jtm_allocated')
          .eq('teacher_id', teacher_id)
          .eq('status', 'TERLAKSANA')
          .gte('ceremony_date', startDate)
          .lte('ceremony_date', endDate),
        supabase
          .from('paid_holiday_jtm_logs')
          .select('total_jtm')
          .eq('teacher_id', teacher_id)
          .gte('holiday_date', startDate)
          .lte('holiday_date', endDate),
        supabase
          .from('teacher_additional_duties')
          .select(
            'duty_type:additional_duty_types(id, code, name, receives_allowance, monthly_allowance)'
          )
          .eq('teacher_id', teacher_id)
          .eq('is_active', true),
      ]);

      const teachingJtm = Number(
        (journals || [])
          .filter((j) => !j.delegation_id)
          .reduce((s, r) => s + Number(r.jtm_credited || 0), 0)
          .toFixed(2)
      );
      const substituteJtm = Number(
        (journals || [])
          .filter((j) => Boolean(j.delegation_id))
          .reduce((s, r) => s + Number(r.jtm_credited || 0), 0)
          .toFixed(2)
      );

      const supervisorIds = new Set((supervisors || []).map((s) => s.id));
      const examSupervisorJtm = Number(
        (bapReports || [])
          .filter((b) => supervisorIds.has(b.exam_supervisor_id))
          .reduce((s, b) => s + Number(b.jtm_credited || 0), 0)
          .toFixed(2)
      );

      const examCommitteeJtm = Number(
        (committeeReports || [])
          .reduce((s, r) => s + Number(r.jtm_credited || 0), 0)
          .toFixed(2)
      );
      const eventJtm = Number(
        (eventJournals || [])
          .reduce((s, r) => s + Number(r.jtm_credited || 0), 0)
          .toFixed(2)
      );
      const picketJtm = Number(
        (picketReports || [])
          .reduce((s, r) => s + Number(r.jtm_credited || 0), 0)
          .toFixed(2)
      );
      const ceremonyJtm = Number(
        (ceremonies || [])
          .reduce((s, r) => s + Number(r.jtm_allocated || 0), 0)
          .toFixed(2)
      );
      const paidHolidayJtm = Number(
        (paidHolidayLogs || [])
          .reduce((s, r) => s + Number(r.total_jtm || 0), 0)
          .toFixed(2)
      );
      const ratePerJtm = Number(rateRow?.rate_per_jtm ?? 25000);
      const transportRatePerKm = Number(rateRow?.transport_rate_per_km ?? 2000);
      const schoolStartTime = String(rateRow?.school_start_time ?? '07:30').slice(0, 5);
      const schoolEndTime = String(rateRow?.school_end_time ?? '12:30').slice(0, 5);
      const homeDistanceKm = Number(teacherRow?.home_distance_km ?? 0);

      // Hitung Tunjangan Transportasi per hari: (% durasi kehadiran di madrasah) x jarak KM x tarif per KM
      const dailyIntervals = new Map<string, { checkIn: string; checkOut: string }>();
      for (const att of attendanceLogs || []) {
        if (!att.check_in_time || !att.check_out_time) continue;
        const cur = dailyIntervals.get(att.attendance_date);
        if (!cur) {
          dailyIntervals.set(att.attendance_date, {
            checkIn: att.check_in_time,
            checkOut: att.check_out_time,
          });
        } else {
          if (att.check_in_time < cur.checkIn) cur.checkIn = att.check_in_time;
          if (att.check_out_time > cur.checkOut) cur.checkOut = att.check_out_time;
        }
      }

      const dailyHoursMap = new Map<
        number,
        { isActive: boolean; startTime: string; endTime: string }
      >();
      for (const dh of dailyHoursRows || []) {
        dailyHoursMap.set(dh.day_of_week, {
          isActive: Boolean(dh.is_active),
          startTime: String(dh.start_time).slice(0, 5),
          endTime: String(dh.end_time).slice(0, 5),
        });
      }

      const shortLeavesByDate = new Map<string, { startTime: string; endTime: string }[]>();
      for (const lv of shortLeaveLogs || []) {
        const list = shortLeavesByDate.get(lv.leave_date) || [];
        list.push({
          startTime: String(lv.leave_start_time).slice(0, 5),
          endTime: String(lv.leave_end_time).slice(0, 5),
        });
        shortLeavesByDate.set(lv.leave_date, list);
      }

      let transportAllowance = 0;
      for (const [attDate, interval] of dailyIntervals.entries()) {
        const dayOfWeek = getIsoDayOfWeek(attDate);
        const dayCfg = dailyHoursMap.get(dayOfWeek);
        if (dayCfg && !dayCfg.isActive) continue;

        const res = calculateDailyTransportAllowance({
          checkInTime: interval.checkIn,
          checkOutTime: interval.checkOut,
          schoolStartTime: dayCfg?.startTime || schoolStartTime,
          schoolEndTime: dayCfg?.endTime || schoolEndTime,
          homeDistanceKm,
          transportRatePerKm,
          shortLeaves: shortLeavesByDate.get(attDate) || [],
        });
        transportAllowance += res.amount;
      }
      // Bulatkan total tunjangan transportasi sebelum generate honorarium
      transportAllowance = roundSavingsFee(transportAllowance);

      const dutyInputs = (duties || [])
        .map((d) => {
          const dt = Array.isArray(d.duty_type) ? d.duty_type[0] : d.duty_type;
          if (!dt) return null;
          return {
            id: dt.id as string,
            code: dt.code as string,
            name: dt.name as string,
            receivesAllowance: Boolean(dt.receives_allowance),
            monthlyAllowance: Number(dt.monthly_allowance ?? 0),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const calc = calculateTeacherHonorarium(
        {
          teachingJtm,
          substituteJtm,
          examSupervisorJtm,
          examCommitteeJtm,
          eventJtm,
          picketJtm,
          ceremonyJtm,
          paidHolidayJtm,
        },
        ratePerJtm,
        dutyInputs,
        transportAllowance
      );

      const { data: saved, error: saveErr } = await supabase
        .from('teacher_honorariums')
        .upsert(
          {
            teacher_id,
            period_month,
            period_year,
            teaching_jtm: teachingJtm,
            substitute_jtm: substituteJtm,
            exam_supervisor_jtm: examSupervisorJtm,
            exam_committee_jtm: examCommitteeJtm,
            event_jtm: eventJtm,
            picket_jtm: picketJtm,
            ceremony_jtm: ceremonyJtm,
            paid_holiday_jtm: paidHolidayJtm,
            total_jtm: calc.totalJtm,
            rate_per_jtm: calc.ratePerJtm,
            jtm_honorarium_amount: calc.jtmHonorariumAmount,
            additional_duty_allowance: calc.additionalDutyAllowance,
            transport_allowance: calc.transportAllowance,
            total_amount: calc.totalAmount,
            status: 'DRAFT',
          },
          { onConflict: 'teacher_id,period_month,period_year' }
        )
        .select('*')
        .single();

      if (saveErr || !saved) {
        return NextResponse.json(
          { error: saveErr?.message || 'Gagal menyimpan honorarium.' },
          { status: 500 }
        );
      }

      await supabase
        .from('teacher_honorarium_duty_items')
        .delete()
        .eq('honorarium_id', saved.id);

      if (calc.eligibleDuties.length > 0) {
        const dutyMap = new Map(dutyInputs.map((d) => [d.code, d.id]));
        await supabase.from('teacher_honorarium_duty_items').insert(
          calc.eligibleDuties.map((d) => ({
            honorarium_id: saved.id,
            duty_type_id: dutyMap.get(d.code)!,
            duty_name: d.name,
            allowance_amount: d.monthlyAllowance,
          }))
        );
      }

      return NextResponse.json({ honorarium: saved, calculation: calc });
    }

    return NextResponse.json({ error: 'Aksi POST honorarium tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses honorarium.' }, { status: 500 });
  }
}

const DeleteDutyAssignmentSchema = z.union([
  z.object({
    id: z.string().uuid('ID penugasan tidak valid.'),
  }),
  z.object({
    ids: z
      .array(z.string().uuid('ID penugasan tidak valid.'))
      .min(1, 'Pilih minimal 1 penugasan untuk dihapus.')
      .max(200, 'Maksimal 200 penugasan dapat dihapus sekaligus.'),
  }),
]);

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.HONORARIUM_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const body = queryId ? { id: queryId } : await request.json().catch(() => ({}));
    const parsed = DeleteDutyAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'ID penugasan tidak valid.' },
        { status: 400 }
      );
    }

    const targetIds = Array.from(
      new Set('ids' in parsed.data ? parsed.data.ids : [parsed.data.id])
    );

    const supabase = createSupabaseAdminClient();
    const { data: existingRows, error: fetchErr } = await supabase
      .from('teacher_additional_duties')
      .select('id, teacher_id, duty_type_id')
      .in('id', targetIds);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json(
        { error: 'Data penugasan tugas tambahan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const foundIds = existingRows.map((r) => r.id);
    const { error: deleteErr } = await supabase
      .from('teacher_additional_duties')
      .delete()
      .in('id', foundIds);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // Sinkronkan penghapusan peran di user_roles untuk semua guru yang terdampak
    const affectedTeacherIds = Array.from(new Set(existingRows.map((r) => r.teacher_id)));
    const deletedDutyTypeIds = Array.from(new Set(existingRows.map((r) => r.duty_type_id)));

    const [{ data: teacherRows }, { data: deletedDutyTypes }, { data: remainingDuties }] =
      await Promise.all([
        supabase
          .from('teachers_staff')
          .select('id, profile_id')
          .in('id', affectedTeacherIds),
        supabase
          .from('additional_duty_types')
          .select('id, code, name')
          .in('id', deletedDutyTypeIds),
        supabase
          .from('teacher_additional_duties')
          .select('teacher_id, duty_type:additional_duty_types(code, name)')
          .in('teacher_id', affectedTeacherIds)
          .eq('is_active', true),
      ]);

    const teacherProfileMap = new Map(
      (teacherRows || [])
        .filter((t) => Boolean(t.profile_id))
        .map((t) => [t.id, t.profile_id as string])
    );
    const dutyTypeMap = new Map((deletedDutyTypes || []).map((dt) => [dt.id, dt]));

    const remainingRolesByTeacher = new Map<string, Set<string>>();
    for (const row of remainingDuties || []) {
      const dt = Array.isArray(row.duty_type) ? row.duty_type[0] : row.duty_type;
      if (!dt) continue;
      const role = mapDutyCodeToRole(dt.code) || mapDutyCodeToRole(dt.name);
      if (!role) continue;
      if (!remainingRolesByTeacher.has(row.teacher_id)) {
        remainingRolesByTeacher.set(row.teacher_id, new Set());
      }
      remainingRolesByTeacher.get(row.teacher_id)!.add(role);
    }

    const roleCleanups: Array<{ userId: string; role: string }> = [];
    const seenCleanup = new Set<string>();
    for (const row of existingRows) {
      const profileId = teacherProfileMap.get(row.teacher_id);
      const dt = dutyTypeMap.get(row.duty_type_id);
      if (!profileId || !dt) continue;
      const removedRole = mapDutyCodeToRole(dt.code) || mapDutyCodeToRole(dt.name);
      if (!removedRole) continue;
      const stillHasRole = remainingRolesByTeacher.get(row.teacher_id)?.has(removedRole);
      if (!stillHasRole) {
        const key = `${profileId}:${removedRole}`;
        if (!seenCleanup.has(key)) {
          seenCleanup.add(key);
          roleCleanups.push({ userId: profileId, role: removedRole });
        }
      }
    }

    if (roleCleanups.length > 0) {
      await Promise.all(
        roleCleanups.map(({ userId, role }) =>
          supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
        )
      );
    }

    return NextResponse.json({
      ok: true,
      deletedId: foundIds[0],
      deletedIds: foundIds,
      deletedCount: foundIds.length,
    });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus penugasan tugas tambahan.' }, { status: 500 });
  }
}
