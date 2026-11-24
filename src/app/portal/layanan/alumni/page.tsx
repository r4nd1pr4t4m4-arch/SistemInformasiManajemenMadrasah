'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';

interface AlumniRow {
  id: string;
  full_name: string;
  graduation_year: number;
  current_activity: string;
  institution_or_company: string | null;
  major_or_position: string | null;
  city?: string | null;
  testimonial?: string | null;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type AlumniActivity =
  | 'KULIAH'
  | 'BEKERJA'
  | 'WIRAUSAHA'
  | 'PESANTREN'
  | 'MENCARI_KERJA'
  | 'LAINNYA';

const ACTIVITY_LABELS: Record<AlumniActivity, string> = {
  KULIAH: 'Kuliah',
  BEKERJA: 'Bekerja',
  WIRAUSAHA: 'Wirausaha',
  PESANTREN: 'Pesantren',
  MENCARI_KERJA: 'Mencari Kerja',
  LAINNYA: 'Lainnya',
};

export default function AlumniPage() {
  const { hasPermission } = usePortalSession();
  const canSubmit = hasPermission(PERMISSIONS.ALUMNI_SUBMIT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [alumni, setAlumni] = useState<AlumniRow[]>([]);
  const [alumniSearch, setAlumniSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | AlumniActivity>('ALL');

  const [alumniForm, setAlumniForm] = useState(() => ({
    full_name: '',
    graduation_year: new Date().getFullYear(),
    current_activity: 'KULIAH' as AlumniActivity,
    institution_or_company: '',
    major_or_position: '',
    city: '',
    testimonial: '',
  }));

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const fetchAlumniData = useCallback(async () => {
    const res = await fetch('/api/layanan/alumni', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error || 'Gagal memuat data tracer study alumni dari server.');
    }
    return (data.alumni || []) as AlumniRow[];
  }, []);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const list = await fetchAlumniData();
        setAlumni(list);
        setLoadError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data alumni.';
        if (mode === 'initial') {
          setLoadError(message);
        } else {
          showToast(message, 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchAlumniData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAlumniData();
        if (!cancelled) {
          setAlumni(list);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data alumni.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAlumniData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    const fullName = alumniForm.full_name.trim();
    if (fullName.length < 2) {
      showToast('Nama lengkap alumni minimal 2 karakter.', 'error');
      return;
    }
    if (
      !Number.isInteger(alumniForm.graduation_year) ||
      alumniForm.graduation_year < 1980 ||
      alumniForm.graduation_year > 2100
    ) {
      showToast('Tahun kelulusan harus antara 1980 sampai 2100.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/layanan/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          graduation_year: alumniForm.graduation_year,
          current_activity: alumniForm.current_activity,
          institution_or_company: alumniForm.institution_or_company.trim() || null,
          major_or_position: alumniForm.major_or_position.trim() || null,
          city: alumniForm.city.trim() || null,
          testimonial: alumniForm.testimonial.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyimpan data alumni.', 'error');
        return;
      }
      showToast('Data tracer study alumni berhasil disimpan.', 'success');
      setAlumniForm((prev) => ({
        ...prev,
        full_name: '',
        institution_or_company: '',
        major_or_position: '',
        city: '',
        testimonial: '',
      }));
      await loadData('refresh');
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const alumniSummary = useMemo(() => {
    let kuliah = 0;
    let bekerja = 0;
    for (const a of alumni) {
      if (a.current_activity === 'KULIAH') kuliah += 1;
      else if (a.current_activity === 'BEKERJA') bekerja += 1;
    }
    return { kuliah, bekerja };
  }, [alumni]);

  const filteredAlumni = useMemo(() => {
    const q = alumniSearch.trim().toLowerCase();
    return alumni.filter((a) => {
      if (activityFilter !== 'ALL' && a.current_activity !== activityFilter) return false;
      if (q) {
        const haystack = `${a.full_name} ${a.graduation_year} ${a.institution_or_company || ''} ${
          a.major_or_position || ''
        } ${a.city || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activityFilter, alumni, alumniSearch]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat Tracer Study Alumni...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Tracer Study Alumni</h1>
          <p className="text-xs text-slate-500">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData('refresh')}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Tracer Study &amp; Sebaran Alumni</span>
            </h1>
            {!canSubmit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Pantau dan perbarui data aktivitas lulusan di perguruan tinggi, dunia kerja, pesantren,
            maupun wirausaha.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Kuliah: </span>
            <span className="font-bold text-emerald-800">{alumniSummary.kuliah}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px]">
            <span className="text-slate-500">Bekerja: </span>
            <span className="font-bold text-sky-800">{alumniSummary.bekerja}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData('refresh')}
            disabled={refreshing || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang data alumni"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {canSubmit && (
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-3.5"
          >
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900">Input Tracer Study Alumni</h2>
              <p className="text-[11px] text-slate-500">
                Catat data kelulusan dan aktivitas terkini alumni.
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="alumni-full-name"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Nama Lengkap Alumni
              </label>
              <input
                id="alumni-full-name"
                required
                minLength={2}
                disabled={submitting}
                placeholder="Nama Lengkap Alumni"
                value={alumniForm.full_name}
                onChange={(e) => setAlumniForm({ ...alumniForm, full_name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="alumni-grad-year"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Tahun Lulus
                </label>
                <input
                  id="alumni-grad-year"
                  type="number"
                  min={1980}
                  max={2100}
                  required
                  disabled={submitting}
                  value={alumniForm.graduation_year}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAlumniForm({
                      ...alumniForm,
                      graduation_year: Number.isFinite(val) ? val : new Date().getFullYear(),
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="alumni-activity"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Aktivitas Saat Ini
                </label>
                <select
                  id="alumni-activity"
                  disabled={submitting}
                  value={alumniForm.current_activity}
                  onChange={(e) =>
                    setAlumniForm({
                      ...alumniForm,
                      current_activity: e.target.value as AlumniActivity,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="alumni-institution"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Kampus / Perusahaan / Instansi (Opsional)
              </label>
              <input
                id="alumni-institution"
                disabled={submitting}
                placeholder="Kampus / Perusahaan / Instansi"
                value={alumniForm.institution_or_company}
                onChange={(e) =>
                  setAlumniForm({ ...alumniForm, institution_or_company: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="alumni-major"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Jurusan / Jabatan (Opsional)
                </label>
                <input
                  id="alumni-major"
                  disabled={submitting}
                  placeholder="Jurusan / Jabatan"
                  value={alumniForm.major_or_position}
                  onChange={(e) =>
                    setAlumniForm({ ...alumniForm, major_or_position: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="alumni-city"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Kota Domisili (Opsional)
                </label>
                <input
                  id="alumni-city"
                  disabled={submitting}
                  placeholder="mis. Surabaya"
                  value={alumniForm.city}
                  onChange={(e) => setAlumniForm({ ...alumniForm, city: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="alumni-testimonial"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Testimoni / Pesan Singkat (Opsional)
              </label>
              <textarea
                id="alumni-testimonial"
                rows={2}
                disabled={submitting}
                placeholder="Pesan atau kesan untuk almamater"
                value={alumniForm.testimonial}
                onChange={(e) => setAlumniForm({ ...alumniForm, testimonial: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan Data Alumni</span>
            </button>
          </form>
        )}

        <div
          className={`${
            canSubmit ? 'lg:col-span-7' : 'lg:col-span-12'
          } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Sebaran Alumni ({filteredAlumni.length})
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActivityFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  activityFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semua
              </button>
              {(Object.entries(ACTIVITY_LABELS) as Array<[AlumniActivity, string]>).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivityFilter(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      activityFilter === key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="relative">
            <label htmlFor="alumni-search" className="sr-only">
              Cari data alumni
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="alumni-search"
              type="search"
              value={alumniSearch}
              onChange={(e) => setAlumniSearch(e.target.value)}
              placeholder="Cari nama alumni, angkatan, kampus/perusahaan, atau kota..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredAlumni.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {alumni.length === 0
                  ? 'Belum ada data tracer study alumni.'
                  : 'Tidak ada data alumni yang cocok dengan filter pencarian.'}
              </p>
              {(alumniSearch || activityFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setAlumniSearch('');
                    setActivityFilter('ALL');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[36rem] overflow-y-auto pr-0.5">
              {filteredAlumni.map((a) => {
                const activityLabel =
                  a.current_activity in ACTIVITY_LABELS
                    ? ACTIVITY_LABELS[a.current_activity as AlumniActivity]
                    : a.current_activity;
                return (
                  <div
                    key={a.id}
                    className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">
                        {a.full_name}{' '}
                        <span className="font-medium text-slate-500">
                          (Angkatan {a.graduation_year})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {a.institution_or_company || '-'} • {a.major_or_position || '-'}
                        {a.city ? ` • ${a.city}` : ''}
                      </p>
                      {a.testimonial && (
                        <p className="text-[11px] italic text-slate-600 break-words pt-0.5">
                          &ldquo;{a.testimonial}&rdquo;
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 self-start px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-semibold text-[11px]">
                      {activityLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
