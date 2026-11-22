'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, BookOpen, FileSpreadsheet, FileText } from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
} from '@/components/portal/akademik/akademik-ui';
import {
  exportAssessmentToPdf,
  exportAssessmentToXlsx,
} from '@/lib/domain/penilaian-export';

interface ScoreItem {
  label: string;
  score: number | null;
}

interface SubjectGrades {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  kkm: number;
  formatif: Array<{
    chapterLabel: string;
    items: ScoreItem[];
    average: number | null;
  }>;
  sumatif: {
    items: ScoreItem[];
    average: number | null;
  };
  praktik: {
    items: ScoreItem[];
    average: number | null;
  };
  sts: {
    score: number | null;
    remedial_score: number | null;
    enrichment_score: number | null;
    notes: string | null;
  } | null;
  sas: {
    score: number | null;
    remedial_score: number | null;
    enrichment_score: number | null;
    notes: string | null;
  } | null;
}

interface StudentGradesWorkspaceProps {
  scope: 'siswa' | 'orang-tua';
}

export function StudentGradesWorkspace({ scope }: StudentGradesWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string; nis: string | null }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; full_name: string; nis: string | null } | null>(null);
  const [classroom, setClassroom] = useState<{ id: string; name: string; grade_level: string } | null>(null);
  const [subjects, setSubjects] = useState<SubjectGrades[]>([]);

  const applyGradesData = useCallback(
    (data: Record<string, unknown>) => {
      setAcademicYear(data.academicYear as { name: string; semester: string } | null);
      setStudents(
        (data.students as Array<{ id: string; full_name: string; nis: string | null }>) || []
      );
      const sel = data.selectedStudent as {
        id: string;
        full_name: string;
        nis: string | null;
      } | null;
      setSelectedStudent(sel);
      if (sel?.id && !selectedStudentId) {
        setSelectedStudentId(sel.id);
      }
      setClassroom(data.classroom as { id: string; name: string; grade_level: string } | null);
      setSubjects((data.subjects as SubjectGrades[]) || []);
    },
    [selectedStudentId]
  );

  const loadGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedStudentId ? `?studentId=${encodeURIComponent(selectedStudentId)}` : '';
      const res = await fetch(`/api/penilaian/student-view${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data nilai.');
      applyGradesData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId, applyGradesData]);

  useEffect(() => {
    let active = true;
    const qs = selectedStudentId ? `?studentId=${encodeURIComponent(selectedStudentId)}` : '';
    fetch(`/api/penilaian/student-view${qs}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data nilai.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError(null);
        applyGradesData(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedStudentId, applyGradesData]);

  function buildExportPayload() {
    const headers = [
      'Mata Pelajaran',
      'KKM',
      'Rata Formatif',
      'Rata Sumatif',
      'STS',
      'Remedial STS',
      'SAS',
      'Remedial SAS',
      'Rata Praktik',
    ];
    const rows = subjects.map((s) => {
      const fmtAvgs = s.formatif
        .map((f) => f.average)
        .filter((v): v is number => v !== null);
      const fmtOverall =
        fmtAvgs.length > 0
          ? Math.round((fmtAvgs.reduce((a, b) => a + b, 0) / fmtAvgs.length) * 100) / 100
          : '-';
      return [
        s.subjectName,
        s.kkm,
        fmtOverall,
        s.sumatif.average ?? '-',
        s.sts?.score ?? '-',
        s.sts?.remedial_score ?? '-',
        s.sas?.score ?? '-',
        s.sas?.remedial_score ?? '-',
        s.praktik.average ?? '-',
      ];
    });
    return {
      fileName: `rekap-nilai-${selectedStudent?.full_name || 'siswa'}`.replace(/[^a-zA-Z0-9-_]/g, '_'),
      title: `Rekapitulasi Nilai — ${selectedStudent?.full_name || ''}`,
      subtitle: `Kelas ${classroom?.name || '-'} | TA ${academicYear?.name || ''} (${academicYear?.semester || ''})`,
      headers,
      rows,
    };
  }

  if (loading) return <AkademikLoading label="Memuat data nilai..." />;
  if (error) return <AkademikErrorBanner error={error} onRetry={loadGrades} />;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <Award className="w-4 h-4" />
            <span>
              {scope === 'siswa' ? 'Rekap Nilai Saya (Read-Only)' : 'Rekap Nilai Anak (Read-Only)'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {selectedStudent?.full_name || 'Data Siswa'} —{' '}
            {classroom ? `Kelas ${classroom.name}` : 'Belum Masuk Rombel'}
          </h2>
          {academicYear && (
            <p className="text-xs text-slate-500">
              Tahun Ajaran {academicYear.name} ({academicYear.semester})
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {scope === 'orang-tua' && students.length > 1 && (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.full_name} {st.nis ? `(${st.nis})` : ''}
                </option>
              ))}
            </select>
          )}

          {subjects.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportAssessmentToPdf(buildExportPayload())}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => exportAssessmentToXlsx(buildExportPayload())}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                XLSX
              </button>
            </>
          )}
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500">
          Belum ada data penilaian pada tahun ajaran/semester aktif.
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((sub) => (
            <div key={sub.subjectId} className="glass-card rounded-3xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">{sub.subjectName}</h3>
                  <span className="text-[11px] font-mono text-slate-400">({sub.subjectCode})</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                  KKM: {sub.kkm}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* Formatif */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800">Formatif (Lingkup BAB)</p>
                  {sub.formatif.length === 0 ? (
                    <p className="text-slate-400 italic">Belum ada data.</p>
                  ) : (
                    sub.formatif.map((ch) => (
                      <div key={ch.chapterLabel} className="space-y-1">
                        <div className="flex items-center justify-between font-semibold text-slate-700">
                          <span>{ch.chapterLabel}</span>
                          <span className="text-emerald-700">
                            Rata-rata: {ch.average ?? '-'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ch.items.map((it) => (
                            <span
                              key={it.label}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px]"
                            >
                              {it.label}: <strong>{it.score ?? '-'}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Sumatif & Praktik */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
                  <div>
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>Sumatif (Lingkup Materi)</span>
                      <span className="text-emerald-700">
                        Rata: {sub.sumatif.average ?? '-'}
                      </span>
                    </div>
                    {sub.sumatif.items.length === 0 ? (
                      <p className="text-slate-400 italic">Belum ada data.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {sub.sumatif.items.map((it) => (
                          <span
                            key={it.label}
                            className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px]"
                          >
                            {it.label}: <strong>{it.score ?? '-'}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/70">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>Praktik</span>
                      <span className="text-emerald-700">
                        Rata: {sub.praktik.average ?? '-'}
                      </span>
                    </div>
                    {sub.praktik.items.length === 0 ? (
                      <p className="text-slate-400 italic">Belum ada data.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {sub.praktik.items.map((it) => (
                          <span
                            key={it.label}
                            className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px]"
                          >
                            {it.label}: <strong>{it.score ?? '-'}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* STS & SAS */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2.5">
                  <div>
                    <p className="font-bold text-slate-800 mb-1">STS (Tengah Semester)</p>
                    {!sub.sts || sub.sts.score === null ? (
                      <p className="text-slate-400 italic">Belum ada nilai.</p>
                    ) : (
                      <div className="space-y-0.5 text-[11px]">
                        <p>
                          Nilai: <strong>{sub.sts.score}</strong>
                          {sub.sts.remedial_score !== null &&
                            ` | Remedial: ${sub.sts.remedial_score}`}
                          {sub.sts.enrichment_score !== null &&
                            ` | Pengayaan: ${sub.sts.enrichment_score}`}
                        </p>
                        {sub.sts.notes && (
                          <p className="text-slate-500">Catatan: {sub.sts.notes}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/70">
                    <p className="font-bold text-slate-800 mb-1">SAS (Akhir Semester)</p>
                    {!sub.sas || sub.sas.score === null ? (
                      <p className="text-slate-400 italic">Belum ada nilai.</p>
                    ) : (
                      <div className="space-y-0.5 text-[11px]">
                        <p>
                          Nilai: <strong>{sub.sas.score}</strong>
                          {sub.sas.remedial_score !== null &&
                            ` | Remedial: ${sub.sas.remedial_score}`}
                          {sub.sas.enrichment_score !== null &&
                            ` | Pengayaan: ${sub.sas.enrichment_score}`}
                        </p>
                        {sub.sas.notes && (
                          <p className="text-slate-500">Catatan: {sub.sas.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
