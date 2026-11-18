'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MapPin,
  PiggyBank,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

interface AdditionalDutyItem {
  id: string;
  decree_number: string | null;
  code: string;
  name: string;
  receives_allowance: boolean;
  monthly_allowance: number;
}

interface DashboardPayload {
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

export default function PortalDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/portal/dashboard', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore network error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="glass-card rounded-3xl p-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Memuat ringkasan data operasional sesuai peran &amp; tugas tambahan Anda...</span>
        </div>
      </div>
    );
  }

  const user = data?.user;
  const effectiveRoles: AppRole[] = user?.effectiveRoles || user?.roles || [];
  const hasRole = (roles: AppRole[]) => effectiveRoles.some((r) => roles.includes(r));

  const teacher = data?.teacherProfile;
  const additionalDuties = teacher?.additionalDuties || [];
  const homeroomClasses = teacher?.homeroomClassrooms || [];
  const exec = data?.executiveSummary;
  const teaching = data?.teachingSummary;
  const finance = data?.financeSummary;
  const bk = data?.bkSummary;
  const guruWali = data?.guruWaliSummary;
  const library = data?.librarySummary;
  const studentPersonal = data?.studentProfile;
  const alumni = data?.alumniSummary;

  const todayFormatted = data?.todayDate
    ? new Date(`${data.todayDate}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. HERO HEADER: IDENTITAS, PERAN AKTIF & TUGAS TAMBAHAN */}
      <section className="glass-card rounded-3xl p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Peran: {(user?.roles || []).join(' • ')}
              </span>
              {data?.academicYear && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  TA {data.academicYear.name} ({data.academicYear.semester})
                </span>
              )}
              {todayFormatted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {todayFormatted}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Assalamu&apos;alaikum, {user?.fullName || 'Pengguna'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Pusat kendali dan informasi real-time yang disesuaikan secara otomatis dengan peran utama
              serta penugasan/tugas tambahan aktif Anda di lembaga.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Segarkan Data
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-emerald-700 transition shadow-xs"
            >
              Website Resmi <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Banner Kalender Pendidikan Hari Ini (jika ada agenda/libur) */}
        {data?.todayCalendarEvent && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Kalender Pendidikan Hari Ini: {data.todayCalendarEvent.title}
                </p>
                <p className="text-[11px] text-emerald-800">
                  Kategori: <strong>{data.todayCalendarEvent.category.replace(/_/g, ' ')}</strong>
                  {data.todayCalendarEvent.description
                    ? ` — ${data.todayCalendarEvent.description}`
                    : ''}
                </p>
              </div>
            </div>
            <Link
              href="/portal/akademik/kalender/agenda"
              className="text-xs font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1"
            >
              Lihat Kalender <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Baris Tugas Tambahan & Penugasan Aktif (Jika Pengguna adalah GTK) */}
        {teacher && (
          <div className="pt-4 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-700" />
                Status GTK &amp; Tugas Tambahan:
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
                {teacher.staff_type} {teacher.employment_status ? `(${teacher.employment_status})` : ''}
              </span>
              {homeroomClasses.map((cls) => (
                <span
                  key={cls.id}
                  className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold"
                >
                  Wali Kelas {cls.name}
                </span>
              ))}
              {teaching?.isPicketToday && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  Guru Piket Hari Ini ({DAY_NAMES[data.todayDayOfWeek]})
                </span>
              )}
              {additionalDuties.map((duty) => (
                <span
                  key={duty.id}
                  className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"
                  title={duty.decree_number ? `SK: ${duty.decree_number}` : undefined}
                >
                  {duty.name}
                  {duty.receives_allowance && duty.monthly_allowance > 0
                    ? ` (${formatRupiah(duty.monthly_allowance)}/bln)`
                    : ''}
                </span>
              ))}
              {additionalDuties.length === 0 && homeroomClasses.length === 0 && (
                <span className="text-xs text-slate-500 italic">
                  Tidak ada SK tugas tambahan struktural aktif
                </span>
              )}
            </div>
            {teacher.nip && (
              <span className="text-[11px] font-mono text-slate-500">NIP: {teacher.nip}</span>
            )}
          </div>
        )}
      </section>

      {/* 2. PANEL KHUSUS GTK / GURU / WALI KELAS: PRESENSI, JADWAL HARI INI, JTM & KELAS PERWALIAN */}
      {teaching && teacher && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-700" />
              Kinerja Mengajar, Presensi &amp; Tugas Tambahan Anda
            </h2>
            <Link
              href="/portal/akademik/presensi/gps"
              className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
            >
              Buka Presensi GPS <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 4 Kartu KPI Guru */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-emerald-600">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Presensi Hari Ini</span>
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              {teaching.todayAttendances.length > 0 ? (
                <div>
                  <p className="text-lg font-extrabold text-emerald-700">
                    Sudah Check-In ({teaching.todayAttendances[0].check_in_time?.slice(0, 5) || 'Hadir'})
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {teaching.todayAttendances[0].check_out_time
                      ? `Check-Out: ${teaching.todayAttendances[0].check_out_time.slice(0, 5)}`
                      : 'Belum Check-Out Pulang'}{' '}
                    •{' '}
                    {teaching.todayAttendances[0].admin_confirmed
                      ? 'Terkonfirmasi Admin'
                      : 'Menunggu Konfirmasi'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-extrabold text-amber-700">Belum Presensi</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Lakukan check-in GPS saat tiba di lembaga
                  </p>
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-sky-600">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Akumulasi JTM Bulan Ini</span>
                <TrendingUp className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {teaching.monthJtmBreakdown.total} <span className="text-xs font-semibold text-slate-500">JTM</span>
              </p>
              <p className="text-[11px] text-slate-600">
                KBM: {teaching.monthJtmBreakdown.teaching} • Piket: {teaching.monthJtmBreakdown.picket} •
                Ujian/Acara: {teaching.monthJtmBreakdown.exam + teaching.monthJtmBreakdown.event}
              </p>
            </div>

            <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-indigo-600">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Beban Jadwal Mingguan</span>
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {teaching.totalWeeklyScheduledJtm}{' '}
                <span className="text-xs font-semibold text-slate-500">JTM / Minggu</span>
              </p>
              <p className="text-[11px] text-slate-600">
                {teaching.totalWeeklySchedules} sesi tatap muka • Hari ini:{' '}
                {teaching.todaySchedules.length} sesi
              </p>
            </div>

            <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Tunjangan &amp; Slip Bulan Ini</span>
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">
                {teaching.currentHonorarium
                  ? formatRupiah(teaching.currentHonorarium.total_amount)
                  : formatRupiah(
                      additionalDuties.reduce(
                        (s, d) => s + (d.receives_allowance ? d.monthly_allowance : 0),
                        0
                      )
                    )}
              </p>
              <p className="text-[11px] text-slate-600">
                {teaching.currentHonorarium
                  ? `Status Slip: ${teaching.currentHonorarium.status}`
                  : `${additionalDuties.length} Tugas Tambahan Aktif`}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            {/* Jadwal Mengajar Hari Ini */}
            <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Jadwal Mengajar Anda Hari Ini ({DAY_NAMES[data.todayDayOfWeek]})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Status pengisian Jurnal Pembelajaran untuk setiap jam tatap muka hari ini
                  </p>
                </div>
                <Link
                  href="/portal/akademik/presensi/jurnal"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                >
                  Isi Jurnal KBM
                </Link>
              </div>

              {teaching.todaySchedules.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-6 text-center text-xs text-slate-500">
                  Anda tidak memiliki jadwal mengajar tatap muka pada hari{' '}
                  {DAY_NAMES[data.todayDayOfWeek]}.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {teaching.todaySchedules.map((sch) => (
                    <div
                      key={sch.id}
                      className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            {String(sch.start_time).slice(0, 5)} - {String(sch.end_time).slice(0, 5)}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {sch.subject?.name} ({sch.classroom?.name})
                          </span>
                        </div>
                        <p className="text-slate-500">
                          Kode Mapel: {sch.subject?.code} • Alokasi: {sch.jtm_count} JTM
                        </p>
                      </div>
                      {sch.journalSubmittedToday ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Jurnal Terisi
                        </span>
                      ) : (
                        <Link
                          href="/portal/akademik/presensi/jurnal"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold hover:bg-amber-100"
                        >
                          <Clock className="w-3.5 h-3.5" /> Belum Isi Jurnal
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rincian Tugas Tambahan, Wali Kelas, Piket & Ujian */}
            <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Penugasan &amp; Tugas Tambahan Aktif
              </h3>

              {/* Wali Kelas */}
              {teaching.homeroomDetails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                    Kelas Perwalian Anda (Wali Kelas)
                  </p>
                  {teaching.homeroomDetails.map((hr) => (
                    <div
                      key={hr.classroomId}
                      className="rounded-2xl bg-indigo-50/70 border border-indigo-200/80 p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-950 text-sm">
                          Kelas {hr.classroomName} (Tingkat {hr.gradeLevel})
                        </span>
                        <span className="font-semibold text-indigo-700">
                          {hr.studentsCount} Siswa
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                        <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                          <p className="text-[10px] text-slate-500">Hadir</p>
                          <p className="font-bold text-emerald-700">{hr.todayPresent}</p>
                        </div>
                        <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                          <p className="text-[10px] text-slate-500">Sakit</p>
                          <p className="font-bold text-amber-700">{hr.todaySick}</p>
                        </div>
                        <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                          <p className="text-[10px] text-slate-500">Izin</p>
                          <p className="font-bold text-sky-700">{hr.todayPermit}</p>
                        </div>
                        <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                          <p className="text-[10px] text-slate-500">Alpa</p>
                          <p className="font-bold text-rose-700">{hr.todayAlpha}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Jadwal Piket */}
              {teaching.picketSchedules.length > 0 && (
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950">Jadwal Guru Piket</span>
                    <Link
                      href="/portal/akademik/presensi/laporan-piket"
                      className="text-amber-800 font-semibold hover:underline"
                    >
                      Laporan Piket →
                    </Link>
                  </div>
                  <p className="text-amber-900">
                    Hari Piket:{' '}
                    <strong>
                      {teaching.picketSchedules.map((p) => DAY_NAMES[p.day_of_week]).join(', ')}
                    </strong>
                  </p>
                </div>
              )}

              {/* Pengawas & Panitia Ujian */}
              {(teaching.upcomingExamSupervisions.length > 0 ||
                teaching.examCommittees.length > 0) && (
                <div className="rounded-2xl bg-sky-50/70 border border-sky-200/80 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-950">Penugasan Ujian Aktif</span>
                    <Link
                      href="/portal/akademik/ujian/bap"
                      className="text-sky-800 font-semibold hover:underline"
                    >
                      Buka Modul Ujian →
                    </Link>
                  </div>
                  {teaching.examCommittees.map((c) => (
                    <p key={c.id} className="text-sky-900">
                      • Panitia Ujian: <strong>{c.committee_role}</strong> ({c.jtm_allocated} JTM)
                    </p>
                  ))}
                  {teaching.upcomingExamSupervisions.map((s) => (
                    <p key={s.id} className="text-sky-900">
                      • Pengawas ({s.exam_date}): <strong>{s.session_name}</strong> —{' '}
                      {s.room?.room_name || 'Ruang Ujian'} ({s.jtm_allocated} JTM)
                    </p>
                  ))}
                </div>
              )}

              {/* Daftar SK Tugas Tambahan */}
              {additionalDuties.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    SK Tugas Tambahan Struktural
                  </p>
                  {additionalDuties.map((d) => (
                    <div
                      key={d.id}
                      className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{d.name}</p>
                        <p className="text-[11px] text-slate-500">
                          No. SK: {d.decree_number || 'Terdaftar'}
                        </p>
                      </div>
                      {d.receives_allowance && (
                        <span className="font-bold text-emerald-700">
                          {formatRupiah(d.monthly_allowance)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. PANEL EKSEKUTIF, ADMINISTRASI, KURIKULUM, HUMAS/PPDB & SARPRAS */}
      {exec && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700" />
            Ringkasan Operasional Lembaga, Akademik &amp; Administrasi
          </h2>

          {/* KPI Utama Lembaga */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
            <Link
              href="/portal/sdm/siswa"
              className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
            >
              <p className="text-[11px] font-semibold text-slate-500">Siswa Aktif</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {exec.activeStudentsCount}
              </p>
            </Link>
            <Link
              href="/portal/sdm/gtk"
              className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
            >
              <p className="text-[11px] font-semibold text-slate-500">GTK Aktif</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {exec.activeTeachersCount}
              </p>
            </Link>
            <Link
              href="/portal/akademik/kelas-jadwal/rombel"
              className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
            >
              <p className="text-[11px] font-semibold text-slate-500">Rombongan Belajar</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{exec.classroomsCount}</p>
            </Link>
            <Link
              href="/portal/akademik/kelas-jadwal/mapel"
              className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
            >
              <p className="text-[11px] font-semibold text-slate-500">Mata Pelajaran</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{exec.subjectsCount}</p>
            </Link>
            <Link
              href="/portal/akademik/presensi/konfirmasi"
              className="glass-card rounded-2xl p-4 border border-amber-200/70 bg-amber-50/40 hover:border-amber-300 transition"
            >
              <p className="text-[11px] font-semibold text-amber-800">Presensi Hari Ini</p>
              <p className="text-2xl font-extrabold text-amber-800 mt-1">
                {exec.todayAttendanceTotal}
              </p>
              <p className="text-[10px] text-amber-700">
                {exec.todayAttendanceUnconfirmed} menunggu konfirmasi
              </p>
            </Link>
            {hasRole(['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU']) && (
              <Link
                href="/portal/akun/manajemen-pengguna"
                className="glass-card rounded-2xl p-4 border border-emerald-200/70 bg-emerald-50/40 hover:border-emerald-300 transition"
              >
                <p className="text-[11px] font-semibold text-emerald-800">Persetujuan Akun</p>
                <p className="text-2xl font-extrabold text-emerald-800 mt-1">
                  {exec.pendingAccountsCount}
                </p>
                <p className="text-[10px] text-emerald-700">Pendaftar akun baru</p>
              </Link>
            )}
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            {/* Kehadiran Guru Hari Ini & Agenda Kegiatan */}
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pantauan Kehadiran Guru Hari Ini
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rekap presensi GPS &amp; status konfirmasi kehadiran GTK hari ini
                  </p>
                </div>
                <Link
                  href="/portal/akademik/presensi/konfirmasi"
                  className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  Konfirmasi Presensi <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {exec.recentTodayAttendances.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs text-slate-500">
                  Belum ada catatan presensi guru yang masuk pada hari ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {exec.recentTodayAttendances.map((att) => (
                    <div
                      key={att.id}
                      className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {att.teacher?.full_name || 'Guru'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {att.attendance_type.replace(/_/g, ' ')} • Masuk:{' '}
                          {att.check_in_time?.slice(0, 5) || '-'} • Pulang:{' '}
                          {att.check_out_time?.slice(0, 5) || '-'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          att.admin_confirmed
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {att.admin_confirmed ? 'Terkonfirmasi' : 'Menunggu'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PPDB Online & Publikasi (Relevan untuk Humas / TU / Kepala / Operator) */}
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Statistik Penerimaan Siswa Baru (PPDB)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Progres pendaftaran dan verifikasi berkas calon peserta didik
                  </p>
                </div>
                <Link
                  href="/portal/cms/ppdb"
                  className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  Verifikasi PPDB <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="modular-card rounded-2xl p-3">
                  <p className="text-[11px] text-slate-500">Total</p>
                  <p className="text-lg font-extrabold text-slate-900">{exec.ppdb.total}</p>
                </div>
                <div className="modular-card rounded-2xl p-3">
                  <p className="text-[11px] text-amber-700">Menunggu</p>
                  <p className="text-lg font-extrabold text-amber-700">
                    {exec.ppdb.waitingVerification}
                  </p>
                </div>
                <div className="modular-card rounded-2xl p-3">
                  <p className="text-[11px] text-sky-700">Terverifikasi</p>
                  <p className="text-lg font-extrabold text-sky-700">{exec.ppdb.verified}</p>
                </div>
                <div className="modular-card rounded-2xl p-3">
                  <p className="text-[11px] text-emerald-700">Lulus</p>
                  <p className="text-lg font-extrabold text-emerald-700">{exec.ppdb.accepted}</p>
                </div>
              </div>

              <div className="space-y-2">
                {exec.ppdb.recentRegistrations.slice(0, 3).map((reg) => (
                  <div
                    key={reg.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{reg.full_name}</p>
                      <p className="text-[11px] text-slate-500">Jalur: {reg.pathway || 'UMUM'}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      {reg.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Baris Sarpras & Persuratan TU */}
          <div className="grid lg:grid-cols-12 gap-5">
            {hasRole([
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_SARPRAS',
              'KEPALA_TU',
              'STAF_TU',
            ]) && (
              <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Kondisi Sarana &amp; Prasarana
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total {exec.facilities.totalItems} item inventaris ({exec.facilities.totalUnits}{' '}
                      unit)
                    </p>
                  </div>
                  <Link
                    href="/portal/cms/sarana-prasarana"
                    className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    Kelola Sarpras <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5">
                    <p className="text-emerald-800 font-medium">Kondisi Baik</p>
                    <p className="text-xl font-extrabold text-emerald-900 mt-0.5">
                      {exec.facilities.goodConditionCount} Item
                    </p>
                  </div>
                  <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-3.5">
                    <p className="text-rose-800 font-medium">Perlu Perbaikan / Rusak</p>
                    <p className="text-xl font-extrabold text-rose-900 mt-0.5">
                      {exec.facilities.needsAttentionCount} Item
                    </p>
                  </div>
                </div>

                {exec.facilities.damagedList.length > 0 && (
                  <div className="space-y-1.5">
                    {exec.facilities.damagedList.map((f) => (
                      <div
                        key={f.id}
                        className="modular-card rounded-xl p-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-800">
                          {f.name} ({f.quantity} unit)
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold text-[11px]">
                          {f.condition.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasRole(['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU']) && (
              <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Arsip Persuratan Tata Usaha Terbaru
                    </h3>
                    <p className="text-xs text-slate-500">
                      Rekam surat masuk &amp; surat keluar terakhir
                    </p>
                  </div>
                  <Link
                    href="/portal/layanan/persuratan"
                    className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    Buka Persuratan <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {exec.recentLetters.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs text-slate-500">
                    Belum ada arsip surat yang tercatat.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {exec.recentLetters.map((l) => (
                      <div
                        key={l.id}
                        className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-mono font-bold text-emerald-700">
                            {l.letter_number} • {l.direction}
                          </p>
                          <p className="font-bold text-slate-900">{l.subject}</p>
                        </div>
                        <span className="text-slate-500 shrink-0">{l.letter_date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. PANEL KEUANGAN: SPP/KOMITE, TABUNGAN DIGITAL & HONORARIUM */}
      {finance && (finance.spp || finance.tabungan || finance.honorarium) && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-700" />
            Informasi Keuangan Sesuai Wewenang &amp; Tugas Tambahan Anda
          </h2>

          <div className="grid lg:grid-cols-3 gap-5">
            {finance.spp && (
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">SPP &amp; Iuran Komite</h3>
                      <p className="text-[11px] text-slate-500">
                        {finance.spp.paidBillsCount} Lunas • {finance.spp.unpaidBillsCount} Belum Lunas
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/portal/keuangan/spp/pembayaran"
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Detail →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="modular-card rounded-2xl p-3">
                    <p className="text-[11px] text-slate-500">Total Tagihan</p>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                      {formatRupiah(finance.spp.totalBilledAmount)}
                    </p>
                  </div>
                  <div className="modular-card rounded-2xl p-3">
                    <p className="text-[11px] text-emerald-700">Total Terbayar</p>
                    <p className="font-extrabold text-emerald-700 text-sm mt-0.5">
                      {formatRupiah(finance.spp.totalPaidAmount)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">
                    Pembayaran Masuk Terbaru
                  </p>
                  {finance.spp.recentPayments.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="modular-card rounded-xl p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-slate-900 truncate">
                          {p.bill?.student?.full_name || p.receipt_number}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {p.bill?.fee_type?.name || 'SPP'} • {p.payment_method}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-700 shrink-0">
                        {formatRupiah(p.amount_paid)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {finance.tabungan && (
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Tabungan Digital</h3>
                      <p className="text-[11px] text-slate-500">
                        {finance.tabungan.activeAccountsCount} Rekening Aktif
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/portal/keuangan/tabungan/transaksi"
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Detail →
                  </Link>
                </div>

                <div className="modular-card rounded-2xl p-3.5">
                  <p className="text-[11px] text-slate-500">Total Saldo Tabungan Mengendap</p>
                  <p className="text-xl font-extrabold text-teal-800 mt-0.5">
                    {formatRupiah(finance.tabungan.totalBalance)}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">
                    Mutasi Setor / Tarik Terbaru
                  </p>
                  {finance.tabungan.recentTransactions.slice(0, 3).map((trx) => (
                    <div
                      key={trx.id}
                      className="modular-card rounded-xl p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-slate-900 truncate">
                          {trx.account?.owner_name || trx.account?.account_number}
                        </p>
                        <p className="text-[11px] text-slate-500">{trx.transaction_type}</p>
                      </div>
                      <span
                        className={`font-bold shrink-0 ${
                          trx.transaction_type === 'SETOR' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {trx.transaction_type === 'SETOR' ? '+' : '-'}
                        {formatRupiah(trx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {finance.honorarium && (
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Honorarium GTK</h3>
                      <p className="text-[11px] text-slate-500">
                        {finance.honorarium.currentMonthSlipsCount} Slip Periode Ini
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/portal/keuangan/honorarium/rekap"
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Detail →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="modular-card rounded-2xl p-3">
                    <p className="text-[11px] text-slate-500">Tarif / JTM</p>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                      {formatRupiah(finance.honorarium.ratePerJtm)}
                    </p>
                  </div>
                  <div className="modular-card rounded-2xl p-3">
                    <p className="text-[11px] text-slate-500">Transport / KM</p>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                      {formatRupiah(finance.honorarium.transportRatePerKm)}
                    </p>
                  </div>
                </div>

                <div className="modular-card rounded-2xl p-3.5 space-y-1 text-xs">
                  <p className="text-[11px] text-slate-500">Total Honorarium Bulan Ini</p>
                  <p className="text-lg font-extrabold text-slate-900">
                    {formatRupiah(finance.honorarium.currentMonthTotalAmount)}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Dibayar: {finance.honorarium.paidSlipsCount} slip • Draft/Approved:{' '}
                    {finance.honorarium.draftOrApprovedCount} slip
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. PANEL BIMBINGAN KONSELING (BK) & PENDAMPINGAN GURU WALI */}
      {(bk || (guruWali && guruWali.mentoredStudentsCount > 0)) && (
        <section className="grid lg:grid-cols-12 gap-5">
          {bk && (
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Rekam Bimbingan Konseling (BK)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Konsultasi: {bk.konsultasiCount} • Prestasi: {bk.prestasiCount} • Pelanggaran:{' '}
                      {bk.pelanggaranCount}
                    </p>
                  </div>
                </div>
                <Link
                  href="/portal/layanan/bk"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Buka BK →
                </Link>
              </div>

              <div className="space-y-2">
                {bk.recentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {r.student?.full_name} — {r.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {r.record_type} • {r.incident_date}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold">
                      {r.points} Poin
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {guruWali && guruWali.mentoredStudentsCount > 0 && (
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Pendampingan Siswa Binaan (Guru Wali)
                    </h3>
                    <p className="text-xs text-slate-500">
                      {guruWali.mentoredStudentsCount} siswa binaan aktif
                    </p>
                  </div>
                </div>
                <Link
                  href="/portal/layanan/guru-wali"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Buka Guru Wali →
                </Link>
              </div>

              <div className="space-y-2">
                {guruWali.recentLogs.map((l) => (
                  <div key={l.id} className="modular-card rounded-xl p-3 text-xs space-y-1">
                    <p className="font-bold text-slate-900">
                      {l.assignment?.student?.full_name} — {l.topic}
                    </p>
                    <p className="text-slate-600 line-clamp-2">{l.notes}</p>
                    <p className="text-[11px] text-slate-400">
                      Wali: {l.assignment?.teacher?.full_name} • {l.mentoring_date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. PANEL KHUSUS SISWA / ORANG TUA */}
      {studentPersonal && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            Informasi Akademik, Dokumen &amp; Keuangan Siswa
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-3xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Identitas &amp; Kelas</p>
              <p className="font-extrabold text-slate-900 text-base">
                {studentPersonal.student.full_name}
              </p>
              <p className="text-xs text-emerald-700 font-semibold">
                {studentPersonal.classroom
                  ? `Kelas ${studentPersonal.classroom.name}`
                  : 'Belum ditempatkan di Rombel'}
              </p>
              <p className="text-[11px] text-slate-500">
                NIS: {studentPersonal.student.nis || '-'} • NISN:{' '}
                {studentPersonal.student.nisn || '-'}
              </p>
            </div>

            <Link
              href="/portal/siswa/biodata-dokumen/dokumen"
              className="glass-card rounded-3xl p-5 space-y-1 hover:border-emerald-300 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Dokumen Resmi Siswa</span>
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {studentPersonal.documents.uploadedCount} Dokumen
              </p>
              <p className="text-[11px] text-emerald-700">
                {studentPersonal.documents.verifiedCount} Terverifikasi •{' '}
                {studentPersonal.documents.pendingCount} Menunggu
              </p>
            </Link>

            <div className="glass-card rounded-3xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Kehadiran Bulan Ini</p>
              <p className="text-2xl font-extrabold text-emerald-700">
                {studentPersonal.monthAttendance.hadir} Hari Hadir
              </p>
              <p className="text-[11px] text-slate-600">
                Sakit: {studentPersonal.monthAttendance.sakit} • Izin:{' '}
                {studentPersonal.monthAttendance.izin} • Alpa:{' '}
                {studentPersonal.monthAttendance.alpa}
              </p>
            </div>

            <div className="glass-card rounded-3xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Tagihan &amp; Tabungan Siswa</p>
              <p className="text-lg font-extrabold text-slate-900">
                Saldo: {formatRupiah(studentPersonal.savings?.balance || 0)}
              </p>
              <p className="text-[11px] text-rose-700 font-semibold">
                Tunggakan SPP/Komite: {formatRupiah(studentPersonal.bills.unpaidAmount)} (
                {studentPersonal.bills.unpaidCount} tagihan)
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 7. PANEL PERPUSTAKAAN DIGITAL (E-LIBRARY) & TRACER ALUMNI */}
      <div className="grid lg:grid-cols-12 gap-5">
        {library && (
          <div
            className={`${
              alumni ? 'lg:col-span-7' : 'lg:col-span-12'
            } glass-card rounded-3xl p-6 space-y-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Perpustakaan Digital (E-Library)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {library.totalBookTitles} Judul Koleksi • {library.totalCopiesAvailable}{' '}
                    Eksemplar Tersedia • {library.activeLoansCount} Dipinjam
                  </p>
                </div>
              </div>
              <Link
                href="/portal/layanan/perpustakaan/katalog"
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                Buka E-Library <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data?.libraryMember && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-emerald-300" />
                  <span>
                    Kartu Anggota E-Library Anda: <strong>{data.libraryMember.member_code}</strong> (
                    {data.libraryMember.member_type})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/15 text-emerald-100 text-[10px] font-semibold">
                  Status: {data.libraryMember.status}
                </span>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {library.recentBooks.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-slate-900 truncate">{b.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {b.author} • {b.book_format}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold shrink-0">
                    {b.available_copies}/{b.total_copies}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {alumni && (
          <div
            className={`${
              library ? 'lg:col-span-5' : 'lg:col-span-12'
            } glass-card rounded-3xl p-6 space-y-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Sebaran Tracer Study Alumni</h3>
                  <p className="text-xs text-slate-500">{alumni.totalTracers} Alumni Terdata</p>
                </div>
              </div>
              <Link
                href="/portal/layanan/alumni"
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Detail →
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="modular-card rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500">Kuliah</p>
                <p className="font-extrabold text-slate-900 text-base">{alumni.kuliahCount}</p>
              </div>
              <div className="modular-card rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500">Bekerja</p>
                <p className="font-extrabold text-slate-900 text-base">{alumni.bekerjaCount}</p>
              </div>
              <div className="modular-card rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500">Wirausaha</p>
                <p className="font-extrabold text-slate-900 text-base">{alumni.wirausahaCount}</p>
              </div>
              <div className="modular-card rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500">Pesantren</p>
                <p className="font-extrabold text-slate-900 text-base">{alumni.pesantrenCount}</p>
              </div>
            </div>

            <div className="space-y-2">
              {alumni.recentTracers.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="modular-card rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-slate-900 truncate">
                      {a.full_name} ({a.graduation_year})
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {a.institution_or_company || '-'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px] shrink-0">
                    {a.current_activity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
