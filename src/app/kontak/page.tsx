'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function KontakPage() {
  const school = useInstitutionSettings();
  const captcha = useSmartCaptcha(true);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [faqRetryTick, setFaqRetryTick] = useState(0);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const [form, setForm] = useState({
    senderName: '',
    senderEmail: '',
    senderPhone: '',
    category: 'ASPIRASI' as 'ASPIRASI' | 'PENGADUAN' | 'INFORMASI',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/public/faqs', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Gagal memuat daftar pertanyaan umum.');
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data?.faqs) ? (data.faqs as FaqItem[]) : [];
        setFaqs(list);
        setFaqError(null);
        if (list.length > 0) {
          setOpenFaqId((prev) => prev ?? list[0].id);
        }
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setFaqError('Tidak dapat memuat FAQ saat ini.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingFaqs(false);
      });

    return () => controller.abort();
  }, [faqRetryTick]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(false);
    setError(null);

    const trimmedName = form.senderName.trim();
    const trimmedEmail = form.senderEmail.trim();
    const trimmedPhone = form.senderPhone.trim();
    const trimmedSubject = form.subject.trim();
    const trimmedMessage = form.message.trim();

    if (trimmedName.length < 2) {
      setError('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Format alamat email tidak valid.');
      return;
    }
    if (trimmedSubject.length < 3) {
      setError('Subjek pesan minimal 3 karakter.');
      return;
    }
    if (trimmedMessage.length < 5) {
      setError('Isi pesan minimal 5 karakter.');
      return;
    }

    setSending(true);
    try {
      const captchaPayload = await captcha.executeCaptcha();
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: trimmedName,
          senderEmail: trimmedEmail,
          senderPhone: trimmedPhone,
          category: form.category,
          subject: trimmedSubject,
          message: trimmedMessage,
          captcha: captchaPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.turnstileUnavailable) {
          captcha.forceLocalFallback();
        }
        setError(data.error || 'Gagal mengirim pesan.');
      } else {
        setSent(true);
        setForm({
          senderName: '',
          senderEmail: '',
          senderPhone: '',
          category: 'ASPIRASI',
          subject: '',
          message: '',
        });
      }
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setSending(false);
    }
  }

  const socialLinks = [
    { label: 'Facebook', url: school.social_links?.facebook },
    { label: 'Instagram', url: school.social_links?.instagram },
    { label: 'YouTube', url: school.social_links?.youtube },
  ].filter((item) => isSafeHttpUrl(item.url));

  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Pengaduan / Aspirasi */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-7 space-y-5 min-w-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Pengaduan &amp; Aspirasi</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                Sampaikan pertanyaan, saran, atau pengaduan layanan secara langsung ke tim Humas
                &amp; Tata Usaha.
              </p>
            </div>

            {sent && (
              <div
                role="status"
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start justify-between gap-2.5"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                  <span className="leading-relaxed">
                    Pesan Anda telah tersimpan di database dan akan segera ditindaklanjuti.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  aria-label="Tutup notifikasi sukses"
                  className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="kontak-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Nama Lengkap <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="kontak-name"
                    required
                    type="text"
                    value={form.senderName}
                    onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                    placeholder="Nama Anda"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="kontak-category"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Kategori Layanan <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="kontak-category"
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as 'ASPIRASI' | 'PENGADUAN' | 'INFORMASI',
                      })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="ASPIRASI">Aspirasi / Saran</option>
                    <option value="PENGADUAN">Pengaduan Layanan</option>
                    <option value="INFORMASI">Permintaan Informasi</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="kontak-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email (Opsional)
                  </label>
                  <input
                    id="kontak-email"
                    type="email"
                    value={form.senderEmail}
                    onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                    placeholder="nama@email.com"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="kontak-phone"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    id="kontak-phone"
                    type="tel"
                    inputMode="tel"
                    value={form.senderPhone}
                    onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="kontak-subject"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Subjek <span className="text-rose-600">*</span>
                </label>
                <input
                  id="kontak-subject"
                  required
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ringkasan topik pesan"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="kontak-message"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Isi Pesan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="kontak-message"
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tuliskan pertanyaan, saran, atau pengaduan Anda secara jelas..."
                  className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-2xl text-sm transition shadow-xs"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{sending ? 'Mengirim...' : 'Kirim Pesan'}</span>
              </button>
            </form>
          </div>

          {/* Kontak & FAQ */}
          <div className="lg:col-span-5 space-y-6 min-w-0">
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Kontak Resmi &amp; Lokasi
              </h2>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600">
                <p className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span className="break-words">{school.address || 'Alamat belum tersedia'}</span>
                </p>
                <p className="flex items-center gap-2.5 min-w-0">
                  <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                  {school.phone ? (
                    <a
                      href={`tel:${school.phone.replace(/\s+/g, '')}`}
                      className="hover:text-emerald-700 transition break-all"
                    >
                      {school.phone}
                    </a>
                  ) : (
                    <span>-</span>
                  )}
                </p>
                <p className="flex items-center gap-2.5 min-w-0">
                  <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                  {school.email ? (
                    <a
                      href={`mailto:${school.email}`}
                      className="hover:text-emerald-700 transition break-all"
                    >
                      {school.email}
                    </a>
                  ) : (
                    <span>-</span>
                  )}
                </p>
              </div>

              {socialLinks.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Media Sosial Resmi
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.map((soc) => (
                      <a
                        key={soc.label}
                        href={soc.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold text-slate-700 transition"
                      >
                        {soc.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Pertanyaan Umum (FAQ)</span>
              </h2>
              <div className="space-y-2.5">
                {loadingFaqs ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span>Memuat daftar pertanyaan...</span>
                  </div>
                ) : faqError ? (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span>{faqError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setLoadingFaqs(true);
                        setFaqError(null);
                        setFaqRetryTick((t) => t + 1);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/50 transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Coba Lagi
                    </button>
                  </div>
                ) : faqs.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Belum ada pertanyaan umum (FAQ) yang dipublikasikan.
                  </p>
                ) : (
                  faqs.map((item) => {
                    const isOpen = openFaqId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="modular-card rounded-2xl overflow-hidden transition"
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                          className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-slate-50/70 transition"
                        >
                          <span className="font-bold text-slate-900 text-xs sm:text-sm leading-snug break-words">
                            {item.question}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-emerald-700' : ''
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-0 text-xs text-slate-600 leading-relaxed whitespace-pre-line break-words border-t border-slate-100/80">
                            <p className="pt-2.5">{item.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <SmartCaptchaMount containerRef={captcha.containerRef} />
    </PublicShell>
  );
}
