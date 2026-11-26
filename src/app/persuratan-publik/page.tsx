'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Inbox,
  Loader2,
  Paperclip,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import {
  encodeCaptchaHeader,
  SmartCaptchaMount,
  useSmartCaptcha,
} from '@/components/security/smart-captcha';
import {
  formatLetterCategoryLabel,
  type InstitutionInfoForLetter,
  type LetterRecord,
} from '@/lib/domain/persuratan-agenda-pdf';
import { generateOfficialLetterPdf } from '@/lib/domain/official-letter-pdf';

type PublicPersuratanTab = 'DROPBOX' | 'TRACKING' | 'EDARAN';

interface TrackedDispositionItem {
  id: string;
  instruction: string;
  notes?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  created_at: string;
  assignee?: { full_name: string } | Array<{ full_name: string }> | null;
}

interface TrackedIncomingLetter {
  id: string;
  letter_number: string;
  letter_date: string;
  category: string;
  subject: string;
  counterparty: string | null;
  summary?: string | null;
  clean_summary?: string | null;
  status?: string | null;
  priority?: string | null;
  receipt_ticket?: string | null;
  created_at: string;
  dispositions: TrackedDispositionItem[];
}

interface SubmittedReceiptSummary {
  ticket: string;
  letterNumber: string;
  subject: string;
  senderOrganization: string;
  letterDate: string;
}

const ALLOWED_FILE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_PUBLIC_FILE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateIdReadable(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function openAttachmentSafely(url: string, fileName?: string | null) {
  if (!url) return;
  if (url.startsWith('data:')) {
    try {
      const [meta, b64] = url.split(',');
      const mimeMatch = meta?.match(/^data:([^;]+);base64$/i);
      const mime = mimeMatch?.[1] || 'application/octet-stream';
      const byteCharacters = atob(b64 || '');
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'Lampiran_Surat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function PersuratanPublikContent() {
  const searchParams = useSearchParams();
  const initialTicketParam = searchParams.get('ticket')?.trim() || '';
  const initialTabParam = searchParams.get('tab')?.toUpperCase() || '';

  const [activeTab, setActiveTab] = useState<PublicPersuratanTab>(() => {
    if (initialTicketParam || initialTabParam === 'TRACKING') return 'TRACKING';
    if (initialTabParam === 'EDARAN') return 'EDARAN';
    return 'DROPBOX';
  });

  const [circulars, setCirculars] = useState<LetterRecord[]>([]);
  const [institution, setInstitution] = useState<InstitutionInfoForLetter | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Drop-Box Form State
  const [submitting, setSubmitting] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [fileSizeInfo, setFileSizeInfo] = useState<number | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<SubmittedReceiptSummary | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    sender_organization: '',
    sender_contact: '',
    letter_number: '',
    letter_date: getTodayIso(),
    category: 'SURAT_PENGANTAR',
    subject: '',
    summary: '',
    file_data_url: '',
    file_name: '',
  });

  // Tracking State
  const [ticketQuery, setTicketQuery] = useState(initialTicketParam);
  const [searchingTicket, setSearchingTicket] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedResult, setTrackedResult] = useState<TrackedIncomingLetter | null>(null);
  const [trackedNotFound, setTrackedNotFound] = useState(false);
  const trackAbortRef = useRef<AbortController | null>(null);

  // Circulars (Edaran) Filter & Preview State
  const [circularSearch, setCircularSearch] = useState('');
  const [downloadingCircularId, setDownloadingCircularId] = useState<string | null>(null);
  const [previewCircular, setPreviewCircular] = useState<LetterRecord | null>(null);

  const {
    containerRef: captchaContainerRef,
    executeCaptcha,
    forceLocalFallback,
  } = useSmartCaptcha(true);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      trackAbortRef.current?.abort();
    };
  }, []);

  const loadPublicData = useCallback(async () => {
    setLoadingInit(true);
    setInitError(null);
    try {
      const res = await fetch('/api/public/persuratan', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Gagal memuat daftar surat edaran publik.');
      }
      setCirculars((data.circulars || []) as LetterRecord[]);
      setInstitution((data.institution || null) as InstitutionInfoForLetter | null);
    } catch (err) {
      setInitError(
        err instanceof Error ? err.message : 'Gagal memuat data persuratan publik dari server.'
      );
    } finally {
      setLoadingInit(false);
    }
  }, []);

  const runTrackTicket = useCallback(async (rawTicket: string) => {
    const q = rawTicket.trim();
    if (q.length < 2) {
      setTrackError('Masukkan minimal 2 karakter Nomor Resi (SM-...) atau Nomor Surat.');
      return;
    }

    trackAbortRef.current?.abort();
    const controller = new AbortController();
    trackAbortRef.current = controller;

    setTicketQuery(q);
    setSearchingTicket(true);
    setTrackError(null);
    setTrackedNotFound(false);

    try {
      const res = await fetch(`/api/public/persuratan?ticket=${encodeURIComponent(q)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTrackedResult(null);
        setTrackError(data?.error || 'Gagal menghubungi layanan pelacakan surat.');
        return;
      }
      if (data?.trackedLetter) {
        setTrackedResult(data.trackedLetter as TrackedIncomingLetter);
        setTrackedNotFound(false);
      } else {
        setTrackedResult(null);
        setTrackedNotFound(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setTrackedResult(null);
      setTrackError('Koneksi terputus saat melacak status surat. Silakan coba lagi.');
    } finally {
      if (trackAbortRef.current === controller) {
        setSearchingTicket(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPublicData();
    if (initialTicketParam) {
      void runTrackTicket(initialTicketParam);
    }
  }, [initialTicketParam, loadPublicData, runTrackTicket]);

  // Tutup modal detail edaran dengan tombol Escape
  useEffect(() => {
    if (!previewCircular) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewCircular(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewCircular]);

  const handleClearFile = useCallback(() => {
    setForm((prev) => ({ ...prev, file_data_url: '', file_name: '' }));
    setFileSizeInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_MIMES.has(file.type)) {
      showToast('Format berkas harus PDF, JPG, PNG, atau WEBP.', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_PUBLIC_FILE_BYTES) {
      showToast(
        `Ukuran berkas (${formatFileSize(file.size)}) melebihi batas maksimal 1.5 MB.`,
        'error'
      );
      e.target.value = '';
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setForm((prev) => ({
        ...prev,
        file_data_url: dataUrl,
        file_name: file.name,
      }));
      setFileSizeInfo(file.size);
      setReadingFile(false);
    };
    reader.onerror = () => {
      showToast('Gagal membaca berkas dari perangkat Anda. Silakan pilih ulang.', 'error');
      setReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCopyTicket = async (ticket: string) => {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket);
      setCopiedTicket(true);
      showToast(`Nomor Resi "${ticket}" berhasil disalin.`, 'success');
      setTimeout(() => setCopiedTicket(false), 2500);
    } catch {
      showToast(`Nomor Resi: ${ticket}`, 'success');
    }
  };

  const handleSubmitDropBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || readingFile) return;

    const trimmedOrg = form.sender_organization.trim();
    const trimmedContact = form.sender_contact.trim();
    const trimmedNumber = form.letter_number.trim();
    const trimmedSubject = form.subject.trim();
    const trimmedSummary = form.summary.trim();

    if (trimmedOrg.length < 3) {
      showToast('Nama instansi / lembaga pengirim minimal 3 karakter.', 'error');
      return;
    }
    if (trimmedContact.length < 5) {
      showToast('Nomor WhatsApp atau Email narahubung minimal 5 karakter.', 'error');
      return;
    }
    if (trimmedNumber.length < 2) {
      showToast('Nomor surat dari instansi asal minimal 2 karakter.', 'error');
      return;
    }
    if (trimmedSubject.length < 4) {
      showToast('Perihal / subjek surat minimal 4 karakter.', 'error');
      return;
    }
    if (trimmedSummary.length < 5) {
      showToast('Ringkasan isi / maksud surat minimal 5 karakter.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const captchaPayload = await executeCaptcha();
      const res = await fetch('/api/public/persuratan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-captcha-payload': encodeCaptchaHeader(captchaPayload),
        },
        body: JSON.stringify({
          ...form,
          sender_organization: trimmedOrg,
          sender_contact: trimmedContact,
          letter_number: trimmedNumber,
          subject: trimmedSubject,
          summary: trimmedSummary,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.turnstileUnavailable) {
        forceLocalFallback();
      }
      if (!res.ok || !data?.submitted) {
        showToast(data?.error || 'Gagal mengirim surat masuk. Silakan coba lagi.', 'error');
        return;
      }

      const ticket = String(data.receiptTicket || '');
      setSubmittedReceipt({
        ticket,
        letterNumber: trimmedNumber,
        subject: trimmedSubject,
        senderOrganization: trimmedOrg,
        letterDate: form.letter_date,
      });
      setTicketQuery(ticket);
      showToast(`Surat berhasil dikirim! Nomor Resi Pelacakan Anda: ${ticket}`, 'success');

      setForm({
        sender_organization: '',
        sender_contact: '',
        letter_number: '',
        letter_date: getTodayIso(),
        category: 'SURAT_PENGANTAR',
        subject: '',
        summary: '',
        file_data_url: '',
        file_name: '',
      });
      setFileSizeInfo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runTrackTicket(ticketQuery);
  };

  const handleDownloadCircularPdf = async (letter: LetterRecord) => {
    if (downloadingCircularId) return;
    setDownloadingCircularId(letter.id);
    try {
      await generateOfficialLetterPdf({ letter, institution });
      showToast(`Surat Edaran "${letter.letter_number}" berhasil diunduh.`, 'success');
    } catch {
      showToast('Gagal membuat dokumen PDF Surat Edaran.', 'error');
    } finally {
      setDownloadingCircularId(null);
    }
  };

  const filteredCirculars = useMemo(() => {
    const q = circularSearch.trim().toLowerCase();
    if (!q) return circulars;
    return circulars.filter((c) => {
      const hay = `${c.letter_number} ${c.subject} ${c.summary || ''} ${c.letter_date}`.toLowerCase();
      return hay.includes(q);
    });
  }, [circularSearch, circulars]);

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 overflow-x-hidden">
        <SmartCaptchaMount containerRef={captchaContainerRef} />

        {/* Toast Notification */}
        {toast && (
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`fixed top-20 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
              toast.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-950'
                : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              )}
              <span className="min-w-0 break-words leading-relaxed">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup pemberitahuan"
              className="p-1 rounded-lg hover:bg-black/5 text-slate-500 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header Banner & Tab Switcher */}
        <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Layanan E-Office &amp; Persuratan Terbuka</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Terintegrasi Buku Agenda &amp; TTE QR</span>
                </span>
              </div>

              <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight break-words">
                Drop-Box Surat Masuk Eksternal &amp; Papan Surat Edaran
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Layanan pengiriman surat resmi daring bagi instansi pemerintah/swasta, perguruan
                tinggi (izin observasi, penelitian skripsi, PLP/KKN), dan masyarakat umum, dilengkapi
                pelacakan disposisi real-time serta unduhan Surat Edaran resmi lembaga.
              </p>
            </div>

            <Link
              href="/verifikasi"
              className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold transition shrink-0 self-start shadow-xs"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>Verifikasi QR Dokumen</span>
            </Link>
          </div>

          {/* Responsive Tab Navigation */}
          <div
            role="tablist"
            aria-label="Menu Layanan Persuratan Publik"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-200/80 pt-4"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'DROPBOX'}
              onClick={() => setActiveTab('DROPBOX')}
              className={`inline-flex items-center justify-center sm:justify-start gap-2 min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'DROPBOX'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Kirim Surat Masuk (Drop-Box)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'TRACKING'}
              onClick={() => setActiveTab('TRACKING')}
              className={`inline-flex items-center justify-center sm:justify-start gap-2 min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'TRACKING'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Lacak Resi &amp; Disposisi Surat</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'EDARAN'}
              onClick={() => setActiveTab('EDARAN')}
              className={`inline-flex items-center justify-center sm:justify-start gap-2 min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'EDARAN'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Papan Surat Edaran ({circulars.length})</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: DROP-BOX PENGIRIMAN SURAT MASUK EKSTERNAL                    */}
        {/* =================================================================== */}
        {activeTab === 'DROPBOX' && (
          <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-6">
            <div className="space-y-1 border-b border-slate-200/80 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Formulir Pengiriman Surat Masuk Eksternal
              </h2>
              <p className="text-xs text-slate-500">
                Isi identitas instansi pengirim, nomor surat, dan unggah pindaian (*scan*) surat
                resmi. Sistem akan menerbitkan <strong>Nomor Resi (`SM-...`)</strong> secara
                otomatis.
              </p>
            </div>

            {submittedReceipt && (
              <div className="rounded-2xl bg-emerald-50/90 border border-emerald-200 p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Bukti Resi Penerimaan Surat Masuk Digital</span>
                    </div>
                    <p className="text-xs text-emerald-900 break-words">
                      Pengirim: <strong>{submittedReceipt.senderOrganization}</strong> • No. Surat:{' '}
                      <span className="font-mono font-semibold">{submittedReceipt.letterNumber}</span>
                    </p>
                    <p className="text-xs text-emerald-800 break-words">
                      Perihal: {submittedReceipt.subject}
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Nomor Resi Pelacakan:
                    </span>
                    <div className="inline-flex items-center gap-2 bg-white border border-emerald-300 px-3 py-1.5 rounded-xl">
                      <strong className="font-mono text-sm text-emerald-950 select-all">
                        {submittedReceipt.ticket}
                      </strong>
                      <button
                        type="button"
                        onClick={() => void handleCopyTicket(submittedReceipt.ticket)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition"
                        title="Salin Nomor Resi"
                      >
                        {copiedTicket ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('TRACKING');
                      void runTrackTicket(submittedReceipt.ticket);
                    }}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Lacak Status Disposisi Sekarang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmittedReceipt(null)}
                    className="inline-flex items-center gap-1 min-h-[38px] px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-emerald-200 text-emerald-900 text-xs font-semibold transition"
                  >
                    <span>Tutup Bukti Resi</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitDropBox} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pub-sender-org"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nama Instansi / Lembaga / Pengirim <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="pub-sender-org"
                    type="text"
                    required
                    minLength={3}
                    maxLength={160}
                    disabled={submitting}
                    value={form.sender_organization}
                    onChange={(e) => setForm({ ...form, sender_organization: e.target.value })}
                    placeholder="cth: Fakultas Tarbiyah UIN / Kemenag / Puskesmas"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pub-sender-contact"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nomor WhatsApp / Email Narahubung <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="pub-sender-contact"
                    type="text"
                    required
                    minLength={5}
                    maxLength={120}
                    disabled={submitting}
                    value={form.sender_contact}
                    onChange={(e) => setForm({ ...form, sender_contact: e.target.value })}
                    placeholder="cth: 0812xxxxxxxx / humas@instansi.ac.id"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pub-letter-number"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nomor Surat Instansi Asal <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="pub-letter-number"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    disabled={submitting}
                    value={form.letter_number}
                    onChange={(e) => setForm({ ...form, letter_number: e.target.value })}
                    placeholder="cth: 124/UN.02/PP.00.9/11/2026"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pub-letter-date"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal Surat <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="pub-letter-date"
                    type="date"
                    required
                    disabled={submitting}
                    value={form.letter_date}
                    onChange={(e) => setForm({ ...form, letter_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pub-letter-category"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Kategori Surat Masuk
                  </label>
                  <select
                    id="pub-letter-category"
                    disabled={submitting}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  >
                    <option value="SURAT_PENGANTAR">Surat Pengantar / Permohonan Dinas</option>
                    <option value="SURAT_UNDANGAN">Surat Undangan Resmi</option>
                    <option value="SURAT_IZIN">Permohonan Izin Penelitian / Observasi / PLP</option>
                    <option value="SURAT_REKOMENDASI">Surat Rekomendasi / Kerja Sama</option>
                    <option value="SURAT_EDARAN">Surat Edaran Instansi</option>
                    <option value="LAINNYA">Surat Dinas Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="pub-letter-subject"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Perihal / Subjek Surat <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pub-letter-subject"
                  type="text"
                  required
                  minLength={4}
                  maxLength={240}
                  disabled={submitting}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="cth: Permohonan Izin Observasi & Penelitian Skripsi Mahasiswa"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="pub-letter-summary"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ringkasan Isi / Maksud Surat <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="pub-letter-summary"
                  rows={3}
                  required
                  minLength={5}
                  maxLength={2000}
                  disabled={submitting}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Jelaskan secara ringkas maksud surat, waktu pelaksanaan kegiatan, atau tindak lanjut yang diharapkan..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              {/* Upload Scan Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Unggah Scan Surat Resmi (Opsional — PDF / Gambar Maks 1.5 MB)</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Format yang didukung: PDF, JPG, PNG, atau WEBP.
                    </p>
                  </div>

                  {form.file_name && (
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-xs font-semibold text-rose-600 hover:underline self-start sm:self-auto shrink-0"
                    >
                      Hapus Berkas
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  id="pub-letter-file"
                  type="file"
                  accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={submitting || readingFile}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={submitting || readingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition disabled:opacity-50"
                  >
                    {readingFile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700 shrink-0" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    )}
                    <span>
                      {readingFile
                        ? 'Membaca Berkas...'
                        : form.file_name
                          ? 'Ganti Berkas Scan'
                          : 'Pilih Berkas Scan Surat'}
                    </span>
                  </button>

                  {form.file_name && (
                    <div className="flex items-center gap-2 min-w-0 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                      <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate max-w-[14rem] sm:max-w-xs font-medium">
                        {form.file_name}
                      </span>
                      {fileSizeInfo !== null && (
                        <span className="text-[11px] text-emerald-700 shrink-0">
                          ({formatFileSize(fileSizeInfo)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting || readingFile}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-6 rounded-xl text-xs transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Send className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {submitting
                      ? 'Mengirim & Menerbitkan Nomor Resi...'
                      : 'Kirim Surat Masuk & Dapatkan Nomor Resi'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: PELACAKAN RESI & STATUS DISPOSISI SURAT MASUK                */}
        {/* =================================================================== */}
        {activeTab === 'TRACKING' && (
          <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Pelacakan Status Surat Masuk &amp; Disposisi
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Masukkan Nomor Resi Drop-Box (contoh:{' '}
                <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                  SM-20261125-XXXX
                </code>
                ) atau Nomor Surat Asal untuk melihat status penerimaan Tata Usaha dan riwayat
                disposisi internal.
              </p>
            </div>

            <form onSubmit={handleTrackFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 min-w-0">
                <label htmlFor="pub-track-input" className="sr-only">
                  Nomor Resi atau Nomor Surat
                </label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pub-track-input"
                  type="text"
                  value={ticketQuery}
                  onChange={(e) => setTicketQuery(e.target.value)}
                  placeholder="Masukkan Nomor Resi (SM-...) atau Nomor Surat..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {ticketQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTicketQuery('');
                      setTrackedResult(null);
                      setTrackedNotFound(false);
                      setTrackError(null);
                    }}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={searchingTicket || ticketQuery.trim().length < 2}
                className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 shrink-0"
              >
                {searchingTicket ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Search className="w-4 h-4 shrink-0" />
                )}
                <span>Lacak Surat</span>
              </button>
            </form>

            {trackError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{trackError}</span>
              </div>
            )}

            {trackedNotFound && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-xs text-amber-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Data Surat Masuk Tidak Ditemukan</span>
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Tidak ditemukan arsip surat masuk dengan nomor resi atau nomor surat{' '}
                  <strong className="font-mono break-all">&ldquo;{ticketQuery}&rdquo;</strong>.
                  Pastikan kode resi (`SM-...`) atau nomor surat lengkap sudah sesuai.
                </p>
              </div>
            )}

            {trackedResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-6 space-y-5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-emerald-200/80 pb-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold">
                        TERCATAT DI BUKU AGENDA TATA USAHA
                      </span>
                      {trackedResult.receipt_ticket && (
                        <span className="px-2.5 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-900 font-mono text-[11px] font-bold">
                          Resi: {trackedResult.receipt_ticket}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-semibold">
                        {formatLetterCategoryLabel(trackedResult.category)}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">
                      {trackedResult.subject}
                    </h3>

                    <p className="text-[11px] text-slate-600 break-words">
                      No. Surat Asal:{' '}
                      <strong className="font-mono text-slate-800 break-all">
                        {trackedResult.letter_number}
                      </strong>{' '}
                      • Pengirim: <strong className="text-slate-800">{trackedResult.counterparty || '-'}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-emerald-900 font-mono text-xs font-bold shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{formatDateIdReadable(trackedResult.letter_date)}</span>
                  </div>
                </div>

                {trackedResult.clean_summary && (
                  <div className="rounded-xl bg-white/90 border border-emerald-200/80 p-3.5 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Ringkasan Maksud Surat
                    </p>
                    <p className="text-xs text-slate-700 whitespace-pre-line break-words leading-relaxed">
                      {trackedResult.clean_summary}
                    </p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      Riwayat Disposisi &amp; Tindak Lanjut Internal (
                      {trackedResult.dispositions.length})
                    </span>
                  </p>

                  {trackedResult.dispositions.length === 0 ? (
                    <div className="rounded-xl bg-white p-4 border border-slate-200 text-slate-600 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        Surat telah diterima dan dicatat oleh Tata Usaha. Saat ini sedang dalam
                        antrean peninjauan/disposisi Kepala Lembaga.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {trackedResult.dispositions.map((d) => {
                        const assignee = Array.isArray(d.assignee) ? d.assignee[0] : d.assignee;
                        return (
                          <div
                            key={d.id}
                            className="rounded-xl bg-white p-4 border border-slate-200 space-y-2"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 break-words">
                                  Didisposisikan kepada: {assignee?.full_name || 'Pejabat Terkait'}
                                </p>
                                <p className="text-[11px] text-slate-600 break-words mt-0.5">
                                  Instruksi: &ldquo;{d.instruction}&rdquo;
                                </p>
                              </div>

                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold self-start sm:self-auto shrink-0 ${
                                  d.status === 'SELESAI'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : d.status === 'DITINDAKLANJUTI'
                                      ? 'bg-sky-100 text-sky-900'
                                      : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {d.status}
                              </span>
                            </div>

                            {d.completion_notes && (
                              <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/80 px-3 py-2 text-[11px] text-emerald-950 break-words">
                                <strong>Tindak Lanjut:</strong> {d.completion_notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: PAPAN SURAT EDARAN & PEMBERITAHUAN RESMI LEMBAGA             */}
        {/* =================================================================== */}
        {activeTab === 'EDARAN' && (
          <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Papan Surat Edaran &amp; Pemberitahuan Resmi Lembaga
                </h2>
                <p className="text-xs text-slate-500">
                  Daftar Surat Edaran resmi yang diterbitkan lembaga dan dapat diunduh langsung
                  dalam format PDF ber-Kop &amp; TTE QR Code.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadPublicData()}
                disabled={loadingInit}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition self-start sm:self-auto shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInit ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>

            {circulars.length > 0 && (
              <div className="relative">
                <label htmlFor="pub-circular-search" className="sr-only">
                  Cari Surat Edaran
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pub-circular-search"
                  type="search"
                  value={circularSearch}
                  onChange={(e) => setCircularSearch(e.target.value)}
                  placeholder="Cari nomor surat edaran, perihal, atau ringkasan isi..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            )}

            {loadingInit ? (
              <div className="p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Memuat daftar surat edaran resmi...</span>
              </div>
            ) : initError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
                <p className="text-xs font-bold text-rose-900">{initError}</p>
                <button
                  type="button"
                  onClick={() => void loadPublicData()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            ) : filteredCirculars.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  {circulars.length === 0
                    ? 'Belum ada Surat Edaran publik yang diterbitkan.'
                    : 'Tidak ada Surat Edaran yang cocok dengan kata kunci pencarian.'}
                </p>
                {circularSearch && (
                  <button
                    type="button"
                    onClick={() => setCircularSearch('')}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCirculars.map((c) => {
                  const isDownloading = downloadingCircularId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="modular-card rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 text-xs border border-slate-200/90"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            {formatLetterCategoryLabel(c.category)}
                          </span>
                          <span className="font-mono font-bold text-slate-800 break-all">
                            {c.letter_number}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            • {formatDateIdReadable(c.letter_date)}
                          </span>
                        </div>

                        <p className="font-bold text-slate-900 text-sm break-words">{c.subject}</p>
                        {c.summary && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 break-words leading-relaxed">
                            {c.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setPreviewCircular(c)}
                          className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Detail</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => void handleDownloadCircularPdf(c)}
                          className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          ) : (
                            <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>Unduh PDF Resmi</span>
                        </button>

                        {c.file_url && (
                          <button
                            type="button"
                            onClick={() => openAttachmentSafely(c.file_url!, c.attachment_name)}
                            className="inline-flex items-center gap-1 min-h-[38px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>Lampiran</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Pratinjau Detail Surat Edaran */}
        {previewCircular && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pub-circular-modal-title"
            onClick={() => setPreviewCircular(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-xl w-full max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      {formatLetterCategoryLabel(previewCircular.category)}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 break-all">
                      {previewCircular.letter_number}
                    </span>
                  </div>
                  <h3
                    id="pub-circular-modal-title"
                    className="text-base font-bold text-slate-900 break-words"
                  >
                    {previewCircular.subject}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewCircular(null)}
                  aria-label="Tutup pratinjau surat edaran"
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                  <p className="text-[10px] font-semibold text-slate-500">Tanggal Terbit</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {formatDateIdReadable(previewCircular.letter_date)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                  <p className="text-[10px] font-semibold text-slate-500">Sasaran / Tujuan Edaran</p>
                  <p className="font-bold text-slate-900 mt-0.5 break-words">
                    {previewCircular.counterparty || 'Seluruh Warga Madrasah & Umum'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 text-xs space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Isi / Ringkasan Surat Edaran
                </p>
                <p className="text-slate-800 whitespace-pre-line break-words leading-relaxed">
                  {previewCircular.summary?.trim() ||
                    'Silakan unduh dokumen PDF resmi di bawah untuk membaca naskah lengkap surat edaran.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={downloadingCircularId === previewCircular.id}
                    onClick={() => void handleDownloadCircularPdf(previewCircular)}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {downloadingCircularId === previewCircular.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileCheck2 className="w-3.5 h-3.5" />
                    )}
                    <span>Unduh PDF Resmi Ber-QR</span>
                  </button>

                  <Link
                    href={`/verifikasi?ref=${encodeURIComponent(previewCircular.letter_number)}&type=SURAT`}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Verifikasi Surat</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewCircular(null)}
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}

export default function PersuratanPublikPage() {
  return (
    <Suspense
      fallback={
        <PublicShell>
          <div className="max-w-5xl mx-auto px-4 py-12">
            <div className="glass-card rounded-3xl p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memuat layanan persuratan publik...</span>
            </div>
          </div>
        </PublicShell>
      }
    >
      <PersuratanPublikContent />
    </Suspense>
  );
}
