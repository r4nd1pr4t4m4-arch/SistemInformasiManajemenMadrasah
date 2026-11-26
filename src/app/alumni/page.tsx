'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Send,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';

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

export default function PublicAlumniPage() {
  const captcha = useSmartCaptcha(true);
  const [loading, setLoading] = useState(true);
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

  const [form, setForm] = useState({
    full_name: '',
    nisn: '',
    graduation_year: new Date().getFullYear(),
    current_activity: 'KULIAH',
    institution_or_company: '',
    major_or_position: '',
    city: '',
    testimonial: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public/alumni', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.stats) setStats(data.stats);
        setByYear(data.byYear || []);
        setAlumni(data.alumni || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const captchaPayload = await captcha.executeCaptcha();
      const res = await fetch('/api/public/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          graduation_year: Number(form.graduation_year),
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
          graduation_year: new Date().getFullYear(),
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

  const activityBars = [
    { label: 'Kuliah / PT', count: stats.kuliah, color: 'bg-emerald-500' },
    { label: 'Bekerja', count: stats.bekerja, color: 'bg-sky-500' },
    { label: 'Wirausaha', count: stats.wirausaha, color: 'bg-amber-500' },
    { label: 'Pesantren', count: stats.pesantren, color: 'bg-indigo-500' },
    { label: 'Lainnya', count: stats.lainnya, color: 'bg-slate-400' },
  ];

  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <GraduationCap className="w-3.5 h-3.5" /> Portal Alumni &amp; Tracer Study Publik
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Sebaran Lulusan &amp; Tracer Study Alumni
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Data sebaran alumni di perguruan tinggi, dunia kerja, pesantren, dan wirausaha. Alumni dapat mengisi pendataan secara mandiri tanpa perlu login.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                Distribusi Aktivitas Lulusan ({stats.total} Alumni Terdata)
              </h2>
              <div className="space-y-2.5 text-xs">
                {activityBars.map((bar) => {
                  const pct = stats.total > 0 ? Math.round((bar.count / stats.total) * 100) : 0;
                  return (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between font-semibold text-slate-700">
                        <span>{bar.label}</span>
                        <span>
                          {bar.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Sebaran per Angkatan Lulus</h2>
              {byYear.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada data angkatan.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {byYear.map((y) => (
                    <div key={y.year} className="modular-card rounded-2xl p-3 text-center">
                      <p className="text-[11px] text-slate-500 font-semibold">Angkatan {y.year}</p>
                      <p className="text-lg font-black text-emerald-700">{y.count}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Tracer Study Mandiri */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4 text-xs"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">Isi Tracer Study Mandiri</h2>
              <p className="text-slate-500 mt-0.5">
                Bantu lembaga memperbarui data akreditasi &amp; jejaring alumni.
              </p>
            </div>
            {feedback && (
              <div
                className={`p-3.5 rounded-2xl border flex items-center gap-2 ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {feedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nama Lengkap Alumni *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                value={form.nisn}
                onChange={(e) => setForm({ ...form, nisn: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="NISN 10 Digit (Opsional)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
              <input
                type="number"
                required
                value={form.graduation_year}
                onChange={(e) => setForm({ ...form, graduation_year: Number(e.target.value) || 2026 })}
                placeholder="Tahun Lulus *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
              />
              <select
                value={form.current_activity}
                onChange={(e) => setForm({ ...form, current_activity: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="KULIAH">Kuliah / Perguruan Tinggi</option>
                <option value="BEKERJA">Bekerja</option>
                <option value="WIRAUSAHA">Wirausaha</option>
                <option value="PESANTREN">Pesantren / Tahfidz</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
              <input
                value={form.institution_or_company}
                onChange={(e) => setForm({ ...form, institution_or_company: e.target.value })}
                placeholder="Nama Kampus / Perusahaan / Pesantren"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                value={form.major_or_position}
                onChange={(e) => setForm({ ...form, major_or_position: e.target.value })}
                placeholder="Jurusan / Jabatan"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <textarea
                rows={2}
                value={form.testimonial}
                onChange={(e) => setForm({ ...form, testimonial: e.target.value })}
                placeholder="Kesan & pesan untuk adik kelas / lembaga (Opsional)"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim Data Tracer Study
            </button>
          </form>

          <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Jejak Alumni Terbaru</h2>
            {loading ? (
              <p className="text-xs text-slate-500">Memuat data alumni...</p>
            ) : alumni.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada data alumni yang dipublikasikan.</p>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 text-xs">
                {alumni.slice(0, 15).map((a) => (
                  <div key={a.id} className="modular-card rounded-2xl p-3.5 space-y-1 border border-slate-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        {a.full_name} <span className="text-slate-400 font-normal">({a.graduation_year})</span>
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        {a.current_activity}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {[a.institution_or_company, a.major_or_position].filter(Boolean).join(' — ') || '-'}
                    </p>
                    {a.testimonial && (
                      <p className="text-slate-500 italic">&ldquo;{a.testimonial}&rdquo;</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <SmartCaptchaMount containerRef={captcha.containerRef} />
    </PublicShell>
  );
}
