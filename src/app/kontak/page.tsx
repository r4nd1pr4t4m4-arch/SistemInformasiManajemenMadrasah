'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';
import {
  EmptyState,
  ErrorState,
  FormFieldFeedback,
  LoadingState,
  SuccessState,
} from '@/components/ui/state-views';

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
  const [lastTicketCode, setLastTicketCode] = useState<string | null>(null);
  const [trackCode, setTrackCode] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedTicket, setTrackedTicket] = useState<{
    ticket_code: string;
    category: string;
    subject: string;
    status: string;
    response: string | null;
    responded_at: string | null;
    created_at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const fieldErrors = {
    senderName:
      touched.senderName && form.senderName.trim().length < 2
        ? 'Nama lengkap minimal 2 karakter.'
        : null,
    senderEmail:
      touched.senderEmail &&
      form.senderEmail.trim().length > 0 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.senderEmail.trim())
        ? 'Format alamat email tidak valid.'
        : null,
    subject:
      touched.subject && form.subject.trim().length < 3
        ? 'Subjek pesan minimal 3 karakter.'
        : null,
    message:
      touched.message && form.message.trim().length < 5
        ? 'Isi pesan minimal 5 karakter agar dapat ditindaklanjuti.'
        : null,
  };

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
        if (data?.ticketCode) {
          setLastTicketCode(String(data.ticketCode));
          setTrackCode(String(data.ticketCode));
        }
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
              <SuccessState
                variant="banner"
                title={
                  lastTicketCode
                    ? `Pesan Terkirim — Nomor Tiket: ${lastTicketCode}`
                    : 'Pesan Berhasil Terkirim'
                }
                description={
                  lastTicketCode
                    ? `Simpan nomor tiket ${lastTicketCode} untuk melacak status tindak lanjut dan tanggapan resmi lembaga di bawah ini.`
                    : 'Pesan Anda telah tersimpan di database dan akan segera ditindaklanjuti oleh tim Humas & Tata Usaha.'
                }
                onDismiss={() => setSent(false)}
              />
            )}

            {error && (
              <ErrorState
                compact
                title="Pengiriman Pesan Belum Berhasil"
                message={error}
              />
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
                    aria-invalid={Boolean(fieldErrors.senderName) || undefined}
                    value={form.senderName}
                    onBlur={() => setTouched((prev) => ({ ...prev, senderName: true }))}
                    onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                    placeholder="Nama Anda"
                    className={INPUT_CLASS}
                  />
                  <FormFieldFeedback error={fieldErrors.senderName} />
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
                    aria-invalid={Boolean(fieldErrors.senderEmail) || undefined}
                    value={form.senderEmail}
                    onBlur={() => setTouched((prev) => ({ ...prev, senderEmail: true }))}
                    onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                    placeholder="nama@email.com"
                    className={INPUT_CLASS}
                  />
                  <FormFieldFeedback error={fieldErrors.senderEmail} />
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
                  aria-invalid={Boolean(fieldErrors.subject) || undefined}
                  value={form.subject}
                  onBlur={() => setTouched((prev) => ({ ...prev, subject: true }))}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ringkasan topik pesan"
                  className={INPUT_CLASS}
                />
                <FormFieldFeedback error={fieldErrors.subject} />
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
                  aria-invalid={Boolean(fieldErrors.message) || undefined}
                  value={form.message}
                  onBlur={() => setTouched((prev) => ({ ...prev, message: true }))}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tuliskan pertanyaan, saran, atau pengaduan Anda secara jelas..."
                  className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                <FormFieldFeedback
                  error={fieldErrors.message}
                  hint={!fieldErrors.message ? 'Minimal 5 karakter. Semakin jelas isi pesan, semakin cepat kami membantu.' : null}
                />
              </div>

              <button
                type="submit"
                aria-busy={sending || undefined}
                disabled={
                  sending ||
                  form.senderName.trim().length < 2 ||
                  form.subject.trim().length < 3 ||
                  form.message.trim().length < 5
                }
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

            {/* Lacak Status Tiket Pengaduan */}
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Lacak Status Tiket Pengaduan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan nomor tiket (mis. <span className="font-mono">ADU-20261126-XXXX</span>) untuk melihat progres &amp; tanggapan resmi.
                </p>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const code = trackCode.trim().toUpperCase();
                  if (!code) return;
                  setTracking(true);
                  setTrackError(null);
                  setTrackedTicket(null);
                  try {
                    const res = await fetch(`/api/inquiries?ticket=${encodeURIComponent(code)}`, {
                      cache: 'no-store',
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setTrackError(data.error || 'Nomor tiket tidak ditemukan.');
                    } else if (data.ticket) {
                      setTrackedTicket(data.ticket);
                    }
                  } catch {
                    setTrackError('Gagal terhubung ke server.');
                  } finally {
                    setTracking(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                  placeholder="ADU-YYYYMMDD-XXXX"
                  className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  type="submit"
                  disabled={tracking}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition shrink-0"
                >
                  {tracking ? 'Mencari...' : 'Lacak'}
                </button>
              </form>
              {trackError && (
                <p className="text-xs text-rose-600 font-medium">{trackError}</p>
              )}
              {trackedTicket && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-emerald-700">
                      {trackedTicket.ticket_code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        trackedTicket.status === 'SELESAI'
                          ? 'bg-emerald-100 text-emerald-800'
                          : trackedTicket.status === 'DIPROSES'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {trackedTicket.status}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900">{trackedTicket.subject}</p>
                  {trackedTicket.response ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-950">
                      <p className="text-[10px] font-bold uppercase text-emerald-700 mb-0.5">
                        Tanggapan Resmi Lembaga:
                      </p>
                      <p className="whitespace-pre-line">{trackedTicket.response}</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">
                      Laporan Anda telah diterima dan sedang dalam antrean peninjauan tim Humas/TU.
                    </p>
                  )}
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
                  <LoadingState variant="inline" title="Memuat daftar pertanyaan..." className="py-2" />
                ) : faqError ? (
                  <ErrorState
                    compact
                    title="Gagal Memuat FAQ"
                    message={faqError}
                    onRetry={() => {
                      setLoadingFaqs(true);
                      setFaqError(null);
                      setFaqRetryTick((t) => t + 1);
                    }}
                  />
                ) : faqs.length === 0 ? (
                  <EmptyState
                    compact
                    title="Belum Ada FAQ"
                    description="Belum ada pertanyaan umum (FAQ) yang dipublikasikan."
                  />
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
