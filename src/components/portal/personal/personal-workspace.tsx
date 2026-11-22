'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  Sparkles,
  Wallet,
  AlertCircle,
  ClipboardCheck,
  Receipt,
  BookOpen,
  ShieldAlert,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { SavingsSlipModal } from '@/components/portal/keuangan/savings-slip-modal';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';
import { SppSlipModal } from '@/components/portal/keuangan/spp-slip-modal';
import type { SppSlipData } from '@/lib/cards/spp-slip-png';
import { HonorariumSlipModal } from '@/components/portal/keuangan/honorarium-slip-modal';
import type { HonorariumDutyItem, HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';

export type PersonalScope = 'siswa' | 'orang-tua' | 'gtk' | 'umum';
export type PersonalSection =
  | 'jadwal-pelajaran'
  | 'jadwal-piket'
  | 'tabungan'
  | 'absensi'
  | 'spp'
  | 'ujian'
  | 'bk'
  | 'honorarium';

const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

function getTodayIsoDay(): number {
  const jsDay = new Date().getDay(); // 0=Minggu .. 6=Sabtu
  return jsDay === 0 ? 7 : jsDay;
}

function formatTimeShort(t?: string | null): string {
  if (!t) return '-';
  return String(t).slice(0, 5);
}

function formatTimeValue(t?: unknown): string {
  if (!t) return '-';
  const raw = String(t).trim();
  if (!raw) return '-';
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return raw;
}

function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const parts = String(t).trim().split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function getCurrentMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatDateId(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface PersonalPayload {
  scope: PersonalScope;
  profile: {
    userId: string;
    fullName: string;
    email: string;
    roles: string[];
  };
  student: {
    id: string;
    full_name: string;
    nis?: string | null;
    nisn?: string | null;
    status?: string | null;
  } | null;
  children: Array<{
    id: string;
    full_name: string;
    nis?: string | null;
    relation?: string | null;
  }>;
  teacher: {
    id: string;
    full_name: string;
    nip?: string | null;
    nuptk?: string | null;
    staff_type?: string | null;
    home_distance_km?: number | null;
  } | null;
  classroom: {
    id: string;
    name: string;
    grade_level?: string | null;
    homeroom_teacher?: { full_name?: string | null } | null;
  } | null;
  schedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    jtm_count: number;
    subject?: { name?: string | null; code?: string | null; subject_group?: string | null } | null;
    teacher?: { full_name?: string | null } | null;
    classroom?: { name?: string | null; grade_level?: string | null } | null;
  }>;
  pickets: Array<{
    id: string;
    day_of_week: number;
    student_id?: string | null;
    task_notes?: string | null;
    notes?: string | null;
    student?: { id: string; full_name: string; nis?: string | null } | null;
    academic_year?: { name?: string | null } | null;
  }>;
  savingsAccounts: Array<{
    id: string;
    account_number: string;
    owner_type: string;
    owner_name: string;
    balance: number;
    is_active: boolean;
  }>;
  savingsTransactions: Array<{
    id: string;
    account_id: string;
    transaction_type: 'SETOR' | 'TARIK';
    amount: number;
    fee_percentage?: number | null;
    fee_amount?: number | null;
    net_amount?: number | null;
    balance_after: number;
    reference_number: string;
    notes?: string | null;
    transaction_date: string;
  }>;
  attendances: Array<Record<string, unknown>>;
  bills: Array<{
    id: string;
    title?: string | null;
    billing_month?: number | null;
    billing_year?: number | null;
    amount: number;
    paid_amount?: number | null;
    status: string;
    due_date?: string | null;
    fee_type?: { name?: string | null } | null;
  }>;
  payments: Array<{
    id: string;
    bill_id: string;
    amount: number;
    payment_date: string;
    payment_method?: string | null;
    reference_number?: string | null;
  }>;
  honorariums: Array<Record<string, unknown>>;
  bkRecords: Array<{
    id: string;
    incident_date: string;
    record_type: string;
    category?: string | null;
    description: string;
    follow_up?: string | null;
    counselor?: { full_name?: string | null } | null;
  }>;
  examRooms: Array<{
    id: string;
    seat_number?: string | null;
    exam_room?: {
      room_name?: string | null;
      exam_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      period?: { name?: string | null; start_date?: string | null; end_date?: string | null } | null;
    } | null;
  }>;
}

export function PersonalWorkspace({
  scope,
  section,
  title,
  subtitle,
}: {
  scope: PersonalScope;
  section: PersonalSection;
  title: string;
  subtitle: string;
}) {
  const [data, setData] = useState<PersonalPayload | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [todayDay, setTodayDay] = useState<number>(() => getTodayIsoDay());
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const [scheduleDayFilter, setScheduleDayFilter] = useState<'ALL' | 'TODAY' | number>('ALL');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [picketFilter, setPicketFilter] = useState<'ALL' | 'MY_DAYS' | 'TODAY'>('ALL');
  const [absensiStatusFilter, setAbsensiStatusFilter] = useState<
    'ALL' | 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
  >('ALL');
  const [absensiSearch, setAbsensiSearch] = useState('');
  const [absensiVisibleCount, setAbsensiVisibleCount] = useState(20);
  const [sppStatusFilter, setSppStatusFilter] = useState<'ALL' | 'UNPAID' | 'CICILAN' | 'LUNAS'>(
    'ALL'
  );
  const [sppSearch, setSppSearch] = useState('');
  const [examSearch, setExamSearch] = useState('');
  const [bkTypeFilter, setBkTypeFilter] = useState<
    'ALL' | 'KONSULTASI' | 'PRESTASI' | 'PELANGGARAN'
  >('ALL');
  const [bkSearch, setBkSearch] = useState('');
  const [activeSlip, setActiveSlip] = useState<SavingsSlipData | null>(null);
  const [activeSppSlip, setActiveSppSlip] = useState<SppSlipData | null>(null);
  const [activeHonorSlip, setActiveHonorSlip] = useState<HonorariumSlipData | null>(null);

  // Filter & pagination khusus Tabungan Digital
  const [trxSearch, setTrxSearch] = useState('');
  const [trxTypeFilter, setTrxTypeFilter] = useState<'ALL' | 'SETOR' | 'TARIK'>('ALL');
  const [trxAccountFilter, setTrxAccountFilter] = useState<string>('ALL');
  const [trxVisibleCount, setTrxVisibleCount] = useState<number>(15);

  useEffect(() => {
    const syncTime = () => {
      setTodayDay(getTodayIsoDay());
      setNowMinutes(getCurrentMinutesOfDay());
    };
    syncTime();
    const timer = setInterval(syncTime, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ scope, section });
    if (selectedChildId) params.set('student_id', selectedChildId);

    fetch(`/api/portal/personal?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');
        return json as PersonalPayload;
      })
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [scope, section, selectedChildId, reloadTick]);

  const myPicketDays = useMemo(() => {
    if (!data) return [];
    if (scope === 'gtk') {
      return Array.from(new Set(data.pickets.map((p) => p.day_of_week))).sort((a, b) => a - b);
    }
    if (!data.student?.id) return [];
    return Array.from(
      new Set(
        data.pickets
          .filter((p) => p.student_id === data.student?.id)
          .map((p) => p.day_of_week)
      )
    ).sort((a, b) => a - b);
  }, [data, scope]);

  return (
    <div className="space-y-6">
      {/* Header & Identity Banner */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight break-words">
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
          {data?.student && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold max-w-full break-words">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="break-words">
                  {data.student.full_name}
                  {data.student.nis ? ` (NIS: ${data.student.nis})` : ''}
                </span>
              </span>
              {data.classroom && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold max-w-full break-words">
                  Kelas: {data.classroom.name}
                  {data.classroom.homeroom_teacher?.full_name
                    ? ` • Wali: ${data.classroom.homeroom_teacher.full_name}`
                    : ''}
                </span>
              )}
            </div>
          )}
          {data?.teacher && scope === 'gtk' && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold max-w-full break-words">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="break-words">
                  {data.teacher.full_name}
                  {data.teacher.nip
                    ? ` (NIP: ${data.teacher.nip})`
                    : data.teacher.nuptk
                      ? ` (NUPTK: ${data.teacher.nuptk})`
                      : ''}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2.5 w-full md:w-auto shrink-0">
          {/* Child selector for Orang Tua */}
          {scope === 'orang-tua' && data && data.children.length > 1 && (
            <div className="w-full sm:w-auto sm:min-w-[220px] min-w-0 flex-1 sm:flex-none">
              <label
                htmlFor="personal-child-select"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Pilih Putra / Putri:
              </label>
              <select
                id="personal-child-select"
                value={selectedChildId || data.student?.id || ''}
                onChange={(e) => {
                  setLoading(true);
                  setError(null);
                  setPicketFilter('ALL');
                  setTrxSearch('');
                  setTrxTypeFilter('ALL');
                  setTrxAccountFilter('ALL');
                  setTrxVisibleCount(15);
                  setAbsensiStatusFilter('ALL');
                  setAbsensiSearch('');
                  setAbsensiVisibleCount(20);
                  setSppStatusFilter('ALL');
                  setSppSearch('');
                  setBkTypeFilter('ALL');
                  setBkSearch('');
                  setSelectedChildId(e.target.value);
                }}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              >
                {data.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.full_name} {child.nis ? `(${child.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReloadTick((t) => t + 1);
            }}
            disabled={loading}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="glass-card rounded-3xl p-10 sm:p-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat data...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReloadTick((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 1. JADWAL PELAJARAN / MENGAJAR SEPEKAN */}
          {section === 'jadwal-pelajaran' && (() => {
            const hasSunday = data.schedules.some((s) => s.day_of_week === 7);
            const activeDayNumbers = hasSunday ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];

            const q = scheduleSearch.trim().toLowerCase();
            const matchingSchedules = data.schedules.filter((s) => {
              if (!q) return true;
              const haystack = `${s.subject?.name || ''} ${s.subject?.code || ''} ${
                s.teacher?.full_name || ''
              } ${s.classroom?.name || ''}`.toLowerCase();
              return haystack.includes(q);
            });

            const effectiveDayFilter =
              scheduleDayFilter === 'TODAY' && !activeDayNumbers.includes(todayDay)
                ? 'ALL'
                : scheduleDayFilter;

            const visibleDays =
              effectiveDayFilter === 'TODAY'
                ? [todayDay]
                : typeof effectiveDayFilter === 'number'
                  ? [effectiveDayFilter]
                  : activeDayNumbers;

            const displayedSchedules = matchingSchedules.filter((s) =>
              visibleDays.includes(s.day_of_week)
            );
            const displayedJtm = displayedSchedules.reduce(
              (acc, s) => acc + (Number(s.jtm_count) || 0),
              0
            );
            const totalWeeklyJtm = data.schedules.reduce(
              (acc, s) => acc + (Number(s.jtm_count) || 0),
              0
            );

            const todaySchedules = data.schedules
              .filter((s) => s.day_of_week === todayDay)
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
            const todayJtm = todaySchedules.reduce(
              (acc, s) => acc + (Number(s.jtm_count) || 0),
              0
            );

            const ongoingToday =
              nowMinutes !== null
                ? todaySchedules.find((s) => {
                    const start = parseTimeToMinutes(s.start_time);
                    const end = parseTimeToMinutes(s.end_time);
                    return start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
                  })
                : undefined;

            const nextToday =
              nowMinutes !== null && !ongoingToday
                ? todaySchedules.find((s) => {
                    const start = parseTimeToMinutes(s.start_time);
                    return start !== null && start > nowMinutes;
                  })
                : undefined;

            const emptyTitle =
              scope === 'orang-tua' && !data.student
                ? 'Belum ada data putra/putri terhubung'
                : scope === 'orang-tua' && !data.classroom
                  ? 'Rombel kelas anak belum ditetapkan'
                  : scope === 'gtk' && !data.teacher
                    ? 'Akun belum tertaut ke data GTK'
                    : 'Belum ada jadwal tersedia';

            const emptyDescription =
              scope === 'orang-tua' && !data.student
                ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
                : scope === 'orang-tua' && !data.classroom
                  ? 'Putra/putri Anda belum ditempatkan pada rombongan belajar aktif pada tahun ajaran ini.'
                  : scope === 'gtk' && !data.teacher
                    ? 'Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha.'
                    : scope === 'gtk'
                      ? 'Jadwal mengajar Anda belum ditetapkan oleh bagian kurikulum.'
                      : 'Jadwal pelajaran kelas belum tersedia atau Anda belum ditempatkan di rombel aktif.';

            return (
              <div className="space-y-4">
                {data.schedules.length === 0 ? (
                  <EmptyState
                    icon={<CalendarDays className="w-8 h-8 text-slate-300" />}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                ) : (
                  <>
                    {/* Ringkasan Jadwal Sepekan & Hari Ini */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Total Sepekan
                          </p>
                          <p className="text-lg font-black text-slate-900 mt-0.5">
                            {data.schedules.length} Sesi{' '}
                            <span className="text-xs font-bold text-slate-500">
                              • {totalWeeklyJtm} JTM
                            </span>
                          </p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                            Hari Ini ({DAY_NAMES[todayDay] || 'Hari Ini'})
                          </p>
                          <p className="text-lg font-black text-emerald-950 mt-0.5">
                            {todaySchedules.length > 0 ? (
                              <>
                                {todaySchedules.length} Sesi{' '}
                                <span className="text-xs font-bold text-emerald-700">
                                  • {todayJtm} JTM
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-bold text-emerald-800">
                                Tidak ada jadwal
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {ongoingToday
                              ? 'Sedang Berlangsung'
                              : nextToday
                                ? 'Sesi Berikutnya'
                                : 'Status Hari Ini'}
                          </p>
                          {ongoingToday ? (
                            <p className="text-xs font-bold text-emerald-700 mt-0.5 truncate">
                              {ongoingToday.subject?.name || 'Mapel'}
                              {scope === 'gtk' && ongoingToday.classroom?.name
                                ? ` • ${ongoingToday.classroom.name}`
                                : ''}{' '}
                              ({formatTimeShort(ongoingToday.start_time)}–
                              {formatTimeShort(ongoingToday.end_time)})
                            </p>
                          ) : nextToday ? (
                            <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                              {nextToday.subject?.name || 'Mapel'}
                              {scope === 'gtk' && nextToday.classroom?.name
                                ? ` • ${nextToday.classroom.name}`
                                : ''}{' '}
                              ({formatTimeShort(nextToday.start_time)})
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                              {todaySchedules.length > 0
                                ? 'Seluruh sesi hari ini selesai'
                                : 'Hari libur / di luar jam KBM'}
                            </p>
                          )}
                        </div>
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            ongoingToday
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Filter Hari & Pencarian */}
                    <div className="glass-card rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1">
                        <button
                          type="button"
                          aria-pressed={effectiveDayFilter === 'ALL'}
                          onClick={() => setScheduleDayFilter('ALL')}
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                            effectiveDayFilter === 'ALL'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          Semua Hari
                        </button>
                        {activeDayNumbers.includes(todayDay) && (
                          <button
                            type="button"
                            aria-pressed={effectiveDayFilter === 'TODAY'}
                            onClick={() => setScheduleDayFilter('TODAY')}
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                              effectiveDayFilter === 'TODAY'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70'
                            }`}
                          >
                            Hari Ini ({DAY_NAMES[todayDay]})
                          </button>
                        )}
                        {activeDayNumbers.map((d) => (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={effectiveDayFilter === d}
                            onClick={() => setScheduleDayFilter(d)}
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                              effectiveDayFilter === d
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {DAY_NAMES[d]}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                        <span className="inline-flex items-center justify-center text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl shrink-0">
                          {displayedSchedules.length} Sesi • {displayedJtm} JTM
                        </span>
                        <div className="relative min-w-0 sm:w-64">
                          <label htmlFor="schedule-search-input" className="sr-only">
                            {scope === 'gtk'
                              ? 'Cari mata pelajaran atau kelas'
                              : 'Cari mata pelajaran atau guru'}
                          </label>
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="schedule-search-input"
                            type="text"
                            value={scheduleSearch}
                            onChange={(e) => setScheduleSearch(e.target.value)}
                            placeholder={
                              scope === 'gtk' ? 'Cari mapel atau kelas...' : 'Cari mapel atau guru...'
                            }
                            className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                          />
                          {scheduleSearch && (
                            <button
                              type="button"
                              onClick={() => setScheduleSearch('')}
                              aria-label="Hapus pencarian"
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {displayedSchedules.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                        <p className="text-xs sm:text-sm font-semibold text-slate-700">
                          {scheduleSearch.trim()
                            ? `Tidak ada jadwal yang cocok dengan pencarian "${scheduleSearch.trim()}"${
                                effectiveDayFilter !== 'ALL' ? ' pada hari terpilih' : ''
                              }.`
                            : 'Tidak ada jadwal pelajaran pada hari yang dipilih.'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {effectiveDayFilter !== 'ALL' && matchingSchedules.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setScheduleDayFilter('ALL')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                            >
                              Lihat di Semua Hari ({matchingSchedules.length})
                            </button>
                          )}
                          {(scheduleSearch || effectiveDayFilter !== 'ALL') && (
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleSearch('');
                                setScheduleDayFilter('ALL');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`grid gap-4 ${
                          visibleDays.length === 1
                            ? 'grid-cols-1'
                            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                        }`}
                      >
                        {visibleDays.map((day) => {
                          const dayItems = matchingSchedules
                            .filter((s) => s.day_of_week === day)
                            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                          const dayTotalJtm = dayItems.reduce(
                            (acc, s) => acc + (Number(s.jtm_count) || 0),
                            0
                          );
                          const isToday = day === todayDay;
                          return (
                            <div
                              key={day}
                              className={`rounded-3xl border p-4 sm:p-5 transition min-w-0 ${
                                isToday
                                  ? 'border-emerald-400 bg-emerald-50/40 shadow-sm'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                  <CalendarDays
                                    className={`w-4 h-4 shrink-0 ${
                                      isToday ? 'text-emerald-600' : 'text-slate-400'
                                    }`}
                                  />
                                  <h3 className="font-bold text-slate-900 text-sm">
                                    {DAY_NAMES[day] || `Hari ${day}`}
                                  </h3>
                                  {dayItems.length > 0 && (
                                    <span className="text-[11px] font-medium text-slate-500">
                                      ({dayItems.length} sesi • {dayTotalJtm} JTM)
                                    </span>
                                  )}
                                </div>
                                {isToday && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                                    HARI INI
                                  </span>
                                )}
                              </div>
                              {dayItems.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-6 text-center">
                                  Tidak ada jadwal
                                </p>
                              ) : (
                                <div
                                  className={
                                    visibleDays.length === 1
                                      ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
                                      : 'space-y-2.5'
                                  }
                                >
                                  {dayItems.map((item) => {
                                    const startMin = parseTimeToMinutes(item.start_time);
                                    const endMin = parseTimeToMinutes(item.end_time);
                                    const isOngoing =
                                      isToday &&
                                      nowMinutes !== null &&
                                      startMin !== null &&
                                      endMin !== null &&
                                      nowMinutes >= startMin &&
                                      nowMinutes < endMin;

                                    return (
                                      <div
                                        key={item.id}
                                        className={`rounded-2xl border p-3.5 space-y-1.5 min-w-0 transition ${
                                          isOngoing
                                            ? 'border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-300'
                                            : 'border-slate-100 bg-slate-50/70 hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                            <Clock className="w-3 h-3 shrink-0" />
                                            {formatTimeShort(item.start_time)} –{' '}
                                            {formatTimeShort(item.end_time)}
                                          </span>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {isOngoing && (
                                              <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                                BERLANGSUNG
                                              </span>
                                            )}
                                            <span className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">
                                              {item.jtm_count || 0} JTM
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-xs sm:text-[13px] font-bold text-slate-900 break-words leading-snug">
                                            {item.subject?.name || 'Mata Pelajaran'}
                                          </p>
                                          {item.subject?.code && (
                                            <span className="text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                                              {item.subject.code}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 break-words">
                                          {scope === 'gtk'
                                            ? `Kelas: ${item.classroom?.name || '-'}`
                                            : `Guru: ${item.teacher?.full_name || '-'}`}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* 2. JADWAL PIKET (KELAS UNTUK SISWA/ORTU, PIKET GURU UNTUK GTK) */}
          {section === 'jadwal-piket' && (() => {
            const hasSundayPicket = data.pickets.some((p) => p.day_of_week === 7);
            const activePicketDays = hasSundayPicket
              ? [1, 2, 3, 4, 5, 6, 7]
              : [1, 2, 3, 4, 5, 6];

            const effectivePicketFilter =
              (picketFilter === 'MY_DAYS' && myPicketDays.length === 0) ||
              (picketFilter === 'TODAY' && !activePicketDays.includes(todayDay))
                ? 'ALL'
                : picketFilter;

            const picketDaysToRender =
              effectivePicketFilter === 'TODAY'
                ? [todayDay]
                : effectivePicketFilter === 'MY_DAYS'
                  ? myPicketDays.filter((d) => activePicketDays.includes(d))
                  : activePicketDays;

            const emptyPicketTitle =
              scope === 'orang-tua' && !data.student
                ? 'Belum ada data putra/putri terhubung'
                : scope === 'orang-tua' && !data.classroom
                  ? 'Rombel kelas anak belum ditetapkan'
                  : 'Jadwal piket kelas belum tersedia';

            const emptyPicketDescription =
              scope === 'orang-tua' && !data.student
                ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
                : scope === 'orang-tua' && !data.classroom
                  ? 'Putra/putri Anda belum ditempatkan pada rombongan belajar aktif pada tahun ajaran ini.'
                  : scope === 'orang-tua'
                    ? 'Wali kelas belum menambahkan jadwal piket untuk kelas putra/putri Anda.'
                    : 'Wali kelas belum menambahkan jadwal piket untuk kelas Anda.';

            if (scope !== 'gtk' && data.pickets.length === 0) {
              return (
                <EmptyState
                  icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
                  title={emptyPicketTitle}
                  description={emptyPicketDescription}
                />
              );
            }

            if (scope === 'gtk' && data.pickets.length === 0) {
              return (
                <EmptyState
                  icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
                  title={
                    !data.teacher ? 'Akun belum tertaut ke data GTK' : 'Belum ada jadwal piket guru'
                  }
                  description={
                    !data.teacher
                      ? 'Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha.'
                      : 'Jadwal piket guru/petugas piket Anda belum ditetapkan.'
                  }
                />
              );
            }

            const isMyPicketToday = myPicketDays.includes(todayDay);

            return (
              <div className="space-y-4">
                {/* Banner penanda khusus hari piketnya */}
                <div
                  className={`rounded-3xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
                    isMyPicketToday
                      ? 'border-amber-300 bg-amber-50 text-amber-950'
                      : 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isMyPicketToday
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                        {scope === 'orang-tua'
                          ? 'Jadwal Piket Putra/Putri Anda'
                          : 'Jadwal Piket Anda'}
                      </p>
                      <p className="text-sm sm:text-base font-black mt-0.5 break-words">
                        {myPicketDays.length > 0
                          ? `Hari ${myPicketDays.map((d) => DAY_NAMES[d] || `Hari ${d}`).join(', ')}`
                          : 'Belum ada hari piket yang ditetapkan'}
                      </p>
                      {isMyPicketToday && (
                        <p className="text-xs font-semibold text-amber-800 mt-1 leading-relaxed">
                          Hari ini ({DAY_NAMES[todayDay]}) adalah jadwal piket! Pastikan
                          melaksanakan tugas piket tepat waktu.
                        </p>
                      )}
                    </div>
                  </div>

                  {scope !== 'gtk' && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
                      <button
                        type="button"
                        aria-pressed={effectivePicketFilter === 'ALL'}
                        onClick={() => setPicketFilter('ALL')}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                          effectivePicketFilter === 'ALL'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white/85 hover:bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        Semua Hari
                      </button>
                      {myPicketDays.length > 0 && (
                        <button
                          type="button"
                          aria-pressed={effectivePicketFilter === 'MY_DAYS'}
                          onClick={() => setPicketFilter('MY_DAYS')}
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                            effectivePicketFilter === 'MY_DAYS'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white/85 hover:bg-white text-amber-800 border border-amber-200'
                          }`}
                        >
                          {scope === 'orang-tua' ? 'Piket Anak' : 'Piket Saya'} ({myPicketDays.length})
                        </button>
                      )}
                      {activePicketDays.includes(todayDay) && (
                        <button
                          type="button"
                          aria-pressed={effectivePicketFilter === 'TODAY'}
                          onClick={() => setPicketFilter('TODAY')}
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                            effectivePicketFilter === 'TODAY'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white/85 hover:bg-white text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          Hari Ini ({DAY_NAMES[todayDay]})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {scope === 'gtk' ? (() => {
                  const sortedGtkPickets = [...data.pickets].sort(
                    (a, b) => (a.day_of_week || 0) - (b.day_of_week || 0)
                  );
                  return (
                    <div
                      className={`grid gap-4 ${
                        sortedGtkPickets.length === 1
                          ? 'grid-cols-1 max-w-xl'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {sortedGtkPickets.map((p) => {
                        const isToday = p.day_of_week === todayDay;
                        return (
                          <div
                            key={p.id}
                            className={`rounded-3xl border p-4 sm:p-5 min-w-0 transition ${
                              isToday
                                ? 'border-amber-400 bg-amber-50/70 ring-1 ring-amber-300/60 shadow-sm'
                                : 'border-emerald-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-black text-slate-900">
                                {DAY_NAMES[p.day_of_week] || `Hari ${p.day_of_week}`}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold shrink-0 ${
                                  isToday ? 'bg-amber-500' : 'bg-emerald-600'
                                }`}
                              >
                                {isToday ? 'PIKET HARI INI' : 'TUGAS PIKET'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-2 break-words leading-relaxed">
                              {p.notes || 'Piket harian madrasah / pemantauan gerbang & KBM.'}
                            </p>
                            {p.academic_year?.name && (
                              <p className="text-[11px] font-medium text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
                                Tahun Ajaran: {p.academic_year.name}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                  <div
                    className={`grid gap-4 ${
                      picketDaysToRender.length === 1
                        ? 'grid-cols-1'
                        : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                    }`}
                  >
                    {picketDaysToRender.map((day) => {
                      const dayPickets = data.pickets
                        .filter((p) => p.day_of_week === day)
                        .sort((a, b) => {
                          const aSelf = Boolean(data.student?.id && a.student_id === data.student.id);
                          const bSelf = Boolean(data.student?.id && b.student_id === data.student.id);
                          if (aSelf !== bSelf) return aSelf ? -1 : 1;
                          return (a.student?.full_name || '').localeCompare(
                            b.student?.full_name || ''
                          );
                        });
                      const isMyDay = myPicketDays.includes(day);
                      const isToday = day === todayDay;
                      return (
                        <div
                          key={day}
                          className={`rounded-3xl border p-4 sm:p-5 transition min-w-0 ${
                            isMyDay
                              ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-300/60 shadow-sm'
                              : isToday
                                ? 'border-emerald-300 bg-emerald-50/30'
                                : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="font-bold text-slate-900 text-sm">
                                {DAY_NAMES[day] || `Hari ${day}`}
                              </h3>
                              <span className="text-[11px] font-medium text-slate-500">
                                ({dayPickets.length} petugas)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-bold">
                                  HARI INI
                                </span>
                              )}
                              {isMyDay && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                                  <Sparkles className="w-3 h-3" />
                                  {scope === 'orang-tua' ? 'PIKET ANAK' : 'PIKET SAYA'}
                                </span>
                              )}
                            </div>
                          </div>

                          {dayPickets.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-6 text-center">
                              Belum ada petugas
                            </p>
                          ) : (
                            <ul
                              className={
                                picketDaysToRender.length === 1
                                  ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
                                  : 'space-y-2'
                              }
                            >
                              {dayPickets.map((p) => {
                                const isSelf = Boolean(
                                  data.student?.id && p.student_id === data.student.id
                                );
                                return (
                                  <li
                                    key={p.id}
                                    className={`rounded-2xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 min-w-0 ${
                                      isSelf
                                        ? 'bg-amber-100 border border-amber-300 font-bold text-amber-950'
                                        : 'bg-slate-50 border border-slate-100 text-slate-700'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p className="break-words leading-snug">
                                        {p.student?.full_name || 'Siswa'}
                                      </p>
                                      {p.task_notes && (
                                        <p className="text-[11px] text-slate-500 font-normal break-words mt-0.5">
                                          Tugas: {p.task_notes}
                                        </p>
                                      )}
                                    </div>
                                    {isSelf && (
                                      <span className="text-[10px] font-black text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-300 shrink-0">
                                        ★ {scope === 'orang-tua' ? 'Anak' : 'Anda'}
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. TABUNGAN DIGITAL & RIWAYAT TRANSAKSI */}
          {section === 'tabungan' && (
            <div className="space-y-6">
              {data.savingsAccounts.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="w-8 h-8 text-slate-300" />}
                  title={
                    scope === 'orang-tua' && !data.student
                      ? 'Belum ada data putra/putri terhubung'
                      : scope === 'orang-tua'
                        ? 'Putra/putri Anda belum memiliki rekening tabungan'
                        : scope === 'gtk' && !data.teacher
                          ? 'Akun belum tertaut ke data GTK'
                          : 'Belum memiliki rekening tabungan'
                  }
                  description={
                    scope === 'orang-tua' && !data.student
                      ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
                      : scope === 'gtk' && !data.teacher
                        ? 'Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha.'
                        : 'Silakan hubungi Pengelola Tabungan atau Bendahara Madrasah untuk membuka buku tabungan digital.'
                  }
                />
              ) : (
                (() => {
                  const effectiveAccountFilter =
                    trxAccountFilter !== 'ALL' &&
                    data.savingsAccounts.some((a) => a.id === trxAccountFilter)
                      ? trxAccountFilter
                      : 'ALL';

                  const accountScopedTrx =
                    effectiveAccountFilter === 'ALL'
                      ? data.savingsTransactions
                      : data.savingsTransactions.filter(
                          (t) => t.account_id === effectiveAccountFilter
                        );

                  const totalSetor = accountScopedTrx
                    .filter((t) => t.transaction_type === 'SETOR')
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                  const totalTarik = accountScopedTrx
                    .filter((t) => t.transaction_type === 'TARIK')
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                  const q = trxSearch.trim().toLowerCase();
                  const filteredTrx = accountScopedTrx.filter((trx) => {
                    if (trxTypeFilter !== 'ALL' && trx.transaction_type !== trxTypeFilter) {
                      return false;
                    }
                    if (!q) return true;
                    return (
                      (trx.reference_number || '').toLowerCase().includes(q) ||
                      (trx.notes || '').toLowerCase().includes(q) ||
                      formatDateId(trx.transaction_date).toLowerCase().includes(q)
                    );
                  });

                  const displayedTrx = filteredTrx.slice(0, trxVisibleCount);
                  const hasMoreTrx = trxVisibleCount < filteredTrx.length;
                  const hasTrxFilter =
                    trxSearch.trim().length > 0 ||
                    trxTypeFilter !== 'ALL' ||
                    effectiveAccountFilter !== 'ALL';

                  function openSlip(trx: PersonalPayload['savingsTransactions'][number]) {
                    const acc = data?.savingsAccounts.find((a) => a.id === trx.account_id);
                    setActiveSlip({
                      referenceNumber: trx.reference_number,
                      accountNumber: acc?.account_number || '-',
                      ownerName:
                        acc?.owner_name ||
                        data?.student?.full_name ||
                        data?.profile.fullName ||
                        'Nasabah',
                      ownerType: acc?.owner_type || 'UMUM',
                      transactionType: trx.transaction_type,
                      amount: Number(trx.amount) || 0,
                      feePercentage: Number(trx.fee_percentage) || 0,
                      feeAmount: Number(trx.fee_amount) || 0,
                      netAmount: Number(trx.net_amount ?? trx.amount) || 0,
                      balanceAfter: Number(trx.balance_after) || 0,
                      transactionDate: trx.transaction_date,
                      notes: trx.notes,
                    });
                  }

                  return (
                    <>
                      <div
                        className={`grid gap-4 ${
                          data.savingsAccounts.length === 1
                            ? 'grid-cols-1 max-w-xl'
                            : 'grid-cols-1 md:grid-cols-2'
                        }`}
                      >
                        {data.savingsAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="rounded-3xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-5 sm:p-6 shadow-md space-y-4 min-w-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-mono bg-white/15 px-3 py-1 rounded-full break-all">
                                {acc.account_number}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${acc.is_active
                                  ? 'bg-emerald-400 text-emerald-950'
                                  : 'bg-slate-400 text-slate-900'
                                  }`}
                              >
                                {acc.is_active ? 'REKENING AKTIF' : 'NONAKTIF'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] text-emerald-200 uppercase font-semibold">
                                Saldo Tabungan Tersedia
                              </p>
                              <p className="text-2xl sm:text-3xl font-black mt-1 break-words">
                                {formatRupiah(Number(acc.balance) || 0)}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-100">
                              <span className="break-words">Pemilik: {acc.owner_name}</span>
                              <span className="shrink-0">Kategori: {acc.owner_type}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {data.savingsTransactions.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <StatCard
                            label="Total Setoran"
                            value={formatRupiah(totalSetor)}
                            tone="emerald"
                          />
                          <StatCard
                            label="Total Penarikan"
                            value={formatRupiah(totalTarik)}
                            tone="amber"
                          />
                          <StatCard
                            label="Jumlah Transaksi"
                            value={`${accountScopedTrx.length} Kali`}
                            tone="slate"
                          />
                        </div>
                      )}

                      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Riwayat Transaksi Setor &amp; Tarik Tabungan</span>
                          </h2>
                          {data.savingsTransactions.length > 0 && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Menampilkan {displayedTrx.length} dari {filteredTrx.length} transaksi
                            </span>
                          )}
                        </div>

                        {data.savingsTransactions.length > 0 && (
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                            <div className="relative flex-1 min-w-0">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                value={trxSearch}
                                onChange={(e) => {
                                  setTrxSearch(e.target.value);
                                  setTrxVisibleCount(15);
                                }}
                                placeholder="Cari referensi, tanggal, atau keterangan..."
                                aria-label="Cari transaksi tabungan"
                                className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                              />
                              {trxSearch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrxSearch('');
                                    setTrxVisibleCount(15);
                                  }}
                                  aria-label="Hapus pencarian transaksi"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {data.savingsAccounts.length > 1 && (
                                <select
                                  value={effectiveAccountFilter}
                                  onChange={(e) => {
                                    setTrxAccountFilter(e.target.value);
                                    setTrxVisibleCount(15);
                                  }}
                                  aria-label="Filter rekening tabungan"
                                  className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                                >
                                  <option value="ALL">Semua Rekening</option>
                                  {data.savingsAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.account_number}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {(['ALL', 'SETOR', 'TARIK'] as const).map((tp) => (
                                <button
                                  key={tp}
                                  type="button"
                                  aria-pressed={trxTypeFilter === tp}
                                  onClick={() => {
                                    setTrxTypeFilter(tp);
                                    setTrxVisibleCount(15);
                                  }}
                                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${trxTypeFilter === tp
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                    }`}
                                >
                                  {tp === 'ALL' ? 'Semua' : tp === 'SETOR' ? 'Setor' : 'Tarik'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.savingsTransactions.length === 0 ? (
                          <p className="text-xs text-slate-400 py-6 text-center">
                            Belum ada transaksi tercatat.
                          </p>
                        ) : filteredTrx.length === 0 ? (
                          <div className="py-8 text-center space-y-2.5">
                            <p className="text-xs font-semibold text-slate-600">
                              Tidak ada transaksi yang sesuai filter.
                            </p>
                            {hasTrxFilter && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTrxSearch('');
                                  setTrxTypeFilter('ALL');
                                  setTrxAccountFilter('ALL');
                                  setTrxVisibleCount(15);
                                }}
                                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Mobile Card List */}
                            <div className="space-y-3 md:hidden">
                              {displayedTrx.map((trx) => {
                                const isTarik = trx.transaction_type === 'TARIK';
                                return (
                                  <div
                                    key={trx.id}
                                    className="modular-card rounded-2xl p-4 space-y-2.5 text-xs min-w-0"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <span
                                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isTarik
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                        >
                                          {isTarik ? (
                                            <ArrowDownRight className="w-3 h-3" />
                                          ) : (
                                            <ArrowUpRight className="w-3 h-3" />
                                          )}
                                          {trx.transaction_type}
                                        </span>
                                        <p className="font-mono text-[11px] text-slate-500 mt-1 break-all">
                                          {trx.reference_number}
                                        </p>
                                      </div>
                                      <span className="text-[11px] text-slate-500 shrink-0">
                                        {formatDateId(trx.transaction_date)}
                                      </span>
                                    </div>

                                    <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-100">
                                      <span className="text-slate-500">Nominal</span>
                                      <span className="text-sm font-extrabold text-slate-900">
                                        {formatRupiah(Number(trx.amount) || 0)}
                                      </span>
                                    </div>

                                    {isTarik && Number(trx.fee_amount) > 0 && (
                                      <div className="flex items-center justify-between gap-2 text-rose-600">
                                        <span>Fee Tarik</span>
                                        <span>- {formatRupiah(Number(trx.fee_amount))}</span>
                                      </div>
                                    )}

                                    {isTarik && (
                                      <div className="flex items-center justify-between gap-2 text-emerald-700 font-semibold">
                                        <span>Diterima Bersih</span>
                                        <span>{formatRupiah(Number(trx.net_amount ?? trx.amount) || 0)}</span>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-slate-500">Saldo Akhir</span>
                                      <span className="font-mono font-bold text-slate-800">
                                        {formatRupiah(Number(trx.balance_after) || 0)}
                                      </span>
                                    </div>

                                    {trx.notes && (
                                      <p className="text-[11px] text-slate-500 break-words bg-slate-50 rounded-xl px-2.5 py-1.5">
                                        {trx.notes}
                                      </p>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => openSlip(trx)}
                                      className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                                    >
                                      <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip PNG
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Referensi</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Jenis</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Nominal</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Fee Tarik</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Diterima Bersih</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Saldo Akhir</th>
                                    <th className="py-2.5 px-3">Keterangan</th>
                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Slip</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {displayedTrx.map((trx) => {
                                    const isTarik = trx.transaction_type === 'TARIK';
                                    return (
                                      <tr key={trx.id} className="hover:bg-slate-50/70">
                                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                          {formatDateId(trx.transaction_date)}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                          {trx.reference_number}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isTarik
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-emerald-100 text-emerald-800'
                                              }`}
                                          >
                                            {isTarik ? (
                                              <ArrowDownRight className="w-3 h-3" />
                                            ) : (
                                              <ArrowUpRight className="w-3 h-3" />
                                            )}
                                            {trx.transaction_type}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                          {formatRupiah(Number(trx.amount) || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-rose-600 whitespace-nowrap">
                                          {isTarik && Number(trx.fee_amount) > 0
                                            ? `- ${formatRupiah(Number(trx.fee_amount))}`
                                            : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                                          {isTarik
                                            ? formatRupiah(Number(trx.net_amount ?? trx.amount) || 0)
                                            : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                          {formatRupiah(Number(trx.balance_after) || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-500 max-w-[220px] break-words">
                                          {trx.notes || '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => openSlip(trx)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                                            title="Lihat & Unduh Slip PNG"
                                          >
                                            <Download className="w-3 h-3" /> PNG
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {hasMoreTrx && (
                              <div className="flex justify-center pt-2">
                                <button
                                  type="button"
                                  onClick={() => setTrxVisibleCount((c) => c + 15)}
                                  className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                                >
                                  Muat Lebih Banyak ({filteredTrx.length - displayedTrx.length}{' '}
                                  tersisa)
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          )}

          {/* 4. RIWAYAT ABSENSI */}
          {section === 'absensi' && (
            <div className="space-y-5">
              {scope === 'gtk' ? (() => {
                if (!data.teacher) {
                  return (
                    <EmptyState
                      icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
                      title="Akun belum tertaut ke data GTK"
                      description="Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha."
                    />
                  );
                }

                const q = absensiSearch.trim().toLowerCase();
                const filteredGtkAtt = data.attendances.filter((a) => {
                  if (!q) return true;
                  const sched = a.schedule as {
                    subject?: { name?: string | null } | null;
                    classroom?: { name?: string | null } | null;
                  } | null;
                  const dateVal = a.attendance_date ? String(a.attendance_date) : null;
                  const attType = String(a.attendance_type || '');
                  const geoLabel = a.is_within_geofence ? 'di lokasi' : 'luar radius';
                  const haystack = `${attType} ${attType.replace(/_/g, ' ')} ${
                    sched?.subject?.name || ''
                  } ${sched?.classroom?.name || ''} ${a.attendance_date || ''} ${formatDateId(
                    dateVal
                  )} ${geoLabel}`.toLowerCase();
                  return haystack.includes(q);
                });
                const displayedGtkAtt = filteredGtkAtt.slice(0, absensiVisibleCount);
                const hasMoreGtkAtt = absensiVisibleCount < filteredGtkAtt.length;

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
                      <StatCard
                        label="Total Catatan Presensi"
                        value={String(data.attendances.length)}
                        tone="emerald"
                      />
                      <StatCard
                        label="Total JTM Diperoleh"
                        value={String(
                          data.attendances.reduce(
                            (acc, row) => acc + (Number(row.jtm_earned) || 0),
                            0
                          )
                        )}
                        tone="slate"
                      />
                      <div className="col-span-2 sm:col-span-1">
                        <StatCard
                          label="Dalam Radius Geofence"
                          value={String(
                            data.attendances.filter((row) => Boolean(row.is_within_geofence)).length
                          )}
                          tone="amber"
                        />
                      </div>
                    </div>

                    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Riwayat Presensi &amp; Perolehan JTM</span>
                        </h2>
                        {data.attendances.length > 0 && (
                          <span className="text-[11px] font-medium text-slate-500">
                            Menampilkan {displayedGtkAtt.length} dari {filteredGtkAtt.length} catatan
                          </span>
                        )}
                      </div>

                      {data.attendances.length > 0 && (
                        <div className="relative min-w-0">
                          <label htmlFor="gtk-absensi-search" className="sr-only">
                            Cari riwayat presensi GTK
                          </label>
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="gtk-absensi-search"
                            type="text"
                            value={absensiSearch}
                            onChange={(e) => {
                              setAbsensiSearch(e.target.value);
                              setAbsensiVisibleCount(20);
                            }}
                            placeholder="Cari tanggal, jenis presensi, mapel, atau kelas..."
                            className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                          />
                          {absensiSearch && (
                            <button
                              type="button"
                              onClick={() => {
                                setAbsensiSearch('');
                                setAbsensiVisibleCount(20);
                              }}
                              aria-label="Hapus pencarian presensi"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {data.attendances.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">
                          Belum ada riwayat presensi GTK.
                        </p>
                      ) : filteredGtkAtt.length === 0 ? (
                        <div className="py-8 text-center space-y-2.5">
                          <p className="text-xs font-semibold text-slate-600">
                            Tidak ada catatan presensi yang sesuai pencarian.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAbsensiSearch('');
                              setAbsensiVisibleCount(20);
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset Pencarian
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Mobile Card List */}
                          <div className="space-y-2.5 md:hidden">
                            {displayedGtkAtt.map((a) => {
                              const sched = a.schedule as {
                                subject?: { name?: string | null } | null;
                                classroom?: { name?: string | null } | null;
                              } | null;
                              const attType = String(a.attendance_type || '-').replace(/_/g, ' ');
                              const dateVal = a.attendance_date
                                ? String(a.attendance_date)
                                : null;
                              const dist =
                                typeof a.distance_meters === 'number'
                                  ? `${Math.round(a.distance_meters)} m`
                                  : null;
                              return (
                                <div
                                  key={String(a.id)}
                                  className="modular-card rounded-2xl p-3.5 space-y-2 text-xs min-w-0"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-slate-900">
                                      {formatDateId(dateVal)}
                                    </span>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                        a.is_within_geofence
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {a.is_within_geofence ? 'Di Lokasi' : 'Luar Radius'}
                                      {dist ? ` (${dist})` : ''}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-slate-800 break-words">
                                    {attType}
                                    {sched?.subject?.name ? ` • ${sched.subject.name}` : ''}
                                    {sched?.classroom?.name ? ` (${sched.classroom.name})` : ''}
                                  </p>
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
                                    <span>
                                      Masuk: <strong>{formatTimeValue(a.check_in_time)}</strong> •
                                      Pulang: <strong>{formatTimeValue(a.check_out_time)}</strong>
                                    </span>
                                    <span className="font-bold text-emerald-700">
                                      {Number(a.jtm_earned) || 0} JTM
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                  <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                                  <th className="py-2.5 px-3">Jenis Presensi &amp; Sesi</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Masuk</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Pulang</th>
                                  <th className="py-2.5 px-3 text-center whitespace-nowrap">JTM</th>
                                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Geofence</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {displayedGtkAtt.map((a) => {
                                  const sched = a.schedule as {
                                    subject?: { name?: string | null } | null;
                                    classroom?: { name?: string | null } | null;
                                  } | null;
                                  const attType = String(a.attendance_type || '-').replace(
                                    /_/g,
                                    ' '
                                  );
                                  const dateVal = a.attendance_date
                                    ? String(a.attendance_date)
                                    : null;
                                  const dist =
                                    typeof a.distance_meters === 'number'
                                      ? ` (${Math.round(a.distance_meters)} m)`
                                      : '';
                                  return (
                                    <tr key={String(a.id)} className="hover:bg-slate-50/70">
                                      <td className="py-2.5 px-3 font-medium whitespace-nowrap text-slate-700">
                                        {formatDateId(dateVal)}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-800 break-words">
                                        <span className="font-semibold">{attType}</span>
                                        {sched?.subject?.name && (
                                          <span className="text-slate-500">
                                            {' '}
                                            • {sched.subject.name}
                                            {sched.classroom?.name
                                              ? ` (${sched.classroom.name})`
                                              : ''}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                        {formatTimeValue(a.check_in_time)}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                        {formatTimeValue(a.check_out_time)}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                        {Number(a.jtm_earned) || 0}
                                      </td>
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            a.is_within_geofence
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {a.is_within_geofence ? 'Di Lokasi' : 'Luar Radius'}
                                          {dist}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {hasMoreGtkAtt && (
                            <div className="pt-2 text-center">
                              <button
                                type="button"
                                onClick={() => setAbsensiVisibleCount((c) => c + 20)}
                                className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                              >
                                Muat Lebih Banyak (
                                {filteredGtkAtt.length - displayedGtkAtt.length} tersisa)
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                );
              })() : (() => {
                if (scope === 'orang-tua' && !data.student) {
                  return (
                    <EmptyState
                      icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
                      title="Belum ada data putra/putri terhubung"
                      description="Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah."
                    />
                  );
                }

                const q = absensiSearch.trim().toLowerCase();
                const filteredAttendances = data.attendances.filter((a) => {
                  const status = String(a.status || '');
                  if (absensiStatusFilter !== 'ALL' && status !== absensiStatusFilter) return false;
                  if (q) {
                    const sched = a.schedule as {
                      start_time?: string | null;
                      end_time?: string | null;
                      subject?: { name?: string | null } | null;
                    } | null;
                    const cls = a.classroom as { name?: string | null } | null;
                    const dateVal = a.attendance_date ? String(a.attendance_date) : null;
                    const haystack = `${sched?.subject?.name || 'Absensi Harian Kelas'} ${
                      cls?.name || ''
                    } ${a.notes || ''} ${a.attendance_date || ''} ${formatDateId(dateVal)} ${status}`.toLowerCase();
                    if (!haystack.includes(q)) return false;
                  }
                  return true;
                });
                const displayedAttendances = filteredAttendances.slice(0, absensiVisibleCount);
                const hasMoreAttendances = absensiVisibleCount < filteredAttendances.length;
                const hasAbsensiFilter =
                  absensiSearch.trim().length > 0 || absensiStatusFilter !== 'ALL';

                const hadirCount = data.attendances.filter((a) => a.status === 'HADIR').length;
                const attendanceRate =
                  data.attendances.length > 0
                    ? Math.round((hadirCount / data.attendances.length) * 100)
                    : 0;

                const getStatusBadgeClass = (status: string) =>
                  status === 'HADIR'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'ALPA'
                      ? 'bg-rose-100 text-rose-800'
                      : status === 'IZIN'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800';

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
                      {(['HADIR', 'SAKIT', 'IZIN', 'ALPA'] as const).map((status) => (
                        <StatCard
                          key={status}
                          label={status}
                          value={String(
                            data.attendances.filter((a) => a.status === status).length
                          )}
                          tone={
                            status === 'HADIR'
                              ? 'emerald'
                              : status === 'ALPA'
                                ? 'rose'
                                : 'amber'
                          }
                        />
                      ))}
                    </div>

                    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Catatan Kehadiran</span>
                          {data.attendances.length > 0 && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                              {attendanceRate}% Hadir
                            </span>
                          )}
                        </h2>
                        {data.attendances.length > 0 && (
                          <span className="text-[11px] font-medium text-slate-500">
                            Menampilkan {displayedAttendances.length} dari {filteredAttendances.length} catatan
                          </span>
                        )}
                      </div>

                      {data.attendances.length > 0 && (
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="relative flex-1 min-w-0">
                            <label htmlFor="absensi-search-input" className="sr-only">
                              Cari riwayat absensi
                            </label>
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              id="absensi-search-input"
                              type="text"
                              value={absensiSearch}
                              onChange={(e) => {
                                setAbsensiSearch(e.target.value);
                                setAbsensiVisibleCount(20);
                              }}
                              placeholder="Cari mata pelajaran, tanggal, atau catatan..."
                              className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                            />
                            {absensiSearch && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAbsensiSearch('');
                                  setAbsensiVisibleCount(20);
                                }}
                                aria-label="Hapus pencarian absensi"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
                            {(['ALL', 'HADIR', 'SAKIT', 'IZIN', 'ALPA'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                aria-pressed={absensiStatusFilter === st}
                                onClick={() => {
                                  setAbsensiStatusFilter(st);
                                  setAbsensiVisibleCount(20);
                                }}
                                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 whitespace-nowrap ${
                                  absensiStatusFilter === st
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                }`}
                              >
                                {st === 'ALL' ? 'Semua' : st}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {data.attendances.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">
                          Belum ada riwayat absensi tercatat.
                        </p>
                      ) : filteredAttendances.length === 0 ? (
                        <div className="py-8 text-center space-y-2.5">
                          <p className="text-xs font-semibold text-slate-600">
                            Tidak ada catatan absensi yang sesuai filter.
                          </p>
                          {hasAbsensiFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                setAbsensiSearch('');
                                setAbsensiStatusFilter('ALL');
                                setAbsensiVisibleCount(20);
                              }}
                              className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Mobile Card List */}
                          <div className="space-y-2.5 md:hidden">
                            {displayedAttendances.map((a) => {
                              const sched = a.schedule as {
                                start_time?: string | null;
                                end_time?: string | null;
                                subject?: { name?: string | null } | null;
                              } | null;
                              const cls = a.classroom as { name?: string | null } | null;
                              const status = String(a.status || '-');
                              const dateVal = a.attendance_date
                                ? String(a.attendance_date)
                                : null;
                              return (
                                <div
                                  key={String(a.id)}
                                  className="modular-card rounded-2xl p-3.5 space-y-1.5 text-xs min-w-0"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {formatDateId(dateVal)}
                                    </span>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getStatusBadgeClass(
                                        status
                                      )}`}
                                    >
                                      {status}
                                    </span>
                                  </div>
                                  <p className="font-bold text-slate-900 break-words">
                                    {sched?.subject?.name
                                      ? `Mapel: ${sched.subject.name}`
                                      : 'Absensi Harian Kelas'}
                                  </p>
                                  {(sched?.start_time || cls?.name) && (
                                    <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      {sched?.start_time && (
                                        <span className="inline-flex items-center gap-1">
                                          <Clock className="w-3 h-3 shrink-0" />
                                          {formatTimeShort(sched.start_time)}
                                          {sched.end_time ? `–${formatTimeShort(sched.end_time)}` : ''}
                                        </span>
                                      )}
                                      {cls?.name && <span>Kelas {cls.name}</span>}
                                    </p>
                                  )}
                                  {Boolean(a.notes) && (
                                    <p className="text-[11px] text-slate-500 break-words bg-slate-50 rounded-xl px-2.5 py-1.5">
                                      Catatan: {String(a.notes)}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                  <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                                  <th className="py-2.5 px-3">Jenis / Mata Pelajaran</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Waktu / Kelas</th>
                                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                                  <th className="py-2.5 px-3">Catatan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {displayedAttendances.map((a) => {
                                  const sched = a.schedule as {
                                    start_time?: string | null;
                                    end_time?: string | null;
                                    subject?: { name?: string | null } | null;
                                  } | null;
                                  const cls = a.classroom as { name?: string | null } | null;
                                  const status = String(a.status || '-');
                                  const dateVal = a.attendance_date
                                    ? String(a.attendance_date)
                                    : null;
                                  return (
                                    <tr key={String(a.id)} className="hover:bg-slate-50/70">
                                      <td className="py-2.5 px-3 font-medium whitespace-nowrap text-slate-700">
                                        {formatDateId(dateVal)}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-800 font-medium break-words">
                                        {sched?.subject?.name
                                          ? `Mapel: ${sched.subject.name}`
                                          : 'Absensi Harian Kelas'}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                        {sched?.start_time
                                          ? `${formatTimeShort(sched.start_time)}${
                                              sched.end_time ? `–${formatTimeShort(sched.end_time)}` : ''
                                            }`
                                          : cls?.name
                                            ? `Kelas ${cls.name}`
                                            : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(
                                            status
                                          )}`}
                                        >
                                          {status}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-500 max-w-[260px] break-words">
                                        {a.notes ? String(a.notes) : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {hasMoreAttendances && (
                            <div className="pt-2 text-center">
                              <button
                                type="button"
                                onClick={() => setAbsensiVisibleCount((c) => c + 20)}
                                className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                              >
                                Muat Lebih Banyak (
                                {filteredAttendances.length - displayedAttendances.length} tersisa)
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* 5. TAGIHAN & PEMBAYARAN SPP */}
          {section === 'spp' && (
            <div className="space-y-6">
              {data.bills.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="w-8 h-8 text-slate-300" />}
                  title={
                    scope === 'orang-tua' && !data.student
                      ? 'Belum ada data putra/putri terhubung'
                      : 'Belum ada tagihan SPP / Komite'
                  }
                  description={
                    scope === 'orang-tua' && !data.student
                      ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
                      : 'Belum ada tagihan yang diterbitkan untuk akun siswa ini.'
                  }
                />
              ) : (() => {
                const totalTagihan = data.bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                const totalDibayar = data.bills.reduce(
                  (sum, b) => sum + (Number(b.paid_amount) || 0),
                  0
                );
                const totalSisa = Math.max(0, totalTagihan - totalDibayar);

                const MONTH_NAMES = [
                  '',
                  'Januari',
                  'Februari',
                  'Maret',
                  'April',
                  'Mei',
                  'Juni',
                  'Juli',
                  'Agustus',
                  'September',
                  'Oktober',
                  'November',
                  'Desember',
                ];

                const q = sppSearch.trim().toLowerCase();
                const filteredBills = data.bills.filter((b) => {
                  if (sppStatusFilter === 'LUNAS' && b.status !== 'LUNAS') return false;
                  if (sppStatusFilter === 'CICILAN' && b.status !== 'CICILAN') return false;
                  if (sppStatusFilter === 'UNPAID' && b.status === 'LUNAS') return false;
                  if (q) {
                    const feeName = b.title || b.fee_type?.name || 'Tagihan';
                    const monthNum = Number(b.billing_month) || 0;
                    const monthName = MONTH_NAMES[monthNum] || '';
                    const paddedMonth = monthNum > 0 ? String(monthNum).padStart(2, '0') : '';
                    const period =
                      b.billing_month && b.billing_year
                        ? `${b.billing_month}/${b.billing_year} ${paddedMonth}/${b.billing_year} ${monthName} ${b.billing_year}`
                        : '';
                    const haystack = `${feeName} ${period} ${b.status}`.toLowerCase();
                    if (!haystack.includes(q)) return false;
                  }
                  return true;
                });

                const openSppSlip = (b: PersonalPayload['bills'][number]) => {
                  const relatedPay = data.payments.find((p) => p.bill_id === b.id);
                  setActiveSppSlip({
                    billId: b.id,
                    referenceNumber: relatedPay?.reference_number || null,
                    studentName: data.student?.full_name || data.profile.fullName,
                    studentNis: data.student?.nis || null,
                    feeName: b.title || b.fee_type?.name || 'SPP / Iuran Komite',
                    periodLabel:
                      b.billing_month && b.billing_year
                        ? `${b.billing_month}/${b.billing_year}`
                        : null,
                    amount: Number(b.amount) || 0,
                    paidAmount: Number(b.paid_amount) || 0,
                    status: b.status,
                    paymentDate: relatedPay?.payment_date || null,
                    paymentMethod: relatedPay?.payment_method || null,
                  });
                };

                const hasSppFilter = sppSearch.trim().length > 0 || sppStatusFilter !== 'ALL';

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <StatCard
                        label="Total Tagihan"
                        value={formatRupiah(totalTagihan)}
                        tone="slate"
                      />
                      <StatCard
                        label="Sudah Dibayar"
                        value={formatRupiah(totalDibayar)}
                        tone="emerald"
                      />
                      <StatCard
                        label="Sisa Tagihan"
                        value={formatRupiah(totalSisa)}
                        tone={totalSisa > 0 ? 'rose' : 'emerald'}
                      />
                    </div>

                    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Daftar Tagihan &amp; Status Pembayaran</span>
                        </h2>
                        <span className="text-[11px] font-medium text-slate-500">
                          Menampilkan {filteredBills.length} dari {data.bills.length} tagihan
                        </span>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-0">
                          <label htmlFor="spp-search-input" className="sr-only">
                            Cari tagihan SPP
                          </label>
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="spp-search-input"
                            type="text"
                            value={sppSearch}
                            onChange={(e) => setSppSearch(e.target.value)}
                            placeholder="Cari jenis biaya atau periode (mis. 11/2026 atau November)..."
                            className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                          />
                          {sppSearch && (
                            <button
                              type="button"
                              onClick={() => setSppSearch('')}
                              aria-label="Hapus pencarian tagihan"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
                          {(
                            [
                              { key: 'ALL', label: 'Semua' },
                              { key: 'UNPAID', label: 'Belum Lunas' },
                              { key: 'CICILAN', label: 'Cicilan' },
                              { key: 'LUNAS', label: 'Lunas' },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              aria-pressed={sppStatusFilter === tab.key}
                              onClick={() => setSppStatusFilter(tab.key)}
                              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 whitespace-nowrap ${
                                sppStatusFilter === tab.key
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredBills.length === 0 ? (
                        <div className="py-8 text-center space-y-2.5">
                          <p className="text-xs font-semibold text-slate-600">
                            Tidak ada tagihan yang sesuai filter.
                          </p>
                          {hasSppFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                setSppSearch('');
                                setSppStatusFilter('ALL');
                              }}
                              className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Mobile Card List */}
                          <div className="space-y-3 md:hidden">
                            {filteredBills.map((b) => {
                              const amount = Number(b.amount) || 0;
                              const paid = Number(b.paid_amount) || 0;
                              const remaining = Math.max(0, amount - paid);
                              const canDownloadSlip = paid > 0 || b.status === 'LUNAS';
                              const periodLabel =
                                b.billing_month && b.billing_year
                                  ? `${b.billing_month}/${b.billing_year}`
                                  : '-';
                              return (
                                <div
                                  key={b.id}
                                  className="modular-card rounded-2xl p-4 space-y-2.5 text-xs min-w-0"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 break-words">
                                        {b.title || b.fee_type?.name || 'Tagihan'}
                                      </p>
                                      <p className="text-[11px] text-slate-500">
                                        Periode: {periodLabel}
                                        {b.due_date ? ` • Tempo: ${formatDateId(b.due_date)}` : ''}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        b.status === 'LUNAS'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : b.status === 'CICILAN'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {b.status}
                                    </span>
                                  </div>

                                  <div className="space-y-1 pt-2 border-t border-slate-100">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-slate-500">Nominal Tagihan</span>
                                      <span className="font-bold text-slate-900">
                                        {formatRupiah(amount)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-slate-500">Sudah Dibayar</span>
                                      <span className="font-semibold text-emerald-700">
                                        {formatRupiah(paid)}
                                      </span>
                                    </div>
                                    {remaining > 0 && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-slate-500">Sisa</span>
                                        <span className="font-semibold text-rose-600">
                                          {formatRupiah(remaining)}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {canDownloadSlip && (
                                    <button
                                      type="button"
                                      onClick={() => openSppSlip(b)}
                                      className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                                    >
                                      <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip PNG
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                  <th className="py-2.5 px-3">Jenis Biaya</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Periode</th>
                                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Nominal Tagihan</th>
                                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Sudah Dibayar</th>
                                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Sisa</th>
                                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Slip</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredBills.map((b) => {
                                  const amount = Number(b.amount) || 0;
                                  const paid = Number(b.paid_amount) || 0;
                                  const remaining = Math.max(0, amount - paid);
                                  const canDownloadSlip = paid > 0 || b.status === 'LUNAS';
                                  return (
                                    <tr key={b.id} className="hover:bg-slate-50/70">
                                      <td className="py-2.5 px-3 font-semibold text-slate-900 break-words">
                                        {b.title || b.fee_type?.name || 'Tagihan'}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                        {b.billing_month && b.billing_year
                                          ? `${b.billing_month}/${b.billing_year}`
                                          : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                                        {formatRupiah(amount)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap">
                                        {formatRupiah(paid)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap text-rose-600">
                                        {remaining > 0 ? formatRupiah(remaining) : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            b.status === 'LUNAS'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : b.status === 'CICILAN'
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-rose-100 text-rose-800'
                                          }`}
                                        >
                                          {b.status}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        {canDownloadSlip ? (
                                          <button
                                            type="button"
                                            onClick={() => openSppSlip(b)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                                            title="Lihat & Unduh Slip PNG"
                                          >
                                            <Download className="w-3 h-3" /> PNG
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-slate-400">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* 6. SLIP HONORARIUM PRIBADI (GTK) */}
          {section === 'honorarium' && (() => {
            if (!data.teacher) {
              return (
                <EmptyState
                  icon={<Banknote className="w-8 h-8 text-slate-300" />}
                  title="Akun belum tertaut ke data GTK"
                  description="Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha."
                />
              );
            }

            if (data.honorariums.length === 0) {
              return (
                <EmptyState
                  icon={<Banknote className="w-8 h-8 text-slate-300" />}
                  title="Belum ada slip honorarium"
                  description="Slip honorarium bulanan akan muncul setelah Bendahara menerbitkan rekap honorarium."
                />
              );
            }

            const HONOR_MONTHS = [
              '',
              'Januari',
              'Februari',
              'Maret',
              'April',
              'Mei',
              'Juni',
              'Juli',
              'Agustus',
              'September',
              'Oktober',
              'November',
              'Desember',
            ];

            const totalHonorReceived = data.honorariums.reduce(
              (sum, h) => sum + (Number(h.total_amount) || 0),
              0
            );
            const totalHonorJtm = data.honorariums.reduce(
              (sum, h) => sum + (Number(h.total_jtm) || 0),
              0
            );

            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
                  <StatCard
                    label="Total Slip Tersedia"
                    value={`${data.honorariums.length} Periode`}
                    tone="slate"
                  />
                  <StatCard
                    label="Akumulasi JTM"
                    value={`${totalHonorJtm} JTM`}
                    tone="amber"
                  />
                  <div className="col-span-2 sm:col-span-1">
                    <StatCard
                      label="Total Honorarium"
                      value={formatRupiah(totalHonorReceived)}
                      tone="emerald"
                    />
                  </div>
                </div>

                <div
                  className={`grid gap-4 ${
                    data.honorariums.length === 1
                      ? 'grid-cols-1 max-w-xl'
                      : 'grid-cols-1 md:grid-cols-2'
                  }`}
                >
                  {data.honorariums.map((h) => {
                    const mNum = Number(h.period_month) || 0;
                    const monthLabel = HONOR_MONTHS[mNum] || String(h.period_month || '-');
                    const statusStr = String(h.status || 'DRAFT').toUpperCase();
                    const statusBadge =
                      statusStr === 'DIBAYAR' || statusStr === 'LUNAS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : statusStr === 'DISETUJUI'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800';

                    return (
                      <div
                        key={String(h.id)}
                        className="glass-card rounded-3xl p-4 sm:p-5 space-y-3 border border-slate-200 min-w-0"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {monthLabel} {String(h.period_year || '')}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusBadge}`}
                          >
                            {statusStr}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex justify-between gap-2">
                            <span>Total JTM:</span>
                            <strong className="text-slate-900 shrink-0">
                              {Number(h.total_jtm) || 0} JTM
                            </strong>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>Honor JTM:</span>
                            <strong className="text-slate-900 shrink-0">
                              {formatRupiah(Number(h.jtm_honorarium_amount) || 0)}
                            </strong>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>Tunjangan Tugas &amp; Transport:</span>
                            <strong className="text-slate-900 shrink-0">
                              {formatRupiah(
                                (Number(h.additional_duty_allowance) || 0) +
                                  (Number(h.transport_allowance) || 0)
                              )}
                            </strong>
                          </div>
                          <div className="flex justify-between gap-2 pt-2 border-t border-slate-100 text-sm font-black text-emerald-800">
                            <span>Total Diterima Bersih:</span>
                            <span className="shrink-0">
                              {formatRupiah(Number(h.total_amount) || 0)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveHonorSlip({
                              id: String(h.id),
                              teacherName: data.teacher?.full_name || data.profile.fullName,
                              teacherNip: data.teacher?.nip || null,
                              homeDistanceKm:
                                h.home_distance_km != null
                                  ? Number(h.home_distance_km)
                                  : data.teacher?.home_distance_km ?? null,
                              periodMonth: Number(h.period_month) || 1,
                              periodYear: Number(h.period_year) || new Date().getFullYear(),
                              teachingJtm: Number(h.teaching_jtm) || 0,
                              substituteJtm: Number(h.substitute_jtm) || 0,
                              examSupervisorJtm: Number(h.exam_supervisor_jtm) || 0,
                              examCommitteeJtm: Number(h.exam_committee_jtm) || 0,
                              eventJtm: Number(h.event_jtm) || 0,
                              picketJtm: Number(h.picket_jtm) || 0,
                              ceremonyJtm: Number(h.ceremony_jtm) || 0,
                              paidHolidayJtm: Number(h.paid_holiday_jtm) || 0,
                              totalJtm: Number(h.total_jtm) || 0,
                              ratePerJtm: Number(h.rate_per_jtm) || 0,
                              jtmHonorariumAmount: Number(h.jtm_honorarium_amount) || 0,
                              additionalDutyAllowance: Number(h.additional_duty_allowance) || 0,
                              transportAllowance: Number(h.transport_allowance) || 0,
                              totalAmount: Number(h.total_amount) || 0,
                              status: statusStr,
                              dutyItems: (h.items as HonorariumDutyItem[]) || [],
                            })
                          }
                          className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2 px-3 text-xs transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip (PNG / PDF)
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 7. JADWAL & RUANG UJIAN */}
          {section === 'ujian' && (() => {
            const q = examSearch.trim().toLowerCase();
            const sortedRooms = [...data.examRooms].sort((a, b) => {
              const dateA = a.exam_room?.exam_date || a.exam_room?.period?.start_date || '';
              const dateB = b.exam_room?.exam_date || b.exam_room?.period?.start_date || '';
              if (dateA !== dateB) return dateA.localeCompare(dateB);
              return (a.exam_room?.start_time || '').localeCompare(b.exam_room?.start_time || '');
            });
            const filteredRooms = q
              ? sortedRooms.filter((er) => {
                  const haystack = `${er.exam_room?.period?.name || ''} ${
                    er.exam_room?.room_name || ''
                  } ${er.seat_number || ''} ${er.exam_room?.exam_date || ''}`.toLowerCase();
                  return haystack.includes(q);
                })
              : sortedRooms;

            return (
              <div className="space-y-4">
                {data.examRooms.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen className="w-8 h-8 text-slate-300" />}
                    title="Belum ada penempatan ruang ujian"
                    description="Penempatan ruang dan nomor kursi ujian akan muncul saat periode ujian aktif."
                  />
                ) : (
                  <>
                    {data.examRooms.length > 2 && (
                      <div className="glass-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <span className="text-xs font-semibold text-slate-700">
                          Menampilkan {filteredRooms.length} dari {data.examRooms.length} ruang ujian
                        </span>
                        <div className="relative min-w-0 sm:w-64">
                          <label htmlFor="exam-search-input" className="sr-only">
                            Cari ruang atau periode ujian
                          </label>
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="exam-search-input"
                            type="search"
                            value={examSearch}
                            onChange={(e) => setExamSearch(e.target.value)}
                            placeholder="Cari ruang, kursi, atau periode..."
                            className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                          />
                        </div>
                      </div>
                    )}

                    {filteredRooms.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Tidak ada ruang ujian yang cocok dengan pencarian &ldquo;{examSearch}
                          &rdquo;.
                        </p>
                        <button
                          type="button"
                          onClick={() => setExamSearch('')}
                          className="text-[11px] font-semibold text-emerald-700 hover:underline"
                        >
                          Reset pencarian
                        </button>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {filteredRooms.map((er) => {
                          const period = er.exam_room?.period;
                          return (
                            <div
                              key={er.id}
                              className="glass-card rounded-3xl p-5 space-y-3 min-w-0 border border-slate-200/80"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-xs font-bold text-emerald-700 break-words">
                                    {period?.name || 'Periode Ujian'}
                                  </p>
                                  <h3 className="text-base font-black text-slate-900 break-words">
                                    Ruang: {er.exam_room?.room_name || '-'}
                                  </h3>
                                </div>
                                <span className="shrink-0 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono">
                                  Kursi: {er.seat_number || '-'}
                                </span>
                              </div>

                              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                                {er.exam_room?.exam_date ? (
                                  <p className="flex items-center gap-1.5 flex-wrap">
                                    <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>
                                      {formatDateId(er.exam_room.exam_date)} (
                                      {formatTimeShort(er.exam_room.start_time)} –{' '}
                                      {formatTimeShort(er.exam_room.end_time)})
                                    </span>
                                  </p>
                                ) : (
                                  (period?.start_date || period?.end_date) && (
                                    <p className="flex items-center gap-1.5 flex-wrap">
                                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>
                                        Periode: {formatDateId(period?.start_date)} –{' '}
                                        {formatDateId(period?.end_date)}
                                      </span>
                                    </p>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* 8. CATATAN BK (NON-RAHASIA) */}
          {section === 'bk' && (() => {
            if (scope === 'orang-tua' && !data.student) {
              return (
                <EmptyState
                  icon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
                  title="Belum ada data putra/putri terhubung"
                  description="Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah."
                />
              );
            }

            const q = bkSearch.trim().toLowerCase();
            const sortedBk = [...data.bkRecords].sort((a, b) =>
              (b.incident_date || '').localeCompare(a.incident_date || '')
            );
            const filteredBk = sortedBk.filter((rec) => {
              const recType = String(rec.record_type || '').toUpperCase();
              if (bkTypeFilter !== 'ALL' && recType !== bkTypeFilter) return false;
              if (q) {
                const haystack = `${recType} ${rec.category || ''} ${rec.description || ''} ${
                  rec.follow_up || ''
                } ${rec.counselor?.full_name || ''} ${rec.incident_date || ''} ${formatDateId(
                  rec.incident_date
                )}`.toLowerCase();
                if (!haystack.includes(q)) return false;
              }
              return true;
            });
            const hasBkFilter = bkSearch.trim().length > 0 || bkTypeFilter !== 'ALL';

            const countKonsultasi = data.bkRecords.filter(
              (r) => String(r.record_type || '').toUpperCase() === 'KONSULTASI'
            ).length;
            const countPrestasi = data.bkRecords.filter(
              (r) => String(r.record_type || '').toUpperCase() === 'PRESTASI'
            ).length;
            const countPelanggaran = data.bkRecords.filter(
              (r) => String(r.record_type || '').toUpperCase() === 'PELANGGARAN'
            ).length;

            return (
              <div className="space-y-4">
                {data.bkRecords.length === 0 ? (
                  <EmptyState
                    icon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
                    title="Tidak ada catatan BK"
                    description={
                      scope === 'orang-tua'
                        ? 'Belum ada catatan bimbingan konseling atau pembinaan yang tercatat untuk putra/putri Anda.'
                        : 'Belum ada catatan bimbingan konseling atau pembinaan yang tercatat.'
                    }
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard
                        label="Konsultasi"
                        value={String(countKonsultasi)}
                        tone="slate"
                      />
                      <StatCard
                        label="Prestasi"
                        value={String(countPrestasi)}
                        tone="emerald"
                      />
                      <StatCard
                        label="Pelanggaran"
                        value={String(countPelanggaran)}
                        tone={countPelanggaran > 0 ? 'rose' : 'slate'}
                      />
                    </div>

                    <div className="glass-card rounded-2xl p-3.5 sm:p-4 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-0">
                          <label htmlFor="personal-bk-search" className="sr-only">
                            Cari catatan BK
                          </label>
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="personal-bk-search"
                            type="text"
                            value={bkSearch}
                            onChange={(e) => setBkSearch(e.target.value)}
                            placeholder="Cari catatan, tindak lanjut, tanggal, atau konselor..."
                            className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                          />
                          {bkSearch && (
                            <button
                              type="button"
                              onClick={() => setBkSearch('')}
                              aria-label="Hapus pencarian catatan BK"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
                          {(
                            [
                              { key: 'ALL', label: 'Semua' },
                              { key: 'KONSULTASI', label: 'Konsultasi' },
                              { key: 'PRESTASI', label: 'Prestasi' },
                              { key: 'PELANGGARAN', label: 'Pelanggaran' },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              aria-pressed={bkTypeFilter === tab.key}
                              onClick={() => setBkTypeFilter(tab.key)}
                              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 whitespace-nowrap ${
                                bkTypeFilter === tab.key
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                        <span>
                          Menampilkan {filteredBk.length} dari {data.bkRecords.length} catatan
                        </span>
                      </div>
                    </div>

                    {filteredBk.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2.5">
                        <p className="text-xs font-semibold text-slate-700">
                          Tidak ada catatan BK yang sesuai dengan filter pencarian.
                        </p>
                        {hasBkFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setBkSearch('');
                              setBkTypeFilter('ALL');
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredBk.map((rec) => {
                          const recType = String(rec.record_type || '').toUpperCase();
                          const badgeClass =
                            recType === 'PELANGGARAN'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : recType === 'PRESTASI'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200';
                          return (
                            <div
                              key={rec.id}
                              className="glass-card rounded-3xl p-4 sm:p-5 space-y-2.5 min-w-0"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold max-w-full break-words ${badgeClass}`}
                                >
                                  {recType || 'CATATAN'} {rec.category ? `• ${rec.category}` : ''}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 shrink-0">
                                  {formatDateId(rec.incident_date)}
                                </span>
                              </div>
                              <p className="text-xs sm:text-[13px] text-slate-800 font-medium break-words leading-relaxed">
                                {rec.description}
                              </p>
                              {rec.follow_up && (
                                <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 break-words">
                                  <span className="font-semibold">Tindak Lanjut:</span> {rec.follow_up}
                                </p>
                              )}
                              {rec.counselor?.full_name && (
                                <p className="text-[11px] text-slate-500 break-words">
                                  Guru BK: {rec.counselor.full_name}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </>
      )}

      {activeSlip && (
        <SavingsSlipModal slip={activeSlip} onClose={() => setActiveSlip(null)} />
      )}
      {activeSppSlip && (
        <SppSlipModal slip={activeSppSlip} onClose={() => setActiveSppSlip(null)} />
      )}
      {activeHonorSlip && (
        <HonorariumSlipModal slip={activeHonorSlip} onClose={() => setActiveHonorSlip(null)} />
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card rounded-3xl p-10 text-center flex flex-col items-center justify-center space-y-2">
      {icon}
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md">{description}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/70 text-amber-900'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50/70 text-rose-900'
          : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold opacity-75 uppercase">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}
