import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { escapeLikePattern, resolveTeacherForProfile } from '@/lib/sdm/sync';

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      profile: {
        userId: session.userId,
        fullName: session.fullName,
        email: session.email,
        roles: session.roles,
      },
      student: null,
      children: [],
      teacher: null,
      classroom: null,
      schedules: [],
      pickets: [],
      savingsAccounts: [],
      savingsTransactions: [],
      attendances: [],
      bills: [],
      payments: [],
      honorariums: [],
      bkRecords: [],
      examRooms: [],
      guruWaliTeacher: null,
      guruWaliLogs: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const scopeParam = request.nextUrl.searchParams.get('scope');
  const section = request.nextUrl.searchParams.get('section') || 'all';
  const requestedStudentId = request.nextUrl.searchParams.get('student_id');

  const canViewGtk = hasAnyRole(session, PERMISSIONS.GTK_PERSONAL_VIEW);
  const canViewOrtu = session.roles.includes('ORANG_TUA');
  const canViewSiswa = session.roles.includes('SISWA');
  const canViewUmum = session.roles.includes('UMUM') || session.roles.includes('ALUMNI');

  if (
    (scopeParam === 'gtk' && !canViewGtk) ||
    (scopeParam === 'orang-tua' && !canViewOrtu) ||
    (scopeParam === 'siswa' && !canViewSiswa) ||
    (scopeParam === 'umum' && !canViewUmum)
  ) {
    return NextResponse.json(
      { error: 'Akses ditolak. Peran akun Anda tidak memiliki izin untuk ruang lingkup ini.' },
      { status: 403 }
    );
  }

  const scope =
    scopeParam ||
    (session.roles.includes('SISWA')
      ? 'siswa'
      : session.roles.includes('ORANG_TUA')
      ? 'orang-tua'
      : canViewGtk
      ? 'gtk'
      : 'umum');

  // 1. Resolve identity (student / children / teacher)
  let activeStudent: Record<string, unknown> | null = null;
  let children: Array<Record<string, unknown>> = [];
  let activeTeacher: Record<string, unknown> | null = null;
  let activeClassroom: Record<string, unknown> | null = null;

  if (scope === 'siswa' || session.roles.includes('SISWA')) {
    const { data: st } = await supabase
      .from('students')
      .select('id, full_name, nis, nisn, gender, status, phone, email')
      .eq('profile_id', session.userId)
      .maybeSingle();
    if (st) activeStudent = st;
  }

  if ((scope === 'orang-tua' || session.roles.includes('ORANG_TUA')) && canViewOrtu) {
    const { data: guards, error: guardsErr } = await supabase
      .from('student_guardians')
      .select(
        'id, relationship, is_primary, student:students(id, full_name, nis, nisn, gender, status, phone, email)'
      )
      .eq('profile_id', session.userId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    if (guardsErr) {
      console.error('[api/portal/personal] student_guardians query error:', guardsErr.message);
    }

    let guardianRows = guards || [];

    // Fallback: jika role ORANG_TUA aktif namun profile_id belum tertaut, cocokkan via email yang sama
    if (guardianRows.length === 0 && session.email) {
      const { data: byEmailGuards } = await supabase
        .from('student_guardians')
        .select(
          'id, relationship, is_primary, student:students(id, full_name, nis, nisn, gender, status, phone, email)'
        )
        .ilike('email', escapeLikePattern(session.email.trim()))
        .is('profile_id', null)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (byEmailGuards && byEmailGuards.length > 0) {
        await supabase
          .from('student_guardians')
          .update({ profile_id: session.userId, updated_at: new Date().toISOString() })
          .in(
            'id',
            byEmailGuards.map((g) => g.id)
          )
          .is('profile_id', null);
        guardianRows = byEmailGuards;
      }
    }

    const childMap = new Map<string, Record<string, unknown>>();
    for (const g of guardianRows) {
      const st = (Array.isArray(g.student) ? g.student[0] : g.student) as
        | Record<string, unknown>
        | null
        | undefined;
      if (st?.id && !childMap.has(String(st.id))) {
        childMap.set(String(st.id), {
          relation: g.relationship,
          is_primary: g.is_primary,
          ...st,
        });
      }
    }
    children = Array.from(childMap.values());

    if (scope === 'orang-tua' && children.length > 0) {
      activeStudent =
        (requestedStudentId ? children.find((c) => c.id === requestedStudentId) : null) ||
        children[0];
    }
  }

  if (scope === 'gtk' && canViewGtk) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', session.userId)
      .maybeSingle();
    activeTeacher = await resolveTeacherForProfile(supabase, {
      userId: session.userId,
      email: prof?.email || session.email,
      fullName: prof?.full_name || session.fullName,
      phone: prof?.phone || null,
    });
  }

  // Resolve active classroom for activeStudent (prefer active academic year)
  if (activeStudent?.id) {
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select(
        'classroom_id, academic_year_id, classroom:classrooms(id, name, grade_level, homeroom_teacher:teachers_staff(full_name)), academic_year:academic_years(id, name, is_active)'
      )
      .eq('student_id', activeStudent.id as string)
      .order('created_at', { ascending: false })
      .limit(10);

    const activeEnrollment =
      (enrollments || []).find((e) => {
        const ay = e.academic_year as unknown as { is_active?: boolean } | null;
        return Boolean(ay?.is_active);
      }) || enrollments?.[0];

    if (activeEnrollment?.classroom) {
      activeClassroom = activeEnrollment.classroom as unknown as Record<string, unknown>;
    }
  }

  const wants = (key: string) => section === 'all' || section === key;

  // 2. Weekly schedules (pelajaran for siswa/ortu, mengajar for gtk)
  let schedules: Array<Record<string, unknown>> = [];
  if (wants('jadwal-pelajaran')) {
    if ((scope === 'siswa' || scope === 'orang-tua') && activeClassroom?.id) {
      const { data } = await supabase
        .from('schedules')
        .select(
          'id, day_of_week, start_time, end_time, jtm_count, subject:subjects(id, code, name, subject_group), teacher:teachers_staff(id, full_name), classroom:classrooms(id, name, grade_level)'
        )
        .eq('classroom_id', activeClassroom.id as string)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      schedules = data || [];
    } else if (scope === 'gtk' && activeTeacher?.id) {
      const { data } = await supabase
        .from('schedules')
        .select(
          'id, day_of_week, start_time, end_time, jtm_count, subject:subjects(id, code, name, subject_group), teacher:teachers_staff(id, full_name), classroom:classrooms(id, name, grade_level)'
        )
        .eq('teacher_id', activeTeacher.id as string)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      schedules = data || [];
    }
  }

  // 3. Picket schedules (class picket for siswa/ortu, teacher picket for gtk)
  let pickets: Array<Record<string, unknown>> = [];
  if (wants('jadwal-piket')) {
    if ((scope === 'siswa' || scope === 'orang-tua') && activeClassroom?.id) {
      const { data } = await supabase
        .from('student_picket_schedules')
        .select(
          'id, classroom_id, student_id, day_of_week, task_notes, student:students(id, full_name, nis, gender)'
        )
        .eq('classroom_id', activeClassroom.id as string)
        .order('day_of_week', { ascending: true });
      pickets = data || [];
    } else if (scope === 'gtk' && activeTeacher?.id) {
      const { data } = await supabase
        .from('picket_schedules')
        .select('id, day_of_week, notes, academic_year:academic_years(name)')
        .eq('teacher_id', activeTeacher.id as string)
        .order('day_of_week', { ascending: true });
      pickets = data || [];
    }
  }

  // 4. Savings account & transactions
  let savingsAccounts: Array<Record<string, unknown>> = [];
  let savingsTransactions: Array<Record<string, unknown>> = [];
  if (wants('tabungan')) {
    let accQuery = supabase.from('savings_accounts').select('*');
    if ((scope === 'siswa' || scope === 'orang-tua') && activeStudent?.id) {
      accQuery = accQuery.eq('student_id', activeStudent.id as string);
    } else if (scope === 'gtk' && activeTeacher?.id) {
      accQuery = accQuery.eq('teacher_id', activeTeacher.id as string);
    } else {
      // UMUM / ALUMNI: match by phone from user profile, restricted to UMUM owner_type
      const { data: prof } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', session.userId)
        .maybeSingle();
      if (prof?.phone) {
        accQuery = accQuery.eq('owner_type', 'UMUM').eq('owner_phone', prof.phone);
      } else {
        accQuery = accQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: accData } = await accQuery.order('created_at', { ascending: false });
    savingsAccounts = accData || [];

    if (savingsAccounts.length > 0) {
      const accIds = savingsAccounts.map((a) => a.id as string);
      const { data: trxData } = await supabase
        .from('savings_transactions')
        .select('*')
        .in('account_id', accIds)
        .order('transaction_date', { ascending: false })
        .limit(1000);
      savingsTransactions = trxData || [];
    }
  }

  // 5. Attendance history
  let attendances: Array<Record<string, unknown>> = [];
  if (wants('absensi')) {
    if ((scope === 'siswa' || scope === 'orang-tua') && activeStudent?.id) {
      const { data } = await supabase
        .from('student_attendances')
        .select(
          'id, attendance_date, status, notes, schedule_id, schedule:schedules(day_of_week, start_time, end_time, subject:subjects(name)), classroom:classrooms(name)'
        )
        .eq('student_id', activeStudent.id as string)
        .order('attendance_date', { ascending: false })
        .limit(120);
      attendances = data || [];
    } else if (scope === 'gtk' && activeTeacher?.id) {
      const { data } = await supabase
        .from('teacher_attendances')
        .select(
          'id, attendance_date, check_in_time, check_out_time, attendance_type, jtm_earned, is_within_geofence, distance_meters, schedule:schedules(subject:subjects(name), classroom:classrooms(name))'
        )
        .eq('teacher_id', activeTeacher.id as string)
        .order('attendance_date', { ascending: false })
        .limit(120);
      attendances = data || [];
    }
  }

  // 6. SPP bills & payments (siswa / orang-tua)
  let bills: Array<Record<string, unknown>> = [];
  let payments: Array<Record<string, unknown>> = [];
  if (wants('spp') && (scope === 'siswa' || scope === 'orang-tua') && activeStudent?.id) {
    const { data: billData } = await supabase
      .from('student_bills')
      .select('*, fee_type:fee_types(id, name, category, is_recurring_monthly)')
      .eq('student_id', activeStudent.id as string)
      .order('billing_year', { ascending: false })
      .order('billing_month', { ascending: false });
    bills = billData || [];

    if (bills.length > 0) {
      const billIds = bills.map((b) => b.id as string);
      const { data: payData } = await supabase
        .from('bill_payments')
        .select('*')
        .in('bill_id', billIds)
        .order('payment_date', { ascending: false });
      payments = payData || [];
    }
  }

  // 7. Personal Honorarium Slips (GTK)
  let honorariums: Array<Record<string, unknown>> = [];
  if (wants('honorarium') && scope === 'gtk' && activeTeacher?.id) {
    const { data } = await supabase
      .from('teacher_honorariums')
      .select('*, items:teacher_honorarium_duty_items(*)')
      .eq('teacher_id', activeTeacher.id as string)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(24);
    honorariums = data || [];
  }

  // 8. BK Records (non-confidential only, for siswa / orang-tua)
  let bkRecords: Array<Record<string, unknown>> = [];
  if (wants('bk') && (scope === 'siswa' || scope === 'orang-tua') && activeStudent?.id) {
    const { data } = await supabase
      .from('bk_records')
      .select('id, incident_date, record_type, title, description, follow_up, counselor:teachers_staff(full_name)')
      .eq('student_id', activeStudent.id as string)
      .eq('is_confidential', false)
      .order('incident_date', { ascending: false })
      .limit(50);
    bkRecords = data || [];
  }

  // 9. Exam Rooms / Periods (siswa / orang-tua)
  let examRooms: Array<Record<string, unknown>> = [];
  if (wants('ujian') && (scope === 'siswa' || scope === 'orang-tua') && activeStudent?.id) {
    const { data } = await supabase
      .from('exam_room_students')
      .select(
        'id, seat_number, exam_room:exam_rooms(id, room_name, period:exam_periods(name, start_date, end_date))'
      )
      .eq('student_id', activeStudent.id as string);
    examRooms = data || [];
  }

  // 10. Rekam Jejak Bimbingan Guru Wali (siswa / orang-tua)
  let guruWaliTeacher: { full_name?: string | null } | null = null;
  let guruWaliLogs: Array<Record<string, unknown>> = [];
  if (wants('guru-wali') && (scope === 'siswa' || scope === 'orang-tua') && activeStudent?.id) {
    const { data: assignRows } = await supabase
      .from('guru_wali_assignments')
      .select(
        'id, teacher:teachers_staff(full_name), academic_year:academic_years(name, is_active)'
      )
      .eq('student_id', activeStudent.id as string)
      .order('created_at', { ascending: false });

    const assigns = assignRows || [];
    if (assigns.length > 0) {
      const activeAssign =
        assigns.find((a) => {
          const ay = (Array.isArray(a.academic_year) ? a.academic_year[0] : a.academic_year) as
            | { is_active?: boolean }
            | null
            | undefined;
          return Boolean(ay?.is_active);
        }) || assigns[0];

      const t = (Array.isArray(activeAssign.teacher)
        ? activeAssign.teacher[0]
        : activeAssign.teacher) as { full_name?: string | null } | null | undefined;
      if (t?.full_name) {
        guruWaliTeacher = { full_name: t.full_name };
      }

      const assignIds = assigns.map((a) => a.id as string);
      const { data: logRows } = await supabase
        .from('guru_wali_mentoring_logs')
        .select(
          'id, mentoring_date, topic, aspect, notes, recommendation, assignment:guru_wali_assignments(teacher:teachers_staff(full_name))'
        )
        .in('assignment_id', assignIds)
        .order('mentoring_date', { ascending: false })
        .limit(100);
      guruWaliLogs = logRows || [];
    }
  }

  return NextResponse.json({
    scope,
    profile: {
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      roles: session.roles,
    },
    student: activeStudent,
    children,
    teacher: activeTeacher,
    classroom: activeClassroom,
    schedules,
    pickets,
    savingsAccounts,
    savingsTransactions,
    attendances,
    bills,
    payments,
    honorariums,
    bkRecords,
    examRooms,
    guruWaliTeacher,
    guruWaliLogs,
  });
}
