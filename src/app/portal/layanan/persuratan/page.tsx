'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Inbox,
  Loader2,
  Paperclip,
  PlusCircle,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { DigitalStudentCard } from '@/components/portal/cards/digital-card-viewer';
import {
  extractIssuedLetter,
  type LetterDispositionRow,
  type LetterRequestRow,
} from '@/components/portal/persuratan/self-service-persuratan-workspace';
import {
  exportLettersAgendaToCsv,
  exportLettersAgendaToPdf,
  exportSingleLetterArchivePdf,
  extractLinkedStudent,
  extractLinkedTeacher,
  formatLetterCategoryLabel,
  generateSuggestedLetterNumber,
  getDefaultClassificationCode,
  LETTER_CATEGORY_OPTIONS,
  LETTER_PRIORITY_OPTIONS,
  LETTER_STATUS_OPTIONS,
  type InstitutionInfoForLetter,
  type LetterCategory,
  type LetterDirection,
  type LetterPriority,
  type LetterRecord,
  type LetterStatus,
} from '@/lib/domain/persuratan-agenda-pdf';
import {
  buildDefaultOfficialLetterBody,
  generateOfficialLetterPdf,
  inferCityFromAddress,
  type OfficialLetterCustomOptions,
} from '@/lib/domain/official-letter-pdf';

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  nik?: string | null;
  gender?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  address?: string | null;
  entry_year?: number | null;
  status?: string | null;
  photo_url?: string | null;
  qr_token?: string | null;
}

interface TeacherOpt {
  id: string;
  full_name: string;
  nip: string | null;
  nuptk?: string | null;
  gender?: string | null;
  staff_type?: string | null;
  employment_status?: string | null;
  education_level?: string | null;
  major?: string | null;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type DatePreset = 'ALL' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';
type LinkFilter = 'ALL' | 'WITH_STUDENT' | 'WITH_TEACHER' | 'WITH_FILE';
type ActiveWorkspaceTab = 'PERSURATAN' | 'PERMOHONAN' | 'DISPOSISI' | 'KARTU_PELAJAR';

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialFormState(inst?: InstitutionInfoForLetter | null) {
  return {
    id: '' as string,
    direction: 'KELUAR' as LetterDirection,
    category: 'SURAT_KETERANGAN_AKTIF' as LetterCategory,
    letter_number: '',
    letter_date: getTodayIsoDate(),
    classification_code: 'PP.00.6',
    priority: 'BIASA' as LetterPriority,
    status: 'TERBIT' as LetterStatus,
    subject: '',
    counterparty: '',
    student_id: '',
    teacher_id: '',
    signatory_name: inst?.headmaster_name || '',
    signatory_title: inst?.head_title_label || 'Kepala Madrasah',
    summary: '',
    file_url: '',
    attachment_name: '',
  };
}

export default function PersuratanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.PERSURATAN_MANAGE);
  const canReviewRequests = hasPermission([...PERMISSIONS.PERSURATAN_MANAGE, 'KEPALA_LEMBAGA']);

  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('PERSURATAN');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    'ALL' | 'PENDING' | 'DISETUJUI' | 'DITOLAK'
  >('ALL');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [letters, setLetters] = useState<LetterRecord[]>([]);
  const [letterRequests, setLetterRequests] = useState<LetterRequestRow[]>([]);
  const [dispositions, setDispositions] = useState<LetterDispositionRow[]>([]);
  const [institution, setInstitution] = useState<InstitutionInfoForLetter | null>(null);
  const [selectedCardStudentId, setSelectedCardStudentId] = useState('');
  const [previewLetter, setPreviewLetter] = useState<LetterRecord | null>(null);

  // Modal Buat Disposisi Surat Masuk (Fase 4)
  const [dispositionTargetLetter, setDispositionTargetLetter] = useState<LetterRecord | null>(null);
  const [submittingDisposition, setSubmittingDisposition] = useState(false);
  const [dispositionForm, setDispositionForm] = useState({
    assigned_to_teacher_id: '',
    instruction: 'Untuk Ditindaklanjuti Sesuai Ketentuan',
    notes: '',
    priority: 'BIASA' as LetterPriority,
    due_date: '',
  });

  // Modal Generator Naskah Surat Resmi (Fase 2)
  const [composerLetter, setComposerLetter] = useState<LetterRecord | null>(null);
  const [composerOptions, setComposerOptions] = useState<OfficialLetterCustomOptions>({
    issueCity: '',
    attachmentCountLabel: '-',
    customBodyText: '',
    signatoryName: '',
    signatoryTitle: '',
    signatoryNip: '',
    ccListText: 'Arsip Tata Usaha',
  });
  const [generatingOfficialPdf, setGeneratingOfficialPdf] = useState(false);

  // Filter States
  const [letterSearch, setLetterSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | LetterDirection>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('ALL');

  // Form State (Create & Edit)
  const [letterForm, setLetterForm] = useState(() => createInitialFormState(null));
  const isEditing = Boolean(letterForm.id);

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

  const fetchPersuratanData = useCallback(async () => {
    const [biRes, surRes, reqRes, dispRes] = await Promise.all([
      fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
      fetch('/api/layanan/persuratan', { cache: 'no-store' }),
      fetch('/api/layanan/persuratan/permohonan', { cache: 'no-store' }),
      fetch('/api/layanan/persuratan/disposisi', { cache: 'no-store' }),
    ]);

    const bi = await biRes.json().catch(() => null);
    const sur = await surRes.json().catch(() => null);
    const reqData = await reqRes.json().catch(() => null);
    const dispData = await dispRes.json().catch(() => null);

    if (!surRes.ok || !sur) {
      throw new Error(sur?.error || 'Gagal memuat arsip persuratan dari server.');
    }
    if (!biRes.ok || !bi) {
      throw new Error(bi?.error || 'Gagal memuat data warga madrasah dari Buku Induk.');
    }

    return {
      students: (bi.students || []) as StudentOpt[],
      teachers: (bi.teachers || []) as TeacherOpt[],
      letters: (sur.letters || []) as LetterRecord[],
      letterRequests: (reqData?.requests || []) as LetterRequestRow[],
      dispositions: (dispData?.dispositions || []) as LetterDispositionRow[],
      institution: (sur.institution || null) as InstitutionInfoForLetter | null,
    };
  }, []);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchPersuratanData();
        setStudents(data.students);
        setTeachers(data.teachers);
        setLetters(data.letters);
        setLetterRequests(data.letterRequests);
        setDispositions(data.dispositions);
        setInstitution(data.institution);
        setLoadError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data persuratan.';
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
    [fetchPersuratanData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPersuratanData();
        if (!cancelled) {
          setStudents(data.students);
          setTeachers(data.teachers);
          setLetters(data.letters);
          setLetterRequests(data.letterRequests);
          setDispositions(data.dispositions);
          setInstitution(data.institution);
          setLetterForm((prev) => ({
            ...prev,
            signatory_name: prev.signatory_name || data.institution?.headmaster_name || '',
            signatory_title:
              prev.signatory_title || data.institution?.head_title_label || 'Kepala Madrasah',
          }));
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data persuratan.'
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
  }, [fetchPersuratanData]);

  const handleCategoryChange = (nextCategory: LetterCategory) => {
    setLetterForm((prev) => ({
      ...prev,
      category: nextCategory,
      classification_code: getDefaultClassificationCode(nextCategory),
    }));
  };

  const handleAutoNumber = () => {
    const suggested = generateSuggestedLetterNumber({
      category: letterForm.category,
      letterDate: letterForm.letter_date,
      classificationCode: letterForm.classification_code,
      institutionShortName: institution?.short_name || institution?.name,
      existingLetters: letters,
    });
    setLetterForm((prev) => ({
      ...prev,
      letter_number: suggested,
    }));
    showToast(`Nomor surat otomatis dibuat: ${suggested}`, 'success');
  };

  const handleSmartFillDraft = () => {
    const selectedStudent = students.find((s) => s.id === letterForm.student_id) || null;
    const selectedTeacher = teachers.find((t) => t.id === letterForm.teacher_id) || null;
    const categoryLabel = formatLetterCategoryLabel(letterForm.category);

    let suggestedNumber = letterForm.letter_number.trim();
    if (!suggestedNumber && letterForm.direction === 'KELUAR') {
      suggestedNumber = generateSuggestedLetterNumber({
        category: letterForm.category,
        letterDate: letterForm.letter_date,
        classificationCode: letterForm.classification_code,
        institutionShortName: institution?.short_name || institution?.name,
        existingLetters: letters,
      });
    }

    let suggestedSubject = letterForm.subject.trim();
    if (!suggestedSubject) {
      if (selectedStudent) {
        suggestedSubject = `${categoryLabel} a.n. ${selectedStudent.full_name}${
          selectedStudent.nis ? ` (NIS: ${selectedStudent.nis})` : ''
        }`;
      } else if (selectedTeacher) {
        suggestedSubject = `${categoryLabel} a.n. ${selectedTeacher.full_name}`;
      } else {
        suggestedSubject = `${categoryLabel} ${institution?.short_name || institution?.name || ''}`.trim();
      }
    }

    let suggestedSummary = letterForm.summary.trim();
    if (!suggestedSummary) {
      switch (letterForm.category) {
        case 'SURAT_KETERANGAN_AKTIF':
          suggestedSummary =
            'Persyaratan administrasi pengajuan beasiswa / pembukaan rekening tabungan pelajar / pendaftaran kegiatan.';
          break;
        case 'SURAT_MUTASI':
          suggestedSummary =
            'Permohonan pindah / mutasi belajar atas permintaan orang tua/wali peserta didik.';
          break;
        case 'SURAT_REKOMENDASI':
          suggestedSummary =
            'Rekomendasi keikutsertaan kompetisi akademik/non-akademik dan seleksi beasiswa berprestasi.';
          break;
        case 'SURAT_TUGAS':
          suggestedSummary =
            'Melaksanakan tugas dinas / kegiatan peningkatan kompetensi pendidik dan tenaga kependidikan.';
          break;
        case 'SURAT_UNDANGAN':
          suggestedSummary =
            'Menghadiri rapat koordinasi dan musyawarah program akademik di ruang pertemuan utama.';
          break;
        case 'SURAT_EDARAN':
          suggestedSummary =
            'Pemberitahuan resmi terkait pelaksanaan agenda akademik dan ketertiban lingkungan lembaga.';
          break;
        case 'SURAT_PANGGILAN':
          suggestedSummary =
            'Koordinasi dan konsultasi pembinaan akademik serta kehadiran peserta didik bersama Wali Kelas / Guru BK.';
          break;
        default:
          suggestedSummary = `Pelaksanaan administrasi ${categoryLabel.toLowerCase()} sesuai ketentuan lembaga.`;
      }
    }

    setLetterForm((prev) => ({
      ...prev,
      letter_number: suggestedNumber || prev.letter_number,
      subject: suggestedSubject,
      summary: suggestedSummary,
      signatory_name: prev.signatory_name || institution?.headmaster_name || '',
      signatory_title:
        prev.signatory_title || institution?.head_title_label || 'Kepala Madrasah',
    }));

    showToast('Draf nomor, perihal, dan ringkasan naskah surat berhasil diisi otomatis.', 'success');
  };

  const handleOpenOfficialComposer = (letter: LetterRecord) => {
    const fullStudent =
      students.find((s) => s.id === letter.student_id) || extractLinkedStudent(letter);
    const fullTeacher =
      teachers.find((t) => t.id === letter.teacher_id) || extractLinkedTeacher(letter);
    const enrichedLetter: LetterRecord = {
      ...letter,
      student: fullStudent || letter.student,
      teacher: fullTeacher || letter.teacher,
    };

    const defaultCity = inferCityFromAddress(institution?.address);
    const defaultBody = buildDefaultOfficialLetterBody({
      letter: enrichedLetter,
      institution,
    });

    setComposerLetter(enrichedLetter);
    setComposerOptions({
      issueCity: defaultCity,
      attachmentCountLabel: letter.file_url ? '1 (Satu) Berkas' : '-',
      customBodyText: defaultBody,
      signatoryName: letter.signatory_name || institution?.headmaster_name || 'Kepala Lembaga',
      signatoryTitle:
        letter.signatory_title || institution?.head_title_label || 'Kepala Madrasah',
      signatoryNip: '',
      ccListText: 'Arsip Tata Usaha',
    });
  };

  const handleGenerateOfficialPdf = async () => {
    if (!composerLetter || generatingOfficialPdf) return;
    setGeneratingOfficialPdf(true);
    try {
      await generateOfficialLetterPdf({
        letter: composerLetter,
        institution,
        options: composerOptions,
      });
      showToast(
        `Naskah Surat Resmi "${composerLetter.letter_number}" ber-Kop & TTE QR berhasil diunduh.`,
        'success'
      );
      setComposerLetter(null);
    } catch {
      showToast('Gagal membuat dokumen PDF Naskah Surat Resmi.', 'error');
    } finally {
      setGeneratingOfficialPdf(false);
    }
  };

  const handleResetForm = () => {
    setLetterForm(createInitialFormState(institution));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartEdit = (letter: LetterRecord) => {
    setActiveTab('PERSURATAN');
    setLetterForm({
      id: letter.id,
      direction: (letter.direction === 'MASUK' ? 'MASUK' : 'KELUAR') as LetterDirection,
      category: (letter.category || 'LAINNYA') as LetterCategory,
      letter_number: letter.letter_number || '',
      letter_date: letter.letter_date || getTodayIsoDate(),
      classification_code:
        letter.classification_code || getDefaultClassificationCode(letter.category),
      priority: ((letter.priority as LetterPriority) || 'BIASA') as LetterPriority,
      status: ((letter.status as LetterStatus) || 'TERBIT') as LetterStatus,
      subject: letter.subject || '',
      counterparty: letter.counterparty || '',
      student_id: letter.student_id || '',
      teacher_id: letter.teacher_id || '',
      signatory_name: letter.signatory_name || institution?.headmaster_name || '',
      signatory_title:
        letter.signatory_title || institution?.head_title_label || 'Kepala Madrasah',
      summary: letter.summary || '',
      file_url: letter.file_url || '',
      attachment_name: letter.attachment_name || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', letterForm.category);

      const res = await fetch('/api/layanan/persuratan/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.fileUrl) {
        showToast(data?.error || 'Gagal mengunggah berkas lampiran surat.', 'error');
        return;
      }

      setLetterForm((prev) => ({
        ...prev,
        file_url: data.fileUrl,
        attachment_name: data.fileName || file.name,
      }));
      showToast(`Berkas "${file.name}" berhasil diunggah.`, 'success');
    } catch {
      showToast('Gagal mengunggah berkas. Periksa koneksi Anda.', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  async function submitLetter(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submitting) return;

    const trimmedNumber = letterForm.letter_number.trim();
    const trimmedSubject = letterForm.subject.trim();

    if (trimmedNumber.length < 2) {
      showToast('Nomor surat minimal 2 karakter.', 'error');
      return;
    }
    if (trimmedSubject.length < 3) {
      showToast('Perihal / subjek surat minimal 3 karakter.', 'error');
      return;
    }
    if (!letterForm.letter_date) {
      showToast('Tanggal surat wajib diisi.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const payload = {
        ...(isEditing ? { id: letterForm.id } : {}),
        direction: letterForm.direction,
        category: letterForm.category,
        letter_number: trimmedNumber,
        letter_date: letterForm.letter_date,
        classification_code: letterForm.classification_code.trim() || null,
        priority: letterForm.priority,
        status: letterForm.status,
        subject: trimmedSubject,
        counterparty: letterForm.counterparty.trim() || null,
        student_id: letterForm.student_id || null,
        teacher_id: letterForm.teacher_id || null,
        signatory_name: letterForm.signatory_name.trim() || null,
        signatory_title: letterForm.signatory_title.trim() || null,
        summary: letterForm.summary.trim() || null,
        file_url: letterForm.file_url.trim() || null,
        attachment_name: letterForm.attachment_name.trim() || null,
      };

      const res = await fetch('/api/layanan/persuratan', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyimpan arsip surat.', 'error');
        return;
      }

      showToast(
        isEditing
          ? `Arsip surat "${trimmedNumber}" berhasil diperbarui.`
          : `Arsip surat "${trimmedNumber}" berhasil disimpan.`,
        'success'
      );
      handleResetForm();
      await loadData('refresh');
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLetter(letter: LetterRecord) {
    if (!canManage || deletingId) return;
    const confirmed = window.confirm(
      `Hapus arsip surat "${letter.letter_number}" (${letter.subject}) secara permanen?`
    );
    if (!confirmed) return;

    setDeletingId(letter.id);
    try {
      const res = await fetch(`/api/layanan/persuratan?id=${encodeURIComponent(letter.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menghapus arsip surat.', 'error');
        return;
      }

      if (letterForm.id === letter.id) {
        handleResetForm();
      }
      if (previewLetter?.id === letter.id) {
        setPreviewLetter(null);
      }
      setLetters((prev) => prev.filter((item) => item.id !== letter.id));
      showToast(`Arsip surat "${letter.letter_number}" telah dihapus.`, 'success');
    } catch {
      showToast('Gagal menghapus arsip surat.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const letterSummary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let withFile = 0;
    let linkedWarga = 0;
    for (const l of letters) {
      if (l.direction === 'MASUK') masuk += 1;
      else if (l.direction === 'KELUAR') keluar += 1;
      if (l.file_url) withFile += 1;
      if (l.student_id || l.teacher_id) linkedWarga += 1;
    }
    return { total: letters.length, masuk, keluar, withFile, linkedWarga };
  }, [letters]);

  const filteredLetters = useMemo(() => {
    const q = letterSearch.trim().toLowerCase();
    const now = new Date();
    const currentYearPrefix = String(now.getFullYear());
    const currentMonthPrefix = `${currentYearPrefix}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return letters.filter((l) => {
      if (directionFilter !== 'ALL' && l.direction !== directionFilter) return false;
      if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;

      if (datePreset === 'THIS_MONTH' && !String(l.letter_date || '').startsWith(currentMonthPrefix)) {
        return false;
      }
      if (datePreset === 'THIS_YEAR' && !String(l.letter_date || '').startsWith(currentYearPrefix)) {
        return false;
      }
      if (datePreset === 'CUSTOM') {
        if (customStartDate && l.letter_date < customStartDate) return false;
        if (customEndDate && l.letter_date > customEndDate) return false;
      }

      if (linkFilter === 'WITH_STUDENT' && !l.student_id) return false;
      if (linkFilter === 'WITH_TEACHER' && !l.teacher_id) return false;
      if (linkFilter === 'WITH_FILE' && !l.file_url) return false;

      if (q) {
        const student = extractLinkedStudent(l);
        const teacher = extractLinkedTeacher(l);
        const haystack = [
          l.letter_number,
          l.subject,
          l.counterparty || '',
          l.category,
          formatLetterCategoryLabel(l.category),
          l.classification_code || '',
          l.summary || '',
          student?.full_name || '',
          student?.nis || '',
          teacher?.full_name || '',
          teacher?.nip || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    categoryFilter,
    customEndDate,
    customStartDate,
    datePreset,
    directionFilter,
    letterSearch,
    letters,
    linkFilter,
  ]);

  const handleExportAgendaPdf = async () => {
    if (filteredLetters.length === 0) {
      showToast('Tidak ada data surat pada filter aktif untuk diekspor.', 'error');
      return;
    }
    setExportingPdf(true);
    try {
      const directionLabel =
        directionFilter === 'ALL'
          ? 'Semua Arah (Masuk & Keluar)'
          : directionFilter === 'KELUAR'
            ? 'Surat Keluar'
            : 'Surat Masuk';
      const categoryLabel =
        categoryFilter === 'ALL' ? 'Semua Kategori' : formatLetterCategoryLabel(categoryFilter);
      const periodLabel =
        datePreset === 'ALL'
          ? 'Semua Periode'
          : datePreset === 'THIS_MONTH'
            ? 'Bulan Ini'
            : datePreset === 'THIS_YEAR'
              ? 'Tahun Ini'
              : `${customStartDate || '...'} s/d ${customEndDate || '...'}`;

      await exportLettersAgendaToPdf({
        institution,
        letters: filteredLetters,
        filterSummary: { directionLabel, categoryLabel, periodLabel },
      });
      showToast('Buku Agenda Persuratan PDF berhasil diunduh.', 'success');
    } catch {
      showToast('Gagal membuat dokumen PDF Buku Agenda.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredLetters.length === 0) {
      showToast('Tidak ada data surat pada filter aktif untuk diekspor.', 'error');
      return;
    }
    exportLettersAgendaToCsv(filteredLetters);
    showToast('Buku Agenda Persuratan (CSV/Excel) berhasil diunduh.', 'success');
  };

  const handlePrintSingleLetter = async (letter: LetterRecord) => {
    try {
      await exportSingleLetterArchivePdf({ letter, institution });
      showToast(`Lembar registrasi surat "${letter.letter_number}" diunduh.`, 'success');
    } catch {
      showToast('Gagal mencetak lembar arsip surat.', 'error');
    }
  };

  const handleOpenDispositionModal = (letter: LetterRecord) => {
    setDispositionTargetLetter(letter);
    setDispositionForm({
      assigned_to_teacher_id: teachers[0]?.id || '',
      instruction: 'Untuk Ditindaklanjuti Sesuai Ketentuan',
      notes: '',
      priority: ((letter.priority as LetterPriority) || 'BIASA') as LetterPriority,
      due_date: '',
    });
  };

  const handleSubmitDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispositionTargetLetter || submittingDisposition) return;
    if (!dispositionForm.assigned_to_teacher_id) {
      showToast('Pilih pejabat / GTK penerima disposisi.', 'error');
      return;
    }

    setSubmittingDisposition(true);
    try {
      const res = await fetch('/api/layanan/persuratan/disposisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letter_id: dispositionTargetLetter.id,
          assigned_to_teacher_id: dispositionForm.assigned_to_teacher_id,
          instruction: dispositionForm.instruction,
          notes: dispositionForm.notes.trim() || null,
          priority: dispositionForm.priority,
          due_date: dispositionForm.due_date || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyimpan disposisi surat masuk.', 'error');
        return;
      }

      showToast(
        `Surat "${dispositionTargetLetter.letter_number}" berhasil didisposisikan dan notifikasi telah dikirim.`,
        'success'
      );
      setDispositionTargetLetter(null);
      await loadData('refresh');
    } catch {
      showToast('Gagal mengirim disposisi surat masuk.', 'error');
    } finally {
      setSubmittingDisposition(false);
    }
  };

  const handleUpdateDispositionStatusAdmin = async (
    dispId: string,
    nextStatus: 'DIBACA' | 'DITINDAKLANJUTI' | 'SELESAI'
  ) => {
    try {
      const res = await fetch('/api/layanan/persuratan/disposisi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dispId, status: nextStatus }),
      });
      if (res.ok) {
        showToast(`Status disposisi diperbarui menjadi ${nextStatus}.`, 'success');
        await loadData('refresh');
      }
    } catch {
      showToast('Gagal memperbarui disposisi.', 'error');
    }
  };

  const handleReviewRequest = async (
    reqItem: LetterRequestRow,
    action: 'DIVERIFIKASI_TU' | 'DISETUJUI' | 'DITOLAK'
  ) => {
    if (!canReviewRequests || reviewingId) return;

    let reviewerNotes: string | null = null;
    if (action === 'DITOLAK') {
      const reason = window.prompt(
        `Masukkan alasan penolakan untuk permohonan "${reqItem.subject}":`,
        reqItem.reviewer_notes || ''
      );
      if (reason === null) return;
      reviewerNotes = reason.trim() || 'Permohonan belum memenuhi syarat administrasi.';
    } else if (action === 'DISETUJUI') {
      const note = window.prompt(
        `Setujui & terbitkan Naskah Surat Resmi otomatis untuk "${reqItem.subject}"?\nTambahkan catatan untuk pemohon (opsional):`,
        reqItem.reviewer_notes || 'Surat resmi telah disetujui dan diterbitkan.'
      );
      if (note === null) return;
      reviewerNotes = note.trim() || null;
    }

    setReviewingId(reqItem.id);
    try {
      const res = await fetch('/api/layanan/persuratan/permohonan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqItem.id,
          action,
          reviewer_notes: reviewerNotes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal memproses permohonan surat.', 'error');
        return;
      }

      showToast(
        action === 'DISETUJUI'
          ? `Permohonan "${reqItem.request_number}" disetujui & Surat Resmi otomatis diterbitkan!`
          : action === 'DIVERIFIKASI_TU'
            ? `Permohonan "${reqItem.request_number}" telah ditandai Diverifikasi TU.`
            : `Permohonan "${reqItem.request_number}" telah ditolak.`,
        'success'
      );
      await loadData('refresh');
    } catch {
      showToast('Gagal memproses permohonan surat.', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  const pendingRequestsCount = useMemo(
    () =>
      letterRequests.filter((r) => r.status === 'DIAJUKAN' || r.status === 'DIVERIFIKASI_TU')
        .length,
    [letterRequests]
  );

  const filteredRequests = useMemo(() => {
    return letterRequests.filter((r) => {
      if (requestStatusFilter === 'PENDING') {
        return r.status === 'DIAJUKAN' || r.status === 'DIVERIFIKASI_TU';
      }
      if (requestStatusFilter === 'DISETUJUI') return r.status === 'DISETUJUI';
      if (requestStatusFilter === 'DITOLAK') return r.status === 'DITOLAK';
      return true;
    });
  }, [letterRequests, requestStatusFilter]);

  const resetAllFilters = () => {
    setLetterSearch('');
    setDirectionFilter('ALL');
    setCategoryFilter('ALL');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setLinkFilter('ALL');
  };

  const hasActiveFilter =
    Boolean(letterSearch.trim()) ||
    directionFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    linkFilter !== 'ALL';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat layanan persuratan, arsip digital &amp; kartu pelajar...</span>
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
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Layanan Persuratan</h1>
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

  const cardStudent = students.find((s) => s.id === selectedCardStudentId) || students[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2.5 shadow-sm ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span className="min-w-0 break-words">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Ringkasan Statistik */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>E-Office Persuratan, Generator Naskah Dinas &amp; Kartu Digital</span>
              </h1>
              {!canManage && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                  <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Pusat registrasi tata naskah surat masuk/keluar, penomoran otomatis, generator PDF
              Surat Resmi ber-Kop Madrasah &amp; TTE QR Code, serta ekspor Buku Agenda.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Link
              href="/persuratan-publik"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              title="Buka halaman Drop-Box Surat Masuk Eksternal & Papan Edaran Publik"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
              <span>Drop-Box Publik</span>
            </Link>

            <button
              type="button"
              onClick={() => void handleExportAgendaPdf()}
              disabled={exportingPdf || filteredLetters.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
              title="Unduh Buku Agenda Surat Masuk & Keluar resmi (PDF dengan QR Code)"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>Buku Agenda PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLetters.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-900 text-xs font-semibold transition disabled:opacity-50"
              title="Unduh Buku Agenda dalam format CSV / Microsoft Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ekspor Excel/CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void loadData('refresh')}
              disabled={refreshing || submitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
              title="Muat ulang data persuratan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Kartu Metrik Ringkas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total Arsip Surat</p>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">{letterSummary.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
            <p className="text-[11px] font-medium text-emerald-800">Surat Keluar</p>
            <p className="text-lg font-extrabold text-emerald-900 mt-0.5">{letterSummary.keluar}</p>
          </div>
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-3.5">
            <p className="text-[11px] font-medium text-sky-800">Surat Masuk</p>
            <p className="text-lg font-extrabold text-sky-900 mt-0.5">{letterSummary.masuk}</p>
          </div>
          <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-3.5">
            <p className="text-[11px] font-medium text-violet-800">Tertaut Siswa / GTK</p>
            <p className="text-lg font-extrabold text-violet-900 mt-0.5">
              {letterSummary.linkedWarga}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5">
            <p className="text-[11px] font-medium text-amber-800">Memiliki Berkas Scan</p>
            <p className="text-lg font-extrabold text-amber-900 mt-0.5">{letterSummary.withFile}</p>
          </div>
        </div>

        {/* Navigasi Sub-Tab Workspace */}
        <div className="flex items-center gap-2 border-t border-slate-200/70 pt-4 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('PERSURATAN')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'PERSURATAN'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Arsip &amp; Generator Surat Resmi ({letters.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PERMOHONAN')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'PERMOHONAN'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Antrean Permohonan Warga ({letterRequests.length})</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                {pendingRequestsCount} Baru
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DISPOSISI')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'DISPOSISI'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Disposisi Surat Masuk ({dispositions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('KARTU_PELAJAR')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'KARTU_PELAJAR'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Kartu Pelajar Digital ({students.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'PERMOHONAN' ? (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-700" />
                <span>Antrean Permohonan Surat &amp; Izin Warga Madrasah ({filteredRequests.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Verifikasi dan setujui permohonan surat dari Siswa, Orang Tua/Wali, maupun GTK. Saat
                disetujui, sistem otomatis menerbitkan Nomor Surat &amp; Naskah Resmi ber-QR Code.
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'ALL', label: `Semua (${letterRequests.length})` },
                  { key: 'PENDING', label: `Menunggu (${pendingRequestsCount})` },
                  { key: 'DISETUJUI', label: 'Disetujui' },
                  { key: 'DITOLAK', label: 'Ditolak' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRequestStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    requestStatusFilter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500">
              Belum ada permohonan surat dari warga madrasah pada filter ini.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const issued = extractIssuedLetter(req);
                const isProcessing = reviewingId === req.id;

                return (
                  <div
                    key={req.id}
                    className="modular-card rounded-2xl p-4 space-y-3 text-xs border border-slate-200/80"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">
                            {req.request_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                            Pemohon: {req.requester_name} ({req.requester_role})
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

                        <p className="font-bold text-slate-900 text-sm">{req.subject}</p>
                        <p className="text-[11px] text-slate-600">
                          <strong>{formatLetterCategoryLabel(req.category)}</strong>
                          {req.counterparty ? ` • Tujuan: ${req.counterparty}` : ''}
                          {req.leave_start_date
                            ? ` • Periode Izin (${req.leave_type || 'IZIN'}): ${req.leave_start_date} s/d ${
                                req.leave_end_date || req.leave_start_date
                              }`
                            : ''}
                        </p>
                      </div>

                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {req.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 text-[11px] text-slate-700">
                      <strong>Keperluan / Alasan:</strong> {req.purpose}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {req.student?.full_name && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-medium">
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>
                            Siswa: <strong>{req.student.full_name}</strong>
                            {req.student.nis ? ` (${req.student.nis})` : ''}
                          </span>
                        </span>
                      )}

                      {req.teacher?.full_name && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-medium">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>
                            GTK: <strong>{req.teacher.full_name}</strong>
                          </span>
                        </span>
                      )}

                      {req.attachment_url && (
                        <a
                          href={req.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>{req.attachment_name || 'Buka Bukti Lampiran'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {req.reviewer_notes && (
                      <p className="text-[11px] text-slate-600 italic">
                        Catatan Verifikator: &ldquo;{req.reviewer_notes}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 flex-wrap">
                      {issued ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-emerald-800">
                            ✓ Terbit No: {issued.letter_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenOfficialComposer(issued)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Cetak Surat Resmi (PDF)</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          {req.status === 'DITOLAK'
                            ? 'Permohonan telah ditolak.'
                            : 'Menunggu persetujuan untuk menerbitkan nomor surat resmi.'}
                        </span>
                      )}

                      {canReviewRequests && req.status !== 'DISETUJUI' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {req.status === 'DIAJUKAN' && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => void handleReviewRequest(req, 'DIVERIFIKASI_TU')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-semibold disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-sky-700" />
                              )}
                              <span>Verifikasi TU</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void handleReviewRequest(req, 'DISETUJUI')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileCheck2 className="w-3.5 h-3.5" />
                            )}
                            <span>Setujui &amp; Terbitkan Surat</span>
                          </button>

                          {req.status !== 'DITOLAK' && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => void handleReviewRequest(req, 'DITOLAK')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'DISPOSISI' ? (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>Manajemen &amp; Pemantauan Disposisi Surat Masuk ({dispositions.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Pantau seluruh instruksi disposisi surat masuk dari Kepala Lembaga / TU kepada Wakil
                Kepala dan GTK beserta laporan penyelesaiannya.
              </p>
            </div>
          </div>

          {dispositions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 space-y-2">
              <p>Belum ada disposisi surat masuk yang tercatat.</p>
              <p className="text-[11px]">
                Buka tab <strong>Arsip &amp; Generator Surat Resmi</strong> lalu klik tombol{' '}
                <strong>Disposisikan</strong> pada kartu Surat Masuk untuk meneruskan surat ke GTK.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dispositions.map((d) => {
                const letterObj = Array.isArray(d.letter) ? d.letter[0] : d.letter;
                const assigneeObj = Array.isArray(d.assignee) ? d.assignee[0] : d.assignee;
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
                        <span className="font-mono font-bold text-slate-900">
                          Surat No: {letterObj?.letter_number || '-'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 text-[10px] font-bold">
                          Kepada: {assigneeObj?.full_name || 'GTK'}
                        </span>
                      </div>

                      <span className="font-mono text-[11px] text-slate-500">
                        {d.due_date ? `Tenggat: ${d.due_date}` : d.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {letterObj?.subject || 'Surat Masuk'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Pengirim Surat: {letterObj?.counterparty || '-'} • Pemberi Disposisi:{' '}
                        {d.assigned_by_name || 'Kepala Lembaga / TU'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-[11px] space-y-1">
                      <p className="font-bold text-amber-950">
                        Instruksi: &ldquo;{d.instruction}&rdquo;
                      </p>
                      {d.notes && <p className="text-amber-900">{d.notes}</p>}
                    </div>

                    {d.completion_notes && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-950">
                        <strong>Laporan Tindak Lanjut GTK:</strong> {d.completion_notes}
                      </div>
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
                          <span>Lihat Scan Surat Masuk</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">Tanpa lampiran berkas</span>
                      )}

                      {canReviewRequests && d.status !== 'SELESAI' && (
                        <button
                          type="button"
                          onClick={() => void handleUpdateDispositionStatusAdmin(d.id, 'SELESAI')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tandai Selesai</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'KARTU_PELAJAR' ? (
        <div className="max-w-xl mx-auto glass-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Pratinjau &amp; Cetak Kartu Pelajar Digital</span>
            </h2>
            <p className="text-xs text-slate-500">
              Pilih siswa terdaftar dari Buku Induk untuk melihat, memverifikasi QR Code, atau mencetak
              Kartu Pelajar Digital resmi.
            </p>
          </div>

          {students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              Belum ada data siswa terdaftar untuk pratinjau kartu pelajar.
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label
                  htmlFor="card-student-select"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Pilih Siswa
                </label>
                <select
                  id="card-student-select"
                  value={selectedCardStudentId}
                  onChange={(e) => setSelectedCardStudentId(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                >
                  <option value="">-- Pilih Siswa (Default: Siswa Pertama) --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {cardStudent && <DigitalStudentCard student={cardStudent} />}
            </>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Form Registrasi / Edit Arsip Surat */}
          {canManage && (
            <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <Edit3 className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Edit Arsip Surat</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Registrasi &amp; Buat Surat Resmi</span>
                      </>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {isEditing
                      ? 'Perbarui metadata, tautan warga madrasah, penandatangan, atau lampiran berkas surat.'
                      : 'Catat surat ke Buku Agenda atau gunakan tombol Draf Otomatis untuk menerbitkan Naskah Surat Resmi.'}
                  </p>
                </div>

                {isEditing ? (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
                  >
                    <X className="w-3 h-3" />
                    Batal Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSmartFillDraft}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold shrink-0"
                    title="Isi otomatis Nomor Surat, Perihal, dan Ringkasan sesuai Kategori & Siswa/GTK yang dipilih"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Isi Draf Otomatis</span>
                  </button>
                )}
              </div>

              <form onSubmit={submitLetter} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="letter-direction"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Arah Surat
                    </label>
                    <select
                      id="letter-direction"
                      disabled={submitting}
                      value={letterForm.direction}
                      onChange={(e) =>
                        setLetterForm({
                          ...letterForm,
                          direction: e.target.value as LetterDirection,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="KELUAR">Surat Keluar</option>
                      <option value="MASUK">Surat Masuk</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="letter-category"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Kategori Surat
                    </label>
                    <select
                      id="letter-category"
                      disabled={submitting}
                      value={letterForm.category}
                      onChange={(e) => handleCategoryChange(e.target.value as LetterCategory)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      {LETTER_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tautan Warga Madrasah: Siswa & GTK (Diletakkan di atas agar tombol Isi Draf Otomatis langsung mengenal nama siswa/GTK) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-800">
                      Tautkan Warga Madrasah (Auto-Fill Biodata Surat)
                    </p>
                    <span className="text-[10px] text-slate-500">Opsional</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="letter-student"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Siswa Terkait
                      </label>
                      <select
                        id="letter-student"
                        disabled={submitting}
                        value={letterForm.student_id}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, student_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      >
                        <option value="">-- Tidak Ditautkan ke Siswa --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} {s.nis ? `(${s.nis})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="letter-teacher"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Guru / GTK Terkait
                      </label>
                      <select
                        id="letter-teacher"
                        disabled={submitting}
                        value={letterForm.teacher_id}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, teacher_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      >
                        <option value="">-- Tidak Ditautkan ke GTK --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name} {t.nip ? `(${t.nip})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Nomor Surat + Tombol Auto-Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="letter-number"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nomor Surat Resmi
                    </label>
                    {letterForm.direction === 'KELUAR' && (
                      <button
                        type="button"
                        onClick={handleAutoNumber}
                        disabled={submitting}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                        title="Buat nomor surat otomatis sesuai kode klasifikasi, bulan Romawi, dan urutan tahun berjalan"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Buat Nomor Otomatis</span>
                      </button>
                    )}
                  </div>
                  <input
                    id="letter-number"
                    required
                    minLength={2}
                    disabled={submitting}
                    placeholder="cth: B-012/MA-SIMMS/PP.00.6/XI/2026"
                    value={letterForm.letter_number}
                    onChange={(e) =>
                      setLetterForm({ ...letterForm, letter_number: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                {/* Tanggal, Kode Klasifikasi, Sifat & Status */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="col-span-2 sm:col-span-2 space-y-1">
                    <label
                      htmlFor="letter-date"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Tanggal Surat
                    </label>
                    <input
                      id="letter-date"
                      type="date"
                      required
                      disabled={submitting}
                      value={letterForm.letter_date}
                      onChange={(e) =>
                        setLetterForm({ ...letterForm, letter_date: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2 space-y-1">
                    <label
                      htmlFor="letter-classification"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Kode Klasifikasi
                    </label>
                    <input
                      id="letter-classification"
                      disabled={submitting}
                      placeholder="cth: PP.00.6 / KP.01.2"
                      value={letterForm.classification_code}
                      onChange={(e) =>
                        setLetterForm({ ...letterForm, classification_code: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="letter-priority"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Sifat Surat
                    </label>
                    <select
                      id="letter-priority"
                      disabled={submitting}
                      value={letterForm.priority}
                      onChange={(e) =>
                        setLetterForm({
                          ...letterForm,
                          priority: e.target.value as LetterPriority,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    >
                      {LETTER_PRIORITY_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1 sm:col-span-3 space-y-1">
                    <label
                      htmlFor="letter-status"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Status Dokumen
                    </label>
                    <select
                      id="letter-status"
                      disabled={submitting}
                      value={letterForm.status}
                      onChange={(e) =>
                        setLetterForm({
                          ...letterForm,
                          status: e.target.value as LetterStatus,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    >
                      {LETTER_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Perihal & Pengirim/Tujuan */}
                <div className="space-y-1">
                  <label
                    htmlFor="letter-subject"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Perihal / Subjek Surat
                  </label>
                  <input
                    id="letter-subject"
                    required
                    minLength={3}
                    disabled={submitting}
                    placeholder="cth: Keterangan Siswa Aktif a.n. Ahmad Fauzi untuk Syarat Beasiswa"
                    value={letterForm.subject}
                    onChange={(e) => setLetterForm({ ...letterForm, subject: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="letter-counterparty"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    {letterForm.direction === 'MASUK'
                      ? 'Pengirim / Instansi Asal Surat'
                      : 'Tujuan / Penerima Surat'}
                  </label>
                  <input
                    id="letter-counterparty"
                    disabled={submitting}
                    placeholder={
                      letterForm.direction === 'MASUK'
                        ? 'cth: Kantor Kementerian Agama Kab/Kota'
                        : 'cth: Panitia Seleksi Beasiswa / Wali Murid'
                    }
                    value={letterForm.counterparty}
                    onChange={(e) => setLetterForm({ ...letterForm, counterparty: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                {/* Pejabat Penandatangan (Untuk Surat Keluar) */}
                {letterForm.direction === 'KELUAR' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="letter-signatory-name"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Pejabat Penandatangan (TTE)
                      </label>
                      <input
                        id="letter-signatory-name"
                        disabled={submitting}
                        placeholder={institution?.headmaster_name || 'Nama Kepala Madrasah'}
                        value={letterForm.signatory_name}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, signatory_name: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="letter-signatory-title"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Jabatan Penandatangan
                      </label>
                      <input
                        id="letter-signatory-title"
                        disabled={submitting}
                        placeholder={institution?.head_title_label || 'Kepala Madrasah'}
                        value={letterForm.signatory_title}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, signatory_title: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>
                )}

                {/* Ringkasan Isi / Catatan */}
                <div className="space-y-1">
                  <label
                    htmlFor="letter-summary"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Keperluan / Ringkasan Isi Naskah Surat
                  </label>
                  <textarea
                    id="letter-summary"
                    rows={3}
                    disabled={submitting}
                    placeholder="Tuliskan keperluan surat (otomatis dimasukkan ke dalam isi PDF Naskah Surat Resmi) atau catatan disposisi..."
                    value={letterForm.summary}
                    onChange={(e) => setLetterForm({ ...letterForm, summary: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                {/* Unggah Berkas Scan / Lampiran */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="letter-file-upload"
                      className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Berkas Scan / Lampiran Digital (PDF/Gambar)</span>
                    </label>
                    {letterForm.file_url && (
                      <button
                        type="button"
                        onClick={() =>
                          setLetterForm((prev) => ({
                            ...prev,
                            file_url: '',
                            attachment_name: '',
                          }))
                        }
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Hapus Lampiran
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      id="letter-file-upload"
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      disabled={uploadingFile || submitting}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile || submitting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-emerald-700" />
                      )}
                      <span>{uploadingFile ? 'Mengunggah...' : 'Pilih File Scan (Maks 5 MB)'}</span>
                    </button>

                    <input
                      type="url"
                      aria-label="Atau tempel URL berkas lampiran"
                      placeholder="Atau tempel URL berkas..."
                      disabled={submitting || uploadingFile}
                      value={letterForm.file_url.startsWith('data:') ? '' : letterForm.file_url}
                      onChange={(e) =>
                        setLetterForm((prev) => ({
                          ...prev,
                          file_url: e.target.value,
                          attachment_name: prev.attachment_name || 'Tautan Eksternal',
                        }))
                      }
                      className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>

                  {letterForm.file_url && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-900">
                      <span className="truncate font-medium">
                        Terlampir: {letterForm.attachment_name || 'Berkas Scan Dokumen'}
                      </span>
                      <a
                        href={letterForm.file_url}
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

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting || uploadingFile}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{isEditing ? 'Simpan Perubahan Surat' : 'Simpan Arsip Surat'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Kolom Kanan: Filter & Daftar Buku Agenda Arsip Surat */}
          <div
            className={`${
              canManage ? 'lg:col-span-7' : 'lg:col-span-12'
            } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Buku Agenda Arsip Digital ({filteredLetters.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Klik <strong>Cetak Surat Resmi (PDF)</strong> untuk menerbitkan naskah surat
                  ber-Kop Madrasah &amp; TTE QR Code.
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { key: 'ALL', label: 'Semua' },
                    { key: 'KELUAR', label: 'Keluar' },
                    { key: 'MASUK', label: 'Masuk' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDirectionFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      directionFilter === tab.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Baris Pencarian & Filter Lanjutan */}
            <div className="space-y-2.5">
              <div className="relative">
                <label htmlFor="letter-search" className="sr-only">
                  Cari arsip surat
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="letter-search"
                  type="search"
                  value={letterSearch}
                  onChange={(e) => setLetterSearch(e.target.value)}
                  placeholder="Cari nomor surat, perihal, pengirim/tujuan, nama siswa/GTK, atau ringkasan..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    aria-label="Filter kategori surat"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Kategori Surat</option>
                    {LETTER_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    aria-label="Filter periode tanggal surat"
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Waktu</option>
                    <option value="THIS_MONTH">Bulan Ini</option>
                    <option value="THIS_YEAR">Tahun Ini</option>
                    <option value="CUSTOM">Rentang Tanggal Kustom</option>
                  </select>
                </div>

                <div>
                  <select
                    aria-label="Filter keterkaitan surat"
                    value={linkFilter}
                    onChange={(e) => setLinkFilter(e.target.value as LinkFilter)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Keterkaitan &amp; Berkas</option>
                    <option value="WITH_STUDENT">Terkait Siswa</option>
                    <option value="WITH_TEACHER">Terkait Guru / GTK</option>
                    <option value="WITH_FILE">Memiliki Lampiran Scan</option>
                  </select>
                </div>
              </div>

              {datePreset === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>
              )}

              {hasActiveFilter && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>
                    Menampilkan <strong className="text-slate-800">{filteredLetters.length}</strong>{' '}
                    dari {letters.length} arsip surat
                  </span>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Reset Semua Filter
                  </button>
                </div>
              )}
            </div>

            {/* Daftar Surat */}
            {filteredLetters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  {letters.length === 0
                    ? 'Belum ada arsip surat tercatat.'
                    : 'Tidak ada arsip surat yang cocok dengan filter pencarian.'}
                </p>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Reset pencarian &amp; filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[44rem] overflow-y-auto pr-0.5">
                {filteredLetters.map((l) => {
                  const student = extractLinkedStudent(l);
                  const teacher = extractLinkedTeacher(l);
                  const priority = l.priority || 'BIASA';
                  const status = l.status || 'TERBIT';

                  return (
                    <div
                      key={l.id}
                      className={`modular-card rounded-2xl p-4 space-y-2.5 text-xs transition border ${
                        letterForm.id === l.id
                          ? 'border-amber-400 bg-amber-50/30'
                          : 'border-slate-200/80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                l.direction === 'MASUK'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {l.direction}
                            </span>

                            <span className="font-mono font-bold text-slate-900 break-all">
                              {l.letter_number}
                            </span>

                            {l.classification_code && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px]">
                                Kode: {l.classification_code}
                              </span>
                            )}

                            {priority !== 'BIASA' && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  priority === 'RAHASIA' || priority === 'SEGERA'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {priority}
                              </span>
                            )}

                            {status !== 'TERBIT' && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  status === 'DIBATALKAN'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {status}
                              </span>
                            )}
                          </div>

                          <p className="font-bold text-slate-900 text-sm break-words">
                            {l.subject}
                          </p>

                          <p className="text-[11px] text-slate-600 break-words">
                            <span className="font-semibold text-slate-700">
                              {formatLetterCategoryLabel(l.category)}
                            </span>{' '}
                            •{' '}
                            <span>
                              {l.direction === 'MASUK' ? 'Dari: ' : 'Kepada: '}
                              {l.counterparty || '-'}
                            </span>
                          </p>
                        </div>

                        <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-500">
                          {l.letter_date}
                        </span>
                      </div>

                      {l.summary && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/60 line-clamp-2">
                          {l.summary}
                        </p>
                      )}

                      {/* Badge Keterkaitan Siswa / GTK / Lampiran */}
                      {(student?.full_name || teacher?.full_name || l.file_url) && (
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {student?.full_name && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-[11px] font-medium">
                              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Siswa: <strong>{student.full_name}</strong>
                                {student.nis ? ` (${student.nis})` : ''}
                              </span>
                            </span>
                          )}

                          {teacher?.full_name && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 text-[11px] font-medium">
                              <UserCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                GTK: <strong>{teacher.full_name}</strong>
                              </span>
                            </span>
                          )}

                          {l.file_url && (
                            <a
                              href={l.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold transition"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span>{l.attachment_name || 'Buka Berkas Scan'}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Baris Tombol Aksi */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {l.direction === 'MASUK' && canReviewRequests && (
                            <button
                              type="button"
                              onClick={() => handleOpenDispositionModal(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-semibold transition shadow-2xs"
                              title="Disposisikan Surat Masuk ini kepada Wakil Kepala / Guru / Staf"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Disposisikan</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenOfficialComposer(l)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition shadow-2xs"
                            title="Terbitkan & Unduh Naskah Surat Resmi ber-Kop Madrasah & TTE QR Code (PDF)"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Cetak Surat Resmi (PDF)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewLetter(l)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handlePrintSingleLetter(l)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold transition"
                            title="Unduh Lembar Bukti Registrasi Arsip & QR Verifikasi (PDF)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Lembar Registrasi</span>
                          </button>

                          <Link
                            href={`/verifikasi?ref=${encodeURIComponent(l.letter_number)}&type=SURAT`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold transition"
                            title="Cek keaslian nomor surat di halaman Verifikasi Publik"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Verifikasi</span>
                          </Link>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDeleteLetter(l)}
                              disabled={deletingId === l.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition disabled:opacity-50"
                            >
                              {deletingId === l.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Hapus</span>
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
        </div>
      )}

      {/* Modal Buat Disposisi Surat Masuk (Fase 4) */}
      {dispositionTargetLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-disposition-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-900 text-[10px] font-bold">
                  DISPOSISI SURAT MASUK DIGITAL
                </span>
                <h3 id="modal-disposition-title" className="text-base font-bold text-slate-900 mt-1">
                  {dispositionTargetLetter.subject}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  No: {dispositionTargetLetter.letter_number} • Dari:{' '}
                  {dispositionTargetLetter.counterparty || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDispositionTargetLetter(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDisposition} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Diteruskan / Didisposisikan Kepada (Waka / Guru / Staf)
                </label>
                <select
                  required
                  value={dispositionForm.assigned_to_teacher_id}
                  onChange={(e) =>
                    setDispositionForm({
                      ...dispositionForm,
                      assigned_to_teacher_id: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">-- Pilih Pejabat / GTK Penerima Disposisi --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.nip ? `(${t.nip})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Instruksi Pokok Disposisi
                </label>
                <select
                  value={dispositionForm.instruction}
                  onChange={(e) =>
                    setDispositionForm({ ...dispositionForm, instruction: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="Untuk Ditindaklanjuti Sesuai Ketentuan">
                    Untuk Ditindaklanjuti Sesuai Ketentuan
                  </option>
                  <option value="Wakili Hadir & Laporkan Hasilnya">
                    Wakili Hadir &amp; Laporkan Hasilnya
                  </option>
                  <option value="Koordinasikan dengan Unit / Waka Terkait">
                    Koordinasikan dengan Unit / Waka Terkait
                  </option>
                  <option value="Siapkan Konsep Jawaban / Balasan Surat">
                    Siapkan Konsep Jawaban / Balasan Surat
                  </option>
                  <option value="Untuk Diketahui, Dipedomani & Diarsipkan">
                    Untuk Diketahui, Dipedomani &amp; Diarsipkan
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Sifat / Prioritas Disposisi
                  </label>
                  <select
                    value={dispositionForm.priority}
                    onChange={(e) =>
                      setDispositionForm({
                        ...dispositionForm,
                        priority: e.target.value as LetterPriority,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {LETTER_PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Batas Waktu Tindak Lanjut (Opsional)
                  </label>
                  <input
                    type="date"
                    value={dispositionForm.due_date}
                    onChange={(e) =>
                      setDispositionForm({ ...dispositionForm, due_date: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Catatan Tambahan Kepala Lembaga / TU (Opsional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan arahan khusus atau catatan disposisi..."
                  value={dispositionForm.notes}
                  onChange={(e) =>
                    setDispositionForm({ ...dispositionForm, notes: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={submittingDisposition}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingDisposition ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  <span>Kirim Disposisi &amp; Notifikasi GTK</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDispositionTargetLetter(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Generator & Kustomisasi Naskah Surat Resmi (Fase 2) */}
      {composerLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-composer-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                    GENERATOR NASKAH SURAT RESMI (KOP &amp; TTE QR)
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {composerLetter.letter_number}
                  </span>
                </div>
                <h3 id="modal-composer-title" className="text-base font-bold text-slate-900 mt-1">
                  {formatLetterCategoryLabel(composerLetter.category)}
                </h3>
                <p className="text-xs text-slate-500">
                  Sesuaikan redaksi paragraf naskah surat, pejabat penandatangan, dan tembusan
                  sebelum mengunduh PDF resmi.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setComposerLetter(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                aria-label="Tutup generator surat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Kota / Tempat Penerbitan Surat
                  </label>
                  <input
                    type="text"
                    value={composerOptions.issueCity || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, issueCity: e.target.value }))
                    }
                    placeholder="cth: Bandung / Jakarta"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Keterangan Lampiran
                  </label>
                  <input
                    type="text"
                    value={composerOptions.attachmentCountLabel || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({
                        ...prev,
                        attachmentCountLabel: e.target.value,
                      }))
                    }
                    placeholder="cth: - atau 1 (Satu) Berkas"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Redaksi Paragraf Isi Surat (Pisahkan antar-paragraf dengan baris kosong)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setComposerOptions((prev) => ({
                        ...prev,
                        customBodyText: buildDefaultOfficialLetterBody({
                          letter: composerLetter,
                          institution,
                        }),
                      }))
                    }
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Reset ke Template Standar
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={composerOptions.customBodyText || ''}
                  onChange={(e) =>
                    setComposerOptions((prev) => ({ ...prev, customBodyText: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Nama Pejabat Penandatangan
                  </label>
                  <input
                    type="text"
                    value={composerOptions.signatoryName || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, signatoryName: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Jabatan Penandatangan
                  </label>
                  <input
                    type="text"
                    value={composerOptions.signatoryTitle || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, signatoryTitle: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    NIP / NIY Pejabat (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Kosongkan jika tidak ada"
                    value={composerOptions.signatoryNip || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, signatoryNip: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Tembusan Surat (Opsional — satu penerima per baris)
                </label>
                <textarea
                  rows={2}
                  placeholder="cth: Arsip Tata Usaha"
                  value={composerOptions.ccListText || ''}
                  onChange={(e) =>
                    setComposerOptions((prev) => ({ ...prev, ccListText: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void handleGenerateOfficialPdf()}
                disabled={generatingOfficialPdf}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {generatingOfficialPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCheck2 className="w-4 h-4" />
                )}
                <span>Unduh Naskah Surat Resmi Ber-Kop &amp; TTE QR (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setComposerLetter(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail & Pratinjau Arsip Surat */}
      {previewLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-letter-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      previewLetter.direction === 'MASUK'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    SURAT {previewLetter.direction}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {previewLetter.letter_number}
                  </span>
                </div>
                <h3 id="modal-letter-title" className="text-base font-bold text-slate-900 mt-1">
                  {previewLetter.subject}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewLetter(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                aria-label="Tutup detail surat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">Kategori Surat</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {formatLetterCategoryLabel(previewLetter.category)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">Tanggal &amp; Klasifikasi</p>
                <p className="font-bold text-slate-900 mt-0.5 font-mono">
                  {previewLetter.letter_date} • Kode:{' '}
                  {previewLetter.classification_code ||
                    getDefaultClassificationCode(previewLetter.category)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">
                  {previewLetter.direction === 'MASUK' ? 'Pengirim / Asal' : 'Tujuan / Penerima'}
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {previewLetter.counterparty || '-'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">Sifat &amp; Status</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {previewLetter.priority || 'BIASA'} • {previewLetter.status || 'TERBIT'}
                </p>
              </div>
            </div>

            {(extractLinkedStudent(previewLetter) || extractLinkedTeacher(previewLetter)) && (
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-200/80 p-3.5 text-xs space-y-1">
                <p className="text-[11px] font-bold text-indigo-950">Warga Madrasah Terkait</p>
                {extractLinkedStudent(previewLetter) && (
                  <p className="text-indigo-900">
                    • Siswa: <strong>{extractLinkedStudent(previewLetter)?.full_name}</strong>
                    {extractLinkedStudent(previewLetter)?.nis
                      ? ` (NIS: ${extractLinkedStudent(previewLetter)?.nis})`
                      : ''}
                  </p>
                )}
                {extractLinkedTeacher(previewLetter) && (
                  <p className="text-indigo-900">
                    • GTK: <strong>{extractLinkedTeacher(previewLetter)?.full_name}</strong>
                    {extractLinkedTeacher(previewLetter)?.nip
                      ? ` (NIP: ${extractLinkedTeacher(previewLetter)?.nip})`
                      : ''}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 text-xs space-y-1">
              <p className="text-[10px] font-semibold text-slate-500">
                Ringkasan Isi / Catatan Arsip
              </p>
              <p className="text-slate-800 whitespace-pre-line">
                {previewLetter.summary?.trim() || 'Tidak ada catatan ringkasan.'}
              </p>
            </div>

            {previewLetter.file_url && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800">Pratinjau Lampiran Digital</p>
                  <a
                    href={previewLetter.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    <span>Buka di Tab Baru</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                {previewLetter.file_url.startsWith('data:image/') ||
                /\.(jpg|jpeg|png|webp)(\?|$)/i.test(previewLetter.file_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewLetter.file_url}
                    alt={previewLetter.subject}
                    className="max-h-80 w-auto mx-auto rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-950">
                      <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div>
                        <p className="font-bold">
                          {previewLetter.attachment_name || 'Dokumen Lampiran PDF'}
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Klik tombol di samping untuk membuka atau mengunduh berkas asli.
                        </p>
                      </div>
                    </div>
                    <a
                      href={previewLetter.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      Buka Dokumen
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewLetter;
                    setPreviewLetter(null);
                    handleOpenOfficialComposer(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Cetak Naskah Surat Resmi (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePrintSingleLetter(previewLetter)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Lembar Registrasi QR</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewLetter(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
