'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  LayoutGrid,
  List,
  Loader2,
  Paperclip,
  PlusCircle,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
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
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
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
type ArchiveViewMode = 'CARD' | 'TABLE';
type RequestReviewAction = 'DIVERIFIKASI_TU' | 'DISETUJUI' | 'DITOLAK';
type DispositionStatusFilter = 'ALL' | 'PENDING' | 'DITINDAKLANJUTI' | 'SELESAI';

interface ReviewModalState {
  request: LetterRequestRow;
  action: RequestReviewAction;
  notes: string;
}

function getTodayIsoDate(): string {
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
  const [archiveViewMode, setArchiveViewMode] = useState<ArchiveViewMode>('CARD');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printingLetterId, setPrintingLetterId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [updatingDispositionId, setUpdatingDispositionId] = useState<string | null>(null);
  const [deletingDispositionId, setDeletingDispositionId] = useState<string | null>(null);

  // Filter States — Permohonan & Disposisi & Kartu Pelajar
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    'ALL' | 'PENDING' | 'DISETUJUI' | 'DITOLAK'
  >('ALL');
  const [requestSearch, setRequestSearch] = useState('');
  const [dispositionStatusFilter, setDispositionStatusFilter] =
    useState<DispositionStatusFilter>('ALL');
  const [dispositionSearch, setDispositionSearch] = useState('');
  const [cardStudentSearch, setCardStudentSearch] = useState('');

  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);

  // Modal Refs for Focus Trap (WCAG 2.1 AA)
  const dispositionModalRef = useRef<HTMLDivElement | null>(null);
  const composerModalRef = useRef<HTMLDivElement | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);
  const deleteConfirmModalRef = useRef<HTMLDivElement | null>(null);
  const reviewModalRef = useRef<HTMLDivElement | null>(null);

  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [letters, setLetters] = useState<LetterRecord[]>([]);
  const [letterRequests, setLetterRequests] = useState<LetterRequestRow[]>([]);
  const [dispositions, setDispositions] = useState<LetterDispositionRow[]>([]);
  const [institution, setInstitution] = useState<InstitutionInfoForLetter | null>(null);
  const [selectedCardStudentId, setSelectedCardStudentId] = useState('');
  const [previewLetter, setPreviewLetter] = useState<LetterRecord | null>(null);
  const [deleteTargetLetter, setDeleteTargetLetter] = useState<LetterRecord | null>(null);
  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null);

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

  // Filter States — Buku Agenda Arsip Surat
  const [letterSearch, setLetterSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | LetterDirection>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('ALL');

  // Pagination States — Buku Agenda Arsip Surat
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Form State (Create & Edit)
  const [letterForm, setLetterForm] = useState(() => createInitialFormState(null));
  const isEditing = Boolean(letterForm.id);

  // Focus Traps for Active Modals
  useFocusTrap(dispositionModalRef, Boolean(dispositionTargetLetter));
  useFocusTrap(composerModalRef, Boolean(composerLetter));
  useFocusTrap(previewModalRef, Boolean(previewLetter));
  useFocusTrap(deleteConfirmModalRef, Boolean(deleteTargetLetter));
  useFocusTrap(reviewModalRef, Boolean(reviewModal));

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

  // Global Escape Key Handler for Modals
  useEffect(() => {
    const hasOpenModal = Boolean(
      dispositionTargetLetter ||
        composerLetter ||
        previewLetter ||
        deleteTargetLetter ||
        reviewModal
    );
    if (!hasOpenModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (reviewModal && !reviewingId) {
        setReviewModal(null);
      } else if (deleteTargetLetter && !deletingId) {
        setDeleteTargetLetter(null);
      } else if (dispositionTargetLetter && !submittingDisposition) {
        setDispositionTargetLetter(null);
      } else if (composerLetter && !generatingOfficialPdf) {
        setComposerLetter(null);
      } else if (previewLetter) {
        setPreviewLetter(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    composerLetter,
    deleteTargetLetter,
    deletingId,
    dispositionTargetLetter,
    generatingOfficialPdf,
    previewLetter,
    reviewModal,
    reviewingId,
    submittingDisposition,
  ]);

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

  const applyFetchedData = useCallback(
    (data: Awaited<ReturnType<typeof fetchPersuratanData>>) => {
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
    },
    []
  );

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchPersuratanData();
        applyFetchedData(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data persuratan.';
        if (mode === 'initial' || loadError) {
          setLoadError(message);
        } else {
          showToast(message, 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyFetchedData, fetchPersuratanData, loadError, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPersuratanData();
        if (!cancelled) {
          applyFetchedData(data);
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
  }, [applyFetchedData, fetchPersuratanData]);

  // Fast Lookup Maps for Enriching Linked Student & Teacher Data Consistently
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentOpt>();
    for (const s of students) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  const teacherMap = useMemo(() => {
    const map = new Map<string, TeacherOpt>();
    for (const t of teachers) {
      map.set(t.id, t);
    }
    return map;
  }, [teachers]);

  const enrichLetterRecord = useCallback(
    (letter: LetterRecord): LetterRecord => {
      const linkedStudent =
        (letter.student_id ? studentMap.get(letter.student_id) : null) ||
        extractLinkedStudent(letter);
      const linkedTeacher =
        (letter.teacher_id ? teacherMap.get(letter.teacher_id) : null) ||
        extractLinkedTeacher(letter);
      return {
        ...letter,
        student: linkedStudent || letter.student,
        teacher: linkedTeacher || letter.teacher,
      };
    },
    [studentMap, teacherMap]
  );

  const enrichedLetters = useMemo(
    () => letters.map((l) => enrichLetterRecord(l)),
    [enrichLetterRecord, letters]
  );

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
    const selectedStudent = letterForm.student_id
      ? studentMap.get(letterForm.student_id) || null
      : null;
    const selectedTeacher = letterForm.teacher_id
      ? teacherMap.get(letterForm.teacher_id) || null
      : null;
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
        suggestedSubject =
          `${categoryLabel} ${institution?.short_name || institution?.name || ''}`.trim();
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
    const enrichedLetter = enrichLetterRecord(letter);
    const defaultCity = inferCityFromAddress(institution?.address);
    const defaultBody = buildDefaultOfficialLetterBody({
      letter: enrichedLetter,
      institution,
    });

    setComposerLetter(enrichedLetter);
    setComposerOptions({
      issueCity: defaultCity,
      attachmentCountLabel: enrichedLetter.file_url ? '1 (Satu) Berkas' : '-',
      customBodyText: defaultBody,
      signatoryName:
        enrichedLetter.signatory_name || institution?.headmaster_name || 'Kepala Lembaga',
      signatoryTitle:
        enrichedLetter.signatory_title || institution?.head_title_label || 'Kepala Madrasah',
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

  const handleClearAttachment = () => {
    setLetterForm((prev) => ({
      ...prev,
      file_url: '',
      attachment_name: '',
    }));
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setTimeout(() => {
      if (formSectionRef.current) {
        formSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  async function confirmDeleteLetter() {
    if (!canManage || !deleteTargetLetter || deletingId) return;
    const target = deleteTargetLetter;

    setDeletingId(target.id);
    try {
      const res = await fetch(`/api/layanan/persuratan?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menghapus arsip surat.', 'error');
        return;
      }

      if (letterForm.id === target.id) {
        handleResetForm();
      }
      if (previewLetter?.id === target.id) {
        setPreviewLetter(null);
      }
      setLetters((prev) => prev.filter((item) => item.id !== target.id));
      setDeleteTargetLetter(null);
      showToast(`Arsip surat "${target.letter_number}" telah dihapus.`, 'success');
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
    for (const l of enrichedLetters) {
      if (l.direction === 'MASUK') masuk += 1;
      else if (l.direction === 'KELUAR') keluar += 1;
      if (l.file_url) withFile += 1;
      if (l.student_id || l.teacher_id) linkedWarga += 1;
    }
    return { total: enrichedLetters.length, masuk, keluar, withFile, linkedWarga };
  }, [enrichedLetters]);

  const filteredLetters = useMemo(() => {
    const q = letterSearch.trim().toLowerCase();
    const now = new Date();
    const currentYearPrefix = String(now.getFullYear());
    const currentMonthPrefix = `${currentYearPrefix}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const effectiveStart =
      customStartDate && customEndDate && customStartDate > customEndDate
        ? customEndDate
        : customStartDate;
    const effectiveEnd =
      customStartDate && customEndDate && customStartDate > customEndDate
        ? customStartDate
        : customEndDate;

    return enrichedLetters.filter((l) => {
      if (directionFilter !== 'ALL' && l.direction !== directionFilter) return false;
      if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;

      if (
        datePreset === 'THIS_MONTH' &&
        !String(l.letter_date || '').startsWith(currentMonthPrefix)
      ) {
        return false;
      }
      if (
        datePreset === 'THIS_YEAR' &&
        !String(l.letter_date || '').startsWith(currentYearPrefix)
      ) {
        return false;
      }
      if (datePreset === 'CUSTOM') {
        if (effectiveStart && l.letter_date < effectiveStart) return false;
        if (effectiveEnd && l.letter_date > effectiveEnd) return false;
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
    enrichedLetters,
    letterSearch,
    linkFilter,
  ]);

  const totalPages = useMemo(() => {
    if (pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(filteredLetters.length / pageSize));
  }, [filteredLetters.length, pageSize]);

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLetters = useMemo(() => {
    if (pageSize <= 0) return filteredLetters;
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredLetters.slice(startIdx, startIdx + pageSize);
  }, [filteredLetters, pageSize, safeCurrentPage]);

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
    if (printingLetterId) return;
    setPrintingLetterId(letter.id);
    try {
      const enriched = enrichLetterRecord(letter);
      await exportSingleLetterArchivePdf({ letter: enriched, institution });
      showToast(`Lembar registrasi surat "${letter.letter_number}" diunduh.`, 'success');
    } catch {
      showToast('Gagal mencetak lembar arsip surat.', 'error');
    } finally {
      setPrintingLetterId(null);
    }
  };

  const handleOpenDispositionModal = (letter: LetterRecord) => {
    setDispositionTargetLetter(enrichLetterRecord(letter));
    setDispositionForm({
      assigned_to_teacher_id: letter.teacher_id || teachers[0]?.id || '',
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
    if (updatingDispositionId) return;
    setUpdatingDispositionId(dispId);
    try {
      const res = await fetch('/api/layanan/persuratan/disposisi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dispId, status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal memperbarui status disposisi.', 'error');
        return;
      }
      showToast(`Status disposisi diperbarui menjadi ${nextStatus}.`, 'success');
      await loadData('refresh');
    } catch {
      showToast('Gagal memperbarui disposisi.', 'error');
    } finally {
      setUpdatingDispositionId(null);
    }
  };

  const handleDeleteDispositionAdmin = async (disp: LetterDispositionRow) => {
    if (!canReviewRequests || deletingDispositionId) return;
    setDeletingDispositionId(disp.id);
    try {
      const res = await fetch(
        `/api/layanan/persuratan/disposisi?id=${encodeURIComponent(disp.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menghapus data disposisi.', 'error');
        return;
      }
      setDispositions((prev) => prev.filter((item) => item.id !== disp.id));
      showToast('Disposisi surat masuk berhasil dihapus.', 'success');
    } catch {
      showToast('Gagal menghapus disposisi.', 'error');
    } finally {
      setDeletingDispositionId(null);
    }
  };

  const openReviewRequestModal = (reqItem: LetterRequestRow, action: RequestReviewAction) => {
    if (!canReviewRequests || reviewingId) return;
    const defaultNotes =
      action === 'DISETUJUI'
        ? reqItem.reviewer_notes || 'Surat resmi telah disetujui dan diterbitkan.'
        : action === 'DITOLAK'
          ? reqItem.reviewer_notes || ''
          : reqItem.reviewer_notes || 'Berkas permohonan telah diverifikasi oleh Tata Usaha.';

    setReviewModal({
      request: reqItem,
      action,
      notes: defaultNotes,
    });
  };

  const handleConfirmReviewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canReviewRequests || !reviewModal || reviewingId) return;

    const { request: reqItem, action, notes } = reviewModal;
    const trimmedNotes = notes.trim();

    if (action === 'DITOLAK' && trimmedNotes.length < 3) {
      showToast('Mohon isi alasan penolakan minimal 3 karakter.', 'error');
      return;
    }

    setReviewingId(reqItem.id);
    try {
      const res = await fetch('/api/layanan/persuratan/permohonan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqItem.id,
          action,
          reviewer_notes:
            trimmedNotes ||
            (action === 'DITOLAK' ? 'Permohonan belum memenuhi syarat administrasi.' : null),
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
      setReviewModal(null);
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

  const activeDispositionsCount = useMemo(
    () => dispositions.filter((d) => d.status !== 'SELESAI').length,
    [dispositions]
  );

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return letterRequests.filter((r) => {
      if (requestStatusFilter === 'PENDING') {
        if (r.status !== 'DIAJUKAN' && r.status !== 'DIVERIFIKASI_TU') return false;
      } else if (requestStatusFilter === 'DISETUJUI' && r.status !== 'DISETUJUI') {
        return false;
      } else if (requestStatusFilter === 'DITOLAK' && r.status !== 'DITOLAK') {
        return false;
      }

      if (q) {
        const issued = extractIssuedLetter(r);
        const haystack = [
          r.request_number,
          r.requester_name,
          r.requester_role,
          r.subject,
          r.purpose,
          r.counterparty || '',
          formatLetterCategoryLabel(r.category),
          r.student?.full_name || '',
          r.student?.nis || '',
          r.teacher?.full_name || '',
          issued?.letter_number || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [letterRequests, requestSearch, requestStatusFilter]);

  const filteredDispositions = useMemo(() => {
    const q = dispositionSearch.trim().toLowerCase();
    return dispositions.filter((d) => {
      if (dispositionStatusFilter === 'PENDING') {
        if (d.status !== 'DITERUSKAN' && d.status !== 'DIBACA') return false;
      } else if (
        dispositionStatusFilter === 'DITINDAKLANJUTI' &&
        d.status !== 'DITINDAKLANJUTI'
      ) {
        return false;
      } else if (dispositionStatusFilter === 'SELESAI' && d.status !== 'SELESAI') {
        return false;
      }

      if (q) {
        const letterObj = Array.isArray(d.letter) ? d.letter[0] : d.letter;
        const assigneeObj = Array.isArray(d.assignee) ? d.assignee[0] : d.assignee;
        const haystack = [
          letterObj?.letter_number || '',
          letterObj?.subject || '',
          letterObj?.counterparty || '',
          assigneeObj?.full_name || '',
          d.assigned_by_name || '',
          d.instruction,
          d.notes || '',
          d.completion_notes || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [dispositionSearch, dispositionStatusFilter, dispositions]);

  const filteredCardStudents = useMemo(() => {
    const q = cardStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.full_name, s.nis || '', s.nisn || ''].join(' ').toLowerCase().includes(q)
    );
  }, [cardStudentSearch, students]);

  const cardStudent = useMemo(() => {
    if (selectedCardStudentId) {
      const found = students.find((s) => s.id === selectedCardStudentId);
      if (found) return found;
    }
    return filteredCardStudents[0] || students[0] || null;
  }, [filteredCardStudents, selectedCardStudentId, students]);

  const resetAllFilters = () => {
    setLetterSearch('');
    setDirectionFilter('ALL');
    setCategoryFilter('ALL');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setLinkFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilter =
    Boolean(letterSearch.trim()) ||
    directionFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    linkFilter !== 'ALL';

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="max-w-7xl mx-auto glass-card rounded-3xl p-8 sm:p-12 text-center space-y-4 border border-slate-200/80"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center mx-auto shadow-md">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <p className="text-sm sm:text-base font-bold text-slate-900">
            Memuat Layanan E-Office Persuratan
          </p>
          <p className="text-xs text-slate-500">
            Menyiapkan Buku Agenda Arsip Digital, Antrean Permohonan, Disposisi, dan Kartu Pelajar...
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
          onClick={() => void loadData('refresh')}
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
      {/* Notifikasi Toast (Floating Top-Right di bawah Navbar) */}
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
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span className="min-w-0 break-words leading-relaxed">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1.5 rounded-lg hover:bg-black/5 text-slate-500 shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Utama, Aksi Cepat, Metrik & Navigasi Tab */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight break-words">
                E-Office Persuratan, Generator Naskah Dinas &amp; Kartu Digital
              </h1>
              {!canManage && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span>Mode Lihat Saja</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              Pusat registrasi tata naskah surat masuk/keluar, penomoran otomatis, generator PDF
              Surat Resmi ber-Kop Madrasah &amp; TTE QR Code, disposisi digital, serta ekspor Buku
              Agenda.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
            <Link
              href="/persuratan-publik"
              target="_blank"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              title="Buka halaman Drop-Box Surat Masuk Eksternal & Papan Edaran Publik"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">Drop-Box Publik</span>
            </Link>

            <button
              type="button"
              onClick={() => void handleExportAgendaPdf()}
              disabled={exportingPdf || filteredLetters.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
              title="Unduh Buku Agenda Surat Masuk & Keluar resmi (PDF dengan QR Code)"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Printer className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">Buku Agenda PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLetters.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-900 text-xs font-semibold transition disabled:opacity-50"
              title="Unduh Buku Agenda dalam format CSV / Microsoft Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">Ekspor Excel/CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void loadData('refresh')}
              disabled={refreshing || submitting}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
              title="Muat ulang data persuratan"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Kartu Metrik Ringkas Interaktif */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('PERSURATAN');
              resetAllFilters();
            }}
            className="text-left rounded-2xl border border-slate-200/80 bg-white/85 hover:border-slate-300 p-3.5 transition"
          >
            <p className="text-[11px] font-medium text-slate-500">Total Arsip Surat</p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 tabular-nums">
              {letterSummary.total}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PERSURATAN');
              setDirectionFilter('KELUAR');
            }}
            className="text-left rounded-2xl border border-emerald-200/80 bg-emerald-50/60 hover:bg-emerald-50 p-3.5 transition"
          >
            <p className="text-[11px] font-medium text-emerald-800">Surat Keluar</p>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-900 mt-0.5 tabular-nums">
              {letterSummary.keluar}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PERSURATAN');
              setDirectionFilter('MASUK');
            }}
            className="text-left rounded-2xl border border-sky-200/80 bg-sky-50/60 hover:bg-sky-50 p-3.5 transition"
          >
            <p className="text-[11px] font-medium text-sky-800">Surat Masuk</p>
            <p className="text-lg sm:text-xl font-extrabold text-sky-900 mt-0.5 tabular-nums">
              {letterSummary.masuk}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PERSURATAN');
              setLinkFilter('WITH_STUDENT');
            }}
            className="text-left rounded-2xl border border-violet-200/80 bg-violet-50/60 hover:bg-violet-50 p-3.5 transition"
          >
            <p className="text-[11px] font-medium text-violet-800">Tertaut Siswa / GTK</p>
            <p className="text-lg sm:text-xl font-extrabold text-violet-900 mt-0.5 tabular-nums">
              {letterSummary.linkedWarga}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PERSURATAN');
              setLinkFilter('WITH_FILE');
            }}
            className="col-span-2 sm:col-span-1 text-left rounded-2xl border border-amber-200/80 bg-amber-50/60 hover:bg-amber-50 p-3.5 transition"
          >
            <p className="text-[11px] font-medium text-amber-800">Memiliki Berkas Scan</p>
            <p className="text-lg sm:text-xl font-extrabold text-amber-900 mt-0.5 tabular-nums">
              {letterSummary.withFile}
            </p>
          </button>
        </div>

        {/* Navigasi Sub-Tab Workspace (Responsive Grid di Mobile, Flex di Desktop) */}
        <div
          role="tablist"
          aria-label="Navigasi modul layanan persuratan"
          className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 border-t border-slate-200/70 pt-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'PERSURATAN'}
            onClick={() => setActiveTab('PERSURATAN')}
            className={`inline-flex items-center justify-between lg:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'PERSURATAN'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Arsip &amp; Generator Surat</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums shrink-0 ${
                activeTab === 'PERSURATAN'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {letters.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'PERMOHONAN'}
            onClick={() => setActiveTab('PERMOHONAN')}
            className={`inline-flex items-center justify-between lg:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'PERMOHONAN'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <Inbox className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Permohonan Warga</span>
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                  activeTab === 'PERMOHONAN'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {letterRequests.length}
              </span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  {pendingRequestsCount} Baru
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'DISPOSISI'}
            onClick={() => setActiveTab('DISPOSISI')}
            className={`inline-flex items-center justify-between lg:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'DISPOSISI'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Disposisi Surat Masuk</span>
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                  activeTab === 'DISPOSISI'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {dispositions.length}
              </span>
              {activeDispositionsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[10px] font-extrabold">
                  {activeDispositionsCount} Aktif
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'KARTU_PELAJAR'}
            onClick={() => setActiveTab('KARTU_PELAJAR')}
            className={`inline-flex items-center justify-between lg:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'KARTU_PELAJAR'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Kartu Pelajar Digital</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums shrink-0 ${
                activeTab === 'KARTU_PELAJAR'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {students.length}
            </span>
          </button>
        </div>
      </div>

      {/* =====================================================================
       * TAB 2: ANTREAN PERMOHONAN WARGA MADRASAH
       * ===================================================================== */}
      {activeTab === 'PERMOHONAN' ? (
        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Antrean Permohonan Surat &amp; Izin Warga Madrasah ({filteredRequests.length})
                </span>
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

          {/* Pencarian Permohonan */}
          <div className="relative">
            <label htmlFor="request-search" className="sr-only">
              Cari permohonan surat warga
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="request-search"
              type="search"
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              placeholder="Cari nomor tiket permohonan, nama pemohon, perihal, siswa/GTK, atau nomor surat terbit..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 sm:p-10 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Belum ada permohonan surat dari warga madrasah pada filter ini.
              </p>
              {(requestStatusFilter !== 'ALL' || requestSearch.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setRequestStatusFilter('ALL');
                    setRequestSearch('');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset filter permohonan
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const rawIssued = extractIssuedLetter(req);
                const issued = rawIssued ? enrichLetterRecord(rawIssued) : null;
                const isProcessing = reviewingId === req.id;

                return (
                  <div
                    key={req.id}
                    className="modular-card rounded-2xl p-4 space-y-3 text-xs border border-slate-200/80"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 break-all">
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
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                            ) : req.status === 'DITOLAK' ? (
                              <XCircle className="w-3 h-3 shrink-0" />
                            ) : (
                              <Clock className="w-3 h-3 shrink-0" />
                            )}
                            <span>{req.status.replace(/_/g, ' ')}</span>
                          </span>
                        </div>

                        <p className="font-bold text-slate-900 text-sm break-words">
                          {req.subject}
                        </p>
                        <p className="text-[11px] text-slate-600 break-words">
                          <strong>{formatLetterCategoryLabel(req.category)}</strong>
                          {req.counterparty ? ` • Tujuan: ${req.counterparty}` : ''}
                          {req.leave_start_date
                            ? ` • Periode Izin (${req.leave_type || 'IZIN'}): ${formatReadableDate(
                                req.leave_start_date
                              )} s/d ${formatReadableDate(
                                req.leave_end_date || req.leave_start_date
                              )}`
                            : ''}
                        </p>
                      </div>

                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {formatReadableDate(req.created_at)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 text-[11px] text-slate-700 break-words">
                      <strong>Keperluan / Alasan:</strong> {req.purpose}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {req.student?.full_name && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-medium">
                          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                          <span className="break-words">
                            Siswa: <strong>{req.student.full_name}</strong>
                            {req.student.nis ? ` (${req.student.nis})` : ''}
                          </span>
                        </span>
                      )}

                      {req.teacher?.full_name && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-medium">
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="break-words">
                            GTK: <strong>{req.teacher.full_name}</strong>
                          </span>
                        </span>
                      )}

                      {req.attachment_url && (
                        <a
                          href={`/api/layanan/persuratan/attachment?id=${encodeURIComponent(req.id)}&type=request`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold"
                        >
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[14rem]">
                            {req.attachment_name || 'Buka Bukti Lampiran'}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>

                    {req.reviewer_notes && (
                      <p className="text-[11px] text-slate-600 italic break-words">
                        Catatan Verifikator: &ldquo;{req.reviewer_notes}&rdquo;
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2.5 border-t border-slate-200/70">
                      {issued ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-emerald-800 break-all">
                            ✓ Terbit No: {issued.letter_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenOfficialComposer(issued)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
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
                              onClick={() => openReviewRequestModal(req, 'DIVERIFIKASI_TU')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-semibold disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                              <span>Verifikasi TU</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => openReviewRequestModal(req, 'DISETUJUI')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs disabled:opacity-50"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Setujui &amp; Terbitkan Surat</span>
                          </button>

                          {req.status !== 'DITOLAK' && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => openReviewRequestModal(req, 'DITOLAK')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
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
        /* =====================================================================
         * TAB 3: MANAJEMEN & PEMANTAUAN DISPOSISI SURAT MASUK
         * ===================================================================== */
        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Manajemen &amp; Pemantauan Disposisi Surat Masuk ({filteredDispositions.length})
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pantau seluruh instruksi disposisi surat masuk dari Kepala Lembaga / TU kepada Wakil
                Kepala dan GTK beserta laporan penyelesaiannya.
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'ALL', label: `Semua (${dispositions.length})` },
                  { key: 'PENDING', label: 'Diteruskan / Dibaca' },
                  { key: 'DITINDAKLANJUTI', label: 'Ditindaklanjuti' },
                  { key: 'SELESAI', label: 'Selesai' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDispositionStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    dispositionStatusFilter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pencarian Disposisi */}
          <div className="relative">
            <label htmlFor="disposition-search" className="sr-only">
              Cari disposisi surat masuk
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="disposition-search"
              type="search"
              value={dispositionSearch}
              onChange={(e) => setDispositionSearch(e.target.value)}
              placeholder="Cari nomor surat masuk, perihal, penerima GTK, instruksi, atau laporan tindak lanjut..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredDispositions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 sm:p-10 text-center text-xs text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">
                {dispositions.length === 0
                  ? 'Belum ada disposisi surat masuk yang tercatat.'
                  : 'Tidak ada disposisi surat masuk yang cocok dengan filter.'}
              </p>
              {dispositions.length === 0 ? (
                <p className="text-[11px]">
                  Buka tab <strong>Arsip &amp; Generator Surat</strong> lalu klik tombol{' '}
                  <strong>Disposisikan</strong> pada Surat Masuk untuk meneruskan surat ke GTK.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDispositionStatusFilter('ALL');
                    setDispositionSearch('');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset filter disposisi
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDispositions.map((d) => {
                const letterObj = Array.isArray(d.letter) ? d.letter[0] : d.letter;
                const assigneeObj = Array.isArray(d.assignee) ? d.assignee[0] : d.assignee;
                const isUpdatingThis = updatingDispositionId === d.id;
                const isDeletingThis = deletingDispositionId === d.id;

                return (
                  <div
                    key={d.id}
                    className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80"
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
                        <span className="font-mono font-bold text-slate-900 break-all">
                          Surat No: {letterObj?.letter_number || '-'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 text-[10px] font-bold break-words">
                          Kepada: {assigneeObj?.full_name || 'GTK'}
                        </span>
                      </div>

                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {d.due_date
                          ? `Tenggat: ${formatReadableDate(d.due_date)}`
                          : formatReadableDate(d.created_at)}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 text-sm break-words">
                        {letterObj?.subject || 'Surat Masuk'}
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        Pengirim Surat: {letterObj?.counterparty || '-'} • Pemberi Disposisi:{' '}
                        {d.assigned_by_name || 'Kepala Lembaga / TU'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-[11px] space-y-1 break-words">
                      <p className="font-bold text-amber-950">
                        Instruksi: &ldquo;{d.instruction}&rdquo;
                      </p>
                      {d.notes && <p className="text-amber-900">{d.notes}</p>}
                    </div>

                    {d.completion_notes && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-950 break-words">
                        <strong>Laporan Tindak Lanjut GTK:</strong> {d.completion_notes}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/70">
                      {letterObj?.file_url ? (
                        <a
                          href={`/api/layanan/persuratan/attachment?id=${encodeURIComponent(d.letter_id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold w-fit"
                        >
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span>Lihat Scan Surat Masuk</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">Tanpa lampiran berkas</span>
                      )}

                      {canReviewRequests && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {d.status !== 'DITINDAKLANJUTI' && d.status !== 'SELESAI' && (
                            <button
                              type="button"
                              disabled={isUpdatingThis}
                              onClick={() =>
                                void handleUpdateDispositionStatusAdmin(d.id, 'DITINDAKLANJUTI')
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-semibold disabled:opacity-50"
                            >
                              {isUpdatingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                              )}
                              <span>Proses</span>
                            </button>
                          )}

                          {d.status !== 'SELESAI' && (
                            <button
                              type="button"
                              disabled={isUpdatingThis}
                              onClick={() =>
                                void handleUpdateDispositionStatusAdmin(d.id, 'SELESAI')
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold disabled:opacity-50"
                            >
                              {isUpdatingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>Tandai Selesai</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => void handleDeleteDispositionAdmin(d)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold disabled:opacity-50"
                            title="Hapus catatan disposisi ini"
                          >
                            {isDeletingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
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
      ) : activeTab === 'KARTU_PELAJAR' ? (
        /* =====================================================================
         * TAB 4: PRATINJAU & CETAK KARTU PELAJAR DIGITAL
         * ===================================================================== */
        <div className="max-w-2xl mx-auto glass-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Pratinjau &amp; Cetak Kartu Pelajar Digital</span>
            </h2>
            <p className="text-xs text-slate-500">
              Pilih atau cari siswa terdaftar dari Buku Induk untuk melihat, memverifikasi QR Code,
              atau mengunduh Kartu Pelajar Digital resmi.
            </p>
          </div>

          {students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              Belum ada data siswa terdaftar untuk pratinjau kartu pelajar.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="card-student-search"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Cari Nama / NIS / NISN Siswa
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="card-student-search"
                      type="search"
                      value={cardStudentSearch}
                      onChange={(e) => {
                        setCardStudentSearch(e.target.value);
                        setSelectedCardStudentId('');
                      }}
                      placeholder="Ketik nama atau NIS siswa..."
                      className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="card-student-select"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Pilih Siswa ({filteredCardStudents.length})
                  </label>
                  <select
                    id="card-student-select"
                    value={cardStudent?.id || ''}
                    onChange={(e) => setSelectedCardStudentId(e.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  >
                    {filteredCardStudents.length === 0 ? (
                      <option value="">-- Tidak ada siswa yang cocok --</option>
                    ) : (
                      filteredCardStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {cardStudent ? (
                <DigitalStudentCard student={cardStudent} />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  Tidak ada siswa yang sesuai dengan kata kunci pencarian.
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* =====================================================================
         * TAB 1: ARSIP PERSURATAN & GENERATOR NASKAH SURAT RESMI
         * ===================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Kolom Kiri: Form Registrasi / Edit Arsip Surat */}
          {canManage && (
            <div
              ref={formSectionRef}
              className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-4 scroll-mt-20"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
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

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleSmartFillDraft}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold shrink-0"
                    title="Isi otomatis Nomor Surat, Perihal, dan Ringkasan sesuai Kategori & Siswa/GTK yang dipilih"
                  >
                    <Wand2 className="w-3 h-3 shrink-0" />
                    <span>Isi Draf Otomatis</span>
                  </button>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold shrink-0"
                    >
                      <X className="w-3 h-3 shrink-0" />
                      <span>Batal Edit</span>
                    </button>
                  )}
                </div>
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      {LETTER_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tautan Warga Madrasah: Siswa & GTK */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-800">
                      Tautkan Warga Madrasah (Auto-Fill Biodata Surat)
                    </p>
                    <span className="text-[10px] text-slate-500 shrink-0">Opsional</span>
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
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
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
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
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
                        <Sparkles className="w-3 h-3 shrink-0" />
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
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                {/* Tanggal, Kode Klasifikasi, Sifat & Status (Grid 2x2 Proporsional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    >
                      {LETTER_PRIORITY_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
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
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
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
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
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
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                {/* Unggah Berkas Scan / Lampiran (Responsive Stack di Mobile) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label
                      htmlFor="letter-file-upload"
                      className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Berkas Scan / Lampiran Digital (PDF/Gambar)</span>
                    </label>
                    {letterForm.file_url && (
                      <button
                        type="button"
                        onClick={handleClearAttachment}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Hapus Lampiran
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition disabled:opacity-60 shrink-0"
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      )}
                      <span>{uploadingFile ? 'Mengunggah...' : 'Pilih File (Maks 5 MB)'}</span>
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
                          attachment_name: e.target.value.trim()
                            ? prev.attachment_name || 'Tautan Eksternal'
                            : '',
                        }))
                      }
                      className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>

                  {letterForm.file_url && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-900">
                      <span className="truncate font-medium min-w-0">
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
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Save className="w-3.5 h-3.5 shrink-0" />
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
            } glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Buku Agenda Arsip Digital ({filteredLetters.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Klik <strong>Cetak Surat Resmi (PDF)</strong> untuk menerbitkan naskah surat
                  ber-Kop Madrasah &amp; TTE QR Code.
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
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
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Toggle Mode Tampilan: Kartu vs Tabel Ringkas (Desktop/Tablet) */}
                <div className="hidden sm:inline-flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setArchiveViewMode('CARD')}
                    className={`p-1.5 rounded-lg transition ${
                      archiveViewMode === 'CARD'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Tampilan Kartu"
                    aria-label="Tampilan Kartu"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveViewMode('TABLE')}
                    className={`p-1.5 rounded-lg transition ${
                      archiveViewMode === 'TABLE'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Tampilan Tabel Ringkas"
                    aria-label="Tampilan Tabel Ringkas"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Baris Pencarian & Filter Lanjutan */}
            <div className="space-y-2.5">
              <div className="relative">
                <label htmlFor="letter-search" className="sr-only">
                  Cari arsip surat
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="letter-search"
                  type="search"
                  value={letterSearch}
                  onChange={(e) => setLetterSearch(e.target.value)}
                  placeholder="Cari nomor surat, perihal, pengirim/tujuan, nama siswa/GTK, atau ringkasan..."
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    aria-label="Filter kategori surat"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Kategori Surat</option>
                    {LETTER_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    aria-label="Filter periode tanggal surat"
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Waktu</option>
                    <option value="THIS_MONTH">Bulan Ini</option>
                    <option value="THIS_YEAR">Tahun Ini</option>
                    <option value="CUSTOM">Rentang Tanggal Kustom</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <select
                    aria-label="Filter keterkaitan surat"
                    value={linkFilter}
                    onChange={(e) => setLinkFilter(e.target.value as LinkFilter)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Keterkaitan &amp; Berkas</option>
                    <option value="WITH_STUDENT">Terkait Siswa</option>
                    <option value="WITH_TEACHER">Terkait Guru / GTK</option>
                    <option value="WITH_FILE">Memiliki Lampiran Scan</option>
                  </select>
                </div>
              </div>

              {datePreset === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label
                      htmlFor="custom-start-date"
                      className="block text-[10px] font-semibold text-slate-500 mb-0.5"
                    >
                      Dari Tanggal
                    </label>
                    <input
                      id="custom-start-date"
                      type="date"
                      max={customEndDate || undefined}
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="custom-end-date"
                      className="block text-[10px] font-semibold text-slate-500 mb-0.5"
                    >
                      Sampai Tanggal
                    </label>
                    <input
                      id="custom-end-date"
                      type="date"
                      min={customStartDate || undefined}
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>
              )}

              {hasActiveFilter && (
                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-500 pt-0.5">
                  <span>
                    Menampilkan <strong className="text-slate-800">{filteredLetters.length}</strong>{' '}
                    dari {letters.length} arsip surat
                  </span>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Semua Filter</span>
                  </button>
                </div>
              )}
            </div>

            {/* Daftar Surat */}
            {filteredLetters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 sm:p-10 text-center space-y-2">
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
              <>
                {/* Mode Tabel Ringkas (Hanya pada layar >= sm jika dipilih) */}
                {archiveViewMode === 'TABLE' && (
                  <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold text-slate-700">
                          <th className="py-2.5 px-3">Nomor &amp; Tanggal</th>
                          <th className="py-2.5 px-3">Perihal &amp; Kategori</th>
                          <th className="py-2.5 px-3">Tujuan / Pengirim</th>
                          <th className="py-2.5 px-3 text-right">Aksi Cepat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {paginatedLetters.map((l) => {
                          const student = extractLinkedStudent(l);
                          const teacher = extractLinkedTeacher(l);
                          return (
                            <tr
                              key={l.id}
                              className={`hover:bg-slate-50/80 transition ${
                                letterForm.id === l.id ? 'bg-amber-50/40' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 align-top space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
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
                                </div>
                                <p className="text-[11px] font-mono text-slate-500">
                                  {formatReadableDate(l.letter_date)}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 align-top space-y-1 max-w-xs">
                                <p className="font-bold text-slate-900 break-words line-clamp-2">
                                  {l.subject}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {formatLetterCategoryLabel(l.category)}
                                </p>
                                {(student?.full_name || teacher?.full_name) && (
                                  <p className="text-[11px] text-indigo-700 font-medium">
                                    {student?.full_name
                                      ? `Siswa: ${student.full_name}`
                                      : `GTK: ${teacher?.full_name}`}
                                  </p>
                                )}
                              </td>
                              <td className="py-2.5 px-3 align-top text-[11px] text-slate-700 break-words max-w-[10rem]">
                                {l.counterparty || '-'}
                              </td>
                              <td className="py-2.5 px-3 align-top text-right">
                                <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                                  {l.direction === 'MASUK' && canReviewRequests && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDispositionModal(l)}
                                      className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200"
                                      title="Disposisikan Surat Masuk"
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOfficialComposer(l)}
                                    className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white"
                                    title="Cetak Naskah Surat Resmi (PDF)"
                                  >
                                    <FileCheck2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewLetter(l)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                    title="Detail Surat"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {canManage && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(l)}
                                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                                        title="Edit Surat"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteTargetLetter(l)}
                                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                        title="Hapus Surat"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Mode Kartu Responsif (Default pada Mobile & Desktop ketika CARD dipilih) */}
                <div className={`${archiveViewMode === 'TABLE' ? 'sm:hidden' : ''} space-y-3`}>
                  {paginatedLetters.map((l) => {
                    const student = extractLinkedStudent(l);
                    const teacher = extractLinkedTeacher(l);
                    const priority = l.priority || 'BIASA';
                    const status = l.status || 'TERBIT';
                    const isPrintingThis = printingLetterId === l.id;

                    return (
                      <div
                        key={l.id}
                        className={`modular-card rounded-2xl p-4 space-y-2.5 text-xs transition border ${
                          letterForm.id === l.id
                            ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20'
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
                            {formatReadableDate(l.letter_date)}
                          </span>
                        </div>

                        {l.summary && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/60 line-clamp-2 break-words">
                            {l.summary}
                          </p>
                        )}

                        {/* Badge Keterkaitan Siswa / GTK / Lampiran */}
                        {(student?.full_name || teacher?.full_name || l.file_url) && (
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {student?.full_name && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-[11px] font-medium">
                                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                <span className="break-words">
                                  Siswa: <strong>{student.full_name}</strong>
                                  {student.nis ? ` (${student.nis})` : ''}
                                </span>
                              </span>
                            )}

                            {teacher?.full_name && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 text-[11px] font-medium">
                                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                <span className="break-words">
                                  GTK: <strong>{teacher.full_name}</strong>
                                </span>
                              </span>
                            )}

                            {l.file_url && (
                              <a
                                href={`/api/layanan/persuratan/attachment?id=${encodeURIComponent(l.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold transition"
                              >
                                <Paperclip className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[14rem]">
                                  {l.attachment_name || 'Buka Berkas Scan'}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Baris Tombol Aksi */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/60">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {l.direction === 'MASUK' && canReviewRequests && (
                              <button
                                type="button"
                                onClick={() => handleOpenDispositionModal(l)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-semibold transition shadow-2xs"
                                title="Disposisikan Surat Masuk ini kepada Wakil Kepala / Guru / Staf"
                              >
                                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                <span>Disposisikan</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenOfficialComposer(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition shadow-2xs"
                              title="Terbitkan & Unduh Naskah Surat Resmi ber-Kop Madrasah & TTE QR Code (PDF)"
                            >
                              <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Cetak Surat Resmi (PDF)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewLetter(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              <span>Detail</span>
                            </button>

                            <button
                              type="button"
                              disabled={isPrintingThis}
                              onClick={() => void handlePrintSingleLetter(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold transition disabled:opacity-50"
                              title="Unduh Lembar Bukti Registrasi Arsip & QR Verifikasi (PDF)"
                            >
                              {isPrintingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                              ) : (
                                <Download className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>Lembar Registrasi</span>
                            </button>

                            <Link
                              href={`/verifikasi?ref=${encodeURIComponent(l.letter_number)}&type=SURAT`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold transition"
                              title="Cek keaslian nomor surat di halaman Verifikasi Publik"
                            >
                              <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
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
                                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteTargetLetter(l)}
                                disabled={deletingId === l.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition disabled:opacity-50"
                              >
                                {deletingId === l.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
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

                {/* Pagination Bar — Mencegah Scroll Trap di Mobile & Menjaga Performa saat Data Banyak */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3 border-t border-slate-200/70 text-xs text-slate-600">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span>
                      Halaman <strong className="text-slate-900">{safeCurrentPage}</strong> dari{' '}
                      <strong className="text-slate-900">{totalPages}</strong> (
                      {filteredLetters.length} surat)
                    </span>
                    <select
                      aria-label="Jumlah surat per halaman"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800"
                    >
                      <option value={10}>10 / hal</option>
                      <option value={25}>25 / hal</option>
                      <option value={50}>50 / hal</option>
                      <option value={0}>Semua</option>
                    </select>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sebelumnya</span>
                      </button>
                      <button
                        type="button"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 1: KONFIRMASI HAPUS ARSIP SURAT (PENGGANTI window.confirm)
       * ===================================================================== */}
      {deleteTargetLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-letter-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) {
              setDeleteTargetLetter(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={deleteConfirmModalRef}
            className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3
                  id="modal-delete-letter-title"
                  className="text-base font-bold text-slate-900"
                >
                  Hapus Arsip Surat Secara Permanen?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  Anda akan menghapus arsip surat{' '}
                  <strong className="font-mono text-slate-900">
                    {deleteTargetLetter.letter_number}
                  </strong>{' '}
                  ({deleteTargetLetter.subject}). Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setDeleteTargetLetter(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void confirmDeleteLetter()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 2: VERIFIKASI / PERSETUJUAN PERMOHONAN WARGA (PENGGANTI window.prompt)
       * ===================================================================== */}
      {reviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-review-request-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !reviewingId) {
              setReviewModal(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={reviewModalRef}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="space-y-1 min-w-0">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                    reviewModal.action === 'DISETUJUI'
                      ? 'bg-emerald-100 text-emerald-900'
                      : reviewModal.action === 'DITOLAK'
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-sky-100 text-sky-900'
                  }`}
                >
                  {reviewModal.action === 'DISETUJUI'
                    ? 'PERSETUJUAN & PENERBITAN SURAT RESMI'
                    : reviewModal.action === 'DITOLAK'
                      ? 'PENOLAKAN PERMOHONAN SURAT'
                      : 'VERIFIKASI ADMINISTRASI TATA USAHA'}
                </span>
                <h3
                  id="modal-review-request-title"
                  className="text-base font-bold text-slate-900 break-words"
                >
                  {reviewModal.request.subject}
                </h3>
                <p className="text-xs text-slate-500 font-mono break-all">
                  Tiket: {reviewModal.request.request_number} • Pemohon:{' '}
                  {reviewModal.request.requester_name} ({reviewModal.request.requester_role})
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(reviewingId)}
                onClick={() => setReviewModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                aria-label="Tutup dialog verifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReviewRequest} className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-1 text-[11px] text-slate-700">
                <p>
                  <strong>Kategori:</strong>{' '}
                  {formatLetterCategoryLabel(reviewModal.request.category)}
                </p>
                <p className="break-words">
                  <strong>Keperluan:</strong> {reviewModal.request.purpose}
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="review-notes-input"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  {reviewModal.action === 'DITOLAK'
                    ? 'Alasan Penolakan (Wajib Diisi)'
                    : 'Catatan Verifikator untuk Pemohon (Opsional)'}
                </label>
                <textarea
                  id="review-notes-input"
                  rows={3}
                  required={reviewModal.action === 'DITOLAK'}
                  value={reviewModal.notes}
                  onChange={(e) =>
                    setReviewModal((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null
                    )
                  }
                  placeholder={
                    reviewModal.action === 'DITOLAK'
                      ? 'Tuliskan alasan penolakan atau berkas persyaratan yang belum lengkap...'
                      : 'Tambahkan catatan untuk pemohon...'
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={Boolean(reviewingId)}
                  onClick={() => setReviewModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={Boolean(reviewingId)}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition disabled:opacity-50 ${
                    reviewModal.action === 'DISETUJUI'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : reviewModal.action === 'DITOLAK'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-sky-700 hover:bg-sky-800'
                  }`}
                >
                  {reviewingId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : reviewModal.action === 'DISETUJUI' ? (
                    <FileCheck2 className="w-4 h-4" />
                  ) : reviewModal.action === 'DITOLAK' ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {reviewModal.action === 'DISETUJUI'
                      ? 'Setujui & Terbitkan Nomor Surat'
                      : reviewModal.action === 'DITOLAK'
                        ? 'Konfirmasi Tolak Permohonan'
                        : 'Simpan Verifikasi TU'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 3: BUAT DISPOSISI SURAT MASUK (FASE 4)
       * ===================================================================== */}
      {dispositionTargetLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-disposition-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingDisposition) {
              setDispositionTargetLetter(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={dispositionModalRef}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <span className="px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-900 text-[10px] font-bold">
                  DISPOSISI SURAT MASUK DIGITAL
                </span>
                <h3
                  id="modal-disposition-title"
                  className="text-base font-bold text-slate-900 mt-1 break-words"
                >
                  {dispositionTargetLetter.subject}
                </h3>
                <p className="text-xs text-slate-500 font-mono break-all">
                  No: {dispositionTargetLetter.letter_number} • Dari:{' '}
                  {dispositionTargetLetter.counterparty || '-'}
                </p>
              </div>
              <button
                type="button"
                disabled={submittingDisposition}
                onClick={() => setDispositionTargetLetter(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                aria-label="Tutup modal disposisi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDisposition} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label
                  htmlFor="disp-assignee"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Diteruskan / Didisposisikan Kepada (Waka / Guru / Staf)
                </label>
                <select
                  id="disp-assignee"
                  required
                  value={dispositionForm.assigned_to_teacher_id}
                  onChange={(e) =>
                    setDispositionForm({
                      ...dispositionForm,
                      assigned_to_teacher_id: e.target.value,
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">-- Pilih Pejabat / GTK Penerima Disposisi --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.nip ? `(${t.nip})` : ''}
                    </option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-[11px] text-amber-700">
                    Data GTK belum tersedia di Buku Induk. Tambahkan data GTK terlebih dahulu.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="disp-instruction"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Instruksi Pokok Disposisi
                </label>
                <select
                  id="disp-instruction"
                  value={dispositionForm.instruction}
                  onChange={(e) =>
                    setDispositionForm({ ...dispositionForm, instruction: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="disp-priority"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Sifat / Prioritas Disposisi
                  </label>
                  <select
                    id="disp-priority"
                    value={dispositionForm.priority}
                    onChange={(e) =>
                      setDispositionForm({
                        ...dispositionForm,
                        priority: e.target.value as LetterPriority,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {LETTER_PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="disp-due-date"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Batas Waktu Tindak Lanjut (Opsional)
                  </label>
                  <input
                    id="disp-due-date"
                    type="date"
                    value={dispositionForm.due_date}
                    onChange={(e) =>
                      setDispositionForm({ ...dispositionForm, due_date: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="disp-notes"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Catatan Tambahan Kepala Lembaga / TU (Opsional)
                </label>
                <textarea
                  id="disp-notes"
                  rows={3}
                  placeholder="Tuliskan arahan khusus atau catatan disposisi..."
                  value={dispositionForm.notes}
                  onChange={(e) =>
                    setDispositionForm({ ...dispositionForm, notes: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={submittingDisposition}
                  onClick={() => setDispositionTargetLetter(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingDisposition || teachers.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingDisposition ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <UserCheck className="w-4 h-4 shrink-0" />
                  )}
                  <span>Kirim Disposisi &amp; Notifikasi GTK</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 4: GENERATOR & KUSTOMISASI NASKAH SURAT RESMI (FASE 2)
       * ===================================================================== */}
      {composerLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-composer-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !generatingOfficialPdf) {
              setComposerLetter(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={composerModalRef}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                    GENERATOR NASKAH SURAT RESMI (KOP &amp; TTE QR)
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700 break-all">
                    {composerLetter.letter_number}
                  </span>
                </div>
                <h3
                  id="modal-composer-title"
                  className="text-base font-bold text-slate-900 mt-1 break-words"
                >
                  {formatLetterCategoryLabel(composerLetter.category)}
                </h3>
                <p className="text-xs text-slate-500">
                  Sesuaikan redaksi paragraf naskah surat, pejabat penandatangan, dan tembusan
                  sebelum mengunduh PDF resmi.
                </p>
              </div>

              <button
                type="button"
                disabled={generatingOfficialPdf}
                onClick={() => setComposerLetter(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                aria-label="Tutup generator surat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="composer-issue-city"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Kota / Tempat Penerbitan Surat
                  </label>
                  <input
                    id="composer-issue-city"
                    type="text"
                    value={composerOptions.issueCity || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, issueCity: e.target.value }))
                    }
                    placeholder="cth: Bandung / Jakarta"
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="composer-attachment-label"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Keterangan Lampiran
                  </label>
                  <input
                    id="composer-attachment-label"
                    type="text"
                    value={composerOptions.attachmentCountLabel || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({
                        ...prev,
                        attachmentCountLabel: e.target.value,
                      }))
                    }
                    placeholder="cth: - atau 1 (Satu) Berkas"
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label
                    htmlFor="composer-body-text"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
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
                  id="composer-body-text"
                  rows={6}
                  value={composerOptions.customBodyText || ''}
                  onChange={(e) =>
                    setComposerOptions((prev) => ({ ...prev, customBodyText: e.target.value }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="composer-sig-name"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Nama Pejabat Penandatangan
                  </label>
                  <input
                    id="composer-sig-name"
                    type="text"
                    value={composerOptions.signatoryName || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, signatoryName: e.target.value }))
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="composer-sig-title"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Jabatan Penandatangan
                  </label>
                  <input
                    id="composer-sig-title"
                    type="text"
                    value={composerOptions.signatoryTitle || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, signatoryTitle: e.target.value }))
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="composer-sig-nip"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    NIP / NIY Pejabat (Opsional)
                  </label>
                  <input
                    id="composer-sig-nip"
                    type="text"
                    placeholder="Kosongkan jika tidak ada"
                    value={composerOptions.signatoryNip || ''}
                    onChange={(e) =>
                      setComposerOptions((prev) => ({ ...prev, signatoryNip: e.target.value }))
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="composer-cc-list"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Tembusan Surat (Opsional — satu penerima per baris)
                </label>
                <textarea
                  id="composer-cc-list"
                  rows={2}
                  placeholder="cth: Arsip Tata Usaha"
                  value={composerOptions.ccListText || ''}
                  onChange={(e) =>
                    setComposerOptions((prev) => ({ ...prev, ccListText: e.target.value }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={generatingOfficialPdf}
                onClick={() => setComposerLetter(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void handleGenerateOfficialPdf()}
                disabled={generatingOfficialPdf}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {generatingOfficialPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                )}
                <span>Unduh Naskah Surat Resmi Ber-Kop &amp; TTE QR (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 5: DETAIL & PRATINJAU ARSIP SURAT
       * ===================================================================== */}
      {previewLetter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-letter-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewLetter(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={previewModalRef}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
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
                  <span className="font-mono text-xs font-bold text-slate-800 break-all">
                    {previewLetter.letter_number}
                  </span>
                </div>
                <h3
                  id="modal-letter-title"
                  className="text-base font-bold text-slate-900 mt-1 break-words"
                >
                  {previewLetter.subject}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewLetter(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                aria-label="Tutup detail surat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">Kategori Surat</p>
                <p className="font-bold text-slate-900 mt-0.5 break-words">
                  {formatLetterCategoryLabel(previewLetter.category)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">
                  Tanggal &amp; Klasifikasi
                </p>
                <p className="font-bold text-slate-900 mt-0.5 font-mono">
                  {formatReadableDate(previewLetter.letter_date)} • Kode:{' '}
                  {previewLetter.classification_code ||
                    getDefaultClassificationCode(previewLetter.category)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-500">
                  {previewLetter.direction === 'MASUK' ? 'Pengirim / Asal' : 'Tujuan / Penerima'}
                </p>
                <p className="font-bold text-slate-900 mt-0.5 break-words">
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

            {(() => {
              const enrichedPreview = enrichLetterRecord(previewLetter);
              const linkedStudent = extractLinkedStudent(enrichedPreview);
              const linkedTeacher = extractLinkedTeacher(enrichedPreview);
              if (!linkedStudent && !linkedTeacher) return null;
              return (
                <div className="rounded-xl bg-indigo-50/60 border border-indigo-200/80 p-3.5 text-xs space-y-1">
                  <p className="text-[11px] font-bold text-indigo-950">Warga Madrasah Terkait</p>
                  {linkedStudent && (
                    <p className="text-indigo-900 break-words">
                      • Siswa: <strong>{linkedStudent.full_name}</strong>
                      {linkedStudent.nis ? ` (NIS: ${linkedStudent.nis})` : ''}
                    </p>
                  )}
                  {linkedTeacher && (
                    <p className="text-indigo-900 break-words">
                      • GTK: <strong>{linkedTeacher.full_name}</strong>
                      {linkedTeacher.nip ? ` (NIP: ${linkedTeacher.nip})` : ''}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 text-xs space-y-1">
              <p className="text-[10px] font-semibold text-slate-500">
                Ringkasan Isi / Catatan Arsip
              </p>
              <p className="text-slate-800 whitespace-pre-line break-words">
                {previewLetter.summary?.trim() || 'Tidak ada catatan ringkasan.'}
              </p>
            </div>

            {previewLetter.file_url && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-bold text-slate-800">Pratinjau Lampiran Digital</p>
                  <a
                    href={`/api/layanan/persuratan/attachment?id=${encodeURIComponent(previewLetter.id)}`}
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
                    src={`/api/layanan/persuratan/attachment?id=${encodeURIComponent(previewLetter.id)}`}
                    alt={previewLetter.subject}
                    className="max-h-80 w-auto max-w-full mx-auto rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-950 min-w-0">
                      <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          {previewLetter.attachment_name || 'Dokumen Lampiran PDF'}
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Klik tombol untuk membuka atau mengunduh berkas asli.
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/layanan/persuratan/attachment?id=${encodeURIComponent(previewLetter.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0"
                    >
                      Buka Dokumen
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewLetter(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Tutup
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handlePrintSingleLetter(previewLetter)}
                  disabled={printingLetterId === previewLetter.id}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold disabled:opacity-50"
                >
                  {printingLetterId === previewLetter.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Lembar Registrasi QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = previewLetter;
                    setPreviewLetter(null);
                    handleOpenOfficialComposer(target);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                >
                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Cetak Naskah Surat Resmi (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
