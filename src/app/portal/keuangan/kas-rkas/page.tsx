'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

interface BudgetRow {
  id: string;
  fiscal_year: number;
  funding_source: string;
  code: string;
  name: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  absorption_pct: number;
}

interface CashbookRow {
  id: string;
  entry_date: string;
  entry_type: 'MASUK' | 'KELUAR';
  funding_source: string;
  category: string;
  description: string;
  amount: number;
  reference_no: string | null;
  receipt_url: string | null;
  budget?: { code: string; name: string } | null;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function getTodayWibIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function isSafeReceiptUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim()) || url.trim().startsWith('/');
}

export default function KasRkasPage() {
  const [tab, setTab] = useState<'BKU' | 'RKAS'>('BKU');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CashbookRow | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [entries, setEntries] = useState<CashbookRow[]>([]);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0, totalBudget: 0 });

  const [bkuForm, setBkuForm] = useState(() => ({
    entry_date: getTodayWibIso(),
    entry_type: 'KELUAR' as 'MASUK' | 'KELUAR',
    funding_source: 'BOS' as 'BOS' | 'KOMITE' | 'YAYASAN' | 'LAINNYA',
    budget_plan_id: '',
    category: 'Operasional',
    description: '',
    amount: 0,
    reference_no: '',
    receipt_url: '',
  }));

  const [rkasForm, setRkasForm] = useState(() => ({
    fiscal_year: new Date().getFullYear(),
    funding_source: 'BOS' as 'BOS' | 'KOMITE' | 'YAYASAN' | 'LAINNYA',
    code: '',
    name: '',
    allocated_amount: 0,
    notes: '',
  }));

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteEntry) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteEntry(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteEntry, deletingId]);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/keuangan/kas-rkas', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        setBudgets(data.budgets || []);
        setEntries(data.entries || []);
        if (data.summary) setSummary(data.summary);
      } else {
        setLoadError(data.error || 'Gagal memuat data Buku Kas Umum & RKAS.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat data kas.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleAddBku(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/keuangan/kas-rkas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_CASHBOOK',
          ...bkuForm,
          budget_plan_id: bkuForm.budget_plan_id || null,
          amount: Number(bkuForm.amount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.error || 'Gagal mencatat BKU.', 'err');
      else {
        showToast('Transaksi Buku Kas Umum berhasil dicatat.');
        setBkuForm((p) => ({ ...p, description: '', amount: 0, reference_no: '', receipt_url: '' }));
        await loadData();
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mencatat BKU.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRkas(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/keuangan/kas-rkas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BUDGET',
          ...rkasForm,
          fiscal_year: Number(rkasForm.fiscal_year),
          allocated_amount: Number(rkasForm.allocated_amount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.error || 'Gagal menambah pos anggaran.', 'err');
      else {
        showToast('Pos anggaran BOS/RKAS berhasil ditambahkan.');
        setRkasForm((p) => ({ ...p, code: '', name: '', allocated_amount: 0, notes: '' }));
        await loadData();
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menambah pos anggaran.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entry: CashbookRow) {
    if (deletingId) return;
    setDeletingId(entry.id);
    try {
      const res = await fetch(
        `/api/keuangan/kas-rkas?id=${encodeURIComponent(entry.id)}&target=entry`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeleteEntry(null);
        showToast('Entri Buku Kas Umum berhasil dihapus.');
        await loadData();
      } else {
        showToast(data.error || 'Gagal menghapus entri BKU.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus entri BKU.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  function handleExportExcel() {
    const bkuRows = entries.map((e) => [
      e.entry_date,
      e.entry_type,
      e.funding_source,
      e.category,
      e.description,
      e.entry_type === 'MASUK' ? Number(e.amount) : 0,
      e.entry_type === 'KELUAR' ? Number(e.amount) : 0,
      e.reference_no || '-',
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Tanggal', 'Jenis', 'Sumber Dana', 'Kategori', 'Uraian', 'Debet (Masuk)', 'Kredit (Keluar)', 'No. Bukti'],
      ...bkuRows,
    ]);
    const rkasRows = budgets.map((b) => [
      b.fiscal_year,
      b.funding_source,
      b.code,
      b.name,
      Number(b.allocated_amount),
      Number(b.spent_amount),
      Number(b.remaining_amount),
      `${b.absorption_pct}%`,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Tahun', 'Sumber Dana', 'Kode', 'Pos Anggaran', 'Pagu', 'Realisasi', 'Sisa', 'Serapan'],
      ...rkasRows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Buku Kas Umum');
    XLSX.utils.book_append_sheet(wb, ws2, 'Realisasi RKAS');
    XLSX.writeFile(wb, `Laporan_BKU_RKAS_${getTodayWibIso()}.xlsx`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Ringkasan Arus Kas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Kas Masuk</p>
          <p className="text-lg font-black text-emerald-700 mt-0.5">{formatRupiah(summary.totalIn)}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Kas Keluar</p>
          <p className="text-lg font-black text-rose-600 mt-0.5">{formatRupiah(summary.totalOut)}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Saldo Kas (Surplus/Defisit)</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{formatRupiah(summary.balance)}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Pagu RKAS / BOS</p>
          <p className="text-lg font-black text-indigo-700 mt-0.5">{formatRupiah(summary.totalBudget)}</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-700" />
              <span>Buku Kas Umum (BKU) &amp; Anggaran BOS / RKAS</span>
            </h1>
            <p className="text-xs text-slate-500">
              Pencatatan arus kas masuk/keluar operasional, serapan anggaran BOS/RKAS, dan ekspor laporan keuangan formal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Ekspor Laporan XLSX
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab('BKU')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'BKU' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Buku Kas Umum ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('RKAS')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'RKAS' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" /> Anggaran BOS &amp; RKAS ({budgets.length})
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {tab === 'BKU' ? (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleAddBku} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <input
                type="date"
                required
                value={bkuForm.entry_date}
                onChange={(e) => setBkuForm({ ...bkuForm, entry_date: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <select
                value={bkuForm.entry_type}
                onChange={(e) => setBkuForm({ ...bkuForm, entry_type: e.target.value as 'MASUK' | 'KELUAR' })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="KELUAR">Kas Keluar (Pengeluaran)</option>
                <option value="MASUK">Kas Masuk (Penerimaan)</option>
              </select>
              <select
                value={bkuForm.funding_source}
                onChange={(e) =>
                  setBkuForm({ ...bkuForm, funding_source: e.target.value as typeof bkuForm.funding_source })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="BOS">Dana BOS</option>
                <option value="KOMITE">Dana Komite</option>
                <option value="YAYASAN">Dana Yayasan</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
              <select
                value={bkuForm.budget_plan_id}
                onChange={(e) => setBkuForm({ ...bkuForm, budget_plan_id: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">-- Pos RKAS (Opsional) --</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
              <input
                required
                value={bkuForm.category}
                onChange={(e) => setBkuForm({ ...bkuForm, category: e.target.value })}
                placeholder="Kategori (ATK, Listrik, Honor...)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                required
                value={bkuForm.description}
                onChange={(e) => setBkuForm({ ...bkuForm, description: e.target.value })}
                placeholder="Uraian Transaksi *"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                type="number"
                required
                min={1}
                value={bkuForm.amount}
                onChange={(e) => setBkuForm({ ...bkuForm, amount: Number(e.target.value) || 0 })}
                placeholder="Nominal (Rp) *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
              <input
                value={bkuForm.reference_no}
                onChange={(e) => setBkuForm({ ...bkuForm, reference_no: e.target.value })}
                placeholder="No. Kwitansi / Bukti"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                type="url"
                value={bkuForm.receipt_url}
                onChange={(e) => setBkuForm({ ...bkuForm, receipt_url: e.target.value })}
                placeholder="URL Foto Nota / Bukti (Opsional)"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Catat BKU
              </button>
            </form>

            <div className="space-y-2">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.entry_type === 'MASUK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {e.entry_type}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {e.funding_source} • {e.category}
                      </span>
                      <span className="text-[11px] text-slate-400">{e.entry_date}</span>
                    </div>
                    <p className="font-bold text-slate-900">{e.description}</p>
                    {e.budget && (
                      <p className="text-[11px] text-indigo-700">
                        Pos RKAS: {e.budget.code} — {e.budget.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-bold text-sm ${
                        e.entry_type === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {e.entry_type === 'MASUK' ? '+' : '-'}
                      {formatRupiah(Number(e.amount))}
                    </span>
                    {isSafeReceiptUrl(e.receipt_url) && (
                      <a
                        href={e.receipt_url!.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        Nota <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === e.id}
                      onClick={() => setConfirmDeleteEntry(e)}
                      aria-label={`Hapus transaksi ${e.description}`}
                      title="Hapus transaksi BKU"
                      className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                    >
                      {deletingId === e.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleAddRkas} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <input
                type="number"
                required
                value={rkasForm.fiscal_year}
                onChange={(e) => setRkasForm({ ...rkasForm, fiscal_year: Number(e.target.value) || 2026 })}
                placeholder="Tahun"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
              <select
                value={rkasForm.funding_source}
                onChange={(e) =>
                  setRkasForm({ ...rkasForm, funding_source: e.target.value as typeof rkasForm.funding_source })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="BOS">BOS</option>
                <option value="KOMITE">KOMITE</option>
                <option value="YAYASAN">YAYASAN</option>
                <option value="LAINNYA">LAINNYA</option>
              </select>
              <input
                required
                value={rkasForm.code}
                onChange={(e) => setRkasForm({ ...rkasForm, code: e.target.value })}
                placeholder="Kode (mis. 01.02)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
              <input
                required
                value={rkasForm.name}
                onChange={(e) => setRkasForm({ ...rkasForm, name: e.target.value })}
                placeholder="Nama Pos Anggaran *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                type="number"
                required
                min={0}
                value={rkasForm.allocated_amount}
                onChange={(e) => setRkasForm({ ...rkasForm, allocated_amount: Number(e.target.value) || 0 })}
                placeholder="Pagu (Rp) *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Pos
              </button>
            </form>

            <div className="space-y-2.5">
              {budgets.map((b) => (
                <div key={b.id} className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-indigo-700 mr-2">{b.code}</span>
                      <span className="font-bold text-slate-900">{b.name}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {b.funding_source} {b.fiscal_year}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700">{b.absorption_pct}% Terserap</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        b.absorption_pct >= 90 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, Number(b.absorption_pct) || 0))}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between text-[11px] text-slate-600">
                    <span>Pagu: <strong>{formatRupiah(b.allocated_amount)}</strong></span>
                    <span>Realisasi: <strong>{formatRupiah(b.spent_amount)}</strong></span>
                    <span>Sisa: <strong>{formatRupiah(b.remaining_amount)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmDeleteEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-bku-title"
          onClick={() => {
            if (!deletingId) setConfirmDeleteEntry(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="delete-bku-title" className="text-base font-bold text-slate-900">
                Hapus Transaksi Buku Kas Umum?
              </h2>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteEntry(null)}
                aria-label="Tutup dialog"
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Entri <strong>&ldquo;{confirmDeleteEntry.description}&rdquo;</strong> sebesar{' '}
              <strong>{formatRupiah(Number(confirmDeleteEntry.amount))}</strong> akan dihapus
              permanen dan saldo kas akan dihitung ulang.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteEntry(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDeleteEntry(confirmDeleteEntry)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus Entri</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
