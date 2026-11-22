'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Search,
  X,
} from 'lucide-react';
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

interface ExamSummary {
  score: number | null;
  remedial_score: number | null;
  enrichment_score: number | null;
  effective_score?: number | null;
  notes: string | null;
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
  formatifAverage?: number | null;
  sumatif: {
    items: ScoreItem[];
    average: number | null;
  };
  praktik: {
    items: ScoreItem[];
    average: number | null;
  };
  sts: ExamSummary | null;
  sas: ExamSummary | null;
  raportScore?: number | null;
}

interface StudentGradesWorkspaceProps {
  scope: 'siswa' | 'orang-tua';
}

function ScoreBadge({
  score,
  kkm,
}: {
  score: number | null | undefined;
  kkm: number;
}) {
  if (score === null || score === undefined) {
    return <span className="text-slate-400 font-semibold">-</span>;
  }
  const passed = score >= kkm;
  return (
    <span
      className={`font-bold ${passed ? 'text-emerald-700' : 'text-rose-600'}`}
    >
      {score}
    </span>
  );
}

export function StudentGradesWorkspace({ scope }: StudentGradesWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [students, setStudents] = useState<
    Array<{ id: string; full_name: string; nis: string | null }>
  >([]);
  const [requestedStudentId, setRequestedStudentId] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    full_name: string;
    nis: string | null;
  } | null>(null);
  const [classroom, setClassroom] = useState<{
    id: string;
    name: string;
    grade_level: string;
  } | null>(null);
  const [subjects, setSubjects] = useState<SubjectGrades[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const applyGradesData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as { name: string; semester: string } | null);
    setStudents(
      (data.students as Array<{ id: string; full_name: string; nis: string | null }>) || []
    );
    setSelectedStudent(
      (data.selectedStudent as { id: string; full_name: string; nis: string | null } | null) ??
        null
    );
    setClassroom(
      (data.classroom as { id: string; name: string; grade_level: string } | null) ?? null
    );
    setSubjects((data.subjects as SubjectGrades[]) || []);
  }, []);

  const loadGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope });
      if (requestedStudentId) params.set('studentId', requestedStudentId);
      const res = await fetch(`/api/penilaian/student-view?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data nilai.');
      applyGradesData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [scope, requestedStudentId, applyGradesData]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ scope });
    if (requestedStudentId) params.set('studentId', requestedStudentId);
    fetch(`/api/penilaian/student-view?${params.toString()}`)
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
  }, [scope, requestedStudentId, applyGradesData]);

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.subjectName.toLowerCase().includes(q) || s.subjectCode.toLowerCase().includes(q)
    );
  }, [subjects, searchQuery]);

  const summaryStats = useMemo(() => {
    const withRaport = subjects.filter(
      (s) => s.raportScore !== null && s.raportScore !== undefined
    );
    const passedCount = withRaport.filter((s) => (s.raportScore ?? 0) >= s.kkm).length;
    const avgRaport =
      withRaport.length > 0
        ? Math.round(
            (withRaport.reduce((acc, s) => acc + (s.raportScore ?? 0), 0) / withRaport.length) *
              100
          ) / 100
        : null;
    return {
      totalSubjects: subjects.length,
      raportReady: withRaport.length,
      passedCount,
      avgRaport,
    };
  }, [subjects]);

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
      'Raport',
    ];
    const rows = subjects.map((s) => [
      s.subjectName,
      s.kkm,
      s.formatifAverage ?? '-',
      s.sumatif.average ?? '-',
      s.sts?.score ?? '-',
      s.sts?.remedial_score ?? '-',
      s.sas?.score ?? '-',
      s.sas?.remedial_score ?? '-',
      s.praktik.average ?? '-',
      s.raportScore ?? '-',
    ]);
    return {
      fileName: `rekap-nilai-${selectedStudent?.full_name || 'siswa'}`.replace(
        /[^a-zA-Z0-9-_]/g,
        '_'
      ),
      title: `Rekapitulasi Nilai — ${selectedStudent?.full_name || ''}`,
      subtitle: `Kelas ${classroom?.name || '-'} | TA ${academicYear?.name || ''} (${academicYear?.semester || ''})`,
      headers,
      rows,
    };
  }

  if (loading) return <AkademikLoading label="Memuat data nilai..." />;
  if (error) return <AkademikErrorBanner error={error} onRetry={loadGrades} />;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">
      {/* Header Card */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <Award className="w-3.5 h-3.5" />
            <span>
              {scope === 'siswa' ? 'Rekap Nilai Saya (Read-Only)' : 'Rekap Nilai Anak (Read-Only)'}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words">
            {selectedStudent?.full_name || 'Data Siswa'}{' '}
            <span className="text-slate-400 font-normal">—</span>{' '}
            <span className="text-emerald-700">
              {classroom ? `Kelas ${classroom.name}` : 'Belum Masuk Rombel'}
            </span>
          </h2>
          {academicYear && (
            <p className="text-xs text-slate-500">
              Tahun Ajaran {academicYear.name} ({academicYear.semester})
              {selectedStudent?.nis ? ` • NIS: ${selectedStudent.nis}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {students.length > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label
                htmlFor="student-switcher"
                className="text-xs font-semibold text-slate-600 shrink-0"
              >
                {scope === 'orang-tua' ? 'Anak:' : 'Siswa:'}
              </label>
              <select
                id="student-switcher"
                value={requestedStudentId || selectedStudent?.id || ''}
                aria-label="Pilih siswa"
                onChange={(e) => {
                  setLoading(true);
                  setSearchQuery('');
                  setRequestedStudentId(e.target.value);
                }}
                className="flex-1 sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.full_name} {st.nis ? `(${st.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {subjects.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportAssessmentToPdf(buildExportPayload())}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportAssessmentToXlsx(buildExportPayload())}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>XLSX</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats & Search */}
      {subjects.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Total Mata Pelajaran</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{summaryStats.totalSubjects}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Nilai Raport Tersedia</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">
              {summaryStats.raportReady}{' '}
              <span className="text-xs font-normal text-slate-400">
                / {summaryStats.totalSubjects}
              </span>
            </p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Tuntas KKM (Raport)</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">
              {summaryStats.passedCount}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Rata-rata Raport</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {summaryStats.avgRaport ?? '-'}
            </p>
          </div>
        </div>
      )}

      {subjects.length > 3 && (
        <div className="glass-card rounded-2xl p-3 sm:p-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari mata pelajaran..."
              aria-label="Cari mata pelajaran"
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {!selectedStudent ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500 leading-relaxed">
          {scope === 'orang-tua'
            ? 'Belum ada data anak yang tertaut ke akun Orang Tua/Wali Anda. Silakan hubungi admin lembaga untuk penautan data siswa.'
            : 'Akun Anda belum tertaut ke data siswa aktif. Silakan hubungi admin lembaga.'}
        </div>
      ) : !classroom ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500 leading-relaxed">
          {selectedStudent.full_name} belum terdaftar pada rombongan belajar di tahun ajaran aktif.
        </div>
      ) : subjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500">
          Belum ada data penilaian pada tahun ajaran/semester aktif.
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500">
          Tidak ada mata pelajaran yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubjects.map((sub) => {
            const hasRaport = sub.raportScore !== null && sub.raportScore !== undefined;
            const raportPassed = hasRaport && (sub.raportScore ?? 0) >= sub.kkm;
            return (
              <div key={sub.subjectId} className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
                {/* Subject Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h3 className="text-sm font-bold text-slate-900 break-words">
                      {sub.subjectName}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      ({sub.subjectCode})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                      KKM: {sub.kkm}
                    </span>
                    {hasRaport && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          raportPassed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Raport: {sub.raportScore}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-column Assessment Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {/* Formatif */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">Formatif (Lingkup BAB)</p>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Rata: {sub.formatifAverage ?? '-'}
                      </span>
                    </div>
                    {sub.formatif.length === 0 ? (
                      <p className="text-slate-400 italic">Belum ada data.</p>
                    ) : (
                      <div className="space-y-2">
                        {sub.formatif.map((ch) => (
                          <div key={ch.chapterLabel} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 font-semibold text-slate-700">
                              <span className="break-words">{ch.chapterLabel}</span>
                              <span className="text-emerald-700 shrink-0">
                                Rata: {ch.average ?? '-'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {ch.items.map((it) => (
                                <span
                                  key={it.label}
                                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px]"
                                >
                                  {it.label}: <ScoreBadge score={it.score} kkm={sub.kkm} />
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sumatif & Praktik */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 font-bold text-slate-800 mb-1.5">
                        <span>Sumatif (Lingkup Materi)</span>
                        <span className="text-emerald-700 shrink-0">
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
                              {it.label}: <ScoreBadge score={it.score} kkm={sub.kkm} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/70">
                      <div className="flex items-center justify-between gap-2 font-bold text-slate-800 mb-1.5">
                        <span>Praktik</span>
                        <span className="text-emerald-700 shrink-0">
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
                              {it.label}: <ScoreBadge score={it.score} kkm={sub.kkm} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STS & SAS */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2.5 md:col-span-2 lg:col-span-1">
                    <div>
                      <p className="font-bold text-slate-800 mb-1">STS (Tengah Semester)</p>
                      {!sub.sts || sub.sts.score === null ? (
                        <p className="text-slate-400 italic">Belum ada nilai.</p>
                      ) : (
                        <div className="space-y-1 text-[11px]">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>
                              Nilai: <ScoreBadge score={sub.sts.score} kkm={sub.kkm} />
                            </span>
                            {sub.sts.remedial_score !== null && (
                              <span>
                                | Remedial: <strong>{sub.sts.remedial_score}</strong>
                              </span>
                            )}
                            {sub.sts.enrichment_score !== null && (
                              <span>
                                | Pengayaan: <strong>{sub.sts.enrichment_score}</strong>
                              </span>
                            )}
                            {sub.sts.effective_score !== null &&
                              sub.sts.effective_score !== undefined &&
                              sub.sts.effective_score !== sub.sts.score && (
                                <span className="text-emerald-700 font-semibold">
                                  (Nilai Akhir: {sub.sts.effective_score})
                                </span>
                              )}
                          </p>
                          {sub.sts.notes && (
                            <p className="text-slate-500 break-words">Catatan: {sub.sts.notes}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/70">
                      <p className="font-bold text-slate-800 mb-1">SAS (Akhir Semester)</p>
                      {!sub.sas || sub.sas.score === null ? (
                        <p className="text-slate-400 italic">Belum ada nilai.</p>
                      ) : (
                        <div className="space-y-1 text-[11px]">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>
                              Nilai: <ScoreBadge score={sub.sas.score} kkm={sub.kkm} />
                            </span>
                            {sub.sas.remedial_score !== null && (
                              <span>
                                | Remedial: <strong>{sub.sas.remedial_score}</strong>
                              </span>
                            )}
                            {sub.sas.enrichment_score !== null && (
                              <span>
                                | Pengayaan: <strong>{sub.sas.enrichment_score}</strong>
                              </span>
                            )}
                            {sub.sas.effective_score !== null &&
                              sub.sas.effective_score !== undefined &&
                              sub.sas.effective_score !== sub.sas.score && (
                                <span className="text-emerald-700 font-semibold">
                                  (Nilai Akhir: {sub.sas.effective_score})
                                </span>
                              )}
                          </p>
                          {sub.sas.notes && (
                            <p className="text-slate-500 break-words">Catatan: {sub.sas.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
