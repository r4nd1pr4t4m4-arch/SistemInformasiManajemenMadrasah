'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
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

export default function SppVerifikasiBuktiPage() {
  const [tab, setTab] = useState<'PROOFS' | 'BULK'>('PROOFS');
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeOpt[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const now = new Date();
  const [bulkForm, setBulkForm] = useState({
    fee_type_id: '',
    classroom_id: '',
    billing_month: now.getMonth() + 1,
    billing_year: now.getFullYear(),
    amount: 0,
    due_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-20`,
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [proofRes, sppRes, clsRes] = await Promise.all([
        fetch('/api/keuangan/spp/proofs', { cache: 'no-store' }),
        fetch('/api/keuangan/spp', { cache: 'no-store' }),
        fetch('/api/akademik/kelas-jadwal', { cache: 'no-store' }),
      ]);
      const proofData = await proofRes.json().catch(() => ({}));
      const sppData = await sppRes.json().catch(() => ({}));
      const clsData = await clsRes.json().catch(() => ({}));
      if (proofRes.ok) setProofs(proofData.proofs || []);
      if (sppRes.ok) setFeeTypes(sppData.feeTypes || []);
      if (clsRes.ok) setClassrooms(clsData.classrooms || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleReview(id: string, decision: 'DISETUJUI' | 'DITOLAK') {
    const reviewer_notes =
      decision === 'DITOLAK'
        ? window.prompt('Masukkan alasan penolakan bukti transfer (opsional):') || ''
        : '';
    setBusyId(id);
    try {
      const res = await fetch('/api/keuangan/spp/proofs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, reviewer_notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memproses verifikasi.', 'err');
        return;
      }
      showToast(
        decision === 'DISETUJUI'
          ? 'Bukti transfer disetujui dan pembayaran SPP otomatis tercatat!'
          : 'Bukti transfer ditolak dan notifikasi dikirim ke keluarga.'
      );
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateBulk(e: FormEvent) {
    e.preventDefault();
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
                    <a
                      href={p.proof_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                    >
                      Lihat Bukti Transfer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {p.status === 'MENUNGGU_VERIFIKASI' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleReview(p.id, 'DISETUJUI')}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleReview(p.id, 'DITOLAK')}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 text-rose-700 font-semibold"
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
    </div>
  );
}
