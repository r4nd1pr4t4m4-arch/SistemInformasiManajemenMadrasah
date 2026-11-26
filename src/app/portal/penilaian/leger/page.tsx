'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  exportLegerToXlsx,
  generateConsolidatedERaportPdf,
  type ERaportExtracurricularItem,
} from '@/lib/domain/eraport-consolidated-pdf';

interface LegerSubject {
  id: string;
  code: string;
  name: string;
  kkm: number;
}

interface ReportCardMeta {
  attitude_spiritual?: string | null;
  attitude_social?: string | null;
  p5_summary?: string | null;
  extracurricular_notes?: ERaportExtracurricularItem[] | null;
  achievements_notes?: string | null;
  homeroom_notes?: string | null;
  promotion_status?: string | null;
  next_grade_label?: string | null;
  is_published?: boolean;
}

interface LegerRow {
  student_id: string;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  subjectScores: Record<string, number | null>;
  average: number | null;
  rank: number;
  attendance: { sakit: number; izin: number; alpa: number };
  reportCard: ReportCardMeta | null;
}

interface LegerPayload {
  academicYear: { id: string; name: string; semester: string };
  classrooms: Array<{
    id: string;
    name: string;
    grade_level: string;
    homeroom_teacher_name: string | null;
  }>;
  selectedClassroom: {
    id: string;
    name: string;
    grade_level: string;
    homeroom_teacher_name: string | null;
  } | null;
  subjects: LegerSubject[];
  rows: LegerRow[];
  canEdit: boolean;
}

export default function LegerERaportPage() {
  const [classroomId, setClassroomId] = useState('');
  const [data, setData] = useState<LegerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<LegerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [rcForm, setRcForm] = useState({
    attitude_spiritual: '',
    attitude_social: '',
    p5_summary: '',
    ekskul_name: '',
    ekskul_grade: 'Baik',
    achievements_notes: '',
    homeroom_notes: '',
    promotion_status: 'MENUNGGU',
    next_grade_label: '',
    is_published: false,
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadLeger = useCallback(async (targetClassId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = targetClassId ? `?classroomId=${encodeURIComponent(targetClassId)}` : '';
      const res = await fetch(`/api/penilaian/leger${qs}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Gagal memuat data Leger & E-Raport.');
      } else {
        setData(json as LegerPayload);
        if (!targetClassId && json.selectedClassroom?.id) {
          setClassroomId(json.selectedClassroom.id);
        }
      }
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeger(classroomId || undefined);
  }, [classroomId, loadLeger]);

  function openEditModal(row: LegerRow) {
    setEditingRow(row);
    const rc = row.reportCard;
    const firstEkskul = Array.isArray(rc?.extracurricular_notes) ? rc?.extracurricular_notes[0] : null;
    setRcForm({
      attitude_spiritual: rc?.attitude_spiritual || '',
      attitude_social: rc?.attitude_social || '',
      p5_summary: rc?.p5_summary || '',
      ekskul_name: firstEkskul?.name || '',
      ekskul_grade: firstEkskul?.grade || 'Baik',
      achievements_notes: rc?.achievements_notes || '',
      homeroom_notes: rc?.homeroom_notes || '',
      promotion_status: rc?.promotion_status || 'MENUNGGU',
      next_grade_label: rc?.next_grade_label || '',
      is_published: Boolean(rc?.is_published),
    });
  }

  async function handleSaveReportCard() {
    if (!editingRow || !data?.selectedClassroom || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/penilaian/leger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: editingRow.student_id,
          classroom_id: data.selectedClassroom.id,
          attitude_spiritual: rcForm.attitude_spiritual.trim() || null,
          attitude_social: rcForm.attitude_social.trim() || null,
          p5_summary: rcForm.p5_summary.trim() || null,
          extracurricular_notes: rcForm.ekskul_name.trim()
            ? [{ name: rcForm.ekskul_name.trim(), grade: rcForm.ekskul_grade, notes: '' }]
            : [],
          achievements_notes: rcForm.achievements_notes.trim() || null,
          homeroom_notes: rcForm.homeroom_notes.trim() || null,
          promotion_status: rcForm.promotion_status,
          next_grade_label: rcForm.next_grade_label.trim() || null,
          is_published: rcForm.is_published,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal menyimpan catatan E-Raport.', 'err');
        return;
      }
      showToast(`Catatan E-Raport ${editingRow.full_name} berhasil disimpan.`);
      setEditingRow(null);
      await loadLeger(data.selectedClassroom.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadStudentPdf(row: LegerRow) {
    if (!data?.selectedClassroom) return;
    await generateConsolidatedERaportPdf({
      studentId: row.student_id,
      fullName: row.full_name,
      nis: row.nis,
      nisn: row.nisn,
      classroomName: data.selectedClassroom.name,
      gradeLevel: data.selectedClassroom.grade_level,
      homeroomTeacherName: data.selectedClassroom.homeroom_teacher_name,
      academicYearName: data.academicYear.name,
      semester: data.academicYear.semester,
      subjects: data.subjects.map((sub) => ({
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        kkm: sub.kkm,
        score: row.subjectScores[sub.id] ?? null,
      })),
      attendance: row.attendance,
      attitudeSpiritual: row.reportCard?.attitude_spiritual,
      attitudeSocial: row.reportCard?.attitude_social,
      p5Summary: row.reportCard?.p5_summary,
      extracurriculars: Array.isArray(row.reportCard?.extracurricular_notes)
        ? row.reportCard?.extracurricular_notes
        : [],
      achievementsNotes: row.reportCard?.achievements_notes,
      homeroomNotes: row.reportCard?.homeroom_notes,
      promotionStatus: row.reportCard?.promotion_status,
      nextGradeLabel: row.reportCard?.next_grade_label,
    });
  }

  function handleExportLegerExcel() {
    if (!data?.selectedClassroom) return;
    exportLegerToXlsx({
      classroomName: data.selectedClassroom.name,
      academicYearName: data.academicYear.name,
      semester: data.academicYear.semester,
      subjects: data.subjects.map((s) => ({ code: s.code, name: s.name })),
      rows: data.rows.map((r) => ({
        rank: r.rank,
        nis: r.nis,
        fullName: r.full_name,
        scoresBySubject: data.subjects.map((s) => r.subjectScores[s.id] ?? null),
        average: r.average,
        attendance: r.attendance,
        promotionStatus: r.reportCard?.promotion_status || 'MENUNGGU',
      })),
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-700" />
              <span>Leger Nilai Kelas &amp; E-Raport Konsolidasi</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Konsolidasi nilai raport seluruh mata pelajaran, peringkat kelas, catatan wali kelas,
              dan cetak Buku E-Raport PDF ber-QR resmi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && data.classrooms.length > 0 && (
              <select
                value={classroomId || data.selectedClassroom?.id || ''}
                onChange={(e) => setClassroomId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {data.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name} ({c.grade_level})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={!data || data.rows.length === 0}
              onClick={handleExportLegerExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor Leger XLSX</span>
            </button>
            <button
              type="button"
              onClick={() => void loadLeger(classroomId || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            Memuat konsolidasi leger kelas...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-xs text-rose-800">
            {error}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada siswa terdaftar di rombel ini untuk Tahun Ajaran aktif.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-center">Rank</th>
                  <th className="px-3 py-2.5">Siswa</th>
                  {data.subjects.map((sub) => (
                    <th key={sub.id} className="px-2.5 py-2.5 text-center whitespace-nowrap" title={sub.name}>
                      {sub.code || sub.name.slice(0, 6)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center">Rata2</th>
                  <th className="px-3 py-2.5 text-center">S/I/A</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.rows.map((row) => (
                  <tr key={row.student_id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 text-center font-black text-emerald-700">
                      #{row.rank}
                    </td>
                    <td className="px-3 py-2.5 min-w-[160px]">
                      <p className="font-bold text-slate-900">{row.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">NIS: {row.nis || '-'}</p>
                    </td>
                    {data.subjects.map((sub) => {
                      const val = row.subjectScores[sub.id];
                      const belowKkm = val !== null && val < sub.kkm;
                      return (
                        <td
                          key={sub.id}
                          className={`px-2.5 py-2.5 text-center font-mono ${
                            belowKkm ? 'text-rose-600 font-bold bg-rose-50/40' : 'text-slate-700'
                          }`}
                        >
                          {val !== null ? val.toFixed(1) : '-'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">
                      {row.average !== null ? row.average.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-600">
                      {row.attendance.sakit}/{row.attendance.izin}/{row.attendance.alpa}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.reportCard?.is_published
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.reportCard?.is_published ? 'Terbit' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      {data.canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-semibold"
                          title="Edit Catatan & Non-Akademik"
                        >
                          <Pencil className="w-3 h-3" /> Catatan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDownloadStudentPdf(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold"
                        title="Cetak Buku E-Raport PDF"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Catatan Non-Akademik E-Raport */}
      {editingRow && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingRow(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  Catatan E-Raport — {editingRow.full_name}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Lengkapi sikap, P5-PPRA, ekskul, catatan wali kelas, dan keputusan akhir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sikap Spiritual</label>
                <input
                  value={rcForm.attitude_spiritual}
                  onChange={(e) => setRcForm({ ...rcForm, attitude_spiritual: e.target.value })}
                  placeholder="Baik, taat beribadah..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sikap Sosial</label>
                <input
                  value={rcForm.attitude_social}
                  onChange={(e) => setRcForm({ ...rcForm, attitude_social: e.target.value })}
                  placeholder="Disiplin, santun, peduli..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ekstrakurikuler</label>
                <input
                  value={rcForm.ekskul_name}
                  onChange={(e) => setRcForm({ ...rcForm, ekskul_name: e.target.value })}
                  placeholder="mis. Pramuka / Tahfidz"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Predikat Ekskul</label>
                <select
                  value={rcForm.ekskul_grade}
                  onChange={(e) => setRcForm({ ...rcForm, ekskul_grade: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="Sangat Baik">Sangat Baik</option>
                  <option value="Baik">Baik</option>
                  <option value="Cukup">Cukup</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Ringkasan Projek P5 / PPRA</label>
                <textarea
                  rows={2}
                  value={rcForm.p5_summary}
                  onChange={(e) => setRcForm({ ...rcForm, p5_summary: e.target.value })}
                  placeholder="Catatan capaian Projek Penguatan Profil Pelajar..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Prestasi Siswa</label>
                <input
                  value={rcForm.achievements_notes}
                  onChange={(e) => setRcForm({ ...rcForm, achievements_notes: e.target.value })}
                  placeholder="mis. Juara 1 KSM Matematika Tingkat Kabupaten"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Catatan Wali Kelas</label>
                <textarea
                  rows={2}
                  value={rcForm.homeroom_notes}
                  onChange={(e) => setRcForm({ ...rcForm, homeroom_notes: e.target.value })}
                  placeholder="Motivasi & saran perkembangan siswa..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keputusan Akhir</label>
                <select
                  value={rcForm.promotion_status}
                  onChange={(e) => setRcForm({ ...rcForm, promotion_status: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="MENUNGGU">Menunggu (Semester Ganjil)</option>
                  <option value="NAIK_KELAS">Naik Kelas</option>
                  <option value="TINGGAL_KELAS">Tinggal Kelas</option>
                  <option value="LULUS">Lulus</option>
                  <option value="TIDAK_LULUS">Tidak Lulus</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tingkat Tujuan (jika Naik)</label>
                <input
                  value={rcForm.next_grade_label}
                  onChange={(e) => setRcForm({ ...rcForm, next_grade_label: e.target.value })}
                  placeholder="mis. VIII / IX / XI"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <label className="sm:col-span-2 inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rcForm.is_published}
                  onChange={(e) => setRcForm({ ...rcForm, is_published: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Terbitkan E-Raport (dapat diunduh langsung oleh Siswa &amp; Orang Tua)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveReportCard()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan E-Raport
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
