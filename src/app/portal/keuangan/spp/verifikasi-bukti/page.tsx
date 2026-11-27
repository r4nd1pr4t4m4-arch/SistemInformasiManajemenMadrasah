'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

interface ProofRow {
  id: string;
  bill_id: string;
  amount_claimed: number;
  payment_method: string;
  transfer_date: string;
  proof_file_url: string;
  notes: string | null;
  status: 'MENUNGGU_VERIFIKASI' | 'DISETUJUI' | 'DITOLAK';
  reviewer_notes: string | null;
  created_at: string;
  student?: { full_name: string; nis: string | null } | null;
  bill?: {
    amount: number;
    paid_amount: number;
    billing_month: number | null;
    billing_year: number | null;
    fee_type?: { name: string } | null;
  } | null;
}

interface FeeTypeOpt {
  id: string;
  name: string;
  category: string;
  default_amount: number;
}

interface ClassroomOpt {
  id: string;
  name: string;
  grade_level: string;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function isSafeProofUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim()) || url.trim().startsWith('/') || url.trim().startsWith('data:image/');
}

export default function SppVerifikasiBuktiPage() {
  const [tab, setTab] = useState<'PROOFS' | 'BULK'>('PROOFS');
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeOpt[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ProofRow | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [bulkForm, setBulkForm] = useState(() => {
    const now = new Date();
    return {
      fee_type_id: '',
      classroom_id: '',
      billing_month: now.getMonth() + 1,
      billing_year: now.getFullYear(),
      amount: 0,
      due_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-20`,
    };
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!rejectTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyId) setRejectTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rejectTarget, busyId]);

  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const [proofRes, sppRes, clsRes] = await Promise.all([
        fetch('/api/keuangan/spp/proofs', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/keuangan/spp', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/akademik/kelas-jadwal', { cache: 'no-store', signal: controller.signal }),
      ]);
      const [proofData, sppData, clsData] = await Promise.all([
        proofRes.json().catch(() => ({})),
        sppRes.json().catch(() => ({})),
        clsRes.json().catch(() => ({})),
      ]);
      if (controller.signal.aborted) return;
      if (proofRes.ok) setProofs(proofData.proofs || []);
      else setLoadError(proofData.error || 'Gagal memuat antrean bukti transfer SPP.');
      if (sppRes.ok) setFeeTypes(sppData.feeTypes || []);
      if (clsRes.ok) setClassrooms(clsData.classrooms || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat data verifikasi SPP.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  async function handleReview(id: string, decision: 'DISETUJUI' | 'DITOLAK', notes = '') {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/keuangan/spp/proofs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, reviewer_notes: notes.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memproses verifikasi.', 'err');
        return;
      }
      if (decision === 'DITOLAK') {
        setRejectTarget(null);
        setRejectNotes('');
      }
      showToast(
        decision === 'DISETUJUI'
          ? 'Bukti transfer disetujui dan pembayaran SPP otomatis tercatat!'
          : 'Bukti transfer ditolak dan notifikasi dikirim ke keluarga.'
      );
      await loadAll();
    } catch {
      showToast('Terjadi kesalahan jaringan saat memproses verifikasi.', 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateBulk(e: FormEvent) {
    e.preventDefault();
    if (submittingBulk) return;
    if (!bulkForm.fee_type_id || bulkForm.amount <= 0) {
      showToast('Pilih jenis biaya dan isi nominal tagihan > 0.', 'err');
      return;
    }
    setSubmittingBulk(true);
    try {
      const res = await fetch('/api/keuangan/spp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_BULK_BILLS',
          fee_type_id: bulkForm.fee_type_id,
          classroom_id: bulkForm.classroom_id || null,
          billing_month: Number(bulkForm.billing_month),
          billing_year: Number(bulkForm.billing_year),
          amount: Number(bulkForm.amount),
          due_date: bulkForm.due_date || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menerbitkan tagihan massal.', 'err');
        return;
      }
      showToast(
        `Berhasil menerbitkan ${data.insertedCount} tagihan SPP (${data.exemptCount || 0} gratis Kelompok Saudara, ${data.skippedCount || 0} dilewati karena sudah ada).`
      );
    } catch {
      showToast('Terjadi kesalahan jaringan saat menerbitkan tagihan massal.', 'err');
    } finally {
      setSubmittingBulk(false);
    }
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

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <span>Verifikasi Bukti Transfer &amp; Tagihan Massal SPP</span>
            </h1>
            <p className="text-xs text-slate-500">
              Verifikasi bukti transfer mandiri dari Orang Tua/Siswa serta terbitkan tagihan SPP bulanan secara massal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab('PROOFS')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'PROOFS'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Antrean Bukti Transfer ({proofs.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length})
          </button>
          <button
            type="button"
            onClick={() => setTab('BULK')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'BULK'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Terbitkan Tagihan SPP Massal
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
              onClick={() => void loadAll()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {tab === 'PROOFS' ? (
          loading ? (
            <div className="py-10 text-center text-xs text-slate-500">Memuat antrean bukti transfer...</div>
          ) : proofs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Belum ada bukti transfer SPP yang dikirim oleh Orang Tua atau Siswa.
            </div>
          ) : (
            <div className="space-y-3">
              {proofs.map((p) => (
                <div
                  key={p.id}
                  className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-slate-200/80"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {p.student?.full_name || 'Siswa'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'DISETUJUI'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'DITOLAK'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-700 font-bold">
                        {formatRupiah(Number(p.amount_claimed))} ({p.payment_method})
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Tagihan: {p.bill?.fee_type?.name || 'SPP'} ({p.bill?.billing_month}/{p.bill?.billing_year}) • Tgl Transfer: {p.transfer_date}
                    </p>
                    {p.notes && <p className="text-slate-500">Catatan: {p.notes}</p>}
                    {isSafeProofUrl(p.proof_file_url) && (
                      <a
                        href={p.proof_file_url.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                      >
                        Lihat Bukti Transfer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {p.status === 'MENUNGGU_VERIFIKASI' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleReview(p.id, 'DISETUJUI')}
                        className="min-h-[38px] inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                      >
                        {busyId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Setujui
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => {
                          setRejectTarget(p);
                          setRejectNotes('');
                        }}
                        className="min-h-[38px] inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 text-rose-700 font-semibold transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <form onSubmit={handleGenerateBulk} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Biaya *</label>
              <select
                required
                value={bulkForm.fee_type_id}
                onChange={(e) => {
                  const ft = feeTypes.find((f) => f.id === e.target.value);
                  setBulkForm({
                    ...bulkForm,
                    fee_type_id: e.target.value,
                    amount: ft ? Number(ft.default_amount || 0) : bulkForm.amount,
                  });
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">-- Pilih Jenis Biaya --</option>
                {feeTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name} ({ft.category}) — {formatRupiah(ft.default_amount)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Rombel</label>
              <select
                value={bulkForm.classroom_id}
                onChange={(e) => setBulkForm({ ...bulkForm, classroom_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Seluruh Siswa Aktif Lembaga</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    Hanya Kelas {c.name} ({c.grade_level})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nominal Tagihan (Rp) *</label>
              <input
                type="number"
                required
                min={1000}
                value={bulkForm.amount}
                onChange={(e) => setBulkForm({ ...bulkForm, amount: Number(e.target.value) || 0 })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bulan (1-12) *</label>
              <input
                type="number"
                required
                min={1}
                max={12}
                value={bulkForm.billing_month}
                onChange={(e) =>
                  setBulkForm({ ...bulkForm, billing_month: Number(e.target.value) || 1 })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tahun *</label>
              <input
                type="number"
                required
                min={2020}
                max={2100}
                value={bulkForm.billing_year}
                onChange={(e) =>
                  setBulkForm({ ...bulkForm, billing_year: Number(e.target.value) || 2026 })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Jatuh Tempo</label>
              <input
                type="date"
                value={bulkForm.due_date}
                onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500">
                * Otomatis menghormati aturan <strong>Kelompok Saudara</strong> (gratis 1 anak untuk SPP/Komite) dan melewati siswa yang sudah memiliki tagihan di periode sama.
              </p>
              <button
                type="submit"
                disabled={submittingBulk}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
              >
                {submittingBulk && <Loader2 className="w-4 h-4 animate-spin" />}
                Terbitkan Tagihan Massal
              </button>
            </div>
          </form>
        )}
      </div>

      {rejectTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-proof-title"
          onClick={() => {
            if (!busyId) setRejectTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="reject-proof-title" className="text-base font-bold text-slate-900">
                Tolak Bukti Transfer SPP?
              </h2>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => setRejectTarget(null)}
                aria-label="Tutup dialog"
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Bukti transfer dari <strong>{rejectTarget.student?.full_name || 'Siswa'}</strong>{' '}
              sebesar <strong>{formatRupiah(Number(rejectTarget.amount_claimed))}</strong> akan
              ditolak dan notifikasi akan dikirim ke keluarga.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="reject-proof-notes" className="block text-xs font-semibold text-slate-700">
                Alasan Penolakan (Opsional)
              </label>
              <textarea
                id="reject-proof-notes"
                rows={3}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Mis. Nominal transfer tidak sesuai atau foto struk buram..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/25 focus:border-rose-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => setRejectTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => void handleReview(rejectTarget.id, 'DITOLAK', rejectNotes)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {busyId === rejectTarget.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Tolak Bukti</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
