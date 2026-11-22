'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  History,
  Loader2,
  Percent,
  PiggyBank,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import {
  calculateWithdrawalFee,
  DEFAULT_WITHDRAWAL_FEE_TIERS,
  generateTierLabel,
  type SavingsFeeTier,
} from '@/lib/domain/tabungan-fee';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { SavingsSlipModal } from './savings-slip-modal';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';

interface SavingsAccountRow {
  id: string;
  account_number: string;
  owner_type: string;
  student_id?: string | null;
  teacher_id?: string | null;
  owner_name: string;
  owner_phone: string | null;
  balance: number;
}

interface SavingsTransactionRow {
  id: string;
  account_id: string;
  transaction_type: 'SETOR' | 'TARIK';
  amount: number;
  fee_percentage?: number | null;
  fee_amount?: number | null;
  net_amount?: number | null;
  balance_after: number;
  reference_number: string;
  notes: string | null;
  transaction_date: string;
  account?: {
    account_number: string;
    owner_name: string;
    owner_type: string;
  } | null;
}

interface StudentCandidate {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  phone: string | null;
}

interface GtkCandidate {
  id: string;
  full_name: string;
  nip: string | null;
  phone: string | null;
  staff_type: string;
}

interface PublicCandidate {
  id: string;
  full_name: string;
  phone: string | null;
  label: string;
}

export type TabunganSection = 'buka-rekening' | 'transaksi' | 'rekap' | 'aturan-fee';

export function TabunganWorkspace({ section }: { section: TabunganSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.TABUNGAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const [accounts, setAccounts] = useState<SavingsAccountRow[]>([]);
  const [transactions, setTransactions] = useState<SavingsTransactionRow[]>([]);
  const [feeTiers, setFeeTiers] = useState<SavingsFeeTier[]>(DEFAULT_WITHDRAWAL_FEE_TIERS);
  const [students, setStudents] = useState<StudentCandidate[]>([]);
  const [teachers, setTeachers] = useState<GtkCandidate[]>([]);
  const [tuStaff, setTuStaff] = useState<GtkCandidate[]>([]);
  const [publicUsers, setPublicUsers] = useState<PublicCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  // Form Buka Rekening
  const [openAccForm, setOpenAccForm] = useState({
    owner_type: 'SISWA' as 'SISWA' | 'GURU' | 'TU' | 'UMUM',
    student_id: null as string | null,
    teacher_id: null as string | null,
    owner_name: '',
    owner_phone: '',
    initial_deposit: 50000,
  });

  // Form Transaksi
  const [trxForm, setTrxForm] = useState({
    account_id: '',
    transaction_type: 'SETOR' as 'SETOR' | 'TARIK',
    amount: 50000,
    notes: '',
  });

  // Struk / Kuitansi Transaksi Terakhir
  const [lastReceipt, setLastReceipt] = useState<{
    referenceNumber: string;
    accountNumber: string;
    ownerName: string;
    ownerType: string;
    type: 'SETOR' | 'TARIK';
    amount: number;
    feePercentage: number;
    feeAmount: number;
    netAmount: number;
    balanceAfter: number;
    transactionDate: string;
  } | null>(null);
  const [activeSlip, setActiveSlip] = useState<SavingsSlipData | null>(null);

  // State Manajemen Aturan Fee
  const [editingTiers, setEditingTiers] = useState<SavingsFeeTier[]>([]);
  const [hasUnsavedTiers, setHasUnsavedTiers] = useState(false);
  const [confirmResetTiers, setConfirmResetTiers] = useState(false);
  const [confirmDeleteTierIdx, setConfirmDeleteTierIdx] = useState<number | null>(null);
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [tierModalError, setTierModalError] = useState<string | null>(null);
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null);
  const [tierForm, setTierForm] = useState<{
    tier_order: number;
    label: string;
    min_amount: number;
    max_amount: number | null;
    is_unbounded: boolean;
    fee_percentage: number;
    is_active: boolean;
  }>({
    tier_order: 1,
    label: '',
    min_amount: 0,
    max_amount: 500000,
    is_unbounded: false,
    fee_percentage: 2.0,
    is_active: true,
  });

  // Simulator Fee
  const [simAmount, setSimAmount] = useState<number>(1000000);

  // Filter & Pagination Rekap
  const [trxSearch, setTrxSearch] = useState('');
  const [trxTypeFilter, setTrxTypeFilter] = useState<'ALL' | 'SETOR' | 'TARIK'>('ALL');
  const [trxPage, setTrxPage] = useState(1);
  const [accSearch, setAccSearch] = useState('');
  const [accOwnerFilter, setAccOwnerFilter] = useState<
    'ALL' | 'SISWA' | 'GURU' | 'TU' | 'UMUM'
  >('ALL');
  const [accPage, setAccPage] = useState(1);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadData = useCallback(
    async (isManualRefresh = false, signal?: AbortSignal) => {
      const reqId = ++requestIdRef.current;
      if (isManualRefresh || hasLoadedOnceRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await fetch('/api/keuangan/tabungan', { cache: 'no-store', signal });
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data buku tabungan.');
        hasLoadedOnceRef.current = true;
        setLoadError(null);
        setAccounts(data.accounts || []);
        setTransactions(data.transactions || []);
        const loadedTiers: SavingsFeeTier[] =
          data.feeTiers && data.feeTiers.length > 0 ? data.feeTiers : DEFAULT_WITHDRAWAL_FEE_TIERS;
        setFeeTiers(loadedTiers);
        setEditingTiers(loadedTiers);
        setStudents(data.students || []);
        setTeachers(data.teachers || []);
        setTuStaff(data.tuStaff || []);
        setPublicUsers(data.publicUsers || []);
      } catch (e) {
        if (signal?.aborted || reqId !== requestIdRef.current) return;
        const msg = e instanceof Error ? e.message : 'Gagal memuat data buku tabungan.';
        setLoadError(msg);
        showToast('err', msg);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadData(false, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  useEffect(() => {
    if (!tierModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTierModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tierModalOpen]);

  // Perhitungan Real-Time Fee Penarikan saat kasir / pengelola menginput nominal di form transaksi
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === trxForm.account_id) || null,
    [accounts, trxForm.account_id]
  );

  const realTimeFeeCalc = useMemo(() => {
    if (trxForm.transaction_type !== 'TARIK') return null;
    return calculateWithdrawalFee(trxForm.amount, feeTiers);
  }, [trxForm.transaction_type, trxForm.amount, feeTiers]);

  // Perhitungan Simulasi Fee
  const simFeeCalc = useMemo(() => {
    return calculateWithdrawalFee(simAmount, editingTiers);
  }, [simAmount, editingTiers]);

  const filteredTransactions = useMemo(() => {
    const q = trxSearch.trim().toLowerCase();
    return transactions.filter((t) => {
      if (trxTypeFilter !== 'ALL' && t.transaction_type !== trxTypeFilter) return false;
      if (!q) return true;
      return (
        t.reference_number.toLowerCase().includes(q) ||
        (t.account?.owner_name || '').toLowerCase().includes(q) ||
        (t.account?.account_number || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    });
  }, [transactions, trxTypeFilter, trxSearch]);

  const TRX_PAGE_SIZE = 10;
  const totalTrxPages = Math.max(1, Math.ceil(filteredTransactions.length / TRX_PAGE_SIZE));
  const currentTrxPage = Math.min(trxPage, totalTrxPages);
  const trxPageStart = (currentTrxPage - 1) * TRX_PAGE_SIZE;
  const pagedTransactions = useMemo(
    () => filteredTransactions.slice(trxPageStart, trxPageStart + TRX_PAGE_SIZE),
    [filteredTransactions, trxPageStart]
  );

  const filteredAccounts = useMemo(() => {
    const q = accSearch.trim().toLowerCase();
    return accounts.filter((a) => {
      if (accOwnerFilter !== 'ALL' && a.owner_type !== accOwnerFilter) return false;
      if (!q) return true;
      return (
        a.owner_name.toLowerCase().includes(q) ||
        a.account_number.toLowerCase().includes(q) ||
        (a.owner_phone || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, accOwnerFilter, accSearch]);

  const ACC_PAGE_SIZE = 9;
  const totalAccPages = Math.max(1, Math.ceil(filteredAccounts.length / ACC_PAGE_SIZE));
  const currentAccPage = Math.min(accPage, totalAccPages);
  const accPageStart = (currentAccPage - 1) * ACC_PAGE_SIZE;
  const pagedAccounts = useMemo(
    () => filteredAccounts.slice(accPageStart, accPageStart + ACC_PAGE_SIZE),
    [filteredAccounts, accPageStart]
  );

  async function postTabungan(body: unknown, successMsg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('err', data.error || 'Terjadi kesalahan.');
        return false;
      }
      showToast('ok', successMsg);
      await loadData(true);
      return data;
    } catch {
      showToast('err', 'Gagal terhubung ke server.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Simpan Aturan Fee
  async function handleSaveFeeTiers() {
    if (submitting || editingTiers.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_FEE_TIERS',
          tiers: editingTiers.map((t, i) => ({
            tier_order: i + 1,
            label: t.label || generateTierLabel(t.min_amount, t.max_amount),
            min_amount: Number(t.min_amount) || 0,
            max_amount: t.max_amount != null ? Number(t.max_amount) : null,
            fee_percentage: Number(t.fee_percentage) || 0,
            is_active: Boolean(t.is_active),
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ok', 'Aturan fee penarikan tabungan berhasil diperbarui.');
        setHasUnsavedTiers(false);
        if (data.feeTiers) {
          setFeeTiers(data.feeTiers);
          setEditingTiers(data.feeTiers);
        }
      } else {
        showToast('err', data.error || 'Gagal menyimpan aturan fee.');
      }
    } catch {
      showToast('err', 'Gagal terhubung ke server saat menyimpan aturan fee.');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Reset ke 6 Aturan Default
  async function handleResetFeeTiers() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_FEE_TIERS' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ok', 'Aturan fee dikembalikan ke 6 ketentuan standar.');
        setConfirmResetTiers(false);
        setHasUnsavedTiers(false);
        if (data.feeTiers) {
          setFeeTiers(data.feeTiers);
          setEditingTiers(data.feeTiers);
        }
      } else {
        showToast('err', data.error || 'Gagal mereset aturan fee.');
      }
    } catch {
      showToast('err', 'Gagal terhubung ke server saat mereset aturan fee.');
    } finally {
      setSubmitting(false);
    }
  }

  function openAddTierModal() {
    setEditingTierIdx(null);
    setTierModalError(null);
    const lastTier = editingTiers[editingTiers.length - 1];
    const nextMin = lastTier?.max_amount != null ? Number(lastTier.max_amount) : 0;
    setTierForm({
      tier_order: editingTiers.length + 1,
      label: '',
      min_amount: nextMin,
      max_amount: nextMin + 1000000,
      is_unbounded: false,
      fee_percentage: 2.0,
      is_active: true,
    });
    setTierModalOpen(true);
  }

  function openEditTierModal(idx: number) {
    const target = editingTiers[idx];
    if (!target) return;
    setEditingTierIdx(idx);
    setTierModalError(null);
    setTierForm({
      tier_order: target.tier_order,
      label: target.label || '',
      min_amount: Number(target.min_amount) || 0,
      max_amount: target.max_amount != null ? Number(target.max_amount) : null,
      is_unbounded: target.max_amount == null,
      fee_percentage: Number(target.fee_percentage) || 0,
      is_active: Boolean(target.is_active),
    });
    setTierModalOpen(true);
  }

  function handleSaveTierModal() {
    const minVal = Number(tierForm.min_amount);
    const maxVal = tierForm.is_unbounded ? null : Number(tierForm.max_amount);
    const pctVal = Number(tierForm.fee_percentage);

    if (!Number.isFinite(minVal) || minVal < 0) {
      setTierModalError('Batas bawah harus berupa angka minimal Rp 0.');
      return;
    }
    if (maxVal !== null && (!Number.isFinite(maxVal) || maxVal <= minVal)) {
      setTierModalError('Batas atas harus lebih besar dari batas bawah.');
      return;
    }
    if (!Number.isFinite(pctVal) || pctVal < 0 || pctVal > 100) {
      setTierModalError('Persentase fee harus antara 0% sampai 100%.');
      return;
    }

    const finalLabel = tierForm.label.trim() || generateTierLabel(minVal, maxVal);
    const updatedItem: SavingsFeeTier = {
      tier_order: tierForm.tier_order,
      label: finalLabel,
      min_amount: minVal,
      max_amount: maxVal,
      fee_percentage: pctVal,
      is_active: tierForm.is_active,
    };

    if (editingTierIdx === null) {
      setEditingTiers([...editingTiers, updatedItem]);
    } else {
      const nextList = [...editingTiers];
      nextList[editingTierIdx] = updatedItem;
      setEditingTiers(nextList);
    }

    setHasUnsavedTiers(true);
    setTierModalError(null);
    setTierModalOpen(false);
  }

  function handleDeleteTier(idx: number) {
    const nextList = editingTiers.filter((_, i) => i !== idx);
    setEditingTiers(nextList);
    setConfirmDeleteTierIdx(null);
    setHasUnsavedTiers(true);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat buku tabungan digital...
      </div>
    );
  }

  const totalTabungan = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalFeePenarikan = transactions
    .filter((t) => t.transaction_type === 'TARIK')
    .reduce((sum, t) => sum + Number(t.fee_amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-start sm:items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5 sm:mt-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5 sm:mt-0" />
            )}
            <span className="break-words">{toast.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-0.5 rounded-md hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <span className="break-words">{loadError}</span>
          <button
            type="button"
            onClick={() => void loadData(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 font-semibold shrink-0 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Header & Tab Navigation */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Tabungan Digital Warga &amp; Umum</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Kelola pembukaan buku rekening, transaksi setor &amp; penarikan dengan fee otomatis, serta rekapitulasi saldo.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          <Link
            href="/portal/keuangan/tabungan/transaksi"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              section === 'transaksi'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Transaksi Setor / Tarik
          </Link>
          <Link
            href="/portal/keuangan/tabungan/buka-rekening"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              section === 'buka-rekening'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Buka Rekening
          </Link>
          <Link
            href="/portal/keuangan/tabungan/rekap"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              section === 'rekap'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Rekapitulasi
          </Link>
          {canManage && (
            <Link
              href="/portal/keuangan/tabungan/aturan-fee"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                section === 'aturan-fee'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Percent className="w-3.5 h-3.5" /> Aturan Fee Penarikan
            </Link>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Pengelola Tabungan</p>
          <p className="font-bold text-slate-900 mt-1">Admin &amp; Petugas Tabungan</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Siswa, Guru, TU &amp; Warga Umum</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Jumlah Rekening Aktif</p>
          <p className="font-bold text-slate-900 text-lg mt-1">{accounts.length} Rekening</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Semua peran terdaftar</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Saldo Terkumpul</p>
          <p className="font-bold text-emerald-700 text-lg mt-1">{formatRupiah(totalTabungan)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Dana simpanan aktif</p>
        </div>
        <div className="modular-card rounded-2xl p-5 border border-amber-200/70 bg-amber-50/40">
          <p className="text-xs text-amber-800">Total Fee Penarikan</p>
          <p className="font-bold text-amber-900 text-lg mt-1">{formatRupiah(totalFeePenarikan)}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Akumulasi pendapatan fee</p>
        </div>
      </div>

      {/* SECTION 1: TRANSAKSI SETOR / TARIK (DENGAN FEE PENARIKAN REAL-TIME) */}
      {section === 'transaksi' && (
        !canManage ? (
          <div className="glass-card rounded-3xl p-6 text-xs text-slate-500">
            Anda memiliki akses lihat saja. Hubungi Petugas Tabungan untuk memproses transaksi setor atau tarik tunai.
          </div>
        ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-700 shrink-0" /> Transaksi Setor / Tarik Tabungan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Pilih nomor rekening dan tentukan jenis transaksi. Pada penarikan, fee transaksi akan dihitung secara otomatis.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!trxForm.account_id) {
                  showToast('err', 'Pilih rekening tabungan terlebih dahulu.');
                  return;
                }
                if (!selectedAccount) {
                  showToast('err', 'Data rekening tidak ditemukan.');
                  return;
                }
                if (
                  !Number.isInteger(trxForm.amount) ||
                  trxForm.amount < 1000 ||
                  trxForm.amount % 1000 !== 0
                ) {
                  showToast(
                    'err',
                    'Nominal transaksi minimal Rp 1.000 dan harus kelipatan Rp 1.000 (sebelum dikurangi fee penarikan).'
                  );
                  return;
                }
                if (
                  trxForm.transaction_type === 'TARIK' &&
                  trxForm.amount > Number(selectedAccount.balance)
                ) {
                  showToast('err', 'Saldo tabungan tidak mencukupi untuk penarikan.');
                  return;
                }

                const result = await postTabungan(
                  {
                    action: 'TRANSACTION',
                    ...trxForm,
                    notes: trxForm.notes.trim(),
                  },
                  trxForm.transaction_type === 'TARIK'
                    ? 'Transaksi penarikan tabungan berhasil diproses.'
                    : 'Transaksi setoran tabungan berhasil dicatat.'
                );

                if (result && result.transaction) {
                  setLastReceipt({
                    referenceNumber: result.transaction.reference_number,
                    accountNumber: selectedAccount.account_number,
                    ownerName: selectedAccount.owner_name,
                    ownerType: selectedAccount.owner_type,
                    type: trxForm.transaction_type,
                    amount: trxForm.amount,
                    feePercentage: result.fee_percentage || 0,
                    feeAmount: result.fee_amount || 0,
                    netAmount: result.net_amount ?? trxForm.amount,
                    balanceAfter: result.balance,
                    transactionDate:
                      result.transaction.transaction_date || new Date().toISOString(),
                  });
                  setTrxForm((prev) => ({ ...prev, notes: '' }));
                }
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="trx-account"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Pilih Rekening Tabungan <span className="text-rose-600">*</span>
                </label>
                <select
                  id="trx-account"
                  required
                  value={trxForm.account_id}
                  onChange={(e) => setTrxForm({ ...trxForm, account_id: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Cari / Pilih Rekening --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.account_number}] {a.owner_name} ({a.owner_type}) — Saldo:{' '}
                      {formatRupiah(Number(a.balance))}
                    </option>
                  ))}
                </select>
                {selectedAccount && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pemilik:{' '}
                    <strong className="text-slate-800">{selectedAccount.owner_name}</strong> • Saldo
                    Tersedia:{' '}
                    <strong className="text-emerald-700 tabular-nums">
                      {formatRupiah(Number(selectedAccount.balance))}
                    </strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="trx-type"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Jenis Transaksi <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="trx-type"
                    value={trxForm.transaction_type}
                    onChange={(e) =>
                      setTrxForm({
                        ...trxForm,
                        transaction_type: e.target.value as 'SETOR' | 'TARIK',
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="SETOR">SETOR TABUNGAN (Simpanan)</option>
                    <option value="TARIK">TARIK TABUNGAN (Penarikan Tunai)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="trx-amount"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nominal Transaksi (Rp) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="trx-amount"
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={trxForm.amount}
                    onChange={(e) => setTrxForm({ ...trxForm, amount: Number(e.target.value) })}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {formatRupiah(Number(trxForm.amount) || 0)}
                    {trxForm.transaction_type === 'TARIK' ? ' (sebelum dikurangi fee)' : ''}
                  </p>
                  {(!Number.isInteger(trxForm.amount) ||
                    trxForm.amount < 1000 ||
                    trxForm.amount % 1000 !== 0) ? (
                    <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                      Minimal Rp 1.000 dan harus kelipatan Rp 1.000.
                    </p>
                  ) : selectedAccount &&
                    trxForm.transaction_type === 'TARIK' &&
                    trxForm.amount > Number(selectedAccount.balance) ? (
                    <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                      Saldo rekening tidak mencukupi ({formatRupiah(Number(selectedAccount.balance))}).
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Minimal Rp 1.000 &amp; kelipatan Rp 1.000
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="trx-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  id="trx-notes"
                  type="text"
                  placeholder="Contoh: Keperluan bayar buku, biaya praktikum, dll"
                  value={trxForm.notes}
                  onChange={(e) => setTrxForm({ ...trxForm, notes: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Memproses Transaksi...
                  </>
                ) : trxForm.transaction_type === 'TARIK' ? (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-amber-400" /> Proses Penarikan Tunai
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Proses Setor Tabungan
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Rincian Fee & Estimasi Penarikan / Struk Terakhir */}
          <div className="lg:col-span-5 space-y-4">
            {trxForm.transaction_type === 'TARIK' && realTimeFeeCalc && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Rincian Fee Penarikan Otomatis
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-amber-200/70 text-slate-600">
                    <span>Nominal Penarikan Saldo:</span>
                    <strong className="text-slate-900">
                      {formatRupiah(realTimeFeeCalc.amount)}
                    </strong>
                  </div>

                  <div className="flex justify-between py-1 border-b border-amber-200/70 text-slate-600">
                    <span>Tarif Fee Dikenakan:</span>
                    <span className="font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px]">
                      {realTimeFeeCalc.feePercentage}% ({realTimeFeeCalc.matchedTier?.label || '-'})
                    </span>
                  </div>

                  <div className="flex justify-between items-start py-1 border-b border-amber-200/70 text-rose-700">
                    <span>Potongan Fee Transaksi:</span>
                    <div className="text-right">
                      <strong className="text-rose-700 block">
                        - {formatRupiah(realTimeFeeCalc.feeAmount)}
                      </strong>
                      {realTimeFeeCalc.rawFeeAmount !== realTimeFeeCalc.feeAmount && (
                        <span className="text-[10px] text-amber-800 block">
                          (Dibulatkan dari {formatRupiah(realTimeFeeCalc.rawFeeAmount)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      Nominal Uang Yang Diterima Pemilik:
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5">
                      {formatRupiah(realTimeFeeCalc.netAmount)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/80 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed space-y-1">
                  <p>
                    💡 <strong>Ketentuan Fee:</strong> Nominal fee langsung mengurangi nominal uang tunai
                    yang diserahkan ke pemilik tabungan. Saldo rekening tetap berkurang sebesar nominal penarikan penuh (
                    <strong>{formatRupiah(realTimeFeeCalc.amount)}</strong>).
                  </p>
                  <p className="text-amber-800">
                    <strong>Aturan Pembulatan Fee:</strong> Ratusan &lt; 330 → 000 | 330–660 → 500 | &gt; 660 → 1.000.
                  </p>
                </div>
              </div>
            )}

            {/* Bukti Transaksi Terakhir */}
            {lastReceipt && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Kuitansi Transaksi Terakhir
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    {lastReceipt.referenceNumber}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 bg-white p-4 rounded-2xl border border-emerald-100">
                  <p className="text-slate-600">
                    Rekening:{' '}
                    <strong className="text-slate-900">
                      {lastReceipt.accountNumber} ({lastReceipt.ownerName})
                    </strong>
                  </p>
                  <p className="text-slate-600">
                    Jenis:{' '}
                    <strong className="text-slate-900">
                      {lastReceipt.type === 'TARIK' ? 'PENARIKAN TABUNGAN' : 'SETORAN TABUNGAN'}
                    </strong>
                  </p>
                  <p className="text-slate-600">
                    Nominal Transaksi:{' '}
                    <strong className="text-slate-900">{formatRupiah(lastReceipt.amount)}</strong>
                  </p>
                  {lastReceipt.type === 'TARIK' && (
                    <>
                      <p className="text-rose-600">
                        Fee Penarikan ({lastReceipt.feePercentage}%):{' '}
                        <strong>- {formatRupiah(lastReceipt.feeAmount)}</strong>
                      </p>
                      <p className="text-emerald-700 font-bold border-t border-slate-100 pt-1">
                        Uang Diserahkan ke Nasabah: {formatRupiah(lastReceipt.netAmount)}
                      </p>
                    </>
                  )}
                  <p className="text-slate-600 border-t border-slate-100 pt-1">
                    Sisa Saldo Rekening:{' '}
                    <strong className="text-emerald-700">
                      {formatRupiah(lastReceipt.balanceAfter)}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveSlip({
                      referenceNumber: lastReceipt.referenceNumber,
                      accountNumber: lastReceipt.accountNumber,
                      ownerName: lastReceipt.ownerName,
                      ownerType: lastReceipt.ownerType,
                      transactionType: lastReceipt.type,
                      amount: lastReceipt.amount,
                      feePercentage: lastReceipt.feePercentage,
                      feeAmount: lastReceipt.feeAmount,
                      netAmount: lastReceipt.netAmount,
                      balanceAfter: lastReceipt.balanceAfter,
                      transactionDate: lastReceipt.transactionDate,
                    })
                  }
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-3 text-xs transition"
                >
                  <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip PNG
                </button>
              </div>
            )}
          </div>
        </div>
        )
      )}

      {/* SECTION 2: BUKA BUKU TABUNGAN DIGITAL */}
      {section === 'buka-rekening' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManage ? (
            <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-700 shrink-0" /> Buka Buku Tabungan Digital
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Daftarkan rekening tabungan baru untuk Siswa, Guru, Staf TU, atau Warga Umum.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmedName = openAccForm.owner_name.trim();
                  if (trimmedName.length < 2) {
                    showToast(
                      'err',
                      'Pilih atau masukkan nama pemilik rekening (minimal 2 karakter).'
                    );
                    return;
                  }
                  if (
                    !Number.isInteger(openAccForm.initial_deposit) ||
                    openAccForm.initial_deposit < 0 ||
                    (openAccForm.initial_deposit > 0 &&
                      (openAccForm.initial_deposit < 1000 ||
                        openAccForm.initial_deposit % 1000 !== 0))
                  ) {
                    showToast(
                      'err',
                      'Setoran awal minimal Rp 1.000 dan harus kelipatan Rp 1.000 (atau Rp 0 jika tanpa setoran awal).'
                    );
                    return;
                  }
                  const res = await postTabungan(
                    {
                      action: 'OPEN_ACCOUNT',
                      ...openAccForm,
                      owner_name: trimmedName,
                      owner_phone: openAccForm.owner_phone.trim(),
                    },
                    'Buku tabungan baru berhasil dibuka.'
                  );
                  if (res) {
                    setSelectedCandidateId('');
                    setOpenAccForm((prev) => ({
                      ...prev,
                      student_id: null,
                      teacher_id: null,
                      owner_name: '',
                      owner_phone: '',
                    }));
                  }
                }}
                className="space-y-3.5"
              >
                <div>
                  <label
                    htmlFor="open-owner-type"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kategori Pemilik Rekening <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="open-owner-type"
                    value={openAccForm.owner_type}
                    onChange={(e) => {
                      const nextType = e.target.value as typeof openAccForm.owner_type;
                      setSelectedCandidateId('');
                      setOpenAccForm({
                        ...openAccForm,
                        owner_type: nextType,
                        student_id: null,
                        teacher_id: null,
                        owner_name: '',
                        owner_phone: '',
                      });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="SISWA">Siswa Madrasah</option>
                    <option value="GURU">Guru / Pendidik</option>
                    <option value="TU">Tenaga Kependidikan (TU)</option>
                    <option value="UMUM">Masyarakat Umum / Warga</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="open-candidate"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Pilih Nama Pemilik Rekening ({openAccForm.owner_type}){' '}
                    <span className="text-rose-600">*</span>
                  </label>

                  {openAccForm.owner_type === 'SISWA' && (
                    <select
                      id="open-candidate"
                      required
                      value={selectedCandidateId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedCandidateId(id);
                        const s = students.find((item) => item.id === id);
                        setOpenAccForm({
                          ...openAccForm,
                          student_id: s ? s.id : null,
                          teacher_id: null,
                          owner_name: s ? s.full_name : '',
                          owner_phone: s?.phone || '',
                        });
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Siswa Aktif --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}{' '}
                          {s.nis ? `(NIS: ${s.nis})` : s.nisn ? `(NISN: ${s.nisn})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {openAccForm.owner_type === 'GURU' && (
                    <select
                      id="open-candidate"
                      required
                      value={selectedCandidateId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedCandidateId(id);
                        const g = teachers.find((item) => item.id === id);
                        setOpenAccForm({
                          ...openAccForm,
                          student_id: null,
                          teacher_id: g ? g.id : null,
                          owner_name: g ? g.full_name : '',
                          owner_phone: g?.phone || '',
                        });
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.full_name} {g.nip ? `(NIP: ${g.nip})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {openAccForm.owner_type === 'TU' && (
                    <select
                      id="open-candidate"
                      required
                      value={selectedCandidateId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedCandidateId(id);
                        const t = tuStaff.find((item) => item.id === id);
                        setOpenAccForm({
                          ...openAccForm,
                          student_id: null,
                          teacher_id: t ? t.id : null,
                          owner_name: t ? t.full_name : '',
                          owner_phone: t?.phone || '',
                        });
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Staf Tata Usaha --</option>
                      {tuStaff.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} {t.nip ? `(NIP: ${t.nip})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {openAccForm.owner_type === 'UMUM' && (
                    <div className="space-y-2">
                      <select
                        id="open-candidate"
                        required={publicUsers.length > 0 && selectedCandidateId !== '__MANUAL__'}
                        value={selectedCandidateId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedCandidateId(id);
                          if (id === '__MANUAL__') {
                            setOpenAccForm({
                              ...openAccForm,
                              student_id: null,
                              teacher_id: null,
                              owner_name: '',
                              owner_phone: '',
                            });
                            return;
                          }
                          const u = publicUsers.find((item) => item.id === id);
                          setOpenAccForm({
                            ...openAccForm,
                            student_id: null,
                            teacher_id: null,
                            owner_name: u ? u.full_name : '',
                            owner_phone: u?.phone || '',
                          });
                        }}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      >
                        <option value="">-- Pilih Pengguna / Anggota Umum --</option>
                        {publicUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                        <option value="__MANUAL__">+ Input Nama Masyarakat Umum Lainnya...</option>
                      </select>

                      {selectedCandidateId === '__MANUAL__' && (
                        <input
                          required
                          minLength={2}
                          placeholder="Masukkan Nama Lengkap Masyarakat Umum"
                          aria-label="Nama lengkap masyarakat umum"
                          value={openAccForm.owner_name}
                          onChange={(e) =>
                            setOpenAccForm({ ...openAccForm, owner_name: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="open-owner-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nomor HP / WhatsApp
                    </label>
                    <input
                      id="open-owner-phone"
                      placeholder="08xxxxxxxxxx"
                      value={openAccForm.owner_phone}
                      onChange={(e) =>
                        setOpenAccForm({ ...openAccForm, owner_phone: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="open-initial-deposit"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Setoran Awal (Rp)
                    </label>
                    <input
                      id="open-initial-deposit"
                      type="number"
                      min={0}
                      step={1000}
                      value={openAccForm.initial_deposit}
                      onChange={(e) =>
                        setOpenAccForm({ ...openAccForm, initial_deposit: Number(e.target.value) })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Rp 0 atau minimal Rp 1.000 (kelipatan Rp 1.000)
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? 'Membuka Rekening...' : 'Buka Rekening Tabungan'}
                </button>
              </form>
            </div>
          ) : (
            <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 text-xs text-slate-500">
              Anda memiliki akses lihat saja. Hubungi Petugas Tabungan untuk membuka rekening baru.
            </div>
          )}

          <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Rekening Terbaru ({accounts.length})
            </h2>
            {accounts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Belum ada rekening tabungan yang terdaftar.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.slice(0, 6).map((a) => (
                  <div
                    key={a.id}
                    className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">{a.owner_name}</p>
                      <p className="text-slate-500 font-mono text-[11px]">
                        {a.account_number} • {a.owner_type}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-700 tabular-nums shrink-0">
                      {formatRupiah(Number(a.balance))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: REKAPITULASI BUKU TABUNGAN & RIWAYAT TRANSAKSI */}
      {section === 'rekap' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Rekapitulasi Riwayat Transaksi &amp; Fee ({filteredTransactions.length})
                </span>
              </h2>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <select
                  aria-label="Filter jenis transaksi"
                  value={trxTypeFilter}
                  onChange={(e) => {
                    setTrxTypeFilter(e.target.value as 'ALL' | 'SETOR' | 'TARIK');
                    setTrxPage(1);
                  }}
                  className="w-full sm:w-40 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="ALL">Semua Transaksi</option>
                  <option value="SETOR">Setor</option>
                  <option value="TARIK">Tarik</option>
                </select>
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={trxSearch}
                    onChange={(e) => {
                      setTrxSearch(e.target.value);
                      setTrxPage(1);
                    }}
                    placeholder="Cari ref, nama, no. rekening..."
                    aria-label="Cari riwayat transaksi"
                    className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {trxSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setTrxSearch('');
                        setTrxPage(1);
                      }}
                      aria-label="Hapus pencarian transaksi"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {pagedTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {transactions.length === 0
                  ? 'Belum ada riwayat transaksi tabungan.'
                  : 'Tidak ada transaksi yang cocok dengan filter pencarian.'}
              </p>
            ) : (
              <>
                {/* Mobile Transaction Cards */}
                <div className="md:hidden space-y-2.5">
                  {pagedTransactions.map((t) => (
                    <div
                      key={t.id}
                      className="modular-card rounded-2xl p-3.5 space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 break-words">
                            {t.account?.owner_name || 'Nasabah'}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {t.reference_number} • {t.account?.account_number || '-'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.transaction_type === 'SETOR'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {t.transaction_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2 text-[11px] tabular-nums">
                        <div>
                          <span className="text-slate-400 block">Nominal</span>
                          <span className="font-bold text-slate-900">
                            {formatRupiah(Number(t.amount))}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Diterima / Masuk</span>
                          <span className="font-bold text-emerald-700">
                            {formatRupiah(Number(t.net_amount || t.amount))}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Potongan Fee</span>
                          <span className="font-semibold text-rose-600">
                            {t.transaction_type === 'TARIK' && Number(t.fee_amount) > 0
                              ? `- ${formatRupiah(Number(t.fee_amount))} (${t.fee_percentage}%)`
                              : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Saldo Akhir</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {formatRupiah(Number(t.balance_after))}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400">
                          {new Date(t.transaction_date).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSlip({
                              referenceNumber: t.reference_number,
                              accountNumber: t.account?.account_number || '-',
                              ownerName: t.account?.owner_name || 'Nasabah',
                              ownerType: t.account?.owner_type || 'UMUM',
                              transactionType: t.transaction_type,
                              amount: Number(t.amount),
                              feePercentage: Number(t.fee_percentage) || 0,
                              feeAmount: Number(t.fee_amount) || 0,
                              netAmount: Number(t.net_amount ?? t.amount),
                              balanceAfter: Number(t.balance_after),
                              transactionDate: t.transaction_date,
                              notes: t.notes,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                        >
                          <Download className="w-3 h-3" /> Slip PNG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Transaction Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50 whitespace-nowrap">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">No. Ref</th>
                        <th className="py-2.5 px-3">Rekening &amp; Nasabah</th>
                        <th className="py-2.5 px-3">Jenis</th>
                        <th className="py-2.5 px-3 text-right">Nominal Transaksi</th>
                        <th className="py-2.5 px-3 text-right">Potongan Fee</th>
                        <th className="py-2.5 px-3 text-right">Uang Diterima / Masuk</th>
                        <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                        <th className="py-2.5 px-3 text-center">Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {pagedTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {new Date(t.transaction_date).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {t.reference_number}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-900">
                              {t.account?.owner_name || 'Nasabah'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {t.account?.account_number} • {t.account?.owner_type}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.transaction_type === 'SETOR'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {t.transaction_type === 'SETOR' ? 'SETOR' : 'TARIK'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatRupiah(Number(t.amount))}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {t.transaction_type === 'TARIK' && Number(t.fee_amount) > 0 ? (
                              <span className="text-rose-600 font-semibold">
                                - {formatRupiah(Number(t.fee_amount))} ({t.fee_percentage}%)
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {formatRupiah(Number(t.net_amount || t.amount))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                            {formatRupiah(Number(t.balance_after))}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveSlip({
                                  referenceNumber: t.reference_number,
                                  accountNumber: t.account?.account_number || '-',
                                  ownerName: t.account?.owner_name || 'Nasabah',
                                  ownerType: t.account?.owner_type || 'UMUM',
                                  transactionType: t.transaction_type,
                                  amount: Number(t.amount),
                                  feePercentage: Number(t.fee_percentage) || 0,
                                  feeAmount: Number(t.fee_amount) || 0,
                                  netAmount: Number(t.net_amount ?? t.amount),
                                  balanceAfter: Number(t.balance_after),
                                  transactionDate: t.transaction_date,
                                  notes: t.notes,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                              title="Lihat & Unduh Slip PNG"
                            >
                              <Download className="w-3 h-3" /> PNG
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredTransactions.length > TRX_PAGE_SIZE && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>
                      Menampilkan {trxPageStart + 1}–
                      {Math.min(trxPageStart + TRX_PAGE_SIZE, filteredTransactions.length)} dari{' '}
                      {filteredTransactions.length} transaksi
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTrxPage((p) => Math.max(1, p - 1))}
                        disabled={currentTrxPage <= 1}
                        aria-label="Halaman transaksi sebelumnya"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2 font-medium text-slate-700 tabular-nums">
                        Hal {currentTrxPage} / {totalTrxPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTrxPage((p) => Math.min(totalTrxPages, p + 1))}
                        disabled={currentTrxPage >= totalTrxPages}
                        aria-label="Halaman transaksi berikutnya"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Daftar Rekening Buku Tabungan ({filteredAccounts.length})</span>
              </h2>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <select
                  aria-label="Filter kategori pemilik rekening"
                  value={accOwnerFilter}
                  onChange={(e) => {
                    setAccOwnerFilter(
                      e.target.value as 'ALL' | 'SISWA' | 'GURU' | 'TU' | 'UMUM'
                    );
                    setAccPage(1);
                  }}
                  className="w-full sm:w-40 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="ALL">Semua Pemilik</option>
                  <option value="SISWA">Siswa</option>
                  <option value="GURU">Guru</option>
                  <option value="TU">Tata Usaha</option>
                  <option value="UMUM">Umum</option>
                </select>
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={accSearch}
                    onChange={(e) => {
                      setAccSearch(e.target.value);
                      setAccPage(1);
                    }}
                    placeholder="Cari nama atau no. rekening..."
                    aria-label="Cari rekening tabungan"
                    className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {accSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setAccSearch('');
                        setAccPage(1);
                      }}
                      aria-label="Hapus pencarian rekening"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {pagedAccounts.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {accounts.length === 0
                  ? 'Belum ada rekening tabungan yang terdaftar.'
                  : 'Tidak ada rekening yang cocok dengan filter pencarian.'}
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pagedAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="modular-card rounded-2xl p-4 flex flex-col justify-between text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-emerald-700 font-bold">
                            {acc.account_number}
                          </p>
                          <p className="font-bold text-slate-900 text-sm mt-0.5 break-words">
                            {acc.owner_name}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {acc.owner_type}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-slate-500">Saldo Rekening:</span>
                        <span className="font-bold text-emerald-700 text-sm tabular-nums">
                          {formatRupiah(Number(acc.balance))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredAccounts.length > ACC_PAGE_SIZE && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>
                      Menampilkan {accPageStart + 1}–
                      {Math.min(accPageStart + ACC_PAGE_SIZE, filteredAccounts.length)} dari{' '}
                      {filteredAccounts.length} rekening
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAccPage((p) => Math.max(1, p - 1))}
                        disabled={currentAccPage <= 1}
                        aria-label="Halaman rekening sebelumnya"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2 font-medium text-slate-700 tabular-nums">
                        Hal {currentAccPage} / {totalAccPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAccPage((p) => Math.min(totalAccPages, p + 1))}
                        disabled={currentAccPage >= totalAccPages}
                        aria-label="Halaman rekening berikutnya"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: ATURAN FEE PENARIKAN TABUNGAN (ADMIN & PENGELOLA TABUNGAN) */}
      {section === 'aturan-fee' && (
        !canManage ? (
          <div className="glass-card rounded-3xl p-6 text-xs text-slate-500">
            Anda tidak memiliki izin untuk mengubah pengaturan tingkatan fee penarikan tabungan.
          </div>
        ) : (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-700 shrink-0" /> Pengaturan Tingkatan Fee Penarikan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Admin dan Pengelola Tabungan dapat mengatur persentase fee serta batas bawah (minimum) dan batas atas (maksimum) nominal penarikan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {confirmResetTiers ? (
                  <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl text-xs">
                    <span className="text-amber-900 font-medium">Reset ke 6 standar?</span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleResetFeeTiers}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50"
                    >
                      Ya
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setConfirmResetTiers(false)}
                      className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-slate-600"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetTiers(true)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset Default (6 Tingkatan)
                  </button>
                )}
                <button
                  type="button"
                  onClick={openAddTierModal}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Aturan Fee
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeeTiers}
                  disabled={submitting || editingTiers.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Simpan Pengaturan
                </button>
              </div>
            </div>

            {hasUnsavedTiers && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                Terdapat perubahan aturan fee yang belum disimpan ke server. Klik{' '}
                <strong>Simpan Pengaturan</strong> untuk menerapkan secara permanen.
              </div>
            )}

            {editingTiers.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Belum ada tingkatan aturan fee. Klik <strong>Tambah Aturan Fee</strong> atau{' '}
                <strong>Reset Default</strong>.
              </p>
            ) : (
              <>
                {/* Mobile Tier Cards */}
                <div className="md:hidden space-y-2.5">
                  {editingTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="modular-card rounded-2xl p-3.5 space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 break-words">
                            #{idx + 1} • {tier.label || generateTierLabel(tier.min_amount, tier.max_amount)}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {formatRupiah(Number(tier.min_amount))} –{' '}
                            {tier.max_amount != null
                              ? formatRupiah(Number(tier.max_amount))
                              : 'Tanpa Batas Atas'}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg tabular-nums">
                          {tier.fee_percentage}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tier.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {tier.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {confirmDeleteTierIdx === idx ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteTier(idx)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTierIdx(null)}
                                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px]"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditTierModal(idx)}
                                className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                                aria-label={`Edit aturan ${idx + 1}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTierIdx(idx)}
                                className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
                                aria-label={`Hapus aturan ${idx + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Tier Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50 whitespace-nowrap">
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">Keterangan Tingkatan</th>
                        <th className="py-2.5 px-3 text-right">Batas Bawah (Min)</th>
                        <th className="py-2.5 px-3 text-right">Batas Atas (Maks)</th>
                        <th className="py-2.5 px-3 text-center">Persentase Fee</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editingTiers.map((tier, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">
                              {tier.label || generateTierLabel(tier.min_amount, tier.max_amount)}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                            {formatRupiah(Number(tier.min_amount))}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                            {tier.max_amount != null ? (
                              formatRupiah(Number(tier.max_amount))
                            ) : (
                              <span className="text-amber-700 font-sans italic text-[11px]">
                                Tanpa Batas Atas
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg tabular-nums">
                              {tier.fee_percentage}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tier.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {tier.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {confirmDeleteTierIdx === idx ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTier(idx)}
                                  className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTierIdx(null)}
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px]"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditTierModal(idx)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
                                  title="Edit Aturan"
                                  aria-label={`Edit aturan ${idx + 1}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTierIdx(idx)}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition"
                                  title="Hapus Aturan"
                                  aria-label={`Hapus aturan ${idx + 1}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Simulator Kalkulasi Fee */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-emerald-200/60 bg-emerald-50/20">
            <div className="flex items-center gap-2 text-slate-900">
              <Calculator className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="text-sm font-bold">Simulator &amp; Uji Coba Aturan Fee Penarikan</h3>
            </div>
            <p className="text-xs text-slate-500">
              Uji coba nominal penarikan untuk memvalidasi apakah tingkatan fee yang Anda atur berjalan sesuai harapan sebelum diterapkan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end pt-1">
              <div>
                <label
                  htmlFor="sim-amount"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Masukkan Nominal Penarikan (Rp):
                </label>
                <input
                  id="sim-amount"
                  type="number"
                  min={1000}
                  step={50000}
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 tabular-nums"
                />
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Tingkatan Cocok:</p>
                <p className="font-bold text-slate-900 text-xs mt-0.5 truncate">
                  {simFeeCalc.matchedTier?.label || 'Tidak ada aturan aktif'}
                </p>
                <p className="text-[11px] text-emerald-700 font-bold">
                  Tarif: {simFeeCalc.feePercentage}%
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Potongan Fee (Setelah Pembulatan):</p>
                <p className="font-bold text-rose-600 text-sm mt-0.5">
                  - {formatRupiah(simFeeCalc.feeAmount)}
                </p>
                {simFeeCalc.rawFeeAmount !== simFeeCalc.feeAmount ? (
                  <p className="text-[10px] text-amber-700 font-medium">
                    Fee murni: {formatRupiah(simFeeCalc.rawFeeAmount)}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">Masuk ke kas madrasah</p>
                )}
              </div>

              <div className="p-3 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/50">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Uang Diterima Pemilik:</p>
                <p className="font-black text-emerald-800 text-base mt-0.5">
                  {formatRupiah(simFeeCalc.netAmount)}
                </p>
                <p className="text-[10px] text-emerald-600">Diterima bersih tunai</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 border border-emerald-200 p-4 text-xs text-slate-700 space-y-1.5">
              <p className="font-bold text-emerald-900">Aturan Pembulatan Nominal Fee:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-600">
                <li>Jika nominal ratusannya <strong>kurang dari 330</strong>, dibulatkan menjadi <strong>000</strong> (contoh: Rp 2.300 → Rp 2.000).</li>
                <li>Jika nominal ratusannya <strong>antara 330 hingga 660</strong>, dibulatkan menjadi <strong>500</strong> (contoh: Rp 2.560 → Rp 2.500).</li>
                <li>Jika nominal ratusannya <strong>lebih dari 660</strong>, dibulatkan menjadi <strong>1.000</strong> (contoh: Rp 2.870 → Rp 3.000).</li>
              </ul>
            </div>
          </div>
        </div>
        )
      )}

      {/* Modal Tambah / Edit Tingkatan Aturan Fee */}
      {tierModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tier-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTierModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="tier-modal-title" className="text-sm font-bold text-slate-900">
                {editingTierIdx === null ? 'Tambah Tingkatan Aturan Fee' : 'Edit Tingkatan Aturan Fee'}
              </h3>
              <button
                type="button"
                onClick={() => setTierModalOpen(false)}
                aria-label="Tutup modal aturan fee"
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tierModalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{tierModalError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label
                  htmlFor="tier-label"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Keterangan / Label (Opsional)
                </label>
                <input
                  id="tier-label"
                  type="text"
                  placeholder="Contoh: Penarikan Rp 500.000 s/d Rp 1.000.000"
                  value={tierForm.label}
                  onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Jika dikosongkan, label otomatis terbuat dari batas bawah dan atas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tier-min"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Batas Bawah (Min Rp)
                  </label>
                  <input
                    id="tier-min"
                    type="number"
                    min={0}
                    step={10000}
                    value={tierForm.min_amount}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, min_amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold tabular-nums"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                    {formatRupiah(tierForm.min_amount)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="tier-max"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Batas Atas (Maks Rp)
                  </label>
                  <input
                    id="tier-max"
                    type="number"
                    disabled={tierForm.is_unbounded}
                    min={tierForm.min_amount}
                    step={10000}
                    value={tierForm.max_amount || 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, max_amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {!tierForm.is_unbounded && (
                    <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                      {formatRupiah(Number(tierForm.max_amount) || 0)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="unbounded_check"
                  checked={tierForm.is_unbounded}
                  onChange={(e) =>
                    setTierForm({
                      ...tierForm,
                      is_unbounded: e.target.checked,
                      max_amount: e.target.checked ? null : 1000000,
                    })
                  }
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="unbounded_check"
                  className="text-xs text-slate-700 cursor-pointer select-none font-medium"
                >
                  Tanpa Batas Atas (Untuk penarikan di atas batas bawah)
                </label>
              </div>

              <div>
                <label
                  htmlFor="tier-pct"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Persentase Fee (%)
                </label>
                <div className="relative">
                  <input
                    id="tier-pct"
                    type="number"
                    min={0}
                    max={100}
                    step={0.05}
                    value={tierForm.fee_percentage}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, fee_percentage: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 pr-7 py-2 text-xs font-bold text-slate-900 tabular-nums"
                  />
                  <span className="absolute right-3 top-2 font-bold text-slate-400 text-xs">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Contoh: 2.0, 2.25, 2.5, 3.5</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active_check"
                  checked={tierForm.is_active}
                  onChange={(e) => setTierForm({ ...tierForm, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="active_check"
                  className="text-xs text-slate-700 cursor-pointer select-none font-medium"
                >
                  Status Aturan Aktif
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTierModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTierModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Terapkan Aturan
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSlip && (
        <SavingsSlipModal slip={activeSlip} onClose={() => setActiveSlip(null)} />
      )}
    </div>
  );
}
