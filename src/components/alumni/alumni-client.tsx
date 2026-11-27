'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MapPin,
  Search,
  Send,
  X,
} from 'lucide-react';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';
import { EmptyState, ErrorState } from '@/components/ui/state-views';

interface AlumniPublicRow {
  id: string;
  full_name: string;
  graduation_year: number;
  current_activity: string;
  institution_or_company: string | null;
  major_or_position: string | null;
  city: string | null;
  testimonial: string | null;
}

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100';

const ALUMNI_PAGE_SIZE = 15;

export function AlumniClient() {
  const captcha = useSmartCaptcha(true);
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    kuliah: 0,
    bekerja: 0,
    wirausaha: 0,
    pesantren: 0,
    lainnya: 0,
  });
  const [byYear, setByYear] = useState<Array<{ year: number; count: number }>>([]);
  const [alumni, setAlumni] = useState<AlumniPublicRow[]>([]);

  const [alumniSearch, setAlumniSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(ALUMNI_PAGE_SIZE);

  const [form, setForm] = useState({
    full_name: '',
    nisn: '',
    graduation_year: String(currentYear),
    current_activity: 'KULIAH',
    institution_or_company: '',
    major_or_position: '',
    city: '',
    testimonial: '',
  });

  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/public/alumni', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Gagal memuat data sebaran alumni.');
      }
      if (data.stats) setStats(data.stats);
      setByYear(Array.isArray(data.byYear) ? data.byYear : []);
      setAlumni(Array.isArray(data.alumni) ? data.alumni : []);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setFetchError(
        err instanceof Error ? err.message : 'Tidak dapat terhubung ke server Tracer Study.'
      );
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);

    const trimmedName = form.full_name.trim();
    const parsedYear = Number.parseInt(form.graduation_year, 10);
    if (trimmedName.length < 2) {
      setFeedback({ type: 'err', text: 'Nama lengkap alumni minimal 2 karakter.' });
      return;
    }
    if (!Number.isInteger(parsedYear) || parsedYear < 1980 || parsedYear > currentYear + 1) {
      setFeedback({
        type: 'err',
        text: `Tahun lulus harus di antara 1980 hingga ${currentYear + 1}.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const captchaPayload = await captcha.executeCaptcha();
      const res = await fetch('/api/public/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          full_name: trimmedName,
          graduation_year: parsedYear,
          captcha: captchaPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.turnstileUnavailable) captcha.forceLocalFallback();
        setFeedback({ type: 'err', text: data.error || 'Gagal mengirim Tracer Study.' });
      } else {
        setFeedback({ type: 'ok', text: data.message || 'Data Tracer Study berhasil disimpan!' });
        setForm({
          full_name: '',
          nisn: '',
          graduation_year: String(currentYear),
          current_activity: 'KULIAH',
          institution_or_company: '',
          major_or_position: '',
          city: '',
          testimonial: '',
        });
        await loadData();
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal terhubung ke server.' });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAlumni = useMemo(() => {
    const q = alumniSearch.trim().toLowerCase();
    return alumni.filter((a) => {
      if (activityFilter !== 'ALL' && a.current_activity !== activityFilter) return false;
      if (!q) return true;
      return (
        (a.full_name || '').toLowerCase().includes(q) ||
        (a.institution_or_company || '').toLowerCase().includes(q) ||
        (a.major_or_position || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q) ||
        String(a.graduation_year || '').includes(q)
      );
    });
  }, [alumni, alumniSearch, activityFilter]);

  const displayedAlumni = filteredAlumni.slice(0, visibleCount);
  const hasMoreAlumni = visibleCount < filteredAlumni.length;

  const activityBars = [
    { label: 'Kuliah / PT', count: stats.kuliah, color: 'bg-emerald-500' },
    { label: 'Bekerja', count: stats.bekerja, color: 'bg-sky-500' },
    { label: 'Wirausaha', count: stats.wirausaha, color: 'bg-amber-500' },
    { label: 'Pesantren', count: stats.pesantren, color: 'bg-indigo-500' },
    { label: 'Lainnya', count: stats.lainnya, color: 'bg-slate-400' },
  ];

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" /> Portal Alumni &amp; Tracer Study
            Publik
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 [overflow-wrap:anywhere]">
            Sebaran Lulusan &amp; Tracer Study Alumni
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Data sebaran alumni di perguruan tinggi, dunia kerja, pesantren, dan wirausaha. Alumni
            dapat mengisi pendataan secara mandiri tanpa perlu login.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3 min-w-0">
            <h2 className="text-sm font-bold text-slate-900">
              Distribusi Aktivitas Lulusan ({stats.total.toLocaleString('id-ID')} Alumni Terdata)
            </h2>
            <div className="space-y-2.5 text-xs">
              {activityBars.map((bar) => {
                const pct = stats.total > 0 ? Math.round((bar.count / stats.total) * 100) : 0;
                return (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex justify-between font-semibold text-slate-700 tabular-nums">
                      <span>{bar.label}</span>
                      <span>
                        {bar.count.toLocaleString('id-ID')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${bar.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Sebaran per Angkatan Lulus</h2>
            {byYear.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada data angkatan.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {byYear.map((y) => (
                  <div key={y.year} className="modular-card rounded-2xl p-3 text-center">
                    <p className="text-[11px] text-slate-500 font-semibold">Angkatan {y.year}</p>
                    <p className="text-lg font-black text-emerald-700 tabular-nums">
                      {y.count.toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Tracer Study Mandiri & Daftar Alumni */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-4"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900">Isi Tracer Study Mandiri</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bantu lembaga memperbarui data akreditasi &amp; jejaring alumni.
            </p>
          </div>
          {feedback && (
            <div
              role={feedback.type === 'err' ? 'alert' : 'status'}
              aria-live="polite"
              className={`p-3.5 rounded-2xl border flex items-start gap-2 text-xs ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed [overflow-wrap:anywhere]">{feedback.text}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label htmlFor="alumni-name" className="block text-xs font-semibold text-slate-700">
                Nama Lengkap Alumni <span className="text-rose-600">*</span>
              </label>
              <input
                id="alumni-name"
                required
                disabled={submitting}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nama lengkap"
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="alumni-nisn" className="block text-xs font-semibold text-slate-700">
                NISN 10 Digit (Opsional)
              </label>
              <input
                id="alumni-nisn"
                inputMode="numeric"
                disabled={submitting}
                value={form.nisn}
                onChange={(e) =>
                  setForm({ ...form, nisn: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                placeholder="0012345678"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="alumni-year" className="block text-xs font-semibold text-slate-700">
                Tahun Lulus <span className="text-rose-600">*</span>
              </label>
              <input
                id="alumni-year"
                type="number"
                inputMode="numeric"
                min={1980}
                max={currentYear + 1}
                required
                disabled={submitting}
                value={form.graduation_year}
                onChange={(e) => setForm({ ...form, graduation_year: e.target.value })}
                placeholder={String(currentYear)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="alumni-activity"
                className="block text-xs font-semibold text-slate-700"
              >
                Aktivitas Saat Ini <span className="text-rose-600">*</span>
              </label>
              <select
                id="alumni-activity"
                disabled={submitting}
                value={form.current_activity}
                onChange={(e) => setForm({ ...form, current_activity: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="KULIAH">Kuliah / Perguruan Tinggi</option>
                <option value="BEKERJA">Bekerja</option>
                <option value="WIRAUSAHA">Wirausaha</option>
                <option value="PESANTREN">Pesantren / Tahfidz</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="alumni-inst" className="block text-xs font-semibold text-slate-700">
                Kampus / Perusahaan / Pesantren
              </label>
              <input
                id="alumni-inst"
                disabled={submitting}
                value={form.institution_or_company}
                onChange={(e) => setForm({ ...form, institution_or_company: e.target.value })}
                placeholder="Nama institusi atau usaha"
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="alumni-major" className="block text-xs font-semibold text-slate-700">
                Jurusan / Jabatan
              </label>
              <input
                id="alumni-major"
                disabled={submitting}
                value={form.major_or_position}
                onChange={(e) => setForm({ ...form, major_or_position: e.target.value })}
                placeholder="Prodi / posisi kerja"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="alumni-city" className="block text-xs font-semibold text-slate-700">
                Kota / Kabupaten Domisili (Opsional)
              </label>
              <input
                id="alumni-city"
                disabled={submitting}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="cth: Bandung, Jakarta, Yogyakarta"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="alumni-testimonial"
                className="block text-xs font-semibold text-slate-700"
              >
                Kesan &amp; Pesan (Opsional)
              </label>
              <textarea
                id="alumni-testimonial"
                rows={2}
                disabled={submitting}
                value={form.testimonial}
                onChange={(e) => setForm({ ...form, testimonial: e.target.value })}
                placeholder="Kesan & pesan untuk adik kelas / lembaga"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>
          </div>
          <button
            type="submit"
            aria-busy={submitting || undefined}
            disabled={submitting}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-xs"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Send className="w-4 h-4 shrink-0" />
            )}
            <span>{submitting ? 'Menyimpan...' : 'Kirim Data Tracer Study'}</span>
          </button>
        </form>

        <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Jejak Alumni Terbaru</h2>
            {!loading && !fetchError && (
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {displayedAlumni.length}/{filteredAlumni.length} alumni
              </span>
            )}
          </div>

          {alumni.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={alumniSearch}
                  onChange={(e) => {
                    setAlumniSearch(e.target.value);
                    setVisibleCount(ALUMNI_PAGE_SIZE);
                  }}
                  placeholder="Cari nama, kampus, angkatan..."
                  aria-label="Cari data alumni"
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white pl-9 pr-9 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {alumniSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setAlumniSearch('');
                      setVisibleCount(ALUMNI_PAGE_SIZE);
                    }}
                    aria-label="Hapus pencarian alumni"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={activityFilter}
                onChange={(e) => {
                  setActivityFilter(e.target.value);
                  setVisibleCount(ALUMNI_PAGE_SIZE);
                }}
                aria-label="Filter aktivitas alumni"
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="ALL">Semua Aktivitas</option>
                <option value="KULIAH">Kuliah</option>
                <option value="BEKERJA">Bekerja</option>
                <option value="WIRAUSAHA">Wirausaha</option>
                <option value="PESANTREN">Pesantren</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
          )}

          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memuat data alumni...</span>
            </div>
          ) : fetchError ? (
            <ErrorState
              compact
              title="Gagal Memuat Data Alumni"
              message={fetchError}
              onRetry={() => void loadData()}
            />
          ) : alumni.length === 0 ? (
            <EmptyState
              compact
              title="Belum Ada Data Alumni"
              description="Jadilah yang pertama mengisi formulir Tracer Study di samping."
            />
          ) : filteredAlumni.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-600">
                Tidak ada alumni yang cocok dengan pencarian atau filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAlumniSearch('');
                  setActivityFilter('ALL');
                  setVisibleCount(ALUMNI_PAGE_SIZE);
                }}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto overscroll-contain pr-1 text-xs">
              {displayedAlumni.map((a) => (
                <article
                  key={a.id}
                  className="modular-card rounded-2xl p-3.5 space-y-1.5 border border-slate-200/80 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">
                      {a.full_name}{' '}
                      <span className="text-slate-400 font-normal">({a.graduation_year})</span>
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold text-[10px] shrink-0">
                      {a.current_activity}
                    </span>
                  </div>
                  <p className="text-slate-600 [overflow-wrap:anywhere]">
                    {[a.institution_or_company, a.major_or_position].filter(Boolean).join(' — ') ||
                      '-'}
                  </p>
                  {a.city && (
                    <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{a.city}</span>
                    </p>
                  )}
                  {a.testimonial && (
                    <p className="text-slate-500 italic leading-relaxed [overflow-wrap:anywhere]">
                      &ldquo;{a.testimonial}&rdquo;
                    </p>
                  )}
                </article>
              ))}

              {hasMoreAlumni && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + ALUMNI_PAGE_SIZE)}
                  className="w-full min-h-[40px] py-2 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50/60 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                >
                  Tampilkan Lebih Banyak ({filteredAlumni.length - displayedAlumni.length} tersisa)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <SmartCaptchaMount containerRef={captcha.containerRef} />
    </div>
  );
}
