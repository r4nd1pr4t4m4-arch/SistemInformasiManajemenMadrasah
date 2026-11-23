import type { AppRole } from '@/types/database';

export const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatEnum(value: string | null | undefined, fallback = '-'): string {
  if (!value) return fallback;
  return value.replace(/_/g, ' ');
}

export interface AdditionalDutyItem {
  id: string;
  decree_number: string | null;
  code: string;
  name: string;
  receives_allowance: boolean;
  monthly_allowance: number;
}

export interface DashboardPayload {
  todayDate: string;
  todayDayOfWeek: number;
  user: {
    userId: string;
    fullName: string;
    email: string | null;
    primaryRole: AppRole;
    roles: AppRole[];
    effectiveRoles: AppRole[];
  };
  academicYear: {
    name: string;
    semester: string;
  };
  todayCalendarEvent: {
    id: string;
    event_date: string;
    title: string;
    category: string;
    description: string | null;
  } | null;
  teacherProfile: {
    id: string;
    full_name: string;
    nip: string | null;
    nuptk: string | null;
    staff_type: string;
    employment_status: string | null;
    home_distance_km: number;
    additionalDuties: AdditionalDutyItem[];
    homeroomClassrooms: Array<{
      id: string;
      name: string;
      grade_level: string;
      room_location: string | null;
    }>;
  } | null;
  studentProfile: {
    student: {
      id: string;
      full_name: string;
      nis: string | null;
      nisn: string | null;
      status: string;
    };
    classroom: {
      id: string;
      name: string;
      grade_level: string;
      homeroom_teacher?: { full_name: string } | null;
    } | null;
    documents: {
      uploadedCount: number;
      verifiedCount: number;
      pendingCount: number;
    };
    bills: {
      unpaidCount: number;
      unpaidAmount: number;
      recentBills: Array<{
        id: string;
        amount: number;
        paid_amount: number;
        status: string;
        billing_month: number | null;
        billing_year: number | null;
        fee_type?: { name: string } | null;
      }>;
    };
    savings: {
      id: string;
      account_number: string;
      balance: number;
    } | null;
    monthAttendance: {
      hadir: number;
      sakit: number;
      izin: number;
      alpa: number;
    };
  } | null;
  libraryMember: {
    id: string;
    member_code: string;
    member_type: string;
    status: string;
  } | null;
  executiveSummary: {
    activeStudentsCount: number;
    activeTeachersCount: number;
    classroomsCount: number;
    subjectsCount: number;
    pendingAccountsCount: number;
    todayAttendanceTotal: number;
    todayAttendanceUnconfirmed: number;
    recentTodayAttendances: Array<{
      id: string;
      attendance_type: string;
      admin_confirmed: boolean;
      check_in_time: string | null;
      check_out_time: string | null;
      teacher?: { full_name: string } | null;
    }>;
    ppdb: {
      total: number;
      waitingVerification: number;
      verified: number;
      accepted: number;
      recentRegistrations: Array<{
        id: string;
        full_name: string;
        pathway: string | null;
        status: string;
        created_at: string;
      }>;
    };
    facilities: {
      totalItems: number;
      totalUnits: number;
      goodConditionCount: number;
      needsAttentionCount: number;
      damagedList: Array<{
        id: string;
        name: string;
        category: string | null;
        quantity: number;
        condition: string;
      }>;
    };
    recentLetters: Array<{
      id: string;
      direction: string;
      category: string;
      letter_number: string;
      letter_date: string;
      subject: string;
      counterparty: string | null;
    }>;
    upcomingEvents: Array<{
      id: string;
      title: string;
      event_type: string;
      day_of_week: number | null;
      start_date: string | null;
      location: string | null;
      jtm_allocated: number;
    }>;
  } | null;
  teachingSummary: {
    totalWeeklySchedules: number;
    totalWeeklyScheduledJtm: number;
    todaySchedules: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      jtm_count: number;
      journalSubmittedToday: boolean;
      classroom?: { id: string; name: string } | null;
      subject?: { name: string; code: string } | null;
    }>;
    picketSchedules: Array<{
      id: string;
      day_of_week: number;
      notes: string | null;
    }>;
    isPicketToday: boolean;
    todayAttendances: Array<{
      id: string;
      attendance_type: string;
      check_in_time: string | null;
      check_out_time: string | null;
      admin_confirmed: boolean;
      is_within_geofence: boolean;
    }>;
    monthJtmBreakdown: {
      teaching: number;
      picket: number;
      event: number;
      exam: number;
      holiday: number;
      total: number;
    };
    upcomingExamSupervisions: Array<{
      id: string;
      exam_date: string;
      session_name: string;
      subject_name: string | null;
      jtm_allocated: number;
      room?: { room_name: string } | null;
      period?: { name: string } | null;
    }>;
    examCommittees: Array<{
      id: string;
      committee_role: string;
      jtm_allocated: number;
      period?: { name: string; is_active?: boolean } | null;
    }>;
    homeroomDetails: Array<{
      classroomId: string;
      classroomName: string;
      gradeLevel: string;
      studentsCount: number;
      todayPresent: number;
      todaySick: number;
      todayPermit: number;
      todayAlpha: number;
    }>;
    currentHonorarium: {
      total_jtm: number;
      total_amount: number;
      status: string;
    } | null;
  } | null;
  financeSummary: {
    spp: {
      totalBillsCount: number;
      totalBilledAmount: number;
      totalPaidAmount: number;
      unpaidBillsCount: number;
      paidBillsCount: number;
      recentPayments: Array<{
        id: string;
        receipt_number: string;
        amount_paid: number;
        payment_method: string;
        payment_date: string;
        bill?: {
          student?: { full_name: string } | null;
          fee_type?: { name: string } | null;
        } | null;
      }>;
    } | null;
    tabungan: {
      activeAccountsCount: number;
      totalBalance: number;
      recentTransactions: Array<{
        id: string;
        transaction_type: string;
        amount: number;
        balance_after: number;
        transaction_date: string;
        account?: { account_number: string; owner_name: string } | null;
      }>;
    } | null;
    honorarium: {
      ratePerJtm: number;
      transportRatePerKm: number;
      currentMonthSlipsCount: number;
      currentMonthTotalAmount: number;
      paidSlipsCount: number;
      draftOrApprovedCount: number;
    } | null;
  } | null;
  bkSummary: {
    totalRecords: number;
    konsultasiCount: number;
    prestasiCount: number;
    pelanggaranCount: number;
    recentRecords: Array<{
      id: string;
      record_type: string;
      title: string;
      points: number;
      incident_date: string;
      student?: { full_name: string; nis: string | null } | null;
    }>;
  } | null;
  guruWaliSummary: {
    mentoredStudentsCount: number;
    mentoredStudents: Array<{
      id: string;
      teacher?: { full_name: string } | null;
      student?: { id: string; full_name: string; nis: string | null } | null;
    }>;
    recentLogs: Array<{
      id: string;
      mentoring_date: string;
      topic: string;
      aspect: string;
      notes: string;
      assignment?: {
        teacher?: { full_name: string } | null;
        student?: { full_name: string } | null;
      } | null;
    }>;
  } | null;
  librarySummary: {
    totalBookTitles: number;
    totalCopiesAvailable: number;
    totalMembersCount: number;
    activeLoansCount: number;
    recentBooks: Array<{
      id: string;
      title: string;
      author: string;
      book_format: string;
      available_copies: number;
      total_copies: number;
    }>;
    recentLoans: Array<{
      id: string;
      loan_date: string;
      due_date: string;
      status: string;
      fine_amount: number;
      book?: { title: string } | null;
      member?: { full_name: string; member_code: string } | null;
    }>;
    personalLoans: Array<{
      id: string;
      loan_date: string;
      due_date: string;
      status: string;
      book?: { title: string } | null;
    }>;
  } | null;
  alumniSummary: {
    totalTracers: number;
    kuliahCount: number;
    bekerjaCount: number;
    wirausahaCount: number;
    pesantrenCount: number;
    recentTracers: Array<{
      id: string;
      full_name: string;
      graduation_year: number;
      current_activity: string;
      institution_or_company: string | null;
      major_or_position: string | null;
    }>;
  } | null;
}
