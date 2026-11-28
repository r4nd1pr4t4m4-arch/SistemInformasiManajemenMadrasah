'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeDecimalInput, parseDecimalInput } from '@/lib/validation/decimal';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Save,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from '@/components/portal/akademik/akademik-ui';
import { PenilaianConfirmModal } from '@/components/portal/penilaian/confirm-modal';
import {
  computeRaportScore,
  sortClassroomsAsc,
  validateRaportWeights,
  type RaportWeights,
  type TaughtClassroomSummary,
} from '@/lib/domain/penilaian';
import {
  exportAssessmentToPdf,
  exportAssessmentToXlsx,
} from '@/lib/domain/penilaian-export';

interface RaportRow {
  student_id: string;
  nis: string | null;
  full_name: string;
  formatifAvg: number | null;
  sumatifAvg: number | null;
  stsEffective: number | null;
  sasEffective: number | null;
  praktikAvg: number | null;
  raportScore: number | null;
}

interface RaportWorkspaceProps {
  subjectId: string;
  classrooms: TaughtClassroomSummary[];
}

export function RaportWorkspace({ subjectId, classrooms }: RaportWorkspaceProps) {
  const { toast, showToast, dismissToast } = useAkademikToast();

  const sortedClassrooms = useMemo(() => sortClassroomsAsc(classrooms), [classrooms]);

  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(
    sortedClassrooms[0]?.id || ''
  );
  const effectiveClassroomId = sortedClassrooms.some((c) => c.id === selectedClassroomId)
    ? selectedClassroomId
    : sortedClassrooms[0]?.id || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<{ code: string; name: string } | null>(null);
  const [classroomInfo, setClassroomInfo] = useState<{ id: string; name: string; grade_level: string } | null>(null);
  const [kkm, setKkm] = useState<{ mode: string; minScore: number }>({
    mode: 'PER_GRADE',
    minScore: 75,
  });
  const [canEdit, setCanEdit] = useState(false);
  const [hasPraktik, setHasPraktik] = useState(false);

  const [weightsInput, setWeightsInput] = useState({
    weight_formatif: '25',
    weight_sumatif: '25',
    weight_sts: '25',
    weight_sas: '25',
    weight_praktik: '0',
  });
  const [initialWeightsInput, setInitialWeightsInput] = useState({
    weight_formatif: '25',
    weight_sumatif: '25',
    weight_sts: '25',
    weight_sas: '25',
    weight_praktik: '0',
  });
  const [rows, setRows] = useState<RaportRow[]>([]);
  const [confirmSwitchClassroomId, setConfirmSwitchClassroomId] = useState<string | null>(null);

  const applyRaportData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as { name: string; semester: string } | null);
    setSubjectInfo(data.subject as { code: string; name: string } | null);
    setClassroomInfo(
      data.classroom as { id: string; name: string; grade_level: string } | null
    );
    setKkm(data.kkm as { mode: string; minScore: number });
    setCanEdit(Boolean(data.canEdit));
    setHasPraktik(Boolean(data.hasPraktik));

    const w = data.weights as RaportWeights | undefined;
    if (w) {
      const nextW = {
        weight_formatif: String(w.weight_formatif),
        weight_sumatif: String(w.weight_sumatif),
        weight_sts: String(w.weight_sts),
        weight_sas: String(w.weight_sas),
        weight_praktik: String(w.weight_praktik),
      };
      setWeightsInput(nextW);
      setInitialWeightsInput(nextW);
    }
    setRows((data.rows as RaportRow[]) || []);
  }, []);

  const loadRaport = useCallback(async () => {
    if (!effectiveClassroomId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        subjectId,
        classroomId: effectiveClassroomId,
      });
      const res = await fetch(`/api/penilaian/raport?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data raport.');
      applyRaportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, effectiveClassroomId, applyRaportData]);

  useEffect(() => {
    if (!effectiveClassroomId) return;
    let active = true;
    const params = new URLSearchParams({
      subjectId,
      classroomId: effectiveClassroomId,
    });
    fetch(`/api/penilaian/raport?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data raport.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError(null);
        applyRaportData(data);
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
  }, [subjectId, effectiveClassroomId, applyRaportData]);

  const parsedWeights: RaportWeights = useMemo(
    () => ({
      weight_formatif: parseDecimalInput(weightsInput.weight_formatif) ?? (weightsInput.weight_formatif.trim() === '' ? 0 : NaN),
      weight_sumatif: parseDecimalInput(weightsInput.weight_sumatif) ?? (weightsInput.weight_sumatif.trim() === '' ? 0 : NaN),
      weight_sts: parseDecimalInput(weightsInput.weight_sts) ?? (weightsInput.weight_sts.trim() === '' ? 0 : NaN),
      weight_sas: parseDecimalInput(weightsInput.weight_sas) ?? (weightsInput.weight_sas.trim() === '' ? 0 : NaN),
      weight_praktik: hasPraktik
        ? parseDecimalInput(weightsInput.weight_praktik) ?? (weightsInput.weight_praktik.trim() === '' ? 0 : NaN)
        : 0,
    }),
    [weightsInput, hasPraktik]
  );

  const weightTotal = useMemo(() => {
    const total =
      parsedWeights.weight_formatif +
      parsedWeights.weight_sumatif +
      parsedWeights.weight_sts +
      parsedWeights.weight_sas +
      (hasPraktik ? parsedWeights.weight_praktik : 0);
    return Number.isNaN(total) ? 0 : Math.round(total * 100) / 100;
  }, [parsedWeights, hasPraktik]);

  const weightError = useMemo(
    () => validateRaportWeights(parsedWeights, hasPraktik),
    [parsedWeights, hasPraktik]
  );

  const hasUnsavedWeights = useMemo(
    () =>
      canEdit &&
      (weightsInput.weight_formatif !== initialWeightsInput.weight_formatif ||
        weightsInput.weight_sumatif !== initialWeightsInput.weight_sumatif ||
        weightsInput.weight_sts !== initialWeightsInput.weight_sts ||
        weightsInput.weight_sas !== initialWeightsInput.weight_sas ||
        (hasPraktik && weightsInput.weight_praktik !== initialWeightsInput.weight_praktik)),
    [canEdit, weightsInput, initialWeightsInput, hasPraktik]
  );

  // Live preview of raport scores when weights are edited
  const computedRows = useMemo(() => {
    if (weightError) return rows;
    return rows.map((r) => ({
      ...r,
      raportScore: computeRaportScore(
        {
          formatifAvg: r.formatifAvg,
          sumatifAvg: r.sumatifAvg,
          stsEffective: r.stsEffective,
          sasEffective: r.sasEffective,
          praktikAvg: r.praktikAvg,
        },
        parsedWeights,
        hasPraktik
      ),
    }));
  }, [rows, parsedWeights, hasPraktik, weightError]);

  const filteredRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return computedRows;
    return computedRows.filter(
      (r) => r.full_name.toLowerCase().includes(q) || (r.nis || '').toLowerCase().includes(q)
    );
  }, [computedRows, studentSearch]);

  const stats = useMemo(() => {
    const complete = computedRows.filter((r) => r.raportScore !== null);
    const passed = complete.filter((r) => (r.raportScore ?? 0) >= kkm.minScore).length;
    const failed = complete.length - passed;
    const incomplete = computedRows.length - complete.length;
    const classAvg =
      complete.length > 0
        ? Math.round(
            (complete.reduce((acc, r) => acc + (r.raportScore ?? 0), 0) / complete.length) * 100
          ) / 100
        : null;
    return { total: computedRows.length, passed, failed, incomplete, classAvg };
  }, [computedRows, kkm.minScore]);

  async function handleSaveWeights() {
    if (weightError) {
      showToast('error', weightError);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/penilaian/raport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: subjectId,
          classroom_id: effectiveClassroomId,
          ...parsedWeights,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan bobot raport.');
      showToast('success', 'Bobot nilai raport berhasil disimpan dan diterapkan.');
      await loadRaport();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan bobot raport.');
    } finally {
      setSaving(false);
    }
  }

  function buildExportData() {
    const title = `Nilai Raport ${subjectInfo?.name || ''}`;
    const subtitle = `Kelas ${classroomInfo?.name || ''} | TA ${academicYear?.name || ''} (${academicYear?.semester || ''}) | KKM: ${kkm.minScore}`;
    const safeName = `raport-${subjectInfo?.code || 'mapel'}-${classroomInfo?.name || 'kelas'}`
      .replace(/[^a-zA-Z0-9-_]/g, '_');

    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      `Formatif (${parsedWeights.weight_formatif}%)`,
      `Sumatif (${parsedWeights.weight_sumatif}%)`,
      `STS (${parsedWeights.weight_sts}%)`,
      `SAS (${parsedWeights.weight_sas}%)`,
    ];
    if (hasPraktik) headers.push(`Praktik (${parsedWeights.weight_praktik}%)`);
    headers.push('Nilai Raport', 'Keterangan');

    const exportRows = computedRows.map((r, idx) => {
      const base: Array<string | number> = [
        idx + 1,
        r.nis || '-',
        r.full_name,
        r.formatifAvg ?? '-',
        r.sumatifAvg ?? '-',
        r.stsEffective ?? '-',
        r.sasEffective ?? '-',
      ];
      if (hasPraktik) base.push(r.praktikAvg ?? '-');
      base.push(
        r.raportScore ?? '-',
        r.raportScore === null
          ? 'Belum Lengkap'
          : r.raportScore >= kkm.minScore
          ? 'Tuntas'
          : 'Belum Tuntas'
      );
      return base;
    });

    return { fileName: safeName, title, subtitle, headers, rows: exportRows };
  }

  if (sortedClassrooms.length === 0) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-8 text-center text-sm text-slate-600">
        Belum ada kelas yang diampu untuk mata pelajaran ini pada tahun ajaran/semester aktif.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={error} onRetry={loadRaport} />

      {/* Header */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {subjectInfo?.name || 'Mata Pelajaran'}
              </span>
            </span>
            {academicYear && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                TA {academicYear.name} ({academicYear.semester})
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
              KKM: {kkm.minScore}
            </span>
            {!canEdit && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
                Mode Lihat (Read-Only)
              </span>
            )}
            {hasUnsavedWeights && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                Bobot belum disimpan
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Raport Mata Pelajaran</span>
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nilai Raport dihitung otomatis dari bobot Formatif, Sumatif, STS, SAS
            {hasPraktik ? ', dan Praktik' : ' (Praktik diabaikan karena belum ada nilai praktik)'}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <select
            value={effectiveClassroomId}
            aria-label="Pilih kelas"
            onChange={(e) => {
              const nextId = e.target.value;
              if (hasUnsavedWeights) {
                setConfirmSwitchClassroomId(nextId);
                return;
              }
              setLoading(true);
              setStudentSearch('');
              setSelectedClassroomId(nextId);
            }}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {sortedClassrooms.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name} (Tingkat {c.gradeLevel})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportAssessmentToPdf(buildExportData())}
              disabled={loading || computedRows.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => exportAssessmentToXlsx(buildExportData())}
              disabled={loading || computedRows.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>XLSX</span>
            </button>
          </div>
        </div>
      </div>

      {/* Weight Configurator */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Pengaturan Bobot Persentase (Tingkat {classroomInfo?.grade_level || '-'}) — Maks. 2
              desimal
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                weightError
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {weightError ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Total: {weightTotal}% / 100%
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={handleSaveWeights}
                disabled={saving || Boolean(weightError)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving ? 'Menyimpan...' : 'Simpan Bobot'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { key: 'weight_formatif', label: 'Formatif (x%)' },
            { key: 'weight_sumatif', label: 'Sumatif (y%)' },
            { key: 'weight_sts', label: 'STS (z%)' },
            { key: 'weight_sas', label: 'SAS (n%)' },
            ...(hasPraktik ? [{ key: 'weight_praktik', label: 'Praktik (m%)' }] : []),
          ].map((item) => {
            const rawStr = weightsInput[item.key as keyof typeof weightsInput];
            const num = parseDecimalInput(rawStr);
            const isInvalidCell =
              rawStr.trim() === '' || num === null || num < 0 || num > 100;
            return (
              <div key={item.key} className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  {item.label}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!canEdit}
                    value={rawStr}
                    onChange={(e) =>
                      setWeightsInput((prev) => ({
                        ...prev,
                        [item.key]: normalizeDecimalInput(e.target.value),
                      }))
                    }
                    className={`w-full pr-7 pl-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${
                      isInvalidCell
                        ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500'
                        : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                    } disabled:bg-slate-100`}
                  />
                  <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-semibold">
                    %
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {weightError && (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {weightError}
          </p>
        )}
      </div>

      {/* Summary Stats & Search */}
      {!loading && computedRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Tuntas KKM</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">
                {stats.passed}{' '}
                <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Belum Tuntas</p>
              <p className="text-lg font-bold text-rose-600 mt-0.5">{stats.failed}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Nilai Belum Lengkap</p>
              <p className="text-lg font-bold text-slate-700 mt-0.5">{stats.incomplete}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Rata-rata Kelas</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{stats.classAvg ?? '-'}</p>
            </div>
          </div>

          {computedRows.length > 5 && (
            <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Cari nama atau NIS siswa..."
                  aria-label="Cari siswa"
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-500 shrink-0">
                Menampilkan {filteredRows.length} dari {computedRows.length} siswa
              </span>
            </div>
          )}
        </>
      )}

      {/* Raport Content: Mobile Cards + Desktop Table */}
      {loading ? (
        <AkademikLoading label="Menghitung rekap nilai raport..." />
      ) : (
        <div className="glass-card rounded-3xl overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {computedRows.length === 0
                ? 'Belum ada siswa terdaftar di kelas ini pada tahun ajaran aktif.'
                : `Tidak ada siswa yang cocok dengan pencarian "${studentSearch}".`}
            </div>
          ) : (
            <>
              {/* Mobile Card View (< md) */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredRows.map((r, idx) => {
                  const isComplete = r.raportScore !== null;
                  const isPassed = isComplete && r.raportScore! >= kkm.minScore;
                  return (
                    <div key={r.student_id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 break-words">
                            {idx + 1}. {r.full_name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            NIS: {r.nis || '-'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold">
                            Raport: {r.raportScore ?? '-'}
                          </div>
                          {!isComplete ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Belum Lengkap
                            </span>
                          ) : isPassed ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Tuntas
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                              Belum Tuntas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                          <span className="text-slate-500">Formatif ({parsedWeights.weight_formatif}%)</span>
                          <strong className="text-slate-800">{r.formatifAvg ?? '-'}</strong>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                          <span className="text-slate-500">Sumatif ({parsedWeights.weight_sumatif}%)</span>
                          <strong className="text-slate-800">{r.sumatifAvg ?? '-'}</strong>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                          <span className="text-slate-500">STS ({parsedWeights.weight_sts}%)</span>
                          <strong className="text-slate-800">{r.stsEffective ?? '-'}</strong>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                          <span className="text-slate-500">SAS ({parsedWeights.weight_sas}%)</span>
                          <strong className="text-slate-800">{r.sasEffective ?? '-'}</strong>
                        </div>
                        {hasPraktik && (
                          <div className="col-span-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                            <span className="text-slate-500">
                              Praktik ({parsedWeights.weight_praktik}%)
                            </span>
                            <strong className="text-slate-800">{r.praktikAvg ?? '-'}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md) with sticky student name */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-bold w-10">No</th>
                      <th className="px-4 py-3 font-bold min-w-[90px]">NIS</th>
                      <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-bold min-w-[200px]">
                        Nama Siswa
                      </th>
                      <th className="px-3 py-3 font-bold text-center">
                        Formatif ({parsedWeights.weight_formatif}%)
                      </th>
                      <th className="px-3 py-3 font-bold text-center">
                        Sumatif ({parsedWeights.weight_sumatif}%)
                      </th>
                      <th className="px-3 py-3 font-bold text-center">
                        STS ({parsedWeights.weight_sts}%)
                      </th>
                      <th className="px-3 py-3 font-bold text-center">
                        SAS ({parsedWeights.weight_sas}%)
                      </th>
                      {hasPraktik && (
                        <th className="px-3 py-3 font-bold text-center">
                          Praktik ({parsedWeights.weight_praktik}%)
                        </th>
                      )}
                      <th className="px-4 py-3 font-bold text-center bg-emerald-50/70 text-emerald-900">
                        Nilai Raport
                      </th>
                      <th className="px-4 py-3 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((r, idx) => {
                      const isComplete = r.raportScore !== null;
                      const isPassed = isComplete && r.raportScore! >= kkm.minScore;
                      return (
                        <tr key={r.student_id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-slate-600 font-mono">
                            {r.nis || '-'}
                          </td>
                          <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold text-slate-900">
                            {r.full_name}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium">
                            {r.formatifAvg ?? '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium">
                            {r.sumatifAvg ?? '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium">
                            {r.stsEffective ?? '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium">
                            {r.sasEffective ?? '-'}
                          </td>
                          {hasPraktik && (
                            <td className="px-3 py-2.5 text-center font-medium">
                              {r.praktikAvg ?? '-'}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                            {r.raportScore ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {!isComplete ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                Belum Lengkap
                              </span>
                            ) : isPassed ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                Tuntas
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                Belum Tuntas
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <PenilaianConfirmModal
        open={Boolean(confirmSwitchClassroomId)}
        title="Bobot Raport Belum Disimpan"
        description="Anda mengubah persentase bobot raport pada tingkat kelas ini dan belum menyimpannya."
        details={[
          'Jika berpindah kelas, perubahan bobot yang belum disimpan akan dibatalkan.',
          'Pilih "Batal" jika ingin menekan "Simpan Bobot" terlebih dahulu.',
        ]}
        variant="warning"
        confirmLabel="Lanjutkan Tanpa Simpan"
        onConfirm={() => {
          if (confirmSwitchClassroomId) {
            setLoading(true);
            setStudentSearch('');
            setSelectedClassroomId(confirmSwitchClassroomId);
          }
          setConfirmSwitchClassroomId(null);
        }}
        onCancel={() => setConfirmSwitchClassroomId(null)}
      />
    </div>
  );
}
