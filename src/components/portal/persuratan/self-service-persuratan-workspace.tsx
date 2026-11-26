'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  Inbox,
  Loader2,
  Paperclip,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Upload,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import {
  extractLinkedStudent,
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatReadableDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const raw = String(dateStr).slice(0, 10);
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function extractIssuedLetter(req: LetterRequestRow): LetterRecord | null {
  if (!req.issued_letter) return null;
  return Array.isArray(req.issued_letter) ? req.issued_letter[0] || null : req.issued_letter;
}

const PAGE_SIZE = 8;

export function SelfServicePersuratanWorkspace({
  scope,
  title,
  subtitle,
}: SelfServicePersuratanProps) {
  const categoryOptions = SCOPE_CATEGORIES[scope];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dispModalRef = useRef<HTMLDivElement | null>(null);

  const [requests, setRequests] = useState<LetterRequestRow[]>([]);
  const [myLetters, setMyLetters] = useState<LetterRecord[]>([]);
  const [myDispositions, setMyDispositions] = useState<LetterDispositionRow[]>([]);
  const [updatingDispId, setUpdatingDispId] = useState<string | null>(null);
  const [completeDispModal, setCompleteDispModal] = useState<{
    disp: LetterDispositionRow;
    notes: string;
  } | null>(null);
  const [children, setChildren] = useState<ChildIdentity[]>([]);
  const [studentIdentity, setStudentIdentity] = useState<ChildIdentity | null>(null);
  const [teacherIdentity, setTeacherIdentity] = useState<{ id: string; full_name: string } | null>(
    null
  );
  const [institution, setInstitution] = useState<InstitutionInfoForLetter | null>(null);

  // Filter & Pagination States
  const [dispStatusFilter, setDispStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SELESAI'>('ALL');
  const [dispPage, setDispPage] = useState(1);
  const [reqStatusFilter, setReqStatusFilter] = useState<
    'ALL' | 'PENDING' | 'DISETUJUI' | 'DITOLAK'
  >('ALL');
  const [reqPage, setReqPage] = useState(1);
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxPage, setInboxPage] = useState(1);

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

  useFocusTrap(dispModalRef, Boolean(completeDispModal));

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!completeDispModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !updatingDispId) {
        setCompleteDispModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [completeDispModal, updatingDispId]);

  const fetchSelfServiceData = useCallback(async () => {
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
    return { data, dispData };
  }, [scope]);

  const applySelfServiceData = useCallback(
    (payload: Awaited<ReturnType<typeof fetchSelfServiceData>>) => {
      const { data, dispData } = payload;
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
      setLoadError(null);
    },
    []
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const payload = await fetchSelfServiceData();
        applySelfServiceData(payload);
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : 'Gagal memuat data layanan persuratan.';
        if (!isRefresh || loadError) {
          setLoadError(errMsg);
        } else {
          showToast(errMsg, 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applySelfServiceData, fetchSelfServiceData, loadError, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchSelfServiceData();
        if (!cancelled) {
          applySelfServiceData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Gagal memuat data layanan persuratan.'
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
  }, [applySelfServiceData, fetchSelfServiceData]);

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

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran berkas pendukung maksimal 5 MB.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearAttachment = () => {
    setForm((prev) => ({ ...prev, attachment_url: '', attachment_name: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

    const isLeaveRequest = form.category === 'SURAT_IZIN';
    if (isLeaveRequest) {
      if (!form.leave_start_date) {
        showToast('Tanggal mulai izin wajib diisi.', 'error');
        return;
      }
      if (form.leave_end_date && form.leave_end_date < form.leave_start_date) {
        showToast('Tanggal selesai izin tidak boleh lebih awal dari tanggal mulai.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
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
        leave_end_date: isLeaveRequest ? form.leave_end_date || form.leave_start_date : null,
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
      setReqPage(1);
      await loadData(true);
    } catch {
      showToast('Koneksi terputus saat mengirim permohonan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadLetterPdf = async (letter: LetterRecord) => {
    if (downloadingId) return;
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

  const submitDispositionUpdate = async (
    disp: LetterDispositionRow,
    nextStatus: 'DIBACA' | 'DITINDAKLANJUTI' | 'SELESAI',
    completionNotes?: string | null
  ) => {
    if (updatingDispId) return;
    setUpdatingDispId(disp.id);
    try {
      const res = await fetch('/api/layanan/persuratan/disposisi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disp.id,
          status: nextStatus,
          completion_notes: completionNotes ?? disp.completion_notes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal memperbarui status disposisi.', 'error');
        return;
      }
      setCompleteDispModal(null);
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

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (reqStatusFilter === 'PENDING') {
        return r.status === 'DIAJUKAN' || r.status === 'DIVERIFIKASI_TU';
      }
      if (reqStatusFilter === 'DISETUJUI') return r.status === 'DISETUJUI';
      if (reqStatusFilter === 'DITOLAK') return r.status === 'DITOLAK';
      return true;
    });
  }, [reqStatusFilter, requests]);

  const reqTotalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const safeReqPage = Math.min(reqPage, reqTotalPages);
  const paginatedRequests = useMemo(() => {
    const start = (safeReqPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, safeReqPage]);

  const filteredInbox = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    if (!q) return myLetters;
    return myLetters.filter((l) => {
      const linkedStudent = extractLinkedStudent(l);
      return [
        l.letter_number,
        l.subject,
        l.summary || '',
        formatLetterCategoryLabel(l.category),
        l.letter_date,
        linkedStudent?.full_name || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [inboxSearch, myLetters]);

  const inboxTotalPages = Math.max(1, Math.ceil(filteredInbox.length / PAGE_SIZE));
  const safeInboxPage = Math.min(inboxPage, inboxTotalPages);
  const paginatedInbox = useMemo(() => {
    const start = (safeInboxPage - 1) * PAGE_SIZE;
    return filteredInbox.slice(start, start + PAGE_SIZE);
  }, [filteredInbox, safeInboxPage]);

  const filteredDispositions = useMemo(() => {
    if (dispStatusFilter === 'ACTIVE') {
      return myDispositions.filter((d) => d.status !== 'SELESAI');
    }
    if (dispStatusFilter === 'SELESAI') {
      return myDispositions.filter((d) => d.status === 'SELESAI');
    }
    return myDispositions;
  }, [dispStatusFilter, myDispositions]);

  const dispTotalPages = Math.max(1, Math.ceil(filteredDispositions.length / PAGE_SIZE));
  const safeDispPage = Math.min(dispPage, dispTotalPages);
  const paginatedDispositions = useMemo(() => {
    const start = (safeDispPage - 1) * PAGE_SIZE;
    return filteredDispositions.slice(start, start + PAGE_SIZE);
  }, [filteredDispositions, safeDispPage]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="max-w-7xl mx-auto glass-card rounded-3xl p-8 sm:p-12 text-center space-y-3 border border-slate-200/80"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center mx-auto shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm sm:text-base font-bold text-slate-900">
            Memuat Layanan Persuratan Digital
          </p>
          <p className="text-xs text-slate-500">
            Menyiapkan formulir pengajuan, pelacakan status surat, dan kotak masuk surat resmi...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="max-w-2xl mx-auto glass-card rounded-3xl p-7 sm:p-10 text-center space-y-4 border border-rose-200/80"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Gagal Memuat Layanan Persuratan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 break-words">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Memuat Ulang...' : 'Coba Muat Ulang'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6 pb-8">
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
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Ringkasan */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
              <span className="break-words">{title}</span>
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing || submitting}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition self-start sm:self-auto shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setReqStatusFilter('ALL');
              setReqPage(1);
            }}
            className="text-left rounded-2xl border border-slate-200/80 bg-white/85 hover:border-slate-300 p-3.5 min-w-0 transition"
          >
            <p className="text-[11px] font-medium text-slate-500 truncate">Total Pengajuan Saya</p>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5 tabular-nums">
              {stats.totalReq}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setReqStatusFilter('PENDING');
              setReqPage(1);
            }}
            className="text-left rounded-2xl border border-amber-200/80 bg-amber-50/50 hover:bg-amber-50 p-3.5 min-w-0 transition"
          >
            <p className="text-[11px] font-medium text-amber-800 truncate">Sedang Diproses TU</p>
            <p className="text-lg font-extrabold text-amber-900 mt-0.5 tabular-nums">
              {stats.pending}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setReqStatusFilter('DISETUJUI');
              setReqPage(1);
            }}
            className="text-left rounded-2xl border border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-50 p-3.5 min-w-0 transition"
          >
            <p className="text-[11px] font-medium text-emerald-800 truncate">
              Disetujui &amp; Terbit
            </p>
            <p className="text-lg font-extrabold text-emerald-900 mt-0.5 tabular-nums">
              {stats.approved}
            </p>
          </button>
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-3.5 min-w-0">
            <p className="text-[11px] font-medium text-sky-800 truncate">
              Kotak Masuk Surat &amp; Edaran
            </p>
            <p className="text-lg font-extrabold text-sky-900 mt-0.5 tabular-nums">
              {stats.inboxCount}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Form Pengajuan Mandiri */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Ajukan Permohonan Surat / Izin Baru</span>
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Setelah disetujui oleh Tata Usaha / Kepala Madrasah, dokumen PDF resmi ber-Kop &amp; TTE
              QR Code dapat langsung Anda unduh dari halaman ini.
            </p>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-3.5">
            {scope === 'orang-tua' && children.length === 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-900 leading-relaxed">
                <strong>Akun belum terhubung dengan data putra/putri.</strong> Permohonan tetap
                dapat dikirim, namun hubungi Tata Usaha / Operator agar data anak tertaut ke akun
                Anda untuk sinkronisasi izin &amp; surat otomatis.
              </div>
            )}

            {scope === 'siswa' && !studentIdentity && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-900 leading-relaxed">
                <strong>Akun siswa belum tertaut ke Buku Induk.</strong> Hubungi Tata Usaha /
                Operator agar pengajuan surat otomatis mencantumkan NIS &amp; NISN Anda.
              </div>
            )}

            {scope === 'gtk' && !teacherIdentity && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-900 leading-relaxed">
                <strong>Akun GTK belum tertaut ke Buku Induk GTK.</strong> Hubungi Tata Usaha /
                Operator agar pengajuan surat tugas dan disposisi surat masuk otomatis tertaut ke
                profil kepegawaian Anda.
              </div>
            )}

            {scope === 'orang-tua' && children.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="ss-student-select"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Pilih Anak
                </label>
                <select
                  id="ss-student-select"
                  disabled={submitting}
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
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
              <label
                htmlFor="ss-category-select"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Jenis Layanan Surat
              </label>
              <select
                id="ss-category-select"
                disabled={submitting}
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value as LetterCategory)}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
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
                  <div className="min-w-0">
                    <label
                      htmlFor="ss-leave-type"
                      className="block text-[10px] font-semibold text-slate-700 mb-0.5"
                    >
                      Jenis Izin
                    </label>
                    <select
                      id="ss-leave-type"
                      disabled={submitting}
                      value={form.leave_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          leave_type: e.target.value as 'SAKIT' | 'IZIN' | 'DISPENSASI',
                        })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      <option value="SAKIT">Sakit</option>
                      <option value="IZIN">Izin Keperluan</option>
                      <option value="DISPENSASI">Dispensasi Lomba/Tugas</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor="ss-leave-start"
                      className="block text-[10px] font-semibold text-slate-700 mb-0.5"
                    >
                      Mulai Tanggal
                    </label>
                    <input
                      id="ss-leave-start"
                      type="date"
                      required
                      disabled={submitting}
                      max={form.leave_end_date || undefined}
                      value={form.leave_start_date}
                      onChange={(e) => setForm({ ...form, leave_start_date: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor="ss-leave-end"
                      className="block text-[10px] font-semibold text-slate-700 mb-0.5"
                    >
                      Sampai Tanggal
                    </label>
                    <input
                      id="ss-leave-end"
                      type="date"
                      disabled={submitting}
                      min={form.leave_start_date || undefined}
                      value={form.leave_end_date}
                      onChange={(e) => setForm({ ...form, leave_end_date: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="ss-subject"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Perihal Permohonan
              </label>
              <input
                id="ss-subject"
                type="text"
                required
                minLength={3}
                disabled={submitting}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Perihal surat yang diajukan"
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="ss-counterparty"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Instansi Tujuan / Penyelenggara (Opsional)
              </label>
              <input
                id="ss-counterparty"
                type="text"
                disabled={submitting}
                value={form.counterparty}
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                placeholder="cth: Panitia Beasiswa PIP / Wali Kelas / Kemenag"
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="ss-purpose"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Alasan / Keperluan Lengkap
              </label>
              <textarea
                id="ss-purpose"
                rows={3}
                required
                minLength={5}
                disabled={submitting}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Jelaskan keperluan surat atau alasan izin secara ringkas dan jelas..."
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            {/* Lampiran Bukti Pendukung (Surat Dokter / Undangan Lomba) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="ss-attachment-upload"
                  className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Paperclip className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Lampiran Pendukung (Foto Surat Dokter / Brosur / Undangan)</span>
                </label>
                {form.attachment_url && (
                  <button
                    type="button"
                    onClick={handleClearAttachment}
                    className="text-[11px] font-semibold text-rose-600 hover:underline shrink-0"
                  >
                    Hapus
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                id="ss-attachment-upload"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={handleUploadSupportingFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                )}
                <span>{uploading ? 'Mengunggah...' : 'Unggah Berkas Pendukung (Maks 5 MB)'}</span>
              </button>

              {form.attachment_url && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] text-emerald-800">
                  <span className="truncate font-medium min-w-0">
                    ✓ Terlampir: {form.attachment_name || 'Berkas Pendukung'}
                  </span>
                  <a
                    href={form.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline shrink-0"
                  >
                    <span>Lihat</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Send className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{submitting ? 'Mengirim Permohonan...' : 'Kirim Permohonan Surat'}</span>
            </button>
          </form>
        </div>

        {/* Kolom Kanan: Status Pengajuan & Kotak Masuk Surat Resmi */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6 min-w-0">
          {/* Kotak Masuk Disposisi Surat Masuk (Khusus GTK) */}
          {scope === 'gtk' && (
            <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Disposisi Surat Masuk untuk Saya ({filteredDispositions.length})</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Instruksi tindak lanjut surat masuk dari Kepala Lembaga / Tata Usaha yang
                    didisposisikan kepada Anda.
                  </p>
                </div>

                {myDispositions.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {(
                      [
                        { key: 'ALL', label: 'Semua' },
                        { key: 'ACTIVE', label: 'Belum Selesai' },
                        { key: 'SELESAI', label: 'Selesai' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setDispStatusFilter(tab.key);
                          setDispPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          dispStatusFilter === tab.key
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredDispositions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 space-y-2">
                  <p>
                    {myDispositions.length === 0
                      ? 'Belum ada disposisi surat masuk yang ditugaskan kepada Anda.'
                      : 'Tidak ada disposisi surat masuk pada filter status ini.'}
                  </p>
                  {dispStatusFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setDispStatusFilter('ALL')}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Tampilkan semua disposisi
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedDispositions.map((d) => {
                      const letterObj = Array.isArray(d.letter) ? d.letter[0] : d.letter;
                      const isUpdating = updatingDispId === d.id;
                      return (
                        <div
                          key={d.id}
                          className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80 min-w-0"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                              <span className="font-mono font-bold text-slate-800 break-all">
                                No. Surat: {letterObj?.letter_number || '-'}
                              </span>
                            </div>
                            {d.due_date && (
                              <span className="text-[11px] font-mono text-rose-700 font-semibold shrink-0">
                                Batas Waktu: {formatReadableDate(d.due_date)}
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="font-bold text-slate-900 text-sm break-words">
                              {letterObj?.subject || 'Surat Masuk'}
                            </p>
                            <p className="text-[11px] text-slate-500 break-words">
                              Pengirim: {letterObj?.counterparty || '-'} • Dari:{' '}
                              {d.assigned_by_name || 'Kepala Lembaga'}
                            </p>
                          </div>

                          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 space-y-1 text-[11px] break-words">
                            <p className="font-bold text-amber-950">
                              Instruksi Disposisi: &ldquo;{d.instruction}&rdquo;
                            </p>
                            {d.notes && <p className="text-amber-900">{d.notes}</p>}
                          </div>

                          {d.completion_notes && (
                            <p className="text-[11px] text-emerald-900 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200 break-words">
                              <strong>Laporan Tindak Lanjut:</strong> {d.completion_notes}
                            </p>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/70">
                            {letterObj?.file_url ? (
                              <a
                                href={letterObj.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold w-fit"
                              >
                                <Paperclip className="w-3 h-3 shrink-0" />
                                <span>Buka Scan Surat Masuk</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
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
                                    onClick={() => void submitDispositionUpdate(d, 'DIBACA')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold disabled:opacity-50"
                                  >
                                    {isUpdating && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                                    <span>Tandai Dibaca</span>
                                  </button>
                                )}
                                {d.status !== 'DITINDAKLANJUTI' && (
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      void submitDispositionUpdate(d, 'DITINDAKLANJUTI')
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-semibold disabled:opacity-50"
                                  >
                                    {isUpdating && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                                    <span>Proses Tindak Lanjut</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    setCompleteDispModal({
                                      disp: d,
                                      notes:
                                        d.completion_notes ||
                                        'Telah ditindaklanjuti sesuai instruksi.',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Selesai &amp; Lapor</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {dispTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                      <span>
                        Hal. <strong className="text-slate-900">{safeDispPage}</strong> /{' '}
                        {dispTotalPages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safeDispPage <= 1}
                          onClick={() => setDispPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Sebelumnya</span>
                        </button>
                        <button
                          type="button"
                          disabled={safeDispPage >= dispTotalPages}
                          onClick={() => setDispPage((p) => Math.min(dispTotalPages, p + 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                        >
                          <span>Berikutnya</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Status Pelacakan Permohonan */}
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Pelacakan Status Pengajuan Surat ({filteredRequests.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Pantau progres verifikasi TU hingga penerbitan surat resmi ber-QR Code.
                </p>
              </div>

              {requests.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { key: 'ALL', label: 'Semua' },
                      { key: 'PENDING', label: 'Diproses' },
                      { key: 'DISETUJUI', label: 'Terbit' },
                      { key: 'DITOLAK', label: 'Ditolak' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setReqStatusFilter(tab.key);
                        setReqPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        reqStatusFilter === tab.key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 space-y-2">
                <p>
                  {requests.length === 0
                    ? 'Belum ada riwayat permohonan surat yang Anda ajukan.'
                    : 'Tidak ada permohonan surat pada filter status ini.'}
                </p>
                {reqStatusFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setReqStatusFilter('ALL')}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Tampilkan semua status
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedRequests.map((req) => {
                    const issued = extractIssuedLetter(req);
                    return (
                      <div
                        key={req.id}
                        className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80 min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-mono font-bold text-slate-800 break-all">
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
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                              ) : req.status === 'DITOLAK' ? (
                                <XCircle className="w-3 h-3 shrink-0" />
                              ) : (
                                <Clock className="w-3 h-3 shrink-0" />
                              )}
                              <span>{req.status.replace(/_/g, ' ')}</span>
                            </span>
                          </div>

                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {formatReadableDate(req.created_at)}
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-slate-900 text-sm break-words">
                            {req.subject}
                          </p>
                          <p className="text-[11px] text-slate-500 break-words">
                            {formatLetterCategoryLabel(req.category)}
                            {req.counterparty ? ` • Tujuan: ${req.counterparty}` : ''}
                            {req.leave_start_date
                              ? ` • Izin: ${formatReadableDate(
                                  req.leave_start_date
                                )} s/d ${formatReadableDate(
                                  req.leave_end_date || req.leave_start_date
                                )}`
                              : ''}
                          </p>
                        </div>

                        {req.student?.full_name && scope === 'orang-tua' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-medium">
                            <GraduationCap className="w-3 h-3 shrink-0" />
                            <span>{req.student.full_name}</span>
                          </span>
                        )}

                        <p className="text-[11px] text-slate-700 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/60 break-words">
                          {req.purpose}
                        </p>

                        {req.reviewer_notes && (
                          <p className="text-[11px] text-emerald-900 bg-emerald-50/70 rounded-xl px-3 py-2 border border-emerald-200 break-words">
                            <strong>Catatan TU / Kepala Lembaga:</strong> {req.reviewer_notes}
                          </p>
                        )}

                        {issued && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/70">
                            <span className="text-[11px] font-mono font-bold text-emerald-800 break-all">
                              No. Surat Terbit: {issued.letter_number}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => void handleDownloadLetterPdf(issued)}
                                disabled={downloadingId === issued.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition disabled:opacity-50"
                              >
                                {downloadingId === issued.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                ) : (
                                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>Unduh Surat Resmi (PDF)</span>
                              </button>

                              <Link
                                href={`/verifikasi?ref=${encodeURIComponent(issued.letter_number)}&type=SURAT`}
                                target="_blank"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold"
                              >
                                <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>Verifikasi</span>
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {reqTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                    <span>
                      Hal. <strong className="text-slate-900">{safeReqPage}</strong> /{' '}
                      {reqTotalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeReqPage <= 1}
                        onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sebelumnya</span>
                      </button>
                      <button
                        type="button"
                        disabled={safeReqPage >= reqTotalPages}
                        onClick={() => setReqPage((p) => Math.min(reqTotalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Kotak Masuk Surat Resmi, Surat Tugas, Panggilan & Surat Edaran */}
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Kotak Masuk Surat Resmi &amp; Edaran ({filteredInbox.length})</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Daftar surat resmi, surat keterangan, surat tugas, panggilan, dan edaran lembaga
                  yang tertaut ke akun Anda.
                </p>
              </div>
            </div>

            {myLetters.length > 0 && (
              <div className="relative">
                <label htmlFor="ss-inbox-search" className="sr-only">
                  Cari kotak masuk surat resmi
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="ss-inbox-search"
                  type="search"
                  value={inboxSearch}
                  onChange={(e) => {
                    setInboxSearch(e.target.value);
                    setInboxPage(1);
                  }}
                  placeholder="Cari nomor surat, perihal, atau kategori..."
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            )}

            {filteredInbox.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 space-y-2">
                <p>
                  {myLetters.length === 0
                    ? 'Belum ada surat resmi atau surat edaran di kotak masuk Anda.'
                    : 'Tidak ada surat yang cocok dengan kata kunci pencarian.'}
                </p>
                {inboxSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setInboxSearch('')}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Reset pencarian
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {paginatedInbox.map((l) => {
                    const linkedStudent = extractLinkedStudent(l);
                    return (
                      <div
                        key={l.id}
                        className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs border border-slate-200/80 min-w-0"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              {formatLetterCategoryLabel(l.category)}
                            </span>
                            {scope === 'orang-tua' && linkedStudent?.full_name && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-semibold">
                                <GraduationCap className="w-3 h-3 shrink-0" />
                                <span>{linkedStudent.full_name}</span>
                              </span>
                            )}
                            <span className="font-mono font-bold text-slate-800 break-all">
                              {l.letter_number}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              • {formatReadableDate(l.letter_date)}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-sm break-words">{l.subject}</p>
                          {l.summary && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 break-words">
                              {l.summary}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void handleDownloadLetterPdf(l)}
                            disabled={downloadingId === l.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition disabled:opacity-50"
                          >
                            {downloadingId === l.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            ) : (
                              <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>Unduh PDF Resmi</span>
                          </button>

                          <Link
                            href={`/verifikasi?ref=${encodeURIComponent(l.letter_number)}&type=SURAT`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Verifikasi</span>
                          </Link>

                          {l.file_url && (
                            <a
                              href={l.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span>Lampiran</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {inboxTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                    <span>
                      Hal. <strong className="text-slate-900">{safeInboxPage}</strong> /{' '}
                      {inboxTotalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeInboxPage <= 1}
                        onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sebelumnya</span>
                      </button>
                      <button
                        type="button"
                        disabled={safeInboxPage >= inboxTotalPages}
                        onClick={() => setInboxPage((p) => Math.min(inboxTotalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Laporan Penyelesaian Disposisi (Pengganti window.prompt) */}
      {completeDispModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-complete-disp-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updatingDispId) {
              setCompleteDispModal(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={dispModalRef}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="space-y-1 min-w-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                  <UserCheck className="w-3 h-3" />
                  <span>LAPORAN TINDAK LANJUT DISPOSISI</span>
                </span>
                <h3
                  id="modal-complete-disp-title"
                  className="text-base font-bold text-slate-900 break-words"
                >
                  Selesaikan Disposisi Surat Masuk
                </h3>
              </div>
              <button
                type="button"
                disabled={Boolean(updatingDispId)}
                onClick={() => setCompleteDispModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                aria-label="Tutup modal laporan disposisi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitDispositionUpdate(
                  completeDispModal.disp,
                  'SELESAI',
                  completeDispModal.notes.trim() || 'Telah ditindaklanjuti sesuai instruksi.'
                );
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label
                  htmlFor="ss-disp-completion-notes"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Laporan Hasil Tindak Lanjut
                </label>
                <textarea
                  id="ss-disp-completion-notes"
                  rows={3}
                  required
                  value={completeDispModal.notes}
                  onChange={(e) =>
                    setCompleteDispModal((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null
                    )
                  }
                  placeholder="Tuliskan ringkasan hasil tindak lanjut disposisi ini..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={Boolean(updatingDispId)}
                  onClick={() => setCompleteDispModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={Boolean(updatingDispId)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
                >
                  {updatingDispId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Simpan &amp; Tandai Selesai</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
