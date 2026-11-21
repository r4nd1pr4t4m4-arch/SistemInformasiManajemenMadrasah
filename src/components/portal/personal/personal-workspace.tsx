'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  Sparkles,
  Wallet,
  CheckCircle2,
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
    employee_type?: string | null;
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
    subject?: { name?: string | null; code?: string | null } | null;
    teacher?: { full_name?: string | null } | null;
    classroom?: { name?: string | null } | null;
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
  const [todayDay, setTodayDay] = useState<number>(1);
  const [activeSlip, setActiveSlip] = useState<SavingsSlipData | null>(null);
  const [activeSppSlip, setActiveSppSlip] = useState<SppSlipData | null>(null);
  const [activeHonorSlip, setActiveHonorSlip] = useState<HonorariumSlipData | null>(null);

  // Filter & pagination khusus Tabungan Digital
  const [trxSearch, setTrxSearch] = useState('');
  const [trxTypeFilter, setTrxTypeFilter] = useState<'ALL' | 'SETOR' | 'TARIK'>('ALL');
  const [trxAccountFilter, setTrxAccountFilter] = useState<string>('ALL');
  const [trxVisibleCount, setTrxVisibleCount] = useState<number>(15);

  useEffect(() => {
    setTodayDay(getTodayIsoDay());
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
        if (!selectedChildId && json.children?.length > 0 && json.student?.id) {
          setSelectedChildId(json.student.id);
        }
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
      return Array.from(new Set(data.pickets.map((p) => p.day_of_week)));
    }
    if (!data.student?.id) return [];
    return Array.from(
      new Set(
        data.pickets
          .filter((p) => p.student_id === data.student?.id)
          .map((p) => p.day_of_week)
      )
    );
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <UserCheck className="w-3.5 h-3.5" />
                {data.student.full_name}
                {data.student.nis ? ` (NIS: ${data.student.nis})` : ''}
              </span>
              {data.classroom && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <UserCheck className="w-3.5 h-3.5" />
                {data.teacher.full_name}
                {data.teacher.nip ? ` (NIP: ${data.teacher.nip})` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Child selector for Orang Tua */}
          {scope === 'orang-tua' && data && data.children.length > 1 && (
            <div className="min-w-[220px] flex-1 sm:flex-none">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Pilih Putra / Putri:
              </label>
              <select
                value={selectedChildId}
                onChange={(e) => {
                  setLoading(true);
                  setError(null);
                  setSelectedChildId(e.target.value);
                }}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
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
            className="self-end min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
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
          {section === 'jadwal-pelajaran' && (
            <div className="space-y-4">
              {data.schedules.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="w-8 h-8 text-slate-300" />}
                  title="Belum ada jadwal tersedia"
                  description={
                    scope === 'gtk'
                      ? 'Jadwal mengajar Anda belum ditetapkan oleh bagian kurikulum.'
                      : 'Jadwal pelajaran kelas belum tersedia atau Anda belum ditempatkan di rombel aktif.'
                  }
                />
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((day) => {
                    const dayItems = data.schedules.filter((s) => s.day_of_week === day);
                    const isToday = day === todayDay;
                    return (
                      <div
                        key={day}
                        className={`rounded-3xl border p-5 transition ${isToday
                          ? 'border-emerald-400 bg-emerald-50/40 shadow-sm'
                          : 'border-slate-200 bg-white'
                          }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <CalendarDays
                              className={`w-4 h-4 ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}
                            />
                            {DAY_NAMES[day]}
                          </h3>
                          {isToday && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                              HARI INI
                            </span>
                          )}
                        </div>
                        {dayItems.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-4 text-center">
                            Tidak ada jadwal
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {dayItems.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeShort(item.start_time)} – {formatTimeShort(item.end_time)}
                                  </span>
                                  <span className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">
                                    {item.jtm_count} JTM
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-slate-900">
                                  {item.subject?.name || 'Mata Pelajaran'}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {scope === 'gtk'
                                    ? `Kelas: ${item.classroom?.name || '-'}`
                                    : `Guru: ${item.teacher?.full_name || '-'}`}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. JADWAL PIKET (KELAS UNTUK SISWA/ORTU, PIKET GURU UNTUK GTK) */}
          {section === 'jadwal-piket' && (
            <div className="space-y-5">
              {/* Banner penanda khusus hari piketnya */}
              <div
                className={`rounded-3xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${myPicketDays.includes(todayDay)
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <Sparkles
                    className={`w-5 h-5 shrink-0 mt-0.5 ${myPicketDays.includes(todayDay) ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">
                      {scope === 'orang-tua'
                        ? 'Jadwal Piket Putra/Putri Anda'
                        : 'Jadwal Piket Anda'}
                    </p>
                    <p className="text-sm font-black mt-0.5">
                      {myPicketDays.length > 0
                        ? `Hari ${myPicketDays.map((d) => DAY_NAMES[d]).join(', ')}`
                        : 'Belum ada hari piket yang ditetapkan'}
                    </p>
                    {myPicketDays.includes(todayDay) && (
                      <p className="text-xs font-semibold text-amber-800 mt-1">
                        🔔 Hari ini ({DAY_NAMES[todayDay]}) adalah jadwal piket! Pastikan melaksanakan tugas piket tepat waktu.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {scope === 'gtk' ? (
                data.pickets.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
                    title="Belum ada jadwal piket guru"
                    description="Jadwal piket guru/petugas piket Anda belum ditetapkan."
                  />
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.pickets.map((p) => {
                      const isToday = p.day_of_week === todayDay;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-3xl border p-5 ${isToday
                            ? 'border-amber-400 bg-amber-50/70 shadow-sm'
                            : 'border-emerald-200 bg-white'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-900">
                              {DAY_NAMES[p.day_of_week]}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                              {isToday ? 'PIKET HARI INI' : 'TUGAS PIKET'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2">
                            {p.notes || 'Piket harian madrasah / pemantauan gerbang & KBM.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : data.pickets.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
                  title="Jadwal piket kelas belum tersedia"
                  description="Wali kelas belum menambahkan jadwal piket untuk kelas Anda."
                />
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((day) => {
                    const dayPickets = data.pickets.filter((p) => p.day_of_week === day);
                    const isMyDay = myPicketDays.includes(day);
                    const isToday = day === todayDay;
                    return (
                      <div
                        key={day}
                        className={`rounded-3xl border p-5 transition ${isMyDay
                          ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-300/60 shadow-sm'
                          : isToday
                            ? 'border-emerald-300 bg-emerald-50/30'
                            : 'border-slate-200 bg-white'
                          }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                          <h3 className="font-bold text-slate-900 text-sm">{DAY_NAMES[day]}</h3>
                          <div className="flex items-center gap-1.5">
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
                          <p className="text-xs text-slate-400 italic py-4 text-center">
                            Belum ada petugas
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {dayPickets.map((p) => {
                              const isSelf = p.student_id === data.student?.id;
                              return (
                                <li
                                  key={p.id}
                                  className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 ${isSelf
                                    ? 'bg-amber-100 border border-amber-300 font-bold text-amber-950'
                                    : 'bg-slate-50 border border-slate-100 text-slate-700'
                                    }`}
                                >
                                  <div>
                                    <p>{p.student?.full_name || 'Siswa'}</p>
                                    {p.task_notes && (
                                      <p className="text-[10px] text-slate-500 font-normal">
                                        Tugas: {p.task_notes}
                                      </p>
                                    )}
                                  </div>
                                  {isSelf && (
                                    <span className="text-[10px] font-black text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-300 shrink-0">
                                      ★ Anda
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
          )}

          {/* 3. TABUNGAN DIGITAL & RIWAYAT TRANSAKSI */}
          {section === 'tabungan' && (
            <div className="space-y-6">
              {data.savingsAccounts.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="w-8 h-8 text-slate-300" />}
                  title="Belum memiliki rekening tabungan"
                  description="Silakan hubungi Pengelola Tabungan atau Bendahara Madrasah untuk membuka buku tabungan digital."
                />
              ) : (
                (() => {
                  const totalSetor = data.savingsTransactions
                    .filter((t) => t.transaction_type === 'SETOR')
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                  const totalTarik = data.savingsTransactions
                    .filter((t) => t.transaction_type === 'TARIK')
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                  const q = trxSearch.trim().toLowerCase();
                  const filteredTrx = data.savingsTransactions.filter((trx) => {
                    if (trxTypeFilter !== 'ALL' && trx.transaction_type !== trxTypeFilter) {
                      return false;
                    }
                    if (trxAccountFilter !== 'ALL' && trx.account_id !== trxAccountFilter) {
                      return false;
                    }
                    if (!q) return true;
                    return (
                      (trx.reference_number || '').toLowerCase().includes(q) ||
                      (trx.notes || '').toLowerCase().includes(q)
                    );
                  });

                  const displayedTrx = filteredTrx.slice(0, trxVisibleCount);
                  const hasMoreTrx = trxVisibleCount < filteredTrx.length;
                  const hasTrxFilter =
                    trxSearch.trim().length > 0 ||
                    trxTypeFilter !== 'ALL' ||
                    trxAccountFilter !== 'ALL';

                  function openSlip(trx: PersonalPayload['savingsTransactions'][number]) {
                    const acc = data?.savingsAccounts.find((a) => a.id === trx.account_id);
                    setActiveSlip({
                      referenceNumber: trx.reference_number,
                      accountNumber: acc?.account_number || '-',
                      ownerName: acc?.owner_name || data?.profile.fullName || 'Nasabah',
                      ownerType: acc?.owner_type || 'UMUM',
                      transactionType: trx.transaction_type,
                      amount: Number(trx.amount) || 0,
                      feePercentage: Number(trx.fee_percentage) || 0,
                      feeAmount: Number(trx.fee_amount) || 0,
                      netAmount: Number(trx.net_amount ?? trx.amount),
                      balanceAfter: Number(trx.balance_after) || 0,
                      transactionDate: trx.transaction_date,
                      notes: trx.notes,
                    });
                  }

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            value={`${data.savingsTransactions.length} Kali`}
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
                                placeholder="Cari nomor referensi atau keterangan..."
                                aria-label="Cari transaksi tabungan"
                                className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                              />
                              {trxSearch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrxSearch('');
                                    setTrxVisibleCount(15);
                                  }}
                                  aria-label="Hapus pencarian transaksi"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {data.savingsAccounts.length > 1 && (
                                <select
                                  value={trxAccountFilter}
                                  onChange={(e) => {
                                    setTrxAccountFilter(e.target.value);
                                    setTrxVisibleCount(15);
                                  }}
                                  aria-label="Filter rekening tabungan"
                                  className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
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
                                  onClick={() => {
                                    setTrxTypeFilter(tp);
                                    setTrxVisibleCount(15);
                                  }}
                                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${trxTypeFilter === tp
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
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
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
                                        <span>{formatRupiah(Number(trx.net_amount ?? trx.amount))}</span>
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
                                      className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-xs transition"
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
                                    <th className="py-2.5 px-3">Tanggal</th>
                                    <th className="py-2.5 px-3">Referensi</th>
                                    <th className="py-2.5 px-3">Jenis</th>
                                    <th className="py-2.5 px-3 text-right">Nominal</th>
                                    <th className="py-2.5 px-3 text-right">Fee Tarik</th>
                                    <th className="py-2.5 px-3 text-right">Diterima Bersih</th>
                                    <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                                    <th className="py-2.5 px-3">Keterangan</th>
                                    <th className="py-2.5 px-3 text-center">Slip</th>
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
                                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                          {trx.reference_number}
                                        </td>
                                        <td className="py-2.5 px-3">
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
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                          {formatRupiah(Number(trx.amount) || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-rose-600">
                                          {isTarik && Number(trx.fee_amount) > 0
                                            ? `- ${formatRupiah(Number(trx.fee_amount))}`
                                            : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                                          {isTarik
                                            ? formatRupiah(Number(trx.net_amount ?? trx.amount))
                                            : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                          {formatRupiah(Number(trx.balance_after) || 0)}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-500">
                                          {trx.notes || '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => openSlip(trx)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
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
              {scope === 'gtk' ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    <StatCard
                      label="Dalam Radius Geofence"
                      value={String(
                        data.attendances.filter((row) => Boolean(row.is_within_geofence)).length
                      )}
                      tone="amber"
                    />
                  </div>
                  <div className="glass-card rounded-3xl p-6">
                    {data.attendances.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        Belum ada riwayat presensi GTK.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2.5 px-3">Tanggal</th>
                              <th className="py-2.5 px-3">Jenis Presensi</th>
                              <th className="py-2.5 px-3">Masuk</th>
                              <th className="py-2.5 px-3">Pulang</th>
                              <th className="py-2.5 px-3 text-center">JTM</th>
                              <th className="py-2.5 px-3 text-center">Geofence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.attendances.map((a) => (
                              <tr key={String(a.id)}>
                                <td className="py-2.5 px-3 font-medium">
                                  {formatDateId(String(a.attendance_date))}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {String(a.attendance_type)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {a.check_in_time
                                    ? new Date(String(a.check_in_time)).toLocaleTimeString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                    : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {a.check_out_time
                                    ? new Date(String(a.check_out_time)).toLocaleTimeString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                    : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold">
                                  {Number(a.jtm_earned) || 0}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.is_within_geofence
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                      }`}
                                  >
                                    {a.is_within_geofence ? 'Di Lokasi' : 'Luar Radius'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <div className="glass-card rounded-3xl p-6">
                    {data.attendances.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        Belum ada riwayat absensi tercatat.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2.5 px-3">Tanggal</th>
                              <th className="py-2.5 px-3">Jenis / Mata Pelajaran</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.attendances.map((a) => {
                              const sched = a.schedule as {
                                subject?: { name?: string | null } | null;
                              } | null;
                              const status = String(a.status);
                              return (
                                <tr key={String(a.id)}>
                                  <td className="py-2.5 px-3 font-medium">
                                    {formatDateId(String(a.attendance_date))}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">
                                    {sched?.subject?.name
                                      ? `Mapel: ${sched.subject.name}`
                                      : 'Absensi Harian Kelas'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${status === 'HADIR'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : status === 'ALPA'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-800'
                                        }`}
                                    >
                                      {status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    {a.notes ? String(a.notes) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 5. TAGIHAN & PEMBAYARAN SPP */}
          {section === 'spp' && (
            <div className="space-y-6">
              {data.bills.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="w-8 h-8 text-slate-300" />}
                  title="Belum ada tagihan SPP / Komite"
                  description="Belum ada tagihan yang diterbitkan untuk akun siswa ini."
                />
              ) : (
                <div className="glass-card rounded-3xl p-6 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">Daftar Tagihan &amp; Status Pembayaran</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 px-3">Jenis Biaya</th>
                          <th className="py-2.5 px-3">Periode</th>
                          <th className="py-2.5 px-3 text-right">Nominal Tagihan</th>
                          <th className="py-2.5 px-3 text-right">Sudah Dibayar</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Slip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.bills.map((b) => {
                          const canDownloadSlip =
                            Number(b.paid_amount) > 0 || b.status === 'LUNAS';
                          const relatedPay = data.payments.find((p) => p.bill_id === b.id);
                          return (
                            <tr key={b.id}>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {b.title || b.fee_type?.name || 'Tagihan'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {b.billing_month && b.billing_year
                                  ? `${b.billing_month}/${b.billing_year}`
                                  : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold">
                                {formatRupiah(Number(b.amount) || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                                {formatRupiah(Number(b.paid_amount) || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'LUNAS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : b.status === 'CICILAN'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                    }`}
                                >
                                  {b.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {canDownloadSlip ? (
                                  <button
                                    type="button"
                                    onClick={() =>
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
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
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
                </div>
              )}
            </div>
          )}

          {/* 6. SLIP HONORARIUM PRIBADI (GTK) */}
          {section === 'honorarium' && (
            <div className="space-y-4">
              {data.honorariums.length === 0 ? (
                <EmptyState
                  icon={<Banknote className="w-8 h-8 text-slate-300" />}
                  title="Belum ada slip honorarium"
                  description="Slip honorarium bulanan akan muncul setelah Bendahara menerbitkan rekap honorarium."
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {data.honorariums.map((h) => (
                    <div
                      key={String(h.id)}
                      className="glass-card rounded-3xl p-5 space-y-3 border border-slate-200"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-900">
                          Periode {String(h.period_month)}/{String(h.period_year)}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {String(h.status || 'DRAFT')}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Total JTM:</span>
                          <strong>{Number(h.total_jtm) || 0} JTM</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Honor JTM:</span>
                          <strong>{formatRupiah(Number(h.jtm_honorarium_amount) || 0)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Tunjangan Tugas &amp; Transport:</span>
                          <strong>
                            {formatRupiah(
                              (Number(h.additional_duty_allowance) || 0) +
                              (Number(h.transport_allowance) || 0)
                            )}
                          </strong>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-black text-emerald-800">
                          <span>Total Diterima Bersih:</span>
                          <span>{formatRupiah(Number(h.total_amount) || 0)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHonorSlip({
                            id: String(h.id),
                            teacherName: data.teacher?.full_name || data.profile.fullName,
                            teacherNip: data.teacher?.nip || null,
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
                            status: String(h.status || 'DRAFT'),
                            dutyItems: (h.items as HonorariumDutyItem[]) || [],
                          })
                        }
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2 px-3 text-xs transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip (PNG / PDF)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. JADWAL & RUANG UJIAN */}
          {section === 'ujian' && (
            <div className="space-y-4">
              {data.examRooms.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="w-8 h-8 text-slate-300" />}
                  title="Belum ada penempatan ruang ujian"
                  description="Penempatan ruang dan nomor kursi ujian akan muncul saat periode ujian aktif."
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {data.examRooms.map((er) => (
                    <div key={er.id} className="glass-card rounded-3xl p-5 space-y-2">
                      <p className="text-xs font-bold text-emerald-700">
                        {er.exam_room?.period?.name || 'Periode Ujian'}
                      </p>
                      <h3 className="text-base font-black text-slate-900">
                        Ruang: {er.exam_room?.room_name || '-'}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Nomor Kursi: <strong>{er.seat_number || '-'}</strong>
                      </p>
                      {er.exam_room?.exam_date && (
                        <p className="text-xs text-slate-500">
                          Tanggal: {formatDateId(er.exam_room.exam_date)} ({formatTimeShort(er.exam_room.start_time)} – {formatTimeShort(er.exam_room.end_time)})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. CATATAN BK (NON-RAHASIA) */}
          {section === 'bk' && (
            <div className="space-y-4">
              {data.bkRecords.length === 0 ? (
                <EmptyState
                  icon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
                  title="Tidak ada catatan BK"
                  description="Belum ada catatan bimbingan konseling atau pembinaan yang tercatat."
                />
              ) : (
                <div className="space-y-3">
                  {data.bkRecords.map((rec) => (
                    <div key={rec.id} className="glass-card rounded-3xl p-5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">
                          {rec.record_type} {rec.category ? `• ${rec.category}` : ''}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDateId(rec.incident_date)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium">{rec.description}</p>
                      {rec.follow_up && (
                        <p className="text-[11px] text-emerald-700">
                          Tindak Lanjut: {rec.follow_up}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
