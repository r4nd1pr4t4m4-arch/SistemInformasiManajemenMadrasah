'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, BookOpenCheck, CheckCircle2, Download, Loader2, Plus, RefreshCw } from 'lucide-react';
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

export default function TahfidzTrackerPage() {
  const [rows, setRows] = useState<TahfidzRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [filterStudentId, setFilterStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    student_id: '',
    surah_or_juz: '',
    target_semester: 'Ganjil 2026/2027',
    status: 'TUNTAS' as 'BELUM' | 'PROSES' | 'TUNTAS',
    fluency: 'LANCAR' as 'LANCAR' | 'CUKUP' | 'MURAJAAH',
    tajwid_score: 85,
    tasmi_score: 90,
    tasmi_date: new Date().toISOString().slice(0, 10),
    examiner_name: '',
    notes: '',
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/layanan/guru-wali/tahfidz', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows(data.progress || []);
        setStudents(data.students || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
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
      showToast('Capaian hafalan & nilai tasmi\' berhasil disimpan.');
      setForm((prev) => ({ ...prev, surah_or_juz: '', notes: '' }));
      await loadData();
    } finally {
      setSaving(false);
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
              <BookOpenCheck className="w-5 h-5 text-emerald-700" />
              <span>Progress Tracker Hafalan &amp; Ujian Tasmi&apos; (Tahfidz)</span>
            </h1>
            <p className="text-xs text-slate-500">
              Catat ketuntasan surah/juz, kelancaran, nilai tajwid, ujian tasmi&apos;, serta cetak Sertifikat/Rapor Hafalan PDF ber-QR.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status &amp; Kelancaran</label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                className="rounded-xl border border-slate-300 bg-white px-2 py-2"
              >
                <option value="TUNTAS">Tuntas</option>
                <option value="PROSES">Proses</option>
                <option value="BELUM">Belum</option>
              </select>
              <select
                value={form.fluency}
                onChange={(e) => setForm({ ...form, fluency: e.target.value as typeof form.fluency })}
                className="rounded-xl border border-slate-300 bg-white px-2 py-2"
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
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 font-mono"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={form.tasmi_score}
                onChange={(e) => setForm({ ...form, tasmi_score: Number(e.target.value) || 0 })}
                placeholder="Tasmi'"
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Ujian Tasmi&apos;</label>
            <input
              type="date"
              value={form.tasmi_date}
              onChange={(e) => setForm({ ...form, tasmi_date: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Penguji / Guru Wali</label>
            <input
              value={form.examiner_name}
              onChange={(e) => setForm({ ...form, examiner_name: e.target.value })}
              placeholder="Ustadz / Ustadzah..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div className="lg:col-span-2 flex items-end justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Simpan Capaian Tahfidz
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <select
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
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
              onClick={() =>
                void generateTahfidzReportPdf({
                  studentId: selectedStudent.id,
                  studentName: selectedStudent.full_name,
                  nis: selectedStudent.nis,
                  items: filtered,
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              Cetak Sertifikat / Rapor Hafalan PDF
            </button>
          )}
        </div>

        <div className="space-y-2 text-xs">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 border border-slate-200/80"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{item.student?.full_name || 'Siswa'}</span>
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
              <span className="text-[11px] text-slate-400">{item.tasmi_date || '-'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
