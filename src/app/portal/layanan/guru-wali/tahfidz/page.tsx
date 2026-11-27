'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, BookOpenCheck, CheckCircle2, Download, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { generateTahfidzReportPdf } from '@/lib/domain/tahfidz-certificate-pdf';

interface TahfidzRow {
  id: string;
  student_id: string;
  surah_or_juz: string;
  target_semester: string | null;
  status: 'BELUM' | 'PROSES' | 'TUNTAS';
  fluency: 'LANCAR' | 'CUKUP' | 'MURAJAAH' | null;
  tajwid_score: number | null;
  tasmi_score: number | null;
  tasmi_date: string | null;
  examiner_name: string | null;
  notes: string | null;
  student?: { id: string; full_name: string; nis: string | null } | null;
}

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
}

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function TahfidzTrackerPage() {
  const [rows, setRows] = useState<TahfidzRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [filterStudentId, setFilterStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState(() => ({
    student_id: '',
    surah_or_juz: '',
    target_semester: 'Ganjil 2026/2027',
    status: 'TUNTAS' as 'BELUM' | 'PROSES' | 'TUNTAS',
    fluency: 'LANCAR' as 'LANCAR' | 'CUKUP' | 'MURAJAAH',
    tajwid_score: 85,
    tasmi_score: 90,
    tasmi_date: getTodayWibIso(),
    examiner_name: '',
    notes: '',
  }));

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/layanan/guru-wali/tahfidz', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat data capaian tahfidz.');
      } else {
        setRows(data.progress || []);
        setStudents(data.students || []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadData]);

  const filtered = useMemo(
    () => (filterStudentId ? rows.filter((r) => r.student_id === filterStudentId) : rows),
    [rows, filterStudentId]
  );

  const selectedStudent = students.find((s) => s.id === filterStudentId) || null;
  const tuntasCount = filtered.filter((r) => r.status === 'TUNTAS').length;
  const pct = filtered.length > 0 ? Math.round((tuntasCount / filtered.length) * 100) : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/layanan/guru-wali/tahfidz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tajwid_score: Number(form.tajwid_score) || null,
          tasmi_score: Number(form.tasmi_score) || null,
          examiner_name: form.examiner_name.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan capaian tahfidz.', 'err');
        return;
      }
      showToast("Capaian hafalan & nilai tasmi' berhasil disimpan.");
      setForm((prev) => ({ ...prev, surah_or_juz: '', notes: '' }));
      await loadData();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan capaian tahfidz.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!selectedStudent || filtered.length === 0) return;
    setDownloadingPdf(true);
    try {
      await generateTahfidzReportPdf({
        studentId: selectedStudent.id,
        studentName: selectedStudent.full_name,
        nis: selectedStudent.nis,
        items: filtered,
      });
    } catch {
      showToast('Gagal membuat dokumen PDF sertifikat hafalan.', 'err');
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="break-words">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Progress Tracker Hafalan &amp; Ujian Tasmi&apos; (Tahfidz)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Catat ketuntasan surah/juz, kelancaran, nilai tajwid, ujian tasmi&apos;, serta cetak Sertifikat/Rapor Hafalan PDF ber-QR.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Siswa *</label>
            <select
              required
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            >
              <option value="">-- Pilih Siswa --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Surah / Juz *</label>
            <input
              required
              value={form.surah_or_juz}
              onChange={(e) => setForm({ ...form, surah_or_juz: e.target.value })}
              placeholder="mis. Juz 30 — An-Naba"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status &amp; Kelancaran</label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm sm:text-xs"
              >
                <option value="TUNTAS">Tuntas</option>
                <option value="PROSES">Proses</option>
                <option value="BELUM">Belum</option>
              </select>
              <select
                value={form.fluency}
                onChange={(e) => setForm({ ...form, fluency: e.target.value as typeof form.fluency })}
                className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm sm:text-xs"
              >
                <option value="LANCAR">Lancar</option>
                <option value="CUKUP">Cukup</option>
                <option value="MURAJAAH">Muraja&apos;ah</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nilai Tajwid / Tasmi&apos;</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={form.tajwid_score}
                onChange={(e) => setForm({ ...form, tajwid_score: Number(e.target.value) || 0 })}
                placeholder="Tajwid"
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm sm:text-xs font-mono"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={form.tasmi_score}
                onChange={(e) => setForm({ ...form, tasmi_score: Number(e.target.value) || 0 })}
                placeholder="Tasmi'"
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm sm:text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Ujian Tasmi&apos;</label>
            <input
              type="date"
              value={form.tasmi_date}
              onChange={(e) => setForm({ ...form, tasmi_date: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Penguji / Guru Wali</label>
            <input
              value={form.examiner_name}
              onChange={(e) => setForm({ ...form, examiner_name: e.target.value })}
              placeholder="Ustadz / Ustadzah..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            />
          </div>
          <div className="lg:col-span-2 flex items-end justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Simpan Capaian Tahfidz
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-semibold"
            >
              <option value="">Semua Siswa ({rows.length} catatan)</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            {filtered.length > 0 && (
              <span className="text-xs font-bold text-emerald-700">
                Ketuntasan: {tuntasCount}/{filtered.length} ({pct}%)
              </span>
            )}
          </div>
          {selectedStudent && filtered.length > 0 && (
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={() => void handleDownloadPdf()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Cetak Sertifikat / Rapor Hafalan PDF
            </button>
          )}
        </div>

        <div className="space-y-2 text-xs">
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
              {loading ? 'Memuat capaian hafalan...' : 'Belum ada catatan capaian hafalan tahfidz.'}
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 border border-slate-200/80"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 break-words">
                      {item.student?.full_name || 'Siswa'}
                    </span>
                    <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {item.surah_or_juz}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'TUNTAS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Kelancaran: <strong>{item.fluency || '-'}</strong> • Tajwid:{' '}
                    <strong>{item.tajwid_score ?? '-'}</strong> • Tasmi&apos;:{' '}
                    <strong>{item.tasmi_score ?? '-'}</strong>
                    {item.examiner_name ? ` • Penguji: ${item.examiner_name}` : ''}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{item.tasmi_date || '-'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
