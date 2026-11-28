'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileCheck2,
  FileWarning,
  Home,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface EvidenceFileItem {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

interface BkSummaryRow {
  student_id: string;
  full_name: string;
  nis: string | null;
  violation_points: number;
  achievement_points: number;
  consultation_count: number;
  recommended_action: string;
}

interface AcademicYearOpt {
  id: string;
  name: string;
  semester: string;
  is_active: boolean;
}

interface BkRuleRow {
  id: string;
  code: string;
  rule_type: 'PELANGGARAN' | 'PRESTASI';
  title: string;
  default_points: number;
  sanction_hint: string | null;
  academic_year_id?: string | null;
  is_archived?: boolean;
  academic_year?: AcademicYearOpt | null;
}

type CounselingTypeValue =
  | 'INDIVIDU'
  | 'KELOMPOK'
  | 'KLASIKAL'
  | 'KONSULTASI'
  | 'MEDIASI'
  | 'LAINNYA';

type TopicCategoryValue = 'PRIBADI' | 'SOSIAL' | 'BELAJAR' | 'KARIR' | 'LAINNYA';

interface BookingRow {
  id: string;
  student_id: string;
  preferred_date: string;
  academic_year_id?: string | null;
  is_archived?: boolean;
  academic_year?: AcademicYearOpt | null;
  counseling_type?: CounselingTypeValue | null;
  counseling_type_other?: string | null;
  topic_category?: TopicCategoryValue | null;
  topic_other?: string | null;
  topic: string;
  status: 'MENUNGGU' | 'DIJADWALKAN' | 'SELESAI' | 'DIBATALKAN';
  counselor_notes: string | null;
  bap_summary?: string | null;
  bap_follow_up?: string | null;
  evidence_files?: EvidenceFileItem[] | null;
  completed_at?: string | null;
  student?: { id?: string; full_name: string; nis: string | null } | null;
}

interface HomeVisitRow {
  id: string;
  student_id: string;
  visit_date: string;
  academic_year_id?: string | null;
  is_archived?: boolean;
  academic_year?: AcademicYearOpt | null;
  visited_address: string | null;
  met_with: string | null;
  participants?: string | null;
  summary: string;
  follow_up: string | null;
  evidence_files?: EvidenceFileItem[] | null;
  student?: { id?: string; full_name: string; nis: string | null } | null;
}

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
}

type SpLevel = 'SP1' | 'SP2' | 'SP3' | 'PANGGILAN_ORTU';

const COUNSELING_TYPE_OPTIONS: ReadonlyArray<{
  value: CounselingTypeValue;
  label: string;
  shortLabel: string;
}> = [
  {
    value: 'INDIVIDU',
    label: 'Konseling Individu (1 siswa — tatap muka privat)',
    shortLabel: 'Konseling Individu',
  },
  {
    value: 'KELOMPOK',
    label: 'Konseling Kelompok (4–8 siswa atau bisa lebih)',
    shortLabel: 'Konseling Kelompok',
  },
  {
    value: 'KLASIKAL',
    label: 'Bimbingan Klasikal (satu kelas/rombel penuh)',
    shortLabel: 'Bimbingan Klasikal',
  },
  {
    value: 'KONSULTASI',
    label: 'Konsultasi (Orang tua/wali siswa, wali kelas, guru wali, atau guru mapel)',
    shortLabel: 'Konsultasi',
  },
  {
    value: 'MEDIASI',
    label: 'Mediasi (2 siswa atau lebih yang berkonflik)',
    shortLabel: 'Mediasi',
  },
  {
    value: 'LAINNYA',
    label: 'Lainnya',
    shortLabel: 'Lainnya',
  },
];

const TOPIC_CATEGORY_OPTIONS: ReadonlyArray<{
  value: TopicCategoryValue;
  label: string;
}> = [
  { value: 'PRIBADI', label: 'Konseling Pribadi' },
  { value: 'SOSIAL', label: 'Konseling Sosial' },
  { value: 'BELAJAR', label: 'Konseling Belajar' },
  { value: 'KARIR', label: 'Konseling Karir' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB
const MAX_EVIDENCE_FILES = 5;

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-semibold text-slate-700 mb-1';

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getCounselingTypeLabel(
  type?: CounselingTypeValue | null,
  other?: string | null
): string {
  if (!type) return 'Konseling Individu';
  if (type === 'LAINNYA') {
    return other?.trim() ? `Lainnya: ${other.trim()}` : 'Lainnya';
  }
  return COUNSELING_TYPE_OPTIONS.find((opt) => opt.value === type)?.shortLabel || type;
}

function parseSafeEvidenceFiles(files: unknown): EvidenceFileItem[] {
  if (!Array.isArray(files)) return [];
  return files.filter(
    (item): item is EvidenceFileItem =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as EvidenceFileItem).url === 'string' &&
      typeof (item as EvidenceFileItem).name === 'string'
  );
}

function inferTopicCategoryFromLegacyTopic(
  topicCategory?: TopicCategoryValue | null,
  topicOther?: string | null,
  topic?: string
): { category: TopicCategoryValue; other: string } {
  if (topicCategory) {
    return { category: topicCategory, other: topicOther || '' };
  }
  const normalized = (topic || '').trim().toLowerCase();
  if (normalized === 'konseling pribadi') return { category: 'PRIBADI', other: '' };
  if (normalized === 'konseling sosial') return { category: 'SOSIAL', other: '' };
  if (normalized === 'konseling belajar') return { category: 'BELAJAR', other: '' };
  if (normalized === 'konseling karir') return { category: 'KARIR', other: '' };
  if (normalized.startsWith('lainnya:')) {
    return { category: 'LAINNYA', other: (topic || '').slice(8).trim() };
  }
  if (normalized) return { category: 'LAINNYA', other: topic || '' };
  return { category: 'PRIBADI', other: '' };
}

export default function BkKasusLanjutanPage() {
  const { hasPermission, loading: sessionLoading } = usePortalSession();
  const canAccess = hasPermission(PERMISSIONS.BK_KASUS_ACCESS);

  const [tab, setTab] = useState<'POIN' | 'KATALOG' | 'BOOKING' | 'HOMEVISIT'>('POIN');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [summaries, setSummaries] = useState<BkSummaryRow[]>([]);
  const [catalog, setCatalog] = useState<BkRuleRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [homeVisits, setHomeVisits] = useState<HomeVisitRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOpt[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYearOpt | null>(null);
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('ACTIVE');

  const [spModal, setSpModal] = useState<{
    student: BkSummaryRow;
    level: SpLevel;
    reason: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    target: 'rule' | 'booking' | 'home_visit';
    id: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // Modal Selesai Konseling (Laporan / BAP + Bukti hingga 5 gambar)
  const [completeModal, setCompleteModal] = useState<{
    booking: BookingRow;
    bap_summary: string;
    bap_follow_up: string;
    counselor_notes: string;
    evidence_files: EvidenceFileItem[];
  } | null>(null);

  // Mode edit Jadwal Konseling & Home Visit
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState({
    code: '',
    rule_type: 'PELANGGARAN' as 'PELANGGARAN' | 'PRESTASI',
    title: '',
    default_points: 10,
    sanction_hint: '',
  });

  const [bookingForm, setBookingForm] = useState(() => ({
    student_id: '',
    preferred_date: getTodayWibIso(),
    counseling_type: 'INDIVIDU' as CounselingTypeValue,
    counseling_type_other: '',
    topic_category: 'PRIBADI' as TopicCategoryValue,
    topic_other: '',
  }));

  const [visitForm, setVisitForm] = useState(() => ({
    student_id: '',
    visit_date: getTodayWibIso(),
    visited_address: '',
    met_with: '',
    participants: '',
    summary: '',
    follow_up: '',
    evidence_files: [] as EvidenceFileItem[],
  }));

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadAll = useCallback(async (targetAcademicYearId: string = academicYearFilter) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const qs = `?scope=kasus&academicYearId=${encodeURIComponent(targetAcademicYearId)}`;
      const [bkRes, stRes] = await Promise.all([
        fetch(`/api/layanan/bk${qs}`, { cache: 'no-store', signal: controller.signal }),
        fetch('/api/akademik/buku-induk', { cache: 'no-store', signal: controller.signal }),
      ]);
      const bkData = await bkRes.json().catch(() => ({}));
      const stData = await stRes.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!bkRes.ok) {
        setLoadError(bkData.error || 'Gagal memuat data kasus BK.');
      } else {
        setAcademicYears(Array.isArray(bkData.academicYears) ? bkData.academicYears : []);
        setActiveAcademicYear(bkData.activeAcademicYear || null);
        setSummaries(bkData.studentPointSummary || []);
        setCatalog(bkData.catalog || []);
        setBookings(bkData.bookings || []);
        setHomeVisits(bkData.homeVisits || []);
      }
      if (stRes.ok) setStudents(stData.students || []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [academicYearFilter]);

  useEffect(() => {
    if (sessionLoading || !canAccess) return;
    const timer = window.setTimeout(() => {
      void loadAll(academicYearFilter);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadAll, sessionLoading, canAccess, academicYearFilter]);

  const inactiveAcademicYears = useMemo(
    () => academicYears.filter((y) => !y.is_active && y.id !== activeAcademicYear?.id),
    [academicYears, activeAcademicYear]
  );

  const selectedArchivedYear = useMemo(() => {
    if (academicYearFilter === 'ACTIVE' || academicYearFilter === 'ALL') return null;
    return inactiveAcademicYears.find((y) => y.id === academicYearFilter) || null;
  }, [academicYearFilter, inactiveAcademicYears]);

  const isReadOnlyArchiveView = Boolean(selectedArchivedYear);

  useEffect(() => {
    if (!spModal && !deleteTarget && !completeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (spModal && !busy) setSpModal(null);
      if (deleteTarget && !deletingKey) setDeleteTarget(null);
      if (completeModal && !busy && !uploadingEvidence) setCompleteModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [spModal, deleteTarget, completeModal, busy, deletingKey, uploadingEvidence]);

  async function postBk(payload: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/layanan/bk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memproses permintaan.', 'err');
        return null;
      }
      showToast(msg);
      await loadAll();
      return data;
    } catch {
      showToast('Terjadi kesalahan jaringan saat memproses permintaan.', 'err');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function uploadEvidenceBatch(
    files: FileList | null,
    existingFiles: EvidenceFileItem[],
    category: 'BAP_KONSELING' | 'HOME_VISIT',
    onUploaded: (nextFiles: EvidenceFileItem[]) => void
  ) {
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_EVIDENCE_FILES - existingFiles.length;
    if (remainingSlots <= 0) {
      showToast(`Maksimal ${MAX_EVIDENCE_FILES} file gambar bukti sudah tercapai.`, 'err');
      return;
    }

    const picked = Array.from(files);
    if (picked.length > remainingSlots) {
      showToast(
        `Anda hanya dapat menambah ${remainingSlots} file lagi (maksimal ${MAX_EVIDENCE_FILES} gambar).`,
        'err'
      );
      return;
    }

    for (const file of picked) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        showToast(
          `File "${file.name}" tidak didukung. Format harus PNG, JPG, JPEG, atau WEBP.`,
          'err'
        );
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showToast(
          `Ukuran "${file.name}" melebihi batas maksimal 1,5 MB per file.`,
          'err'
        );
        return;
      }
    }

    setUploadingEvidence(true);
    try {
      const uploadedItems: EvidenceFileItem[] = [];
      for (const file of picked) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', category);
        const res = await fetch('/api/layanan/bk/upload', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          showToast(data.error || `Gagal mengunggah "${file.name}".`, 'err');
          break;
        }
        uploadedItems.push({
          url: data.url as string,
          name: (data.name as string) || file.name,
          mimeType: data.mimeType as string | undefined,
          size: typeof data.size === 'number' ? data.size : file.size,
        });
      }
      if (uploadedItems.length > 0) {
        onUploaded([...existingFiles, ...uploadedItems]);
        showToast(`${uploadedItems.length} gambar bukti berhasil diunggah.`);
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mengunggah gambar bukti.', 'err');
    } finally {
      setUploadingEvidence(false);
    }
  }

  function openSpModal(student: BkSummaryRow, level: SpLevel) {
    setSpModal({
      student,
      level,
      reason: `Akumulasi poin pelanggaran mencapai ${student.violation_points} poin.`,
    });
  }

  async function handleSubmitSp(e: FormEvent) {
    e.preventDefault();
    if (!spModal) return;
    const reason = spModal.reason.trim();
    if (!reason) {
      showToast('Alasan penerbitan surat wajib diisi.', 'err');
      return;
    }
    const { student, level } = spModal;
    const res = await postBk(
      { action: 'ISSUE_SP_LETTER', student_id: student.student_id, letter_level: level, reason },
      `${level.replace('_', ' ')} berhasil diterbitkan ke E-Office Persuratan & notifikasi keluarga terkirim.`
    );
    if (res) {
      setSpModal(null);
      if (res?.letter?.letter_number) {
        showToast(
          `Draf ${level.replace('_', ' ')} (${res.letter.letter_number}) berhasil dibuat di E-Office Persuratan.`
        );
      }
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeletingKey(deleteTarget.id);
    try {
      const res = await fetch(
        `/api/layanan/bk?id=${encodeURIComponent(deleteTarget.id)}&target=${encodeURIComponent(
          deleteTarget.target
        )}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menghapus data.', 'err');
        return;
      }
      if (deleteTarget.target === 'booking' && editingBookingId === deleteTarget.id) {
        resetBookingForm();
      }
      if (deleteTarget.target === 'home_visit' && editingVisitId === deleteTarget.id) {
        resetVisitForm();
      }
      showToast(`${deleteTarget.title} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadAll();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus data.', 'err');
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk(
      { action: 'CREATE_RULE', ...ruleForm },
      'Aturan poin berhasil ditambahkan.'
    );
    if (ok) {
      setRuleForm({
        code: '',
        rule_type: 'PELANGGARAN',
        title: '',
        default_points: 10,
        sanction_hint: '',
      });
    }
  }

  function resetBookingForm() {
    setEditingBookingId(null);
    setBookingForm({
      student_id: '',
      preferred_date: getTodayWibIso(),
      counseling_type: 'INDIVIDU',
      counseling_type_other: '',
      topic_category: 'PRIBADI',
      topic_other: '',
    });
  }

  function startEditBooking(b: BookingRow) {
    const inferred = inferTopicCategoryFromLegacyTopic(b.topic_category, b.topic_other, b.topic);
    setEditingBookingId(b.id);
    setBookingForm({
      student_id: b.student_id || b.student?.id || '',
      preferred_date: b.preferred_date || getTodayWibIso(),
      counseling_type: b.counseling_type || 'INDIVIDU',
      counseling_type_other: b.counseling_type_other || '',
      topic_category: inferred.category,
      topic_other: inferred.other,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmitBooking(e: FormEvent) {
    e.preventDefault();
    if (
      bookingForm.counseling_type === 'LAINNYA' &&
      bookingForm.counseling_type_other.trim().length < 2
    ) {
      showToast('Penjelasan Tipe Konseling Lainnya wajib diisi.', 'err');
      return;
    }
    if (bookingForm.topic_category === 'LAINNYA' && bookingForm.topic_other.trim().length < 2) {
      showToast('Penjelasan Topik Konseling Lainnya wajib diisi.', 'err');
      return;
    }

    const isEditing = Boolean(editingBookingId);
    const ok = await postBk(
      {
        action: isEditing ? 'UPDATE_BOOKING' : 'CREATE_BOOKING',
        ...(isEditing ? { id: editingBookingId } : {}),
        student_id: bookingForm.student_id,
        preferred_date: bookingForm.preferred_date,
        counseling_type: bookingForm.counseling_type,
        counseling_type_other:
          bookingForm.counseling_type === 'LAINNYA'
            ? bookingForm.counseling_type_other.trim()
            : null,
        topic_category: bookingForm.topic_category,
        topic_other:
          bookingForm.topic_category === 'LAINNYA' ? bookingForm.topic_other.trim() : null,
      },
      isEditing ? 'Jadwal konseling berhasil diperbarui.' : 'Jadwal konseling berhasil dibuat.'
    );
    if (ok) resetBookingForm();
  }

  function openCompleteBookingModal(b: BookingRow) {
    setCompleteModal({
      booking: b,
      bap_summary: b.bap_summary || '',
      bap_follow_up: b.bap_follow_up || '',
      counselor_notes: b.counselor_notes || '',
      evidence_files: parseSafeEvidenceFiles(b.evidence_files),
    });
  }

  async function handleSubmitCompleteBooking(e: FormEvent) {
    e.preventDefault();
    if (!completeModal || busy || uploadingEvidence) return;
    if (completeModal.bap_summary.trim().length < 5) {
      showToast('Laporan / BAP konseling minimal 5 karakter.', 'err');
      return;
    }
    if (completeModal.evidence_files.length === 0) {
      showToast(
        'Unggah minimal 1 gambar bukti konseling (lembar konseling, BAP, atau foto kegiatan).',
        'err'
      );
      return;
    }

    const ok = await postBk(
      {
        action: 'COMPLETE_BOOKING',
        id: completeModal.booking.id,
        bap_summary: completeModal.bap_summary.trim(),
        bap_follow_up: completeModal.bap_follow_up.trim() || null,
        counselor_notes: completeModal.counselor_notes.trim() || null,
        evidence_files: completeModal.evidence_files,
      },
      'Sesi konseling selesai dan laporan BAP beserta bukti berhasil disimpan.'
    );
    if (ok) setCompleteModal(null);
  }

  function resetVisitForm() {
    setEditingVisitId(null);
    setVisitForm({
      student_id: '',
      visit_date: getTodayWibIso(),
      visited_address: '',
      met_with: '',
      participants: '',
      summary: '',
      follow_up: '',
      evidence_files: [],
    });
  }

  function startEditVisit(v: HomeVisitRow) {
    setEditingVisitId(v.id);
    setVisitForm({
      student_id: v.student_id || v.student?.id || '',
      visit_date: v.visit_date || getTodayWibIso(),
      visited_address: v.visited_address || '',
      met_with: v.met_with || '',
      participants: v.participants || '',
      summary: v.summary || '',
      follow_up: v.follow_up || '',
      evidence_files: parseSafeEvidenceFiles(v.evidence_files),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmitVisit(e: FormEvent) {
    e.preventDefault();
    if (visitForm.participants.trim().length < 2) {
      showToast('Daftar pihak yang ikut dalam kegiatan Home Visit wajib diisi.', 'err');
      return;
    }
    const isEditing = Boolean(editingVisitId);
    const ok = await postBk(
      {
        action: isEditing ? 'UPDATE_HOME_VISIT' : 'CREATE_HOME_VISIT',
        ...(isEditing ? { id: editingVisitId } : {}),
        student_id: visitForm.student_id,
        visit_date: visitForm.visit_date,
        visited_address: visitForm.visited_address.trim() || null,
        met_with: visitForm.met_with.trim() || null,
        participants: visitForm.participants.trim(),
        summary: visitForm.summary.trim(),
        follow_up: visitForm.follow_up.trim() || null,
        evidence_files: visitForm.evidence_files,
      },
      isEditing
        ? 'Laporan Home Visit berhasil diperbarui.'
        : 'Laporan Home Visit berhasil disimpan.'
    );
    if (ok) resetVisitForm();
  }

  if (!sessionLoading && !canAccess) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-3xl p-6 sm:p-8 text-center space-y-3 border border-rose-200/80">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
            Akses Dibatasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Halaman <strong>Manajemen Kasus BK, SP1–SP3, Konseling &amp; Home Visit</strong> hanya
            dapat diakses oleh <strong>Superadmin</strong>, <strong>Operator</strong>, dan guru
            dengan tugas tambahan <strong>Guru BK</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 min-w-0">
      {toast && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="[overflow-wrap:anywhere]">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="[overflow-wrap:anywhere]">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Manajemen Kasus BK, SP1–SP3, Konseling &amp; Home Visit</span>
              </h1>
              {activeAcademicYear && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                  TA Aktif: {activeAcademicYear.name} ({activeAcademicYear.semester})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau akumulasi poin siswa, terbitkan SP otomatis ke Persuratan, kelola katalog tata tertib, jadwal konseling &amp; BAP, serta kunjungan rumah per tahun pelajaran.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter Tahun Pelajaran"
              value={academicYearFilter}
              onChange={(e) => {
                setAcademicYearFilter(e.target.value);
                resetBookingForm();
                resetVisitForm();
              }}
              className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            >
              <option value="ACTIVE">
                {activeAcademicYear
                  ? `TA Aktif: ${activeAcademicYear.name} (${activeAcademicYear.semester})`
                  : 'Tahun Pelajaran Aktif'}
              </option>
              {inactiveAcademicYears.length > 0 && (
                <optgroup label="Arsip Tahun Pelajaran Sebelumnya (Hanya Lihat)">
                  {inactiveAcademicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      Arsip: {y.name} ({y.semester})
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="ALL">Semua Tahun Pelajaran</option>
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadAll(academicYearFilter)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
          </div>
        </div>

        {/* Banner Informasi Mode Arsip Tahun Pelajaran Tidak Aktif */}
        {selectedArchivedYear && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Archive className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Menampilkan arsip{' '}
                <strong>
                  TA {selectedArchivedYear.name} ({selectedArchivedYear.semester})
                </strong>
                . Seluruh data pada tahun pelajaran tidak aktif hanya dapat dilihat (tidak dapat ditambah, diedit, maupun dihapus).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAcademicYearFilter('ACTIVE')}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 transition"
            >
              Kembali ke TA Aktif
            </button>
          </div>
        )}

        {/* Tabulasi Horizontal Scrollable */}
        <div
          role="tablist"
          aria-label="Menu Kasus BK"
          className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3 -mx-1 px-1 no-scrollbar"
        >
          {(
            [
              { id: 'POIN', label: `Akumulasi Poin & SP (${summaries.length})`, icon: FileWarning },
              { id: 'KATALOG', label: `Katalog Tata Tertib (${catalog.length})`, icon: BookOpen },
              { id: 'BOOKING', label: `Jadwal Konseling (${bookings.length})`, icon: Calendar },
              { id: 'HOMEVISIT', label: `Home Visit (${homeVisits.length})`, icon: Home },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  active
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ==================== TAB POIN & SP ==================== */}
        {tab === 'POIN' && (
          <div className="space-y-3 text-xs">
            {summaries.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {loading ? 'Memuat rekap poin siswa...' : 'Belum ada rekap poin siswa.'}
              </div>
            ) : (
              summaries.map((s) => (
                <div
                  key={s.student_id}
                  className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                        {s.full_name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">NIS: {s.nis || '-'}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.violation_points >= 50
                            ? 'bg-rose-100 text-rose-800'
                            : s.violation_points >= 25
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        Rekomendasi: {s.recommended_action}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Pelanggaran: <strong className="text-rose-700">{s.violation_points} poin</strong> • Prestasi:{' '}
                      <strong className="text-emerald-700">+{s.achievement_points} poin</strong> • Konsultasi:{' '}
                      <strong>{s.consultation_count}x</strong>
                    </p>
                  </div>
                  {!isReadOnlyArchiveView && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {(['SP1', 'SP2', 'SP3', 'PANGGILAN_ORTU'] as const).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          disabled={busy}
                          onClick={() => openSpModal(s, lv)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 font-semibold text-[11px] transition"
                        >
                          Terbitkan {lv.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== TAB KATALOG ==================== */}
        {tab === 'KATALOG' && (
          <div className="space-y-4 text-xs">
            {!isReadOnlyArchiveView && (
              <form
                onSubmit={handleCreateRule}
                className="grid sm:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 items-end"
              >
              <div className="sm:col-span-2">
                <label htmlFor="bk-rule-code" className={LABEL_CLASS}>
                  Kode <span className="text-rose-600">*</span>
                </label>
                <input
                  id="bk-rule-code"
                  required
                  value={ruleForm.code}
                  onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })}
                  placeholder="P-01"
                  className={`${INPUT_CLASS} font-mono uppercase`}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bk-rule-type" className={LABEL_CLASS}>
                  Jenis <span className="text-rose-600">*</span>
                </label>
                <select
                  id="bk-rule-type"
                  value={ruleForm.rule_type}
                  onChange={(e) =>
                    setRuleForm({
                      ...ruleForm,
                      rule_type: e.target.value as 'PELANGGARAN' | 'PRESTASI',
                    })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="PELANGGARAN">Pelanggaran</option>
                  <option value="PRESTASI">Prestasi</option>
                </select>
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="bk-rule-title" className={LABEL_CLASS}>
                  Nama Tata Tertib / Prestasi <span className="text-rose-600">*</span>
                </label>
                <input
                  id="bk-rule-title"
                  required
                  value={ruleForm.title}
                  onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                  placeholder="mis. Terlambat masuk > 15 menit"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bk-rule-points" className={LABEL_CLASS}>
                  Poin <span className="text-rose-600">*</span>
                </label>
                <input
                  id="bk-rule-points"
                  type="number"
                  required
                  min={1}
                  value={ruleForm.default_points}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, default_points: Number(e.target.value) || 5 })
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah
                </button>
              </div>
            </form>
            )}

            <div className="space-y-2">
              {catalog.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  Belum ada katalog aturan tata tertib atau prestasi pada tahun pelajaran ini.
                </div>
              ) : (
                catalog.map((r) => (
                  <div
                    key={r.id}
                    className="modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {r.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          r.rule_type === 'PELANGGARAN'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {r.rule_type} ({r.default_points} poin)
                      </span>
                      {r.is_archived && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                          <Archive className="w-3 h-3" /> Arsip{r.academic_year ? ` ${r.academic_year.name}` : ''}
                        </span>
                      )}
                      <span className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{r.title}</span>
                    </div>
                    {!r.is_archived && (
                      <button
                        type="button"
                        disabled={Boolean(deletingKey)}
                        onClick={() =>
                          setDeleteTarget({
                            target: 'rule',
                            id: r.id,
                            title: `Aturan "${r.code}"`,
                            subtitle: `Anda akan menghapus aturan ${r.code} (${r.title}).`,
                          })
                        }
                        aria-label={`Hapus aturan ${r.code}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 shrink-0 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB JADWAL KONSELING ==================== */}
        {tab === 'BOOKING' && (
          <div className="space-y-4 text-xs">
            {!isReadOnlyArchiveView && (
              <form
                onSubmit={handleSubmitBooking}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingBookingId ? 'Edit Jadwal Konseling' : 'Buat Jadwal Konseling Baru'}
                </h2>
                {editingBookingId && (
                  <button
                    type="button"
                    onClick={resetBookingForm}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200/60"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="booking-student" className={LABEL_CLASS}>
                    Siswa <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="booking-student"
                    required
                    value={bookingForm.student_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, student_id: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name} {st.nis ? `(${st.nis})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="booking-date" className={LABEL_CLASS}>
                    Tanggal Sesi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    required
                    value={bookingForm.preferred_date}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, preferred_date: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="booking-type" className={LABEL_CLASS}>
                    Tipe Konseling <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="booking-type"
                    required
                    value={bookingForm.counseling_type}
                    onChange={(e) => {
                      const nextType = e.target.value as CounselingTypeValue;
                      setBookingForm((prev) => ({
                        ...prev,
                        counseling_type: nextType,
                        counseling_type_other: nextType === 'LAINNYA' ? prev.counseling_type_other : '',
                      }));
                    }}
                    className={INPUT_CLASS}
                  >
                    {COUNSELING_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="booking-topic-category" className={LABEL_CLASS}>
                    Topik Konseling <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="booking-topic-category"
                    required
                    value={bookingForm.topic_category}
                    onChange={(e) => {
                      const nextTopic = e.target.value as TopicCategoryValue;
                      setBookingForm((prev) => ({
                        ...prev,
                        topic_category: nextTopic,
                        topic_other: nextTopic === 'LAINNYA' ? prev.topic_other : '',
                      }));
                    }}
                    className={INPUT_CLASS}
                  >
                    {TOPIC_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {bookingForm.counseling_type === 'LAINNYA' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="booking-type-other" className={LABEL_CLASS}>
                      Penjelasan Tipe Konseling Lainnya <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="booking-type-other"
                      required
                      value={bookingForm.counseling_type_other}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, counseling_type_other: e.target.value })
                      }
                      placeholder="Tuliskan jenis/tipe konseling lainnya..."
                      className={INPUT_CLASS}
                    />
                  </div>
                )}

                {bookingForm.topic_category === 'LAINNYA' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="booking-topic-other" className={LABEL_CLASS}>
                      Penjelasan Topik Konseling Lainnya <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="booking-topic-other"
                      required
                      value={bookingForm.topic_other}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, topic_other: e.target.value })
                      }
                      placeholder="Tuliskan topik konseling lainnya..."
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {editingBookingId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={resetBookingForm}
                    className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : editingBookingId ? (
                    <Save className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  {editingBookingId ? 'Simpan Perubahan' : 'Jadwalkan'}
                </button>
              </div>
            </form>
            )}

            <div className="space-y-2.5">
              {bookings.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  Belum ada jadwal konseling tercatat pada tahun pelajaran ini.
                </div>
              ) : (
                bookings.map((b) => {
                  const evidenceList = parseSafeEvidenceFiles(b.evidence_files);
                  return (
                    <article
                      key={b.id}
                      className="modular-card rounded-2xl p-4 space-y-2.5 border border-slate-200/80 min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                b.status === 'SELESAI'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'DIBATALKAN'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-sky-50 text-sky-800'
                              }`}
                            >
                              {b.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold text-[10px]">
                              {getCounselingTypeLabel(b.counseling_type, b.counseling_type_other)}
                            </span>
                            {b.is_archived && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                                <Archive className="w-3 h-3" /> Arsip{b.academic_year ? ` ${b.academic_year.name}` : ''} • Hanya Lihat
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              Tanggal: {b.preferred_date}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                            {b.student?.full_name || 'Siswa'} — {b.topic}
                          </p>
                        </div>

                        {!b.is_archived && (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {b.status !== 'SELESAI' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openCompleteBookingModal(b)}
                                className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-[11px] transition"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" />
                                Selesai
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startEditBooking(b)}
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold text-[11px] transition"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(deletingKey)}
                              onClick={() =>
                                setDeleteTarget({
                                  target: 'booking',
                                  id: b.id,
                                  title: `Jadwal Konseling ${b.student?.full_name || ''}`,
                                  subtitle: `Anda akan menghapus jadwal konseling "${b.topic}" pada ${b.preferred_date}.`,
                                })
                              }
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Ringkasan BAP & Bukti jika sudah Selesai */}
                      {(b.bap_summary || b.bap_follow_up || evidenceList.length > 0) && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-2">
                          {b.bap_summary && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Laporan / BAP Konseling
                              </p>
                              <p className="text-xs text-slate-700 whitespace-pre-line [overflow-wrap:anywhere] mt-0.5">
                                {b.bap_summary}
                              </p>
                            </div>
                          )}
                          {b.bap_follow_up && (
                            <p className="text-[11px] text-slate-600 [overflow-wrap:anywhere]">
                              <strong>Tindak Lanjut:</strong> {b.bap_follow_up}
                            </p>
                          )}
                          {evidenceList.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Bukti Konseling ({evidenceList.length} foto)
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {evidenceList.map((file, idx) => (
                                  <a
                                    key={`${file.url}-${idx}`}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={file.name}
                                    className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 block"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={file.url}
                                      alt={file.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition"
                                    />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB HOME VISIT ==================== */}
        {tab === 'HOMEVISIT' && (
          <div className="space-y-4 text-xs">
            {!isReadOnlyArchiveView && (
              <form
                onSubmit={handleSubmitVisit}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingVisitId ? 'Edit Laporan Home Visit' : 'Catat Laporan Home Visit Baru'}
                </h2>
                {editingVisitId && (
                  <button
                    type="button"
                    onClick={resetVisitForm}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200/60"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="visit-student" className={LABEL_CLASS}>
                    Siswa <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="visit-student"
                    required
                    value={visitForm.student_id}
                    onChange={(e) => setVisitForm({ ...visitForm, student_id: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name} {st.nis ? `(${st.nis})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="visit-date" className={LABEL_CLASS}>
                    Tanggal Kunjungan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="visit-date"
                    type="date"
                    required
                    value={visitForm.visit_date}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="visit-address" className={LABEL_CLASS}>
                    Alamat Dikunjungi
                  </label>
                  <input
                    id="visit-address"
                    value={visitForm.visited_address}
                    onChange={(e) =>
                      setVisitForm({ ...visitForm, visited_address: e.target.value })
                    }
                    placeholder="Alamat rumah orang tua/wali"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="visit-met-with" className={LABEL_CLASS}>
                    Bertemu Dengan
                  </label>
                  <input
                    id="visit-met-with"
                    value={visitForm.met_with}
                    onChange={(e) => setVisitForm({ ...visitForm, met_with: e.target.value })}
                    placeholder="mis. Ayah / Ibu Kandung / Wali"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="visit-participants" className={LABEL_CLASS}>
                    Pihak / Tim yang Ikut dalam Kegiatan Home Visit{' '}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="visit-participants"
                    required
                    value={visitForm.participants}
                    onChange={(e) => setVisitForm({ ...visitForm, participants: e.target.value })}
                    placeholder="mis. Guru BK (Ibu Siti), Wali Kelas VII-A (Bpk. Ahmad), Guru Wali"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="visit-summary" className={LABEL_CLASS}>
                    Hasil Kunjungan / Berita Acara <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    id="visit-summary"
                    required
                    rows={2}
                    value={visitForm.summary}
                    onChange={(e) => setVisitForm({ ...visitForm, summary: e.target.value })}
                    placeholder="Ringkasan hasil kunjungan rumah..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="visit-follow-up" className={LABEL_CLASS}>
                    Rencana Tindak Lanjut (Opsional)
                  </label>
                  <input
                    id="visit-follow-up"
                    value={visitForm.follow_up}
                    onChange={(e) => setVisitForm({ ...visitForm, follow_up: e.target.value })}
                    placeholder="Tindak lanjut pembinaan bersama orang tua/wali..."
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Upload Bukti Kunjungan (max 5 gambar, 1.5 MB/file) */}
                <div className="sm:col-span-2 space-y-2">
                  <label htmlFor="visit-evidence-upload" className={LABEL_CLASS}>
                    Bukti Kunjungan / Foto Kegiatan Home Visit (Maks. 5 gambar • PNG/JPG/JPEG/WEBP • Maks. 1,5 MB/file)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="visit-evidence-upload"
                      className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 font-semibold cursor-pointer transition ${
                        uploadingEvidence || visitForm.evidence_files.length >= MAX_EVIDENCE_FILES
                          ? 'opacity-50 pointer-events-none'
                          : ''
                      }`}
                    >
                      {uploadingEvidence ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImagePlus className="w-4 h-4" />
                      )}
                      <span>
                        Pilih Foto Bukti ({visitForm.evidence_files.length}/{MAX_EVIDENCE_FILES})
                      </span>
                    </label>
                    <input
                      id="visit-evidence-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      disabled={
                        uploadingEvidence || visitForm.evidence_files.length >= MAX_EVIDENCE_FILES
                      }
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const input = e.target;
                        void uploadEvidenceBatch(
                          input.files,
                          visitForm.evidence_files,
                          'HOME_VISIT',
                          (nextFiles) =>
                            setVisitForm((prev) => ({ ...prev, evidence_files: nextFiles }))
                        );
                        input.value = '';
                      }}
                      className="sr-only"
                    />
                  </div>

                  {visitForm.evidence_files.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {visitForm.evidence_files.map((file, idx) => (
                        <div
                          key={`${file.url}-${idx}`}
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setVisitForm((prev) => ({
                                ...prev,
                                evidence_files: prev.evidence_files.filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label={`Hapus foto ${file.name}`}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {editingVisitId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={resetVisitForm}
                    className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy || uploadingEvidence}
                  className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : editingVisitId ? (
                    <Save className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  {editingVisitId ? 'Simpan Perubahan Home Visit' : 'Simpan Laporan Home Visit'}
                </button>
              </div>
            </form>
            )}

            <div className="space-y-2.5">
              {homeVisits.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  Belum ada laporan Home Visit tercatat pada tahun pelajaran ini.
                </div>
              ) : (
                homeVisits.map((v) => {
                  const evidenceList = parseSafeEvidenceFiles(v.evidence_files);
                  return (
                    <article
                      key={v.id}
                      className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80 min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">
                              {v.student?.full_name || 'Siswa'}
                            </p>
                            <span className="text-[11px] text-slate-400">{v.visit_date}</span>
                            {v.is_archived && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                                <Archive className="w-3 h-3" /> Arsip{v.academic_year ? ` ${v.academic_year.name}` : ''} • Hanya Lihat
                              </span>
                            )}
                          </div>
                          {v.visited_address && (
                            <p className="text-[11px] text-slate-500 [overflow-wrap:anywhere]">
                              Alamat: {v.visited_address}
                            </p>
                          )}
                        </div>
                        {!v.is_archived && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startEditVisit(v)}
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold text-[11px] transition"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(deletingKey)}
                              onClick={() =>
                                setDeleteTarget({
                                  target: 'home_visit',
                                  id: v.id,
                                  title: `Laporan Home Visit ${v.student?.full_name || ''}`,
                                  subtitle: `Anda akan menghapus laporan Home Visit tanggal ${v.visit_date}.`,
                                })
                              }
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-slate-700 whitespace-pre-line [overflow-wrap:anywhere]">
                        {v.summary}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {v.met_with && <span>Bertemu: <strong>{v.met_with}</strong></span>}
                        {v.participants && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                            Tim Kunjungan: <strong className="text-slate-700">{v.participants}</strong>
                          </span>
                        )}
                      </div>

                      {v.follow_up && (
                        <p className="text-[11px] text-slate-600 [overflow-wrap:anywhere]">
                          <strong>Tindak Lanjut:</strong> {v.follow_up}
                        </p>
                      )}

                      {evidenceList.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Bukti Kunjungan ({evidenceList.length} foto)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {evidenceList.map((file, idx) => (
                              <a
                                key={`${file.url}-${idx}`}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={file.name}
                                className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Laporan / BAP Penyelesaian Sesi Konseling */}
      {completeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-complete-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy && !uploadingEvidence) {
              setCompleteModal(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  LAPORAN &amp; BAP KONSELING
                </span>
                <h2
                  id="bk-complete-modal-title"
                  className="text-base font-bold text-slate-900 mt-1 [overflow-wrap:anywhere]"
                >
                  Selesaikan Sesi — {completeModal.booking.student?.full_name || 'Siswa'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 [overflow-wrap:anywhere]">
                  {getCounselingTypeLabel(
                    completeModal.booking.counseling_type,
                    completeModal.booking.counseling_type_other
                  )}{' '}
                  • {completeModal.booking.topic} ({completeModal.booking.preferred_date})
                </p>
              </div>
              <button
                type="button"
                disabled={busy || uploadingEvidence}
                onClick={() => setCompleteModal(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitCompleteBooking}
              className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs"
            >
              <div>
                <label htmlFor="bap-summary" className={LABEL_CLASS}>
                  Laporan / Berita Acara Pelaksanaan (BAP) Konseling{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="bap-summary"
                  required
                  rows={4}
                  disabled={busy}
                  value={completeModal.bap_summary}
                  onChange={(e) =>
                    setCompleteModal((prev) =>
                      prev ? { ...prev, bap_summary: e.target.value } : null
                    )
                  }
                  placeholder="Tuliskan ringkasan pelaksanaan sesi konseling, pokok permasalahan, dan kesepakatan yang dicapai..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <div>
                <label htmlFor="bap-follow-up" className={LABEL_CLASS}>
                  Rencana Tindak Lanjut (Opsional)
                </label>
                <textarea
                  id="bap-follow-up"
                  rows={2}
                  disabled={busy}
                  value={completeModal.bap_follow_up}
                  onChange={(e) =>
                    setCompleteModal((prev) =>
                      prev ? { ...prev, bap_follow_up: e.target.value } : null
                    )
                  }
                  placeholder="Tindak lanjut sesi berikutnya, koordinasi wali kelas, atau pemanggilan orang tua..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <div>
                <label htmlFor="bap-counselor-notes" className={LABEL_CLASS}>
                  Catatan Tambahan Konselor (Opsional)
                </label>
                <input
                  id="bap-counselor-notes"
                  disabled={busy}
                  value={completeModal.counselor_notes}
                  onChange={(e) =>
                    setCompleteModal((prev) =>
                      prev ? { ...prev, counselor_notes: e.target.value } : null
                    )
                  }
                  placeholder="Catatan internal konselor BK..."
                  className={INPUT_CLASS}
                />
              </div>

              {/* Unggah Bukti Konseling (Lembar Konseling, BAP, Foto) */}
              <div className="space-y-2">
                <label htmlFor="bap-evidence-upload" className={LABEL_CLASS}>
                  Bukti Pelaksanaan Konseling (Lembar Konseling, Lembar BAP, Foto Kegiatan){' '}
                  <span className="text-rose-600">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Format: PNG, JPG, JPEG, atau WEBP • Maksimal 5 file sekaligus • Maks. 1,5 MB per file.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="bap-evidence-upload"
                    className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 font-semibold cursor-pointer transition ${
                      uploadingEvidence || completeModal.evidence_files.length >= MAX_EVIDENCE_FILES
                        ? 'opacity-50 pointer-events-none'
                        : ''
                    }`}
                  >
                    {uploadingEvidence ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImagePlus className="w-4 h-4" />
                    )}
                    <span>
                      Unggah Bukti ({completeModal.evidence_files.length}/{MAX_EVIDENCE_FILES})
                    </span>
                  </label>
                  <input
                    id="bap-evidence-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    disabled={
                      uploadingEvidence ||
                      completeModal.evidence_files.length >= MAX_EVIDENCE_FILES
                    }
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const input = e.target;
                      void uploadEvidenceBatch(
                        input.files,
                        completeModal.evidence_files,
                        'BAP_KONSELING',
                        (nextFiles) =>
                          setCompleteModal((prev) =>
                            prev ? { ...prev, evidence_files: nextFiles } : null
                          )
                      );
                      input.value = '';
                    }}
                    className="sr-only"
                  />
                </div>

                {completeModal.evidence_files.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {completeModal.evidence_files.map((file, idx) => (
                      <div
                        key={`${file.url}-${idx}`}
                        className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCompleteModal((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    evidence_files: prev.evidence_files.filter((_, i) => i !== idx),
                                  }
                                : null
                            )
                          }
                          aria-label={`Hapus bukti ${file.name}`}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy || uploadingEvidence}
                  onClick={() => setCompleteModal(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy || uploadingEvidence}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileCheck2 className="w-3.5 h-3.5" />
                  )}
                  Simpan BAP &amp; Tandai Selesai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Terbitkan SP / Panggilan Orang Tua */}
      {spModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-sp-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setSpModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                  PENERBITAN SURAT BK OTOMATIS
                </span>
                <h2
                  id="bk-sp-modal-title"
                  className="text-base font-bold text-slate-900 mt-1 [overflow-wrap:anywhere]"
                >
                  Terbitkan {spModal.level.replace('_', ' ')} — {spModal.student.full_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Akumulasi pelanggaran saat ini: <strong>{spModal.student.violation_points} poin</strong>
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSpModal(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSp} className="space-y-4">
              <div>
                <label htmlFor="bk-sp-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penerbitan Surat *
                </label>
                <textarea
                  id="bk-sp-reason"
                  required
                  rows={3}
                  value={spModal.reason}
                  onChange={(e) =>
                    setSpModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                  }
                  placeholder="Tuliskan alasan penerbitan surat peringatan / panggilan orang tua..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSpModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Terbitkan {spModal.level.replace('_', ' ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus (Aturan / Jadwal Konseling / Home Visit) */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-delete-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingKey) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 id="bk-delete-modal-title" className="text-base font-bold text-slate-900">
                  Hapus {deleteTarget.title}?
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
                  {deleteTarget.subtitle} Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingKey)}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingKey)}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
