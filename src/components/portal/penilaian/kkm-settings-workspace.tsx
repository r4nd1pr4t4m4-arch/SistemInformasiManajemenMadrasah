'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Save, SlidersHorizontal } from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from '@/components/portal/akademik/akademik-ui';
import type { KkmMode } from '@/lib/domain/penilaian';

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

export function KkmSettingsWorkspace() {
  const { toast, showToast, dismissToast } = useAkademikToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [activeMode, setActiveMode] = useState<KkmMode>('PER_GRADE');
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  // key: `${gradeLevel}::${subjectId || 'ALL'}` -> string
  const [ruleScores, setRuleScores] = useState<Record<string, string>>({});

  const applyKkmData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as { name: string; semester: string } | null);
    setActiveMode((data.activeMode as KkmMode) || 'PER_GRADE');
    setGradeLevels((data.gradeLevels as string[]) || []);
    setSubjects((data.subjects as SubjectItem[]) || []);

    const map: Record<string, string> = {};
    for (const r of (data.rules as KkmRule[]) || []) {
      map[`${r.grade_level}::${r.subject_id || 'ALL'}`] = String(r.min_score);
    }
    setRuleScores(map);
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

  async function handleModeChange(mode: KkmMode) {
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
        `Mode KKM aktif diubah ke ${
          mode === 'PER_GRADE' ? 'Per Tingkat Kelas' : 'Per Mata Pelajaran & Tingkat Kelas'
        }.`
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengubah mode KKM.');
    }
  }

  async function handleSaveRules() {
    setSaving(true);
    try {
      const rules: Array<{ grade_level: string; subject_id: string | null; min_score: number }> = [];
      if (activeMode === 'PER_GRADE') {
        for (const grade of gradeLevels) {
          const val = Number(ruleScores[`${grade}::ALL`] ?? 75);
          if (Number.isNaN(val) || val < 0 || val > 100) {
            throw new Error(`Nilai KKM tingkat ${grade} harus 0–100.`);
          }
          rules.push({ grade_level: grade, subject_id: null, min_score: val });
        }
      } else {
        for (const grade of gradeLevels) {
          for (const sub of subjects) {
            const raw = ruleScores[`${grade}::${sub.id}`];
            if (raw === undefined || raw.trim() === '') continue;
            const val = Number(raw);
            if (Number.isNaN(val) || val < 0 || val > 100) {
              throw new Error(`Nilai KKM ${sub.name} (${grade}) harus 0–100.`);
            }
            rules.push({ grade_level: grade, subject_id: sub.id, min_score: val });
          }
        }
      }

      if (rules.length === 0) {
        showToast('error', 'Tidak ada nilai KKM untuk disimpan.');
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
    <div className="max-w-6xl mx-auto space-y-5">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={error} onRetry={loadKkm} />

      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Kriteria Ketuntasan Minimal (KKM)
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Pengaturan KKM — TA {academicYear?.name} ({academicYear?.semester})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih metode KKM yang aktif diterapkan untuk validasi Formatif, Sumatif, STS, dan SAS.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveRules}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Menyimpan...' : 'Simpan Nilai KKM'}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleModeChange('PER_GRADE')}
          className={`text-left p-5 rounded-3xl border transition ${
            activeMode === 'PER_GRADE'
              ? 'bg-emerald-50/90 border-emerald-400 shadow-sm'
              : 'glass-card border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-bold text-slate-900">KKM Per Tingkat Kelas</span>
            {activeMode === 'PER_GRADE' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Satu nilai KKM seragam untuk seluruh mata pelajaran di tiap tingkat kelas (misal VII = 75, VIII = 78).
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('PER_SUBJECT_GRADE')}
          className={`text-left p-5 rounded-3xl border transition ${
            activeMode === 'PER_SUBJECT_GRADE'
              ? 'bg-emerald-50/90 border-emerald-400 shadow-sm'
              : 'glass-card border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-bold text-slate-900">
              KKM Per Mata Pelajaran & Tingkat Kelas
            </span>
            {activeMode === 'PER_SUBJECT_GRADE' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Nilai KKM dapat diatur spesifik untuk setiap mata pelajaran pada masing-masing tingkat kelas.
          </p>
        </button>
      </div>

      {/* Rules Table */}
      <div className="glass-card rounded-3xl overflow-hidden">
        {gradeLevels.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada rombel/tingkat kelas pada tahun ajaran aktif.
          </div>
        ) : activeMode === 'PER_GRADE' ? (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-bold">Tingkat Kelas</th>
                <th className="px-5 py-3.5 font-bold">Nilai KKM Minimal (0–100)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gradeLevels.map((grade) => {
                const key = `${grade}::ALL`;
                return (
                  <tr key={grade}>
                    <td className="px-5 py-3 font-bold text-slate-800">Tingkat {grade}</td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={ruleScores[key] ?? '75'}
                        onChange={(e) =>
                          setRuleScores((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-32 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-bold min-w-[200px]">Mata Pelajaran</th>
                  {gradeLevels.map((g) => (
                    <th key={g} className="px-4 py-3 font-bold min-w-[120px]">
                      Tingkat {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {sub.name}{' '}
                      <span className="text-[10px] font-mono text-slate-400">({sub.code})</span>
                    </td>
                    {gradeLevels.map((g) => {
                      const key = `${g}::${sub.id}`;
                      return (
                        <td key={g} className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={ruleScores[key] ?? ruleScores[`${g}::ALL`] ?? '75'}
                            onChange={(e) =>
                              setRuleScores((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
