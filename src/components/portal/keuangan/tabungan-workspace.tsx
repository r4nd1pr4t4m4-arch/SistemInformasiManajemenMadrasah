'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  History,
  Loader2,
  Percent,
  PiggyBank,
  RefreshCw,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { DEFAULT_WITHDRAWAL_FEE_TIERS, type SavingsFeeTier } from '@/lib/domain/tabungan-fee';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { SavingsSlipModal } from './savings-slip-modal';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';
import type {
  GtkCandidate,
  PublicCandidate,
  SavingsAccountRow,
  SavingsTransactionRow,
  StudentCandidate,
  TabunganPostResponse,
  TabunganSection,
} from './tabungan/types';
import {
  BukaRekeningSection,
  TransaksiSection,
} from './tabungan/transaksi-and-buka-rekening-sections';
import { RekapSection } from './tabungan/rekap-section';
import { AturanFeeSection } from './tabungan/aturan-fee-section';

export type { TabunganSection } from './tabungan/types';

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
  const [editingTiers, setEditingTiers] = useState<SavingsFeeTier[]>([]);
  const [students, setStudents] = useState<StudentCandidate[]>([]);
  const [teachers, setTeachers] = useState<GtkCandidate[]>([]);
  const [tuStaff, setTuStaff] = useState<GtkCandidate[]>([]);
  const [publicUsers, setPublicUsers] = useState<PublicCandidate[]>([]);
  const [activeSlip, setActiveSlip] = useState<SavingsSlipData | null>(null);

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

  async function postTabungan(
    body: unknown,
    successMsg: string
  ): Promise<TabunganPostResponse | false> {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: TabunganPostResponse = await res.json();
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
      {/* Toast Notification (Floating Top-Right di bawah Navbar) */}
      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
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
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${section === 'transaksi'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Transaksi Setor / Tarik
          </Link>
          <Link
            href="/portal/keuangan/tabungan/buka-rekening"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${section === 'buka-rekening'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
          >
            <User className="w-3.5 h-3.5" /> Buka Rekening
          </Link>
          <Link
            href="/portal/keuangan/tabungan/rekap"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${section === 'rekap'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
          >
            <History className="w-3.5 h-3.5" /> Rekapitulasi
          </Link>
          {canManage && (
            <Link
              href="/portal/keuangan/tabungan/aturan-fee"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${section === 'aturan-fee'
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

      {section === 'transaksi' && (
        <TransaksiSection
          canManage={canManage}
          accounts={accounts}
          transactions={transactions}
          feeTiers={feeTiers}
          submitting={submitting}
          postTabungan={postTabungan}
          showToast={showToast}
          onOpenSlip={setActiveSlip}
        />
      )}

      {section === 'buka-rekening' && (
        <BukaRekeningSection
          canManage={canManage}
          accounts={accounts}
          students={students}
          teachers={teachers}
          tuStaff={tuStaff}
          publicUsers={publicUsers}
          submitting={submitting}
          postTabungan={postTabungan}
          showToast={showToast}
        />
      )}

      {section === 'rekap' && (
        <RekapSection
          accounts={accounts}
          transactions={transactions}
          onOpenSlip={setActiveSlip}
        />
      )}

      {section === 'aturan-fee' && (
        <AturanFeeSection
          canManage={canManage}
          editingTiers={editingTiers}
          setEditingTiers={setEditingTiers}
          onFeeTiersSaved={(tiers) => {
            setFeeTiers(tiers);
            setEditingTiers(tiers);
          }}
          submitting={submitting}
          setSubmitting={setSubmitting}
          showToast={showToast}
        />
      )}

      {activeSlip && (
        <SavingsSlipModal slip={activeSlip} onClose={() => setActiveSlip(null)} />
      )}
    </div>
  );
}
