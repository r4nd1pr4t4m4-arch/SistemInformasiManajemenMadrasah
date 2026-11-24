'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Inbox,
  Loader2,
  Paperclip,
  QrCode,
  RefreshCw,
  Send,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  formatLetterCategoryLabel,
  type InstitutionInfoForLetter,
  type LetterCategory,
  type LetterRecord,
} from '@/lib/domain/persuratan-agenda-pdf';
import { generateOfficialLetterPdf } from '@/lib/domain/official-letter-pdf';

export interface LetterDispositionRow {
  id: string;
  letter_id: string;
  assigned_to_teacher_id: string;
  assigned_by_name: string | null;
  instruction: string;
  notes: string | null;
  priority: string;
  due_date: string | null;
  status: 'DITERUSKAN' | 'DIBACA' | 'DITINDAKLANJUTI' | 'SELESAI';
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  letter?: LetterRecord | LetterRecord[] | null;
  assignee?: {
    id: string;
    full_name: string;
    nip?: string | null;
  } | null;
}

export interface LetterRequestRow {
  id: string;
  request_number: string;
  requester_role: string;
  requester_name: string;
  category: LetterCategory | string;
  subject: string;
  purpose: string;
  counterparty: string | null;
  student_id: string | null;
  teacher_id: string | null;
  leave_type: 'SAKIT' | 'IZIN' | 'DISPENSASI' | null;
  leave_start_date: string | null;
  leave_end_date: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  status: 'DIAJUKAN' | 'DIVERIFIKASI_TU' | 'DISETUJUI' | 'DITOLAK';
  reviewer_notes: string | null;
  reviewed_at: string | null;
  issued_letter_id: string | null;
  created_at: string;
  student?: {
    id: string;
    full_name: string;
    nis?: string | null;
    nisn?: string | null;
  } | null;
  teacher?: {
    id: string;
    full_name: string;
    nip?: string | null;
  } | null;
  issued_letter?: LetterRecord | LetterRecord[] | null;
}

interface ChildIdentity {
  id: string;
  full_name: string;
  nis?: string | null;
  nisn?: string | null;
}

interface SelfServicePersuratanProps {
  scope: 'siswa' | 'orang-tua' | 'gtk';
  title: string;
  subtitle: string;
}

const SCOPE_CATEGORIES: Record<
  'siswa' | 'orang-tua' | 'gtk',
  ReadonlyArray<{ value: LetterCategory; label: string; defaultSubject: string }>
> = {
  siswa: [
    {
      value: 'SURAT_KETERANGAN_AKTIF',
      label: 'Surat Keterangan Siswa Aktif',
      defaultSubject: 'Permohonan Surat Keterangan Siswa Aktif',
    },
    {
      value: 'SURAT_REKOMENDASI',
      label: 'Surat Rekomendasi Lomba / Beasiswa / PTN',
      defaultSubject: 'Permohonan Surat Rekomendasi Mengikuti Kegiatan / Beasiswa',
    },
    {
      value: 'SURAT_IZIN',
      label: 'Surat Izin Tidak Masuk / Dispensasi Kegiatan',
      defaultSubject: 'Permohonan Izin / Dispensasi Kehadiran Siswa',
    },
    {
      value: 'SURAT_PENGANTAR',
      label: 'Surat Pengantar Administrasi',
      defaultSubject: 'Permohonan Surat Pengantar Administrasi Siswa',
    },
  ],
  'orang-tua': [
    {
      value: 'SURAT_IZIN',
      label: 'Surat Izin Anak Sakit / Keperluan Keluarga (Terhubung Absensi)',
      defaultSubject: 'Surat Izin Tidak Masuk Sekolah Anak',
    },
    {
      value: 'SURAT_KETERANGAN_AKTIF',
      label: 'Surat Keterangan Siswa Aktif Anak (Tunjangan/BPJS/Beasiswa)',
      defaultSubject: 'Permohonan Surat Keterangan Siswa Aktif Anak',
    },
    {
      value: 'SURAT_MUTASI',
      label: 'Permohonan Surat Keterangan Pindah / Mutasi Sekolah',
      defaultSubject: 'Permohonan Surat Keterangan Pindah / Mutasi Anak',
    },
    {
      value: 'SURAT_REKOMENDASI',
      label: 'Surat Rekomendasi Anak',
      defaultSubject: 'Permohonan Surat Rekomendasi Anak',
    },
  ],
  gtk: [
    {
      value: 'SURAT_TUGAS',
      label: 'Permohonan Surat Tugas Dinas / MGMP / Pelatihan / Pendamping Lomba',
      defaultSubject: 'Permohonan Surat Tugas Mengikuti Kegiatan Dinas',
    },
    {
      value: 'SURAT_REKOMENDASI',
      label: 'Surat Rekomendasi / Keterangan Aktif Mengajar GTK',
      defaultSubject: 'Permohonan Surat Keterangan / Rekomendasi GTK',
    },
    {
      value: 'SURAT_IZIN',
      label: 'Surat Permohonan Izin / Cuti GTK',
      defaultSubject: 'Permohonan Izin Tidak Melaksanakan Tugas GTK',
    },
    {
      value: 'SURAT_PENGANTAR',
      label: 'Surat Pengantar Berkas Kepegawaian / Kemenag',
      defaultSubject: 'Permohonan Surat Pengantar Dokumen Kepegawaian',
    },
  ],
};

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function extractIssuedLetter(req: LetterRequestRow): LetterRecord | null {
  if (!req.issued_letter) return null;
  return Array.isArray(req.issued_letter) ? req.issued_letter[0] || null : req.issued_letter;
}

export function SelfServicePersuratanWorkspace({
  scope,
  title,
  subtitle,
}: SelfServicePersuratanProps) {
  const categoryOptions = SCOPE_CATEGORIES[scope];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [requests, setRequests] = useState<LetterRequestRow[]>([]);
  const [myLetters, setMyLetters] = useState<LetterRecord[]>([]);
  const [myDispositions, setMyDispositions] = useState<LetterDispositionRow[]>([]);
  const [updatingDispId, setUpdatingDispId] = useState<string | null>(null);
  const [children, setChildren] = useState<ChildIdentity[]>([]);
  const [studentIdentity, setStudentIdentity] = useState<ChildIdentity | null>(null);
  const [teacherIdentity, setTeacherIdentity] = useState<{ id: string; full_name: string } | null>(
    null
  );
  const [institution, setInstitution] = useState<InstitutionInfoForLetter | null>(null);

  const [form, setForm] = useState(() => ({
    category: categoryOptions[0].value,
    subject: categoryOptions[0].defaultSubject,
    purpose: '',
    counterparty: '',
    student_id: '',
    leave_type: 'SAKIT' as 'SAKIT' | 'IZIN' | 'DISPENSASI',
    leave_start_date: getTodayIso(),
    leave_end_date: getTodayIso(),
    attachment_url: '',
    attachment_name: '',
  }));

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [res, dispRes] = await Promise.all([
        fetch('/api/layanan/persuratan/permohonan?scope=personal', {
          cache: 'no-store',
        }),
        scope === 'gtk'
          ? fetch('/api/layanan/persuratan/disposisi?scope=personal', { cache: 'no-store' })
          : Promise.resolve(null),
      ]);
      const data = await res.json().catch(() => null);
      const dispData = dispRes ? await dispRes.json().catch(() => null) : null;
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Gagal memuat data layanan persuratan.');
      }

      setRequests((data.requests || []) as LetterRequestRow[]);
      setMyLetters((data.myLetters || []) as LetterRecord[]);
      if (dispData?.dispositions) {
        setMyDispositions(dispData.dispositions as LetterDispositionRow[]);
      }
      setInstitution((data.institution || null) as InstitutionInfoForLetter | null);

      const childList = (data.identity?.children || []) as ChildIdentity[];
      setChildren(childList);
      setStudentIdentity((data.identity?.student || null) as ChildIdentity | null);
      setTeacherIdentity(
        (data.identity?.teacher || null) as { id: string; full_name: string } | null
      );

      if (childList.length > 0) {
        setForm((prev) => ({
          ...prev,
          student_id: prev.student_id || childList[0].id,
        }));
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memuat data layanan persuratan.',
        'error'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleCategoryChange = (nextCat: LetterCategory) => {
    const found = categoryOptions.find((c) => c.value === nextCat);
    setForm((prev) => ({
      ...prev,
      category: nextCat,
      subject: found?.defaultSubject || prev.subject,
    }));
  };

  const handleUploadSupportingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', form.category);

      const res = await fetch('/api/layanan/persuratan/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.fileUrl) {
        showToast(data?.error || 'Gagal mengunggah lampiran pendukung.', 'error');
        return;
      }

      setForm((prev) => ({
        ...prev,
        attachment_url: data.fileUrl,
        attachment_name: data.fileName || file.name,
      }));
      showToast(`Lampiran "${file.name}" berhasil diunggah.`, 'success');
    } catch {
      showToast('Gagal mengunggah berkas pendukung.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (form.subject.trim().length < 3) {
      showToast('Perihal permohonan minimal 3 karakter.', 'error');
      return;
    }
    if (form.purpose.trim().length < 5) {
      showToast('Tuliskan alasan / keperluan pengajuan secara jelas (minimal 5 karakter).', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const isLeaveRequest = form.category === 'SURAT_IZIN';
      const payload = {
        category: form.category,
        subject: form.subject.trim(),
        purpose: form.purpose.trim(),
        counterparty: form.counterparty.trim() || null,
        student_id:
          scope === 'orang-tua'
            ? form.student_id || children[0]?.id || null
            : scope === 'siswa'
              ? studentIdentity?.id || null
              : null,
        teacher_id: scope === 'gtk' ? teacherIdentity?.id || null : null,
        leave_type: isLeaveRequest ? form.leave_type : null,
        leave_start_date: isLeaveRequest ? form.leave_start_date : null,
        leave_end_date: isLeaveRequest ? form.leave_end_date : null,
        attachment_url: form.attachment_url || null,
        attachment_name: form.attachment_name || null,
      };

      const res = await fetch('/api/layanan/persuratan/permohonan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal mengirim permohonan surat.', 'error');
        return;
      }

      showToast(
        'Permohonan surat berhasil dikirim ke Tata Usaha & Kepala Madrasah.',
        'success'
      );
      setForm((prev) => ({
        ...prev,
        purpose: '',
        counterparty: '',
        attachment_url: '',
        attachment_name: '',
      }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData(true);
    } catch {
      showToast('Koneksi terputus saat mengirim permohonan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadLetterPdf = async (letter: LetterRecord) => {
    setDownloadingId(letter.id);
    try {
      await generateOfficialLetterPdf({
        letter,
        institution,
      });
      showToast(`Dokumen resmi "${letter.letter_number}" berhasil diunduh.`, 'success');
    } catch {
      showToast('Gagal mengunduh PDF surat resmi.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpdateDispositionStatus = async (
    disp: LetterDispositionRow,
    nextStatus: 'DIBACA' | 'DITINDAKLANJUTI' | 'SELESAI'
  ) => {
    if (updatingDispId) return;
    let completionNotes: string | null = disp.completion_notes;
    if (nextStatus === 'SELESAI') {
      const note = window.prompt(
        'Masukkan laporan hasil tindak lanjut disposisi ini:',
        disp.completion_notes || 'Telah ditindaklanjuti sesuai instruksi.'
      );
      if (note === null) return;
      completionNotes = note.trim() || 'Telah ditindaklanjuti sesuai instruksi.';
    }

    setUpdatingDispId(disp.id);
    try {
      const res = await fetch('/api/layanan/persuratan/disposisi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disp.id,
          status: nextStatus,
          completion_notes: completionNotes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal memperbarui status disposisi.', 'error');
        return;
      }
      showToast(`Status disposisi diperbarui menjadi ${nextStatus}.`, 'success');
      await loadData(true);
    } catch {
      showToast('Gagal memperbarui status disposisi.', 'error');
    } finally {
      setUpdatingDispId(null);
    }
  };

  const stats = useMemo(() => {
    const pending = requests.filter(
      (r) => r.status === 'DIAJUKAN' || r.status === 'DIVERIFIKASI_TU'
    ).length;
    const approved = requests.filter((r) => r.status === 'DISETUJUI').length;
    return { totalReq: requests.length, pending, approved, inboxCount: myLetters.length };
  }, [myLetters.length, requests]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat layanan persuratan digital...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
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
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Ringkasan */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>{title}</span>
            </h1>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total Pengajuan Saya</p>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">{stats.totalReq}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5">
            <p className="text-[11px] font-medium text-amber-800">Sedang Diproses TU</p>
            <p className="text-lg font-extrabold text-amber-900 mt-0.5">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
            <p className="text-[11px] font-medium text-emerald-800">Disetujui &amp; Terbit</p>
            <p className="text-lg font-extrabold text-emerald-900 mt-0.5">{stats.approved}</p>
          </div>
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-3.5">
            <p className="text-[11px] font-medium text-sky-800">Kotak Masuk Surat &amp; Edaran</p>
            <p className="text-lg font-extrabold text-sky-900 mt-0.5">{stats.inboxCount}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Form Pengajuan Mandiri */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-700" />
              <span>Ajukan Permohonan Surat / Izin Baru</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Setelah disetujui oleh Tata Usaha / Kepala Madrasah, dokumen PDF resmi ber-Kop &amp; TTE
              QR Code dapat langsung Anda unduh dari halaman ini.
            </p>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-3.5">
            {scope === 'orang-tua' && children.length > 0 && (
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Pilih Anak
                </label>
                <select
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.nis ? `(NIS: ${c.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Jenis Layanan Surat
              </label>
              <select
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value as LetterCategory)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {form.category === 'SURAT_IZIN' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold text-amber-950">
                  Detail Tanggal &amp; Kategori Izin Kehadiran
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Jenis Izin
                    </label>
                    <select
                      value={form.leave_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          leave_type: e.target.value as 'SAKIT' | 'IZIN' | 'DISPENSASI',
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      <option value="SAKIT">Sakit</option>
                      <option value="IZIN">Izin Keperluan</option>
                      <option value="DISPENSASI">Dispensasi Lomba/Tugas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Mulai Tanggal
                    </label>
                    <input
                      type="date"
                      value={form.leave_start_date}
                      onChange={(e) => setForm({ ...form, leave_start_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      value={form.leave_end_date}
                      onChange={(e) => setForm({ ...form, leave_end_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Perihal Permohonan
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Perihal surat yang diajukan"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Instansi Tujuan / Penyelenggara (Opsional)
              </label>
              <input
                type="text"
                value={form.counterparty}
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                placeholder="cth: Panitia Beasiswa PIP / Wali Kelas / Kemenag"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Alasan / Keperluan Lengkap
              </label>
              <textarea
                rows={3}
                required
                minLength={5}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Jelaskan keperluan surat atau alasan izin secara ringkas dan jelas..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            {/* Lampiran Bukti Pendukung (Surat Dokter / Undangan Lomba) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Lampiran Pendukung (Foto Surat Dokter / Brosur / Undangan)</span>
                </span>
                {form.attachment_url && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, attachment_url: '', attachment_name: '' }))
                    }
                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    Hapus
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={handleUploadSupportingFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                )}
                <span>{uploading ? 'Mengunggah...' : 'Unggah Berkas Pendukung (Opsional)'}</span>
              </button>

              {form.attachment_url && (
                <p className="text-[11px] text-emerald-800 font-medium truncate">
                  ✓ Terlampir: {form.attachment_name || 'Berkas Pendukung'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Kirim Permohonan Surat</span>
            </button>
          </form>
        </div>

        {/* Kolom Kanan: Status Pengajuan & Kotak Masuk Surat Resmi */}
        <div className="lg:col-span-7 space-y-6">
          {/* Kotak Masuk Disposisi Surat Masuk (Khusus GTK) */}
          {scope === 'gtk' && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-emerald-700" />
                  <span>Disposisi Surat Masuk untuk Saya ({myDispositions.length})</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Instruksi tindak lanjut surat masuk dari Kepala Lembaga / Tata Usaha yang
                  didisposisikan kepada Anda.
                </p>
              </div>

              {myDispositions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  Belum ada disposisi surat masuk yang ditugaskan kepada Anda.
                </div>
              ) : (
                <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-0.5">
                  {myDispositions.map((d) => {
                    const letterObj = Array.isArray(d.letter) ? d.letter[0] : d.letter;
                    const isUpdating = updatingDispId === d.id;
                    return (
                      <div
                        key={d.id}
                        className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                d.status === 'SELESAI'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : d.status === 'DITINDAKLANJUTI'
                                    ? 'bg-sky-100 text-sky-900'
                                    : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {d.status}
                            </span>
                            {d.priority && d.priority !== 'BIASA' && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                {d.priority}
                              </span>
                            )}
                            <span className="font-mono font-bold text-slate-800">
                              No. Surat: {letterObj?.letter_number || '-'}
                            </span>
                          </div>
                          {d.due_date && (
                            <span className="text-[11px] font-mono text-rose-700 font-semibold">
                              Batas Waktu: {d.due_date}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {letterObj?.subject || 'Surat Masuk'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Pengirim: {letterObj?.counterparty || '-'} • Dari:{' '}
                            {d.assigned_by_name || 'Kepala Lembaga'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 space-y-1 text-[11px]">
                          <p className="font-bold text-amber-950">
                            Instruksi Disposisi: &ldquo;{d.instruction}&rdquo;
                          </p>
                          {d.notes && <p className="text-amber-900">{d.notes}</p>}
                        </div>

                        {d.completion_notes && (
                          <p className="text-[11px] text-emerald-900 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200">
                            <strong>Laporan Tindak Lanjut:</strong> {d.completion_notes}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 flex-wrap">
                          {letterObj?.file_url ? (
                            <a
                              href={letterObj.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>Buka Scan Surat Masuk</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Tanpa lampiran berkas scan
                            </span>
                          )}

                          {d.status !== 'SELESAI' && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {d.status === 'DITERUSKAN' && (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => void handleUpdateDispositionStatus(d, 'DIBACA')}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
                                >
                                  Tandai Dibaca
                                </button>
                              )}
                              {d.status !== 'DITINDAKLANJUTI' && (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    void handleUpdateDispositionStatus(d, 'DITINDAKLANJUTI')
                                  }
                                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-semibold"
                                >
                                  Proses Tindak Lanjut
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void handleUpdateDispositionStatus(d, 'SELESAI')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Selesai &amp; Lapor</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Status Pelacakan Permohonan */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Pelacakan Status Pengajuan Surat ({requests.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Pantau progres verifikasi TU hingga penerbitan surat resmi ber-QR Code.
              </p>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                Belum ada riwayat permohonan surat yang Anda ajukan.
              </div>
            ) : (
              <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-0.5">
                {requests.map((req) => {
                  const issued = extractIssuedLetter(req);
                  return (
                    <div
                      key={req.id}
                      className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-800">
                            {req.request_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'DISETUJUI'
                                ? 'bg-emerald-100 text-emerald-900'
                                : req.status === 'DITOLAK'
                                  ? 'bg-rose-100 text-rose-800'
                                  : req.status === 'DIVERIFIKASI_TU'
                                    ? 'bg-sky-100 text-sky-900'
                                    : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {req.status === 'DISETUJUI' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : req.status === 'DITOLAK' ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            <span>{req.status.replace(/_/g, ' ')}</span>
                          </span>
                        </div>

                        <span className="text-[11px] font-mono text-slate-500">
                          {req.created_at?.slice(0, 10)}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 text-sm">{req.subject}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatLetterCategoryLabel(req.category)}
                          {req.counterparty ? ` • Tujuan: ${req.counterparty}` : ''}
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-700 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/60">
                        {req.purpose}
                      </p>

                      {req.reviewer_notes && (
                        <p className="text-[11px] text-emerald-900 bg-emerald-50/70 rounded-xl px-3 py-2 border border-emerald-200">
                          <strong>Catatan TU / Kepala Lembaga:</strong> {req.reviewer_notes}
                        </p>
                      )}

                      {issued && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-emerald-800">
                            No. Surat Terbit: {issued.letter_number}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDownloadLetterPdf(issued)}
                              disabled={downloadingId === issued.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition"
                            >
                              {downloadingId === issued.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileCheck2 className="w-3.5 h-3.5" />
                              )}
                              <span>Unduh Surat Resmi (PDF)</span>
                            </button>

                            <Link
                              href={`/verifikasi?ref=${encodeURIComponent(issued.letter_number)}&type=SURAT`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold"
                            >
                              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Verifikasi</span>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kotak Masuk Surat Resmi, Surat Tugas, Panggilan & Surat Edaran */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-700" />
                <span>Kotak Masuk Surat Resmi &amp; Surat Edaran ({myLetters.length})</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Daftar surat resmi, surat keterangan, surat tugas, panggilan, dan edaran lembaga yang
                tertaut ke akun Anda.
              </p>
            </div>

            {myLetters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                Belum ada surat resmi atau surat edaran di kotak masuk Anda.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-0.5">
                {myLetters.map((l) => (
                  <div
                    key={l.id}
                    className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs border border-slate-200/80"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          {formatLetterCategoryLabel(l.category)}
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {l.letter_number}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          • {l.letter_date}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm break-words">{l.subject}</p>
                      {l.summary && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">{l.summary}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleDownloadLetterPdf(l)}
                        disabled={downloadingId === l.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition"
                      >
                        {downloadingId === l.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileCheck2 className="w-3.5 h-3.5" />
                        )}
                        <span>Unduh PDF Resmi</span>
                      </button>

                      {l.file_url && (
                        <a
                          href={l.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold"
                        >
                          <Paperclip className="w-3 h-3" />
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
        </div>
      </div>
    </div>
  );
}
