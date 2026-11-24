'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { SppSlipModal } from './spp-slip-modal';
import type { SppSlipData } from '@/lib/cards/spp-slip-png';
import type {
  BillRow,
  FeeTypeRow,
  SiblingGroupRow,
  SppSection,
  StudentOption,
} from './spp/types';
import {
  JenisBiayaSection,
  TerbitkanSection,
} from './spp/jenis-biaya-and-terbitkan-sections';
import { PembayaranSection } from './spp/pembayaran-section';
import { KelompokSaudaraSection } from './spp/kelompok-saudara-section';

export type { SppSection } from './spp/types';

export function SppWorkspace({ section }: { section: SppSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SPP_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [siblingGroups, setSiblingGroups] = useState<SiblingGroupRow[]>([]);
  const [activeSppSlip, setActiveSppSlip] = useState<SppSlipData | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadData = useCallback(async (isManualRefresh = false, signal?: AbortSignal) => {
    const reqId = ++requestIdRef.current;
    if (isManualRefresh || hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [biRes, sppRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store', signal }),
        fetch('/api/keuangan/spp', { cache: 'no-store', signal }),
      ]);
      const [bi, spp] = await Promise.all([biRes.json(), sppRes.json()]);
      if (reqId !== requestIdRef.current) return;
      if (!sppRes.ok) throw new Error(spp.error || 'Gagal memuat data SPP.');
      hasLoadedOnceRef.current = true;
      setLoadError(null);
      setStudents(biRes.ok ? bi.students || [] : []);
      setFeeTypes(spp.feeTypes || []);
      setBills(spp.bills || []);
      setSiblingGroups(spp.siblingGroups || []);
    } catch (e) {
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      setLoadError(e instanceof Error ? e.message : 'Gagal terhubung ke server.');
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

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

  const postSpp = useCallback(
    async (body: unknown, successMsg: string) => {
      if (submitting) return false;
      setSubmitting(true);
      try {
        const res = await fetch('/api/keuangan/spp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Terjadi kesalahan.', 'err');
          return false;
        }
        showToast(successMsg, 'ok');
        await loadData(true);
        return true;
      } catch {
        showToast('Terjadi kesalahan jaringan. Silakan coba lagi.', 'err');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, showToast, loadData]
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data SPP &amp; Iuran Komite...
      </div>
    );
  }

  const totalTunggakan = bills.reduce(
    (sum, b) => sum + Math.max(0, Number(b.amount) - Number(b.paid_amount)),
    0
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {section === 'jenis-biaya'
              ? 'Master Jenis Biaya SPP & Komite'
              : section === 'terbitkan'
              ? 'Terbitkan Tagihan Siswa'
              : section === 'pembayaran'
              ? 'Pembayaran & Riwayat Tagihan SPP'
              : 'Kelompok Saudara (N -> N-1)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Pengelolaan tagihan SPP, iuran komite, potongan kelompok saudara, dan kwitansi pembayaran.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{loadError}</span>
          </div>
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

      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="break-words">{toast.text}</span>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Pengelola Modul</p>
          <p className="font-bold text-slate-900 mt-1 text-sm sm:text-base">Bendahara Komite</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Tanpa tambahan tunjangan honorarium</p>
        </div>
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Tagihan Tercatat</p>
          <p className="font-bold text-slate-900 text-base sm:text-lg mt-1 tabular-nums">
            {bills.length} Tagihan
          </p>
        </div>
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Tunggakan</p>
          <p className="font-bold text-rose-600 text-base sm:text-lg mt-1 tabular-nums">
            {formatRupiah(totalTunggakan)}
          </p>
        </div>
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Kelompok Saudara Aktif</p>
          <p className="font-bold text-emerald-700 text-base sm:text-lg mt-1 tabular-nums">
            {siblingGroups.filter((g) => g.is_active).length} Kelompok
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">N saudara → bayar N-1</p>
        </div>
      </div>

      {section !== 'kelompok-saudara' ? (
        <div className="space-y-6">
          {section === 'jenis-biaya' && (
            <JenisBiayaSection
              canManage={canManage}
              submitting={submitting}
              feeTypes={feeTypes}
              postSpp={postSpp}
              showToast={showToast}
            />
          )}

          {section === 'terbitkan' && (
            <TerbitkanSection
              canManage={canManage}
              submitting={submitting}
              students={students}
              feeTypes={feeTypes}
              bills={bills}
              siblingGroups={siblingGroups}
              postSpp={postSpp}
              showToast={showToast}
            />
          )}

          {section === 'pembayaran' && (
            <PembayaranSection
              canManage={canManage}
              submitting={submitting}
              bills={bills}
              postSpp={postSpp}
              showToast={showToast}
              onOpenSlip={setActiveSppSlip}
            />
          )}
        </div>
      ) : (
        <KelompokSaudaraSection
          canManage={canManage}
          submitting={submitting}
          students={students}
          feeTypes={feeTypes}
          siblingGroups={siblingGroups}
          postSpp={postSpp}
          showToast={showToast}
        />
      )}

      {activeSppSlip && (
        <SppSlipModal slip={activeSppSlip} onClose={() => setActiveSppSlip(null)} />
      )}
    </div>
  );
}
