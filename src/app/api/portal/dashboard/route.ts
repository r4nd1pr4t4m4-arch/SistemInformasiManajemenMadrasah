import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { mapDutyCodeToRole } from '@/lib/auth/rbac';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import type { AppRole } from '@/types/database';

function getIsoDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

const DUTY_CODE_TO_ROLE: Partial<Record<string, AppRole>> = {
  WAKA_KURIKULUM: 'WAKA_KURIKULUM',
  WAKA_KESISWAAN: 'WAKA_KESISWAAN',
  WAKA_HUMAS: 'WAKA_HUMAS',
  WAKA_SARPRAS: 'WAKA_SARPRAS',
  KEPALA_TU: 'KEPALA_TU',
  BENDAHARA: 'BENDAHARA',
  BENDAHARA_KOMITE: 'BENDAHARA_KOMITE',
  PENGELOLA_TABUNGAN: 'PENGELOLA_TABUNGAN',
  PUSTAKAWAN: 'PUSTAKAWAN',
  WALI_KELAS: 'WALI_KELAS',
  GURU_BK: 'GURU_BK',
  GURU_WALI: 'GURU_WALI',
  PEMBINA_OSIM: 'PEMBINA_OSIM',
  PEMBINA_EKSTRAKURIKULER: 'PEMBINA_EKSTRAKURIKULER',
};

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayDate = getWibTodayDateString();
  const todayDayOfWeek = getIsoDayOfWeek(todayDate);
  const currentMonth = Number(todayDate.slice(5, 7));
  const currentYear = Number(todayDate.slice(0, 4));
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      todayDate,
      todayDayOfWeek,
      user: {
        userId: session.userId,
        fullName: session.fullName,
        email: session.email,
        primaryRole: session.primaryRole,
        roles: session.roles,
        effectiveRoles: session.roles,
      },
      academicYear: { name: '2026/2027', semester: 'GANJIL' },
      todayCalendarEvent: null,
      teacherProfile: null,
      studentProfile: null,
      libraryMember: null,
      executiveSummary: null,
      teachingSummary: null,
      financeSummary: null,
      bkSummary: null,
      guruWaliSummary: null,
      librarySummary: null,
      alumniSummary: null,
    });
  }

  const supabase = createSupabaseAdminClient();

  // 1. Ambil profil GTK, Siswa, Anggota Perpustakaan, Tahun Ajaran Aktif, & Kalender Hari Ini
  const [
    { data: activeYear },
    { data: todayCalEvent },
    { data: teacherRow },
    { data: studentRow },
    { data: libMemberRow },
  ] = await Promise.all([
    supabase
      .from('academic_years')
      .select('id, name, semester')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('academic_calendar_events')
      .select('id, event_date, title, category, description')
      .eq('event_date', todayDate)
      .maybeSingle(),
    supabase
      .from('teachers_staff')
      .select('*')
      .eq('profile_id', session.userId)
      .maybeSingle(),
    supabase
      .from('students')
      .select('*')
      .eq('profile_id', session.userId)
      .maybeSingle(),
    supabase
      .from('library_members')
      .select('*')
      .eq('profile_id', session.userId)
      .maybeSingle(),
  ]);

  // 2. Jika terhubung dengan GTK, ambil Tugas Tambahan & Perwalian Kelas untuk menentukan effectiveRoles
  const effectiveRolesSet = new Set<AppRole>(session.roles);
  let additionalDuties: Array<{
    id: string;
    decree_number: string | null;
    code: string;
    name: string;
    receives_allowance: boolean;
    monthly_allowance: number;
  }> = [];
  let homeroomClassrooms: Array<{ id: string; name: string; grade_level: string; room_location: string | null }> = [];

  if (teacherRow) {
    const [{ data: dutyRows }, { data: hrClasses }] = await Promise.all([
      supabase
        .from('teacher_additional_duties')
        .select(
          'id, decree_number, duty_type:additional_duty_types(code, name, receives_allowance, monthly_allowance)'
        )
        .eq('teacher_id', teacherRow.id)
        .eq('is_active', true),
      supabase
        .from('classrooms')
        .select('id, name, grade_level, room_location')
        .eq('homeroom_teacher_id', teacherRow.id),
    ]);

    additionalDuties = (dutyRows || []).map((d) => {
      const dt = Array.isArray(d.duty_type) ? d.duty_type[0] : d.duty_type;
      const code = String(dt?.code || '');
      const name = String(dt?.name || code);
      const mappedRole = DUTY_CODE_TO_ROLE[code] || mapDutyCodeToRole(code) || mapDutyCodeToRole(name);
      if (mappedRole) effectiveRolesSet.add(mappedRole);
      return {
        id: d.id,
        decree_number: d.decree_number,
        code,
        name,
        receives_allowance: Boolean(dt?.receives_allowance),
        monthly_allowance: Number(dt?.monthly_allowance ?? 0),
      };
    });

    homeroomClassrooms = hrClasses || [];
    if (homeroomClassrooms.length > 0) {
      effectiveRolesSet.add('WALI_KELAS');
    }
  }

  const effectiveRoles = Array.from(effectiveRolesSet);
  const effectiveSession = { ...session, roles: effectiveRoles };

  // Helper check
  const hasRole = (roles: AppRole[]) => hasAnyRole(effectiveSession, roles);

  // 3. Siapkan query paralel berdasarkan peran & tugas tambahan pengguna
  const isExecutiveOrAdmin = hasRole([
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'STAF_TU',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_HUMAS',
    'WAKA_SARPRAS',
  ]);

  const isTeacherOrAcademic =
    Boolean(teacherRow) ||
    hasRole(['GURU', 'WALI_KELAS', 'GURU_WALI', 'GURU_BK', 'WAKA_KURIKULUM', 'WAKA_KESISWAAN']);

  const isPrivilegedFinanceBaseRole = hasAnyRole(session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'BENDAHARA',
    'KEPALA_TU',
  ]);
  const isGuruOnlyDashboard = hasAnyRole(session, ['GURU']) && !isPrivilegedFinanceBaseRole;
  const hasBendaharaKomiteDuty = additionalDuties.some(
    (d) =>
      mapDutyCodeToRole(d.code) === 'BENDAHARA_KOMITE' ||
      mapDutyCodeToRole(d.name) === 'BENDAHARA_KOMITE'
  );
  const hasPengelolaTabunganDuty = additionalDuties.some(
    (d) =>
      mapDutyCodeToRole(d.code) === 'PENGELOLA_TABUNGAN' ||
      mapDutyCodeToRole(d.name) === 'PENGELOLA_TABUNGAN'
  );

  const isFinanceRole = isGuruOnlyDashboard
    ? hasBendaharaKomiteDuty || hasPengelolaTabunganDuty
    : hasRole([
        'SUPERADMIN',
        'OPERATOR',
        'KEPALA_LEMBAGA',
        'BENDAHARA',
        'BENDAHARA_KOMITE',
        'PENGELOLA_TABUNGAN',
        'KEPALA_TU',
      ]);

  const isBkRole = hasRole([
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'GURU_BK',
  ]);

  const isGuruWaliRole =
    Boolean(teacherRow) ||
    hasRole(['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'GURU_WALI', 'WALI_KELAS', 'GURU']);

  const isLibraryRole = hasRole([
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'PUSTAKAWAN',
    'GURU',
    'STAF_TU',
    'SISWA',
    'UMUM',
  ]);

  const isAlumniRole = hasRole([
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_HUMAS',
    'GURU_BK',
    'ALUMNI',
    'STAF_TU',
  ]);

  // --- A. Executive / Admin Summary ---
  let executiveSummary: Record<string, unknown> | null = null;
  if (isExecutiveOrAdmin) {
    const [
      { count: activeStudentsCount },
      { count: activeTeachersCount },
      { count: classroomsCount },
      { count: subjectsCount },
      { count: pendingAccountsCount },
      { data: todayAttendances },
      { data: ppdbRows },
      { data: facilitiesRows },
      { data: recentLetters },
      { data: upcomingEvents },
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'AKTIF'),
      supabase.from('teachers_staff').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('classrooms').select('id', { count: 'exact', head: true }),
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'PENDING'),
      supabase
        .from('teacher_attendances')
        .select('id, attendance_type, admin_confirmed, check_in_time, check_out_time, teacher:teachers_staff(full_name)')
        .eq('attendance_date', todayDate)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('ppdb_registrations').select('id, status, pathway, full_name, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('facilities').select('id, name, category, quantity, condition'),
      supabase.from('letters').select('id, direction, category, letter_number, letter_date, subject, counterparty').order('letter_date', { ascending: false }).limit(5),
      supabase.from('school_events').select('id, title, event_type, day_of_week, start_date, end_date, location, jtm_allocated').eq('is_active', true).limit(6),
    ]);

    const ppdbList = ppdbRows || [];
    const facilitiesList = facilitiesRows || [];
    const attList = todayAttendances || [];

    executiveSummary = {
      activeStudentsCount: activeStudentsCount ?? 0,
      activeTeachersCount: activeTeachersCount ?? 0,
      classroomsCount: classroomsCount ?? 0,
      subjectsCount: subjectsCount ?? 0,
      pendingAccountsCount: pendingAccountsCount ?? 0,
      todayAttendanceTotal: attList.length,
      todayAttendanceUnconfirmed: attList.filter((a) => !a.admin_confirmed).length,
      recentTodayAttendances: attList.slice(0, 6),
      ppdb: {
        total: ppdbList.length,
        waitingVerification: ppdbList.filter((r) => r.status === 'MENUNGGU_VERIFIKASI').length,
        verified: ppdbList.filter((r) => r.status === 'TERVERIFIKASI').length,
        accepted: ppdbList.filter((r) => r.status === 'LULUS').length,
        recentRegistrations: ppdbList.slice(0, 5),
      },
      facilities: {
        totalItems: facilitiesList.length,
        totalUnits: facilitiesList.reduce((acc, f) => acc + Number(f.quantity || 0), 0),
        goodConditionCount: facilitiesList.filter((f) => f.condition === 'BAIK').length,
        needsAttentionCount: facilitiesList.filter((f) => f.condition !== 'BAIK').length,
        damagedList: facilitiesList.filter((f) => f.condition !== 'BAIK').slice(0, 5),
      },
      recentLetters: recentLetters || [],
      upcomingEvents: upcomingEvents || [],
    };
  }

  // --- B. Teaching, Picket, Homeroom & Exam Duties Summary ---
  let teachingSummary: Record<string, unknown> | null = null;
  if (isTeacherOrAcademic && teacherRow) {
    const [
      { data: teacherSchedules },
      { data: picketRows },
      { data: todayAttRows },
      { data: monthJournals },
      { data: monthPicketReports },
      { data: monthEventJournals },
      { data: monthBapReports },
      { data: monthCommitteeReports },
      { data: monthPaidHolidayLogs },
      { data: examSupervisorRows },
      { data: examCommitteeRows },
      { data: currentHonorarium },
    ] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, day_of_week, start_time, end_time, jtm_count, classroom:classrooms(id, name), subject:subjects(name, code)')
        .eq('teacher_id', teacherRow.id)
        .order('day_of_week')
        .order('start_time'),
      supabase
        .from('picket_schedules')
        .select('id, day_of_week, notes')
        .eq('teacher_id', teacherRow.id)
        .order('day_of_week'),
      supabase
        .from('teacher_attendances')
        .select('id, attendance_type, check_in_time, check_out_time, admin_confirmed, is_within_geofence')
        .eq('teacher_id', teacherRow.id)
        .eq('attendance_date', todayDate),
      supabase
        .from('teaching_journals')
        .select('id, schedule_id, journal_date, jtm_credited, topic')
        .eq('teacher_id', teacherRow.id)
        .gte('journal_date', monthStart),
      supabase
        .from('picket_daily_reports')
        .select('id, report_date, jtm_credited')
        .eq('teacher_id', teacherRow.id)
        .gte('report_date', monthStart),
      supabase
        .from('event_journals')
        .select('id, journal_date, jtm_credited')
        .eq('teacher_id', teacherRow.id)
        .gte('journal_date', monthStart),
      supabase
        .from('exam_bap_reports')
        .select('id, report_date, jtm_credited')
        .eq('teacher_id', teacherRow.id)
        .gte('report_date', monthStart),
      supabase
        .from('exam_committee_daily_reports')
        .select('id, report_date, jtm_credited')
        .eq('teacher_id', teacherRow.id)
        .gte('report_date', monthStart),
      supabase
        .from('paid_holiday_jtm_logs')
        .select('id, holiday_date, total_jtm')
        .eq('teacher_id', teacherRow.id)
        .gte('holiday_date', monthStart),
      supabase
        .from('exam_supervisors')
        .select('id, exam_date, session_name, subject_name, jtm_allocated, room:exam_rooms(room_name), period:exam_periods(name)')
        .eq('teacher_id', teacherRow.id)
        .gte('exam_date', todayDate)
        .order('exam_date', { ascending: true })
        .limit(5),
      supabase
        .from('exam_committees')
        .select('id, committee_role, jtm_allocated, period:exam_periods(name, is_active)')
        .eq('teacher_id', teacherRow.id),
      supabase
        .from('teacher_honorariums')
        .select('*')
        .eq('teacher_id', teacherRow.id)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .maybeSingle(),
    ]);

    const todaySchedules = (teacherSchedules || []).filter(
      (s) => s.day_of_week === todayDayOfWeek
    );
    const todayJournalScheduleIds = new Set(
      (monthJournals || [])
        .filter((j) => j.journal_date === todayDate && j.schedule_id)
        .map((j) => j.schedule_id)
    );

    const teachingJtmMonth = (monthJournals || []).reduce(
      (acc, r) => acc + Number(r.jtm_credited || 0),
      0
    );
    const picketJtmMonth = (monthPicketReports || []).reduce(
      (acc, r) => acc + Number(r.jtm_credited || 0),
      0
    );
    const eventJtmMonth = (monthEventJournals || []).reduce(
      (acc, r) => acc + Number(r.jtm_credited || 0),
      0
    );
    const examJtmMonth =
      (monthBapReports || []).reduce((acc, r) => acc + Number(r.jtm_credited || 0), 0) +
      (monthCommitteeReports || []).reduce((acc, r) => acc + Number(r.jtm_credited || 0), 0);
    const holidayJtmMonth = (monthPaidHolidayLogs || []).reduce(
      (acc, r) => acc + Number(r.total_jtm || 0),
      0
    );

    // Homeroom class details if Wali Kelas
    let homeroomDetails: Array<{
      classroomId: string;
      classroomName: string;
      gradeLevel: string;
      studentsCount: number;
      todayPresent: number;
      todaySick: number;
      todayPermit: number;
      todayAlpha: number;
    }> = [];

    if (homeroomClassrooms.length > 0) {
      const classIds = homeroomClassrooms.map((c) => c.id);
      const [{ data: enrolls }, { data: todayStudentAtt }] = await Promise.all([
        supabase
          .from('student_enrollments')
          .select('classroom_id, student_id')
          .in('classroom_id', classIds),
        supabase
          .from('student_attendances')
          .select('classroom_id, status')
          .in('classroom_id', classIds)
          .eq('attendance_date', todayDate),
      ]);

      homeroomDetails = homeroomClassrooms.map((cls) => {
        const clsEnrolls = (enrolls || []).filter((e) => e.classroom_id === cls.id);
        const clsAtt = (todayStudentAtt || []).filter((a) => a.classroom_id === cls.id);
        return {
          classroomId: cls.id,
          classroomName: cls.name,
          gradeLevel: cls.grade_level,
          studentsCount: clsEnrolls.length,
          todayPresent: clsAtt.filter((a) => a.status === 'HADIR').length,
          todaySick: clsAtt.filter((a) => a.status === 'SAKIT').length,
          todayPermit: clsAtt.filter((a) => a.status === 'IZIN').length,
          todayAlpha: clsAtt.filter((a) => a.status === 'ALPA').length,
        };
      });
    }

    teachingSummary = {
      totalWeeklySchedules: (teacherSchedules || []).length,
      totalWeeklyScheduledJtm: (teacherSchedules || []).reduce(
        (acc, s) => acc + Number(s.jtm_count || 0),
        0
      ),
      todaySchedules: todaySchedules.map((s) => ({
        ...s,
        journalSubmittedToday: todayJournalScheduleIds.has(s.id),
      })),
      picketSchedules: picketRows || [],
      isPicketToday: (picketRows || []).some((p) => p.day_of_week === todayDayOfWeek),
      todayAttendances: todayAttRows || [],
      monthJtmBreakdown: {
        teaching: Number(teachingJtmMonth.toFixed(2)),
        picket: Number(picketJtmMonth.toFixed(2)),
        event: Number(eventJtmMonth.toFixed(2)),
        exam: Number(examJtmMonth.toFixed(2)),
        holiday: Number(holidayJtmMonth.toFixed(2)),
        total: Number(
          (
            teachingJtmMonth +
            picketJtmMonth +
            eventJtmMonth +
            examJtmMonth +
            holidayJtmMonth
          ).toFixed(2)
        ),
      },
      upcomingExamSupervisions: examSupervisorRows || [],
      examCommittees: examCommitteeRows || [],
      homeroomDetails,
      currentHonorarium: currentHonorarium || null,
    };
  }

  // --- C. Finance Summary (SPP, Tabungan, Honorarium) ---
  let financeSummary: Record<string, unknown> | null = null;
  if (isFinanceRole) {
    const canSeeSpp = isGuruOnlyDashboard
      ? hasBendaharaKomiteDuty
      : hasRole([
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
        ]);
    const canSeeTabungan = isGuruOnlyDashboard
      ? hasPengelolaTabunganDuty
      : hasRole([
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'PENGELOLA_TABUNGAN',
          'BENDAHARA',
        ]);
    const canSeeHonorarium = isGuruOnlyDashboard
      ? false
      : hasRole([
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'BENDAHARA',
          'KEPALA_TU',
        ]);

    const [
      billsRes,
      paymentsRes,
      savingsAccRes,
      savingsTrxRes,
      honorSettingsRes,
      honorSlipsRes,
    ] = await Promise.all([
      canSeeSpp
        ? supabase.from('student_bills').select('id, amount, paid_amount, status')
        : Promise.resolve({ data: null }),
      canSeeSpp
        ? supabase
            .from('bill_payments')
            .select(
              'id, receipt_number, amount_paid, payment_method, payment_date, bill:student_bills(student:students(full_name), fee_type:fee_types(name))'
            )
            .order('payment_date', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: null }),
      canSeeTabungan
        ? supabase.from('savings_accounts').select('id, balance, owner_type, is_active').eq('is_active', true)
        : Promise.resolve({ data: null }),
      canSeeTabungan
        ? supabase
            .from('savings_transactions')
            .select(
              'id, transaction_type, amount, balance_after, transaction_date, account:savings_accounts(account_number, owner_name)'
            )
            .order('transaction_date', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: null }),
      canSeeHonorarium
        ? supabase
            .from('honorarium_settings')
            .select('rate_per_jtm, transport_rate_per_km')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      canSeeHonorarium
        ? supabase
            .from('teacher_honorariums')
            .select('id, total_jtm, total_amount, status, period_month, period_year, teacher:teachers_staff(full_name)')
            .eq('period_month', currentMonth)
            .eq('period_year', currentYear)
        : Promise.resolve({ data: null }),
    ]);

    const bills = billsRes.data || [];
    const savingsAccounts = savingsAccRes.data || [];
    const honorSlips = honorSlipsRes.data || [];

    financeSummary = {
      spp: canSeeSpp
        ? {
            totalBillsCount: bills.length,
            totalBilledAmount: bills.reduce((s, b) => s + Number(b.amount || 0), 0),
            totalPaidAmount: bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0),
            unpaidBillsCount: bills.filter((b) => b.status !== 'LUNAS').length,
            paidBillsCount: bills.filter((b) => b.status === 'LUNAS').length,
            recentPayments: paymentsRes.data || [],
          }
        : null,
      tabungan: canSeeTabungan
        ? {
            activeAccountsCount: savingsAccounts.length,
            totalBalance: savingsAccounts.reduce((s, a) => s + Number(a.balance || 0), 0),
            recentTransactions: savingsTrxRes.data || [],
          }
        : null,
      honorarium: canSeeHonorarium
        ? {
            ratePerJtm: Number(honorSettingsRes.data?.rate_per_jtm ?? 25000),
            transportRatePerKm: Number(honorSettingsRes.data?.transport_rate_per_km ?? 2000),
            currentMonthSlipsCount: honorSlips.length,
            currentMonthTotalAmount: honorSlips.reduce((s, h) => s + Number(h.total_amount || 0), 0),
            paidSlipsCount: honorSlips.filter((h) => h.status === 'PAID').length,
            draftOrApprovedCount: honorSlips.filter((h) => h.status !== 'PAID').length,
          }
        : null,
    };
  }

  // --- D. BK Summary ---
  let bkSummary: Record<string, unknown> | null = null;
  if (isBkRole) {
    const { data: bkRows } = await supabase
      .from('bk_records')
      .select('id, record_type, title, points, incident_date, student:students(full_name, nis)')
      .order('incident_date', { ascending: false })
      .limit(50);

    const list = bkRows || [];
    bkSummary = {
      totalRecords: list.length,
      konsultasiCount: list.filter((r) => r.record_type === 'KONSULTASI').length,
      prestasiCount: list.filter((r) => r.record_type === 'PRESTASI').length,
      pelanggaranCount: list.filter((r) => r.record_type === 'PELANGGARAN').length,
      recentRecords: list.slice(0, 5),
    };
  }

  // --- E. Guru Wali Summary ---
  let guruWaliSummary: Record<string, unknown> | null = null;
  if (isGuruWaliRole) {
    const isGlobalAdmin = hasRole(['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA']);
    let assignQuery = supabase
      .from('guru_wali_assignments')
      .select('id, teacher_id, teacher:teachers_staff(full_name), student:students(id, full_name, nis)');
    if (teacherRow && !isGlobalAdmin) {
      assignQuery = assignQuery.eq('teacher_id', teacherRow.id);
    }
    const [{ data: gwAssigns }, { data: gwLogs }] = await Promise.all([
      assignQuery.limit(100),
      supabase
        .from('guru_wali_mentoring_logs')
        .select(
          'id, mentoring_date, topic, aspect, notes, assignment:guru_wali_assignments(teacher_id, teacher:teachers_staff(full_name), student:students(full_name))'
        )
        .order('mentoring_date', { ascending: false })
        .limit(30),
    ]);

    const filteredLogs =
      teacherRow && !isGlobalAdmin
        ? (gwLogs || []).filter((l) => {
            const a = Array.isArray(l.assignment) ? l.assignment[0] : l.assignment;
            return a?.teacher_id === teacherRow.id;
          })
        : gwLogs || [];

    guruWaliSummary = {
      mentoredStudentsCount: (gwAssigns || []).length,
      mentoredStudents: (gwAssigns || []).slice(0, 8),
      recentLogs: filteredLogs.slice(0, 5),
    };
  }

  // --- F. Library Summary ---
  let librarySummary: Record<string, unknown> | null = null;
  if (isLibraryRole) {
    const [
      { data: booksRows },
      { count: membersCount },
      { data: loansRows },
    ] = await Promise.all([
      supabase
        .from('library_books')
        .select('id, title, author, book_format, available_copies, total_copies')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('library_members').select('id', { count: 'exact', head: true }),
      supabase
        .from('library_loans')
        .select('id, member_id, loan_date, due_date, return_date, status, fine_amount, book:library_books(title), member:library_members(full_name, member_code)')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const booksList = booksRows || [];
    const loansList = loansRows || [];
    const personalLoans = libMemberRow
      ? loansList.filter((l) => l.member_id === libMemberRow.id)
      : [];

    librarySummary = {
      totalBookTitles: booksList.length,
      totalCopiesAvailable: booksList.reduce((s, b) => s + Number(b.available_copies || 0), 0),
      totalMembersCount: membersCount ?? 0,
      activeLoansCount: loansList.filter((l) => l.status === 'DIPINJAM').length,
      recentBooks: booksList.slice(0, 5),
      recentLoans: loansList.slice(0, 5),
      personalLoans,
    };
  }

  // --- G. Student / Parent Personal Summary ---
  let studentPersonalSummary: Record<string, unknown> | null = null;
  let targetStudent = studentRow;
  if (!targetStudent && hasRole(['ORANG_TUA'])) {
    const { data: guardianLink } = await supabase
      .from('student_guardians')
      .select('student:students(*)')
      .eq('profile_id', session.userId)
      .limit(1)
      .maybeSingle();
    if (guardianLink?.student) {
      targetStudent = Array.isArray(guardianLink.student)
        ? guardianLink.student[0]
        : guardianLink.student;
    }
  }

  if (targetStudent) {
    const [
      { data: enrollment },
      { data: docs },
      { data: bills },
      { data: savings },
      { data: attRows },
    ] = await Promise.all([
      supabase
        .from('student_enrollments')
        .select('classroom:classrooms(id, name, grade_level, homeroom_teacher:teachers_staff(full_name))')
        .eq('student_id', targetStudent.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('student_documents')
        .select('id, document_type, verification_status')
        .eq('student_id', targetStudent.id),
      supabase
        .from('student_bills')
        .select('id, amount, paid_amount, status, billing_month, billing_year, fee_type:fee_types(name)')
        .eq('student_id', targetStudent.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('savings_accounts')
        .select('id, account_number, balance')
        .eq('student_id', targetStudent.id)
        .maybeSingle(),
      supabase
        .from('student_attendances')
        .select('status')
        .eq('student_id', targetStudent.id)
        .gte('attendance_date', monthStart),
    ]);

    const docsList = docs || [];
    const billsList = bills || [];
    const attList = attRows || [];

    studentPersonalSummary = {
      student: {
        id: targetStudent.id,
        full_name: targetStudent.full_name,
        nis: targetStudent.nis,
        nisn: targetStudent.nisn,
        status: targetStudent.status,
      },
      classroom: enrollment?.classroom || null,
      documents: {
        uploadedCount: docsList.length,
        verifiedCount: docsList.filter((d) => d.verification_status === 'TERVERIFIKASI').length,
        pendingCount: docsList.filter((d) => d.verification_status === 'MENUNGGU').length,
      },
      bills: {
        unpaidCount: billsList.filter((b) => b.status !== 'LUNAS').length,
        unpaidAmount: billsList
          .filter((b) => b.status !== 'LUNAS')
          .reduce((s, b) => s + (Number(b.amount || 0) - Number(b.paid_amount || 0)), 0),
        recentBills: billsList.slice(0, 4),
      },
      savings: savings || null,
      monthAttendance: {
        hadir: attList.filter((a) => a.status === 'HADIR').length,
        sakit: attList.filter((a) => a.status === 'SAKIT').length,
        izin: attList.filter((a) => a.status === 'IZIN').length,
        alpa: attList.filter((a) => a.status === 'ALPA').length,
      },
    };
  }

  // --- H. Alumni Summary ---
  let alumniSummary: Record<string, unknown> | null = null;
  if (isAlumniRole) {
    const { data: tracerRows } = await supabase
      .from('alumni_tracers')
      .select('id, full_name, graduation_year, current_activity, institution_or_company, major_or_position')
      .order('graduation_year', { ascending: false })
      .limit(100);

    const list = tracerRows || [];
    alumniSummary = {
      totalTracers: list.length,
      kuliahCount: list.filter((a) => a.current_activity === 'KULIAH').length,
      bekerjaCount: list.filter((a) => a.current_activity === 'BEKERJA').length,
      wirausahaCount: list.filter((a) => a.current_activity === 'WIRAUSAHA').length,
      pesantrenCount: list.filter((a) => a.current_activity === 'PESANTREN').length,
      recentTracers: list.slice(0, 5),
    };
  }

  return NextResponse.json({
    todayDate,
    todayDayOfWeek,
    user: {
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      primaryRole: session.primaryRole,
      roles: session.roles,
      effectiveRoles,
    },
    academicYear: activeYear || { name: '2026/2027', semester: 'GANJIL' },
    todayCalendarEvent: todayCalEvent || null,
    teacherProfile: teacherRow
      ? {
          id: teacherRow.id,
          full_name: teacherRow.full_name,
          nip: teacherRow.nip,
          nuptk: teacherRow.nuptk,
          staff_type: teacherRow.staff_type,
          employment_status: teacherRow.employment_status,
          home_distance_km: Number(teacherRow.home_distance_km ?? 0),
          additionalDuties,
          homeroomClassrooms,
        }
      : null,
    studentProfile: studentPersonalSummary,
    libraryMember: libMemberRow
      ? {
          id: libMemberRow.id,
          member_code: libMemberRow.member_code,
          member_type: libMemberRow.member_type,
          status: libMemberRow.status,
        }
      : null,
    executiveSummary,
    teachingSummary,
    financeSummary,
    bkSummary,
    guruWaliSummary,
    librarySummary,
    alumniSummary,
  });
}
