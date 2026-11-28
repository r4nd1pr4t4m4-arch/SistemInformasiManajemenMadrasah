'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from '@/components/portal/akademik/akademik-ui';
import { DEFAULT_KKM_SCORE, type KkmMode } from '@/lib/domain/penilaian';
import { parseDecimalInput } from '@/lib/validation/decimal';
import { DecimalInput } from '@/components/ui/decimal-input';

interface SubjectItem {
  id: string;
  code: string;
  name: string;
  subject_group: string | null;
}

interface KkmRule {
  grade_level: string;
  subject_id: string | null;
  min_score: number;
}

function parseKkmInput(raw: string | undefined): { valid: boolean; value: number | null } {
  const num = parseDecimalInput(raw);
  if (num === null) {
    return { valid: false, value: null };
  }
  if (num < 0 || num > 100) {
    return { valid: false, value: num };
  }
  return { valid: true, value: Math.round(num * 100) / 100 };
}

export function KkmSettingsWorkspace() {
  const { toast, showToast, dismissToast } = useAkademikToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [activeMode, setActiveMode] = useState<KkmMode>('PER_GRADE');
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  // key: `${gradeLevel}::${subjectId || 'ALL'}` -> string
  const [ruleScores, setRuleScores] = useState<Record<string, string>>({});
  const [initialScores, setInitialScores] = useState<Record<string, string>>({});

  // Filter & bulk helper state for PER_SUBJECT_GRADE
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [bulkScore, setBulkScore] = useState('');

  const applyKkmData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as { name: string; semester: string } | null);
    setActiveMode((data.activeMode as KkmMode) || 'PER_GRADE');
    const grades = (data.gradeLevels as string[]) || [];
    const subs = (data.subjects as SubjectItem[]) || [];
    const defaultVal = String((data.defaultScore as number) ?? DEFAULT_KKM_SCORE);
    setGradeLevels(grades);
    setSubjects(subs);

    const rawMap: Record<string, string> = {};
    for (const r of (data.rules as KkmRule[]) || []) {
      rawMap[`${r.grade_level}::${r.subject_id || 'ALL'}`] = String(r.min_score);
    }

    // Populate explicit values for every visible cell so displayed defaults are saved cleanly
    const hydrated: Record<string, string> = { ...rawMap };
    for (const g of grades) {
      const gradeKey = `${g}::ALL`;
      if (hydrated[gradeKey] === undefined) {
        hydrated[gradeKey] = defaultVal;
      }
      for (const s of subs) {
        const subKey = `${g}::${s.id}`;
        if (hydrated[subKey] === undefined) {
          hydrated[subKey] = hydrated[gradeKey] ?? defaultVal;
        }
      }
    }

    setRuleScores(hydrated);
    setInitialScores(hydrated);
  }, []);

  const loadKkm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/akademik/kkm');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat pengaturan KKM.');
      applyKkmData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [applyKkmData]);

  useEffect(() => {
    let active = true;
    fetch('/api/akademik/kkm')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat pengaturan KKM.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError(null);
        applyKkmData(data);
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
  }, [applyKkmData]);

  const subjectGroups = useMemo(() => {
    const groups = Array.from(
      new Set(subjects.map((s) => (s.subject_group || 'Umum').trim()).filter(Boolean))
    ).sort();
    return groups;
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter((sub) => {
      const grp = (sub.subject_group || 'Umum').trim();
      if (selectedGroup !== 'ALL' && grp !== selectedGroup) return false;
      if (!q) return true;
      return sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q);
    });
  }, [subjects, searchQuery, selectedGroup]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (activeMode === 'PER_GRADE') {
      for (const grade of gradeLevels) {
        const { valid } = parseKkmInput(ruleScores[`${grade}::ALL`]);
        if (!valid) {
          issues.push(`Tingkat ${grade}: nilai KKM harus antara 0–100.`);
        }
      }
    } else {
      for (const grade of gradeLevels) {
        for (const sub of subjects) {
          const { valid } = parseKkmInput(ruleScores[`${grade}::${sub.id}`]);
          if (!valid) {
            issues.push(`${sub.name} (Tingkat ${grade}): nilai KKM harus antara 0–100.`);
          }
        }
      }
    }
    return issues;
  }, [activeMode, gradeLevels, subjects, ruleScores]);

  const hasUnsavedChanges = useMemo(() => {
    if (activeMode === 'PER_GRADE') {
      return gradeLevels.some(
        (g) => (ruleScores[`${g}::ALL`] ?? '') !== (initialScores[`${g}::ALL`] ?? '')
      );
    }
    return gradeLevels.some((g) =>
      subjects.some(
        (s) => (ruleScores[`${g}::${s.id}`] ?? '') !== (initialScores[`${g}::${s.id}`] ?? '')
      )
    );
  }, [activeMode, gradeLevels, subjects, ruleScores, initialScores]);

  async function handleModeChange(mode: KkmMode) {
    if (mode === activeMode || switchingMode) return;
    const previousMode = activeMode;
    setSwitchingMode(true);
    setActiveMode(mode);
    try {
      const res = await fetch('/api/akademik/kkm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_MODE', active_mode: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah mode KKM.');
      showToast(
        'success',
        `Mode KKM aktif diubah ke ${mode === 'PER_GRADE' ? 'Per Tingkat Kelas' : 'Per Mata Pelajaran & Tingkat Kelas'
        }.`
      );
    } catch (err) {
      setActiveMode(previousMode);
      showToast('error', err instanceof Error ? err.message : 'Gagal mengubah mode KKM.');
    } finally {
      setSwitchingMode(false);
    }
  }

  function handleApplyBulk() {
    const parsed = parseKkmInput(bulkScore);
    if (!parsed.valid || parsed.value === null) {
      showToast('error', 'Masukkan nilai KKM massal yang valid (0–100).');
      return;
    }
    const strVal = String(parsed.value);
    setRuleScores((prev) => {
      const next = { ...prev };
      for (const grade of gradeLevels) {
        if (activeMode === 'PER_GRADE') {
          next[`${grade}::ALL`] = strVal;
        } else {
          for (const sub of filteredSubjects) {
            next[`${grade}::${sub.id}`] = strVal;
          }
        }
      }
      return next;
    });
    showToast(
      'success',
      `Nilai ${strVal} diterapkan ke ${activeMode === 'PER_GRADE'
        ? `${gradeLevels.length} tingkat kelas`
        : `${filteredSubjects.length} mata pelajaran`
      }. Klik "Simpan Nilai KKM" untuk menyimpan.`
    );
  }

  async function handleSaveRules() {
    if (validationIssues.length > 0) {
      showToast('error', validationIssues[0]);
      return;
    }

    setSaving(true);
    try {
      const rules: Array<{ grade_level: string; subject_id: string | null; min_score: number }> = [];
      if (activeMode === 'PER_GRADE') {
        for (const grade of gradeLevels) {
          const parsed = parseKkmInput(ruleScores[`${grade}::ALL`]);
          if (!parsed.valid || parsed.value === null) {
            throw new Error(`Nilai KKM tingkat ${grade} harus 0–100.`);
          }
          rules.push({ grade_level: grade, subject_id: null, min_score: parsed.value });
        }
      } else {
        for (const grade of gradeLevels) {
          for (const sub of subjects) {
            const parsed = parseKkmInput(ruleScores[`${grade}::${sub.id}`]);
            if (!parsed.valid || parsed.value === null) {
              throw new Error(`Nilai KKM ${sub.name} (${grade}) harus 0–100.`);
            }
            rules.push({ grade_level: grade, subject_id: sub.id, min_score: parsed.value });
          }
        }
      }

      if (rules.length === 0) {
        showToast('error', 'Tidak ada tingkat kelas atau mata pelajaran untuk disimpan.');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/akademik/kkm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPSERT_RULES', rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan KKM.');
      showToast('success', 'Pengaturan nilai KKM berhasil disimpan.');
      await loadKkm();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan KKM.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AkademikLoading label="Memuat pengaturan KKM..." />;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={error} onRetry={loadKkm} />

      {/* Header Card */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Kriteria Ketuntasan Minimal
            </span>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Perubahan belum disimpan
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words">
            Pengaturan KKM — TA {academicYear?.name || '-'} ({academicYear?.semester || '-'})
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pilih metode KKM yang aktif diterapkan untuk validasi nilai Formatif, Sumatif, STS, dan SAS.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveRules}
          disabled={saving || gradeLevels.length === 0 || validationIssues.length > 0}
          className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? 'Menyimpan...' : 'Simpan Nilai KKM'}</span>
        </button>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" role="radiogroup" aria-label="Mode KKM Aktif">
        <button
          type="button"
          role="radio"
          aria-checked={activeMode === 'PER_GRADE'}
          disabled={switchingMode}
          onClick={() => handleModeChange('PER_GRADE')}
          className={`text-left p-4 sm:p-5 rounded-3xl border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70 ${activeMode === 'PER_GRADE'
              ? 'bg-emerald-50/95 border-emerald-400 shadow-sm'
              : 'glass-card border-slate-200 hover:border-emerald-300'
            }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-bold text-slate-900">KKM Per Tingkat Kelas</span>
            {activeMode === 'PER_GRADE' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Satu nilai KKM seragam untuk seluruh mata pelajaran di tiap tingkat kelas (misal VII = 75, VIII = 78).
          </p>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={activeMode === 'PER_SUBJECT_GRADE'}
          disabled={switchingMode}
          onClick={() => handleModeChange('PER_SUBJECT_GRADE')}
          className={`text-left p-4 sm:p-5 rounded-3xl border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70 ${activeMode === 'PER_SUBJECT_GRADE'
              ? 'bg-emerald-50/95 border-emerald-400 shadow-sm'
              : 'glass-card border-slate-200 hover:border-emerald-300'
            }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-bold text-slate-900">
              KKM Per Mata Pelajaran &amp; Tingkat Kelas
            </span>
            {activeMode === 'PER_SUBJECT_GRADE' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Nilai KKM dapat diatur spesifik untuk setiap mata pelajaran pada masing-masing tingkat kelas.
          </p>
        </button>
      </div>

      {/* Validation Banner */}
      {validationIssues.length > 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold">Terdapat {validationIssues.length} input KKM tidak valid:</p>
            <p className="break-words">{validationIssues[0]}</p>
          </div>
        </div>
      )}

      {/* Filter & Bulk Apply Toolbar */}
      {gradeLevels.length > 0 && (
        <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {activeMode === 'PER_SUBJECT_GRADE' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau kode mapel..."
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
              {subjectGroups.length > 1 && (
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  aria-label="Filter kelompok mata pelajaran"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Kelompok ({subjects.length})</option>
                  {subjectGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-600">
              Menampilkan {gradeLevels.length} tingkat kelas pada tahun ajaran aktif.
            </p>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <DecimalInput
              maxDecimals={2}
              value={bulkScore}
              onValueChange={setBulkScore}
              placeholder="Nilai massal (0–100)"
              aria-label="Nilai KKM massal"
              className="w-36 sm:w-40 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleApplyBulk}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Terapkan</span>
            </button>
          </div>
        </div>
      )}

      {/* Rules Content */}
      <div className="glass-card rounded-3xl overflow-hidden">
        {gradeLevels.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada rombel/tingkat kelas pada tahun ajaran aktif. Tambahkan rombel terlebih dahulu di menu Kelas &amp; Jadwal.
          </div>
        ) : activeMode === 'PER_GRADE' ? (
          <div className="divide-y divide-slate-100">
            <div className="hidden sm:grid sm:grid-cols-2 bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-bold px-5 py-3.5">
              <span>Tingkat Kelas</span>
              <span>Nilai KKM Minimal (0–100)</span>
            </div>
            {gradeLevels.map((grade) => {
              const key = `${grade}::ALL`;
              const val = ruleScores[key] ?? '';
              const { valid } = parseKkmInput(val);
              return (
                <div
                  key={grade}
                  className="px-4 sm:px-5 py-3.5 flex flex-col sm:grid sm:grid-cols-2 sm:items-center gap-2 hover:bg-slate-50/70"
                >
                  <span className="text-xs font-bold text-slate-800">Tingkat {grade}</span>
                  <div className="flex items-center gap-2">
                    <DecimalInput
                      maxDecimals={2}
                      value={val}
                      aria-label={`Nilai KKM Tingkat ${grade}`}
                      onValueChange={(next) =>
                        setRuleScores((prev) => ({ ...prev, [key]: next }))
                      }
                      className={`w-full sm:w-36 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${valid
                          ? 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                          : 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500'
                        }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada mata pelajaran terdaftar. Tambahkan mata pelajaran di menu Kelas &amp; Jadwal.
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Tidak ada mata pelajaran yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (no horizontal overflow) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredSubjects.map((sub) => (
                <div key={sub.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 break-words">{sub.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {sub.code} {sub.subject_group ? `• ${sub.subject_group}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {gradeLevels.map((g) => {
                      const key = `${g}::${sub.id}`;
                      const val = ruleScores[key] ?? '';
                      const { valid } = parseKkmInput(val);
                      return (
                        <div key={g} className="space-y-1">
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Tingkat {g}
                          </label>
                          <DecimalInput
                            maxDecimals={2}
                            value={val}
                            aria-label={`KKM ${sub.name} Tingkat ${g}`}
                            onValueChange={(next) =>
                              setRuleScores((prev) => ({ ...prev, [key]: next }))
                            }
                            className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${valid
                                ? 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                : 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500'
                              }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout with sticky subject column */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-bold min-w-[220px]">
                      Mata Pelajaran
                    </th>
                    {gradeLevels.map((g) => (
                      <th key={g} className="px-4 py-3 font-bold min-w-[120px]">
                        Tingkat {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/70">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold text-slate-900">
                        <div className="leading-snug">{sub.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {sub.code} {sub.subject_group ? `• ${sub.subject_group}` : ''}
                        </div>
                      </td>
                      {gradeLevels.map((g) => {
                        const key = `${g}::${sub.id}`;
                        const val = ruleScores[key] ?? '';
                        const { valid } = parseKkmInput(val);
                        return (
                          <td key={g} className="px-4 py-2">
                            <DecimalInput
                              maxDecimals={2}
                              value={val}
                              aria-label={`KKM ${sub.name} Tingkat ${g}`}
                              onValueChange={(next) =>
                                setRuleScores((prev) => ({ ...prev, [key]: next }))
                              }
                              className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${valid
                                  ? 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                  : 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
