'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Inbox,
  Loader2,
  Paperclip,
  QrCode,
  Search,
  Send,
  Upload,
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

interface TrackedDispositionItem {
  id: string;
  instruction: string;
  status: string;
  priority: string;
  due_date?: string | null;
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
  status?: string | null;
  receipt_ticket?: string | null;
  created_at: string;
  dispositions: TrackedDispositionItem[];
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PersuratanPublikPage() {
  const [activeTab, setActiveTab] = useState<'DROPBOX' | 'TRACKING' | 'EDARAN'>('DROPBOX');
  const [circulars, setCirculars] = useState<LetterRecord[]>([]);
  const [institution, setInstitution] = useState<InstitutionInfoForLetter | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  // Drop-Box Form State
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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
  const [ticketQuery, setTicketQuery] = useState('');
  const [searchingTicket, setSearchingTicket] = useState(false);
  const [trackedResult, setTrackedResult] = useState<TrackedIncomingLetter | null>(null);
  const [trackedNotFound, setTrackedNotFound] = useState(false);

  const {
    containerRef: captchaContainerRef,
    executeCaptcha,
    forceLocalFallback,
  } = useSmartCaptcha(true);

  const loadPublicData = useCallback(async () => {
    try {
      const res = await fetch('/api/public/persuratan', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCirculars((data.circulars || []) as LetterRecord[]);
        setInstitution((data.institution || null) as InstitutionInfoForLetter | null);
      }
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicData();
  }, [loadPublicData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setToast({
        type: 'error',
        message: 'Ukuran berkas maksimal 1.5 MB untuk pengiriman melalui Drop-Box Publik.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setForm((prev) => ({
        ...prev,
        file_data_url: dataUrl,
        file_name: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitDropBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setToast(null);
    try {
      const captchaPayload = await executeCaptcha();
      const res = await fetch('/api/public/persuratan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-captcha-payload': encodeCaptchaHeader(captchaPayload),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (data?.turnstileUnavailable) {
        forceLocalFallback();
      }
      if (!res.ok || !data?.submitted) {
        setToast({
          type: 'error',
          message: data?.error || 'Gagal mengirim surat masuk. Silakan coba lagi.',
        });
        return;
      }

      setSubmittedTicket(data.receiptTicket);
      setTicketQuery(data.receiptTicket);
      setToast({
        type: 'success',
        message: `Surat berhasil dikirim! Simpan Nomor Resi Pelacakan Anda: ${data.receiptTicket}`,
      });
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setToast({
        type: 'error',
        message: 'Koneksi ke server terputus. Silakan coba lagi.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = ticketQuery.trim();
    if (!q) return;

    setSearchingTicket(true);
    setTrackedNotFound(false);
    try {
      const res = await fetch(`/api/public/persuratan?ticket=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.trackedLetter) {
        setTrackedResult(data.trackedLetter as TrackedIncomingLetter);
      } else {
        setTrackedResult(null);
        setTrackedNotFound(true);
      }
    } finally {
      setSearchingTicket(false);
    }
  };

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SmartCaptchaMount containerRef={captchaContainerRef} />

        {/* Header */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <Building2 className="w-3.5 h-3.5" />
                <span>Layanan E-Office &amp; Persuratan Terbuka</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Drop-Box Surat Masuk Eksternal &amp; Papan Surat Edaran
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Layanan pengiriman surat resmi daring bagi instansi luar, perguruan tinggi (izin
                observasi/penelitian/PLP), dan masyarakat umum, dilengkapi pelacakan disposisi serta
                unduhan Surat Edaran resmi lembaga.
              </p>
            </div>

            <Link
              href="/verifikasi"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold transition shrink-0 self-start"
            >
              <QrCode className="w-4 h-4" />
              <span>Verifikasi QR Dokumen</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200/80 pt-4 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('DROPBOX')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'DROPBOX'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Surat Masuk (Drop-Box)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TRACKING')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'TRACKING'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Lacak Resi &amp; Disposisi Surat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('EDARAN')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'EDARAN'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Papan Surat Edaran Resmi ({circulars.length})</span>
            </button>
          </div>
        </div>

        {toast && (
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
              toast.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-950'
                : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span>{toast.message}</span>
            </div>
            <button type="button" onClick={() => setToast(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeTab === 'DROPBOX' && (
          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
            {submittedTicket && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-emerald-950">
                    Bukti Penerimaan Surat Masuk Digital
                  </p>
                  <p className="text-xs text-emerald-800">
                    Nomor Resi Pelacakan Anda:{' '}
                    <strong className="font-mono text-sm">{submittedTicket}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('TRACKING');
                    void handleTrackTicket();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold self-start sm:self-auto"
                >
                  Lacak Status Disposisi
                </button>
              </div>
            )}

            <form onSubmit={handleSubmitDropBox} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Instansi / Lembaga / Pengirim
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={form.sender_organization}
                    onChange={(e) => setForm({ ...form, sender_organization: e.target.value })}
                    placeholder="cth: Fakultas Tarbiyah UIN / Kemenag / Puskesmas"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor WhatsApp / Email Narahubung
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={form.sender_contact}
                    onChange={(e) => setForm({ ...form, sender_contact: e.target.value })}
                    placeholder="cth: 0812xxxxxxxx / humas@instansi.ac.id"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor Surat dari Instansi Asal
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={form.letter_number}
                    onChange={(e) => setForm({ ...form, letter_number: e.target.value })}
                    placeholder="cth: 124/UN.02/PP.00.9/11/2026"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tanggal Surat
                  </label>
                  <input
                    type="date"
                    required
                    value={form.letter_date}
                    onChange={(e) => setForm({ ...form, letter_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kategori Surat Masuk
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                  >
                    <option value="SURAT_PENGANTAR">Surat Pengantar / Permohonan Dinas</option>
                    <option value="SURAT_UNDANGAN">Surat Undangan</option>
                    <option value="SURAT_IZIN">Permohonan Izin Penelitian / Observasi / PLP</option>
                    <option value="SURAT_REKOMENDASI">Surat Rekomendasi / Kerja Sama</option>
                    <option value="SURAT_EDARAN">Surat Edaran Instansi</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Perihal / Subjek Surat
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="cth: Permohonan Izin Observasi & Penelitian Skripsi Mahasiswa"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Ringkasan Isi / Maksud Surat
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Jelaskan secara ringkas maksud surat, waktu pelaksanaan kegiatan, atau tindak lanjut yang diharapkan..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Unggah Scan Surat Resmi (PDF / Gambar Maks 1.5 MB)</span>
                  </span>
                  {form.file_name && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, file_data_url: '', file_name: '' }))}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Hapus Berkas
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{form.file_name ? `Terpilih: ${form.file_name}` : 'Pilih Berkas Scan Surat'}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-6 rounded-xl text-xs transition disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Kirim Surat Masuk &amp; Dapatkan Nomor Resi</span>
              </button>
            </form>
          </div>
        )}

        {activeTab === 'TRACKING' && (
          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                Pelacakan Status Surat Masuk &amp; Disposisi
              </h2>
              <p className="text-xs text-slate-500">
                Masukkan Nomor Resi Drop-Box (contoh: <code className="font-mono">SM-20261125-XXXX</code>)
                atau Nomor Surat Asal untuk melihat posisi tindak lanjut surat Anda.
              </p>
            </div>

            <form onSubmit={handleTrackTicket} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={ticketQuery}
                onChange={(e) => setTicketQuery(e.target.value)}
                placeholder="Masukkan Nomor Resi (SM-...) atau Nomor Surat..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900"
              />
              <button
                type="submit"
                disabled={searchingTicket || !ticketQuery.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {searchingTicket ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Lacak Surat</span>
              </button>
            </form>

            {trackedNotFound && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                Data surat masuk dengan nomor resi / nomor surat tersebut tidak ditemukan. Pastikan
                kode yang Anda masukkan sudah benar.
              </div>
            )}

            {trackedResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-200/70 pb-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold">
                      TERCATAT DI BUKU AGENDA TATA USAHA
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                      {trackedResult.subject}
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      No. Surat: <strong className="font-mono">{trackedResult.letter_number}</strong> •
                      Pengirim: <strong>{trackedResult.counterparty || '-'}</strong>
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-900">
                    Tanggal: {trackedResult.letter_date}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-slate-800">
                    Riwayat Disposisi &amp; Tindak Lanjut Internal ({trackedResult.dispositions.length})
                  </p>
                  {trackedResult.dispositions.length === 0 ? (
                    <div className="rounded-xl bg-white p-3.5 border border-slate-200 text-slate-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Surat telah diterima Tata Usaha dan sedang menunggu disposisi Kepala Lembaga.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trackedResult.dispositions.map((d) => {
                        const assignee = Array.isArray(d.assignee) ? d.assignee[0] : d.assignee;
                        return (
                          <div
                            key={d.id}
                            className="rounded-xl bg-white p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                          >
                            <div>
                              <p className="font-bold text-slate-900">
                                Didisposisikan kepada: {assignee?.full_name || 'Pejabat Terkait'}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                Instruksi: &ldquo;{d.instruction}&rdquo;
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold self-start sm:self-auto ${
                                d.status === 'SELESAI'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-sky-100 text-sky-900'
                              }`}
                            >
                              {d.status}
                            </span>
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

        {activeTab === 'EDARAN' && (
          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                Papan Surat Edaran &amp; Pemberitahuan Resmi Lembaga
              </h2>
              <p className="text-xs text-slate-500">
                Daftar Surat Edaran resmi yang diterbitkan lembaga dan dapat diunduh langsung dalam
                format PDF ber-Kop &amp; TTE QR Code.
              </p>
            </div>

            {loadingInit ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Memuat surat edaran...</span>
              </div>
            ) : circulars.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Belum ada Surat Edaran publik yang diterbitkan.
              </div>
            ) : (
              <div className="space-y-3">
                {circulars.map((c) => (
                  <div
                    key={c.id}
                    className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs border border-slate-200"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          {formatLetterCategoryLabel(c.category)}
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {c.letter_number}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          • {c.letter_date}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">{c.subject}</p>
                      {c.summary && <p className="text-[11px] text-slate-600">{c.summary}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          void generateOfficialLetterPdf({ letter: c, institution })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Unduh Surat Resmi (PDF)</span>
                      </button>

                      {c.file_url && (
                        <a
                          href={c.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Lampiran</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
