'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { parseDecimalInput } from '@/lib/validation/decimal';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex?: number;
}

interface MaterialRow {
  id: string;
  title: string;
  chapter_label: string | null;
  material_type: string;
  file_url: string | null;
  content: string | null;
  subject_id?: string | null;
  classroom_id?: string | null;
  subject?: { id?: string; name: string } | null;
  classroom?: { id?: string; name: string } | null;
  teacher?: { full_name: string } | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  max_score: number;
  subject_id?: string | null;
  classroom_id?: string | null;
  subject?: { id?: string; name: string } | null;
  classroom?: { id?: string; name: string } | null;
  teacher?: { full_name: string } | null;
}

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  attachment_url: string | null;
  score: number | null;
  teacher_feedback: string | null;
  submitted_at?: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

interface QuizRow {
  id: string;
  title: string;
  duration_minutes: number;
  questions: QuizQuestion[];
  subject_id?: string | null;
  classroom_id?: string | null;
  subject?: { id?: string; name: string } | null;
  classroom?: { id?: string; name: string } | null;
}

interface AttemptRow {
  id: string;
  quiz_id: string;
  student_id: string;
  correct_count: number;
  total_questions: number;
  score: number;
  student?: { full_name: string } | null;
}

interface DraftQuizQuestion {
  question: string;
  optA: string;
  optB: string;
  optC: string;
  optD: string;
  correctIndex: number;
}

const ITEMS_PER_PAGE = 8;

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-semibold text-slate-700 mb-1';

const EMPTY_MATERIAL_FORM = {
  subject_id: '',
  classroom_id: '',
  title: '',
  chapter_label: '',
  material_type: 'MODUL_PDF',
  file_url: '',
  content: '',
};

const EMPTY_ASSIGNMENT_FORM = {
  subject_id: '',
  classroom_id: '',
  title: '',
  description: '',
  due_at: '',
};

const EMPTY_QUIZ_FORM = {
  subject_id: '',
  classroom_id: '',
  title: '',
  duration_minutes: 30,
};

function toLocalDateTimeInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
}

function quizQuestionsToDrafts(questions: QuizQuestion[]): DraftQuizQuestion[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [{ ...EMPTY_DRAFT_QUESTION }];
  }
  return questions.map((q) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const safeCorrect =
      typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length
        ? q.correctIndex
        : 0;
    return {
      question: q.question || '',
      optA: opts[0] || '',
      optB: opts[1] || '',
      optC: opts[2] || '',
      optD: opts[3] || '',
      correctIndex: Math.min(3, safeCorrect),
    };
  });
}

const EMPTY_DRAFT_QUESTION: DraftQuizQuestion = {
  question: '',
  optA: '',
  optB: '',
  optC: '',
  optD: '',
  correctIndex: 0,
};

const MATERIAL_TYPE_META: Record<
  string,
  { label: string; badgeClass: string; Icon: typeof FileText }
> = {
  MODUL_PDF: {
    label: 'Modul PDF / Slide',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    Icon: FileText,
  },
  VIDEO: {
    label: 'Video',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/70',
    Icon: Video,
  },
  LINK: {
    label: 'Tautan Referensi',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/70',
    Icon: Link2,
  },
  CATATAN: {
    label: 'Catatan Teks',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70',
    Icon: BookOpen,
  },
};

function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

function formatDueDate(dateStr: string | null | undefined): {
  label: string;
  isPast: boolean;
} | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    label: parsed.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    isPast: parsed.getTime() < Date.now(),
  };
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSafeQuestions(quiz: QuizRow | null | undefined): QuizQuestion[] {
  if (!quiz || !Array.isArray(quiz.questions)) return [];
  return quiz.questions.filter(
    (q) => q && typeof q.question === 'string' && Array.isArray(q.options)
  );
}

export default function PembelajaranLmsPage() {
  const [tab, setTab] = useState<'MATERI' | 'TUGAS' | 'CBT'>('MATERI');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [hasTeachingSchedule, setHasTeachingSchedule] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);
  const [classroomsBySubject, setClassroomsBySubject] = useState<
    Record<string, Array<{ id: string; name: string }>>
  >({});

  // Mode edit & modal hapus guru
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    kind: 'MATERIAL' | 'ASSIGNMENT' | 'QUIZ';
    id: string;
    title: string;
  } | null>(null);

  // Pencarian, Filter & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [classroomFilter, setClassroomFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [submitModal, setSubmitModal] = useState<{
    assignment: AssignmentRow;
    text: string;
    isUpdate: boolean;
  } | null>(null);
  const [gradeModal, setGradeModal] = useState<{
    submission: SubmissionRow;
    assignmentTitle: string;
    score: string;
    feedback: string;
  } | null>(null);

  // Forms Guru
  const [matForm, setMatForm] = useState({
    subject_id: '',
    classroom_id: '',
    title: '',
    chapter_label: '',
    material_type: 'MODUL_PDF',
    file_url: '',
    content: '',
  });
  const [asgForm, setAsgForm] = useState({
    subject_id: '',
    classroom_id: '',
    title: '',
    description: '',
    due_at: '',
  });
  const [quizForm, setQuizForm] = useState({
    subject_id: '',
    classroom_id: '',
    title: '',
    duration_minutes: 30,
  });
  const [quizDraftQuestions, setQuizDraftQuestions] = useState<DraftQuizQuestion[]>([
    { ...EMPTY_DRAFT_QUESTION },
  ]);

  // Siswa CBT Runner
  const [activeQuiz, setActiveQuiz] = useState<QuizRow | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/pembelajaran', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat data Ruang Belajar Digital.');
      } else {
        setIsTeacher(Boolean(data.isTeacher));
        setHasTeachingSchedule(Boolean(data.hasTeachingSchedule));
        setStudentId(typeof data.studentId === 'string' ? data.studentId : null);
        setMaterials(Array.isArray(data.materials) ? data.materials : []);
        setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
        setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
        setQuizzes(Array.isArray(data.quizzes) ? data.quizzes : []);
        setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
        setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
        setClassrooms(Array.isArray(data.classrooms) ? data.classrooms : []);
        setClassroomsBySubject(
          data.classroomsBySubject && typeof data.classroomsBySubject === 'object'
            ? data.classroomsBySubject
            : {}
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadData]);

  // Escape key untuk menutup modal (kecuali sedang busy)
  useEffect(() => {
    if (!submitModal && !gradeModal && !deleteModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      if (submitModal) setSubmitModal(null);
      if (gradeModal) setGradeModal(null);
      if (deleteModal) setDeleteModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitModal, gradeModal, deleteModal, busy]);

  // Countdown timer CBT saat kuis aktif
  useEffect(() => {
    if (!activeQuiz) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeQuiz]);

  const postLms = useCallback(
    async (payload: Record<string, unknown>, msg: string) => {
      setBusy(true);
      try {
        const res = await fetch('/api/pembelajaran', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.error || 'Gagal memproses permintaan LMS.', 'err');
          return null;
        }
        showToast(msg);
        await loadData();
        return data;
      } catch {
        showToast('Terjadi kesalahan jaringan saat memproses permintaan LMS.', 'err');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [loadData, showToast]
  );

  const getClassroomsForSubject = useCallback(
    (subjectId: string) => {
      if (!isTeacher) return classrooms;
      if (!subjectId) return [];
      return classroomsBySubject[subjectId] || [];
    },
    [isTeacher, classrooms, classroomsBySubject]
  );

  const pickNextClassroom = useCallback(
    (nextSubjectId: string, currentClassroomId: string) => {
      const allowed = getClassroomsForSubject(nextSubjectId);
      if (allowed.some((c) => c.id === currentClassroomId)) return currentClassroomId;
      if (allowed.length === 1) return allowed[0].id;
      return '';
    },
    [getClassroomsForSubject]
  );

  const closeTeacherForm = useCallback(() => {
    setShowCreateForm(false);
    setEditingMaterialId(null);
    setEditingAssignmentId(null);
    setEditingQuizId(null);
    setMatForm({ ...EMPTY_MATERIAL_FORM });
    setAsgForm({ ...EMPTY_ASSIGNMENT_FORM });
    setQuizForm({ ...EMPTY_QUIZ_FORM });
    setQuizDraftQuestions([{ ...EMPTY_DRAFT_QUESTION }]);
  }, []);

  function startEditMaterial(m: MaterialRow) {
    const subjId = m.subject?.id || m.subject_id || '';
    const clsId = m.classroom?.id || m.classroom_id || '';
    setEditingMaterialId(m.id);
    setMatForm({
      subject_id: subjId,
      classroom_id: clsId,
      title: m.title || '',
      chapter_label: m.chapter_label || '',
      material_type: m.material_type || 'MODUL_PDF',
      file_url: m.file_url || '',
      content: m.content || '',
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditAssignment(a: AssignmentRow) {
    const subjId = a.subject?.id || a.subject_id || '';
    const clsId = a.classroom?.id || a.classroom_id || '';
    setEditingAssignmentId(a.id);
    setAsgForm({
      subject_id: subjId,
      classroom_id: clsId,
      title: a.title || '',
      description: a.description || '',
      due_at: toLocalDateTimeInputValue(a.due_at),
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditQuiz(qz: QuizRow) {
    const subjId = qz.subject?.id || qz.subject_id || '';
    const clsId = qz.classroom?.id || qz.classroom_id || '';
    setEditingQuizId(qz.id);
    setQuizForm({
      subject_id: subjId,
      classroom_id: clsId,
      title: qz.title || '',
      duration_minutes: qz.duration_minutes || 30,
    });
    setQuizDraftQuestions(quizQuestionsToDrafts(getSafeQuestions(qz)));
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleConfirmDelete() {
    if (!deleteModal || busy) return;
    const actionMap = {
      MATERIAL: { action: 'DELETE_MATERIAL', msg: 'Materi ajar berhasil dihapus.' },
      ASSIGNMENT: { action: 'DELETE_ASSIGNMENT', msg: 'Tugas online berhasil dihapus.' },
      QUIZ: { action: 'DELETE_QUIZ', msg: 'Kuis CBT berhasil dihapus.' },
    } as const;
    const target = actionMap[deleteModal.kind];
    const ok = await postLms({ action: target.action, id: deleteModal.id }, target.msg);
    if (ok) {
      if (deleteModal.kind === 'MATERIAL' && editingMaterialId === deleteModal.id) closeTeacherForm();
      if (deleteModal.kind === 'ASSIGNMENT' && editingAssignmentId === deleteModal.id) closeTeacherForm();
      if (deleteModal.kind === 'QUIZ' && editingQuizId === deleteModal.id) closeTeacherForm();
      setDeleteModal(null);
    }
  }

  async function handleCreateMaterial(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmedTitle = matForm.title.trim();
    const trimmedUrl = matForm.file_url.trim();
    if (!matForm.subject_id || !matForm.classroom_id) {
      showToast('Mata pelajaran dan rombel yang Anda ajar wajib dipilih.', 'err');
      return;
    }
    if (trimmedTitle.length < 3) {
      showToast('Judul materi minimal 3 karakter.', 'err');
      return;
    }
    if (trimmedUrl && !isSafeExternalUrl(trimmedUrl)) {
      showToast('URL file/video harus diawali http://, https://, atau /.', 'err');
      return;
    }
    const isEditing = Boolean(editingMaterialId);
    const ok = await postLms(
      {
        action: isEditing ? 'UPDATE_MATERIAL' : 'CREATE_MATERIAL',
        ...(isEditing ? { id: editingMaterialId } : {}),
        subject_id: matForm.subject_id,
        classroom_id: matForm.classroom_id,
        title: trimmedTitle,
        chapter_label: matForm.chapter_label.trim() || null,
        material_type: matForm.material_type,
        file_url: trimmedUrl || null,
        content: matForm.content.trim() || null,
      },
      isEditing ? 'Materi ajar berhasil diperbarui.' : 'Materi ajar berhasil dipublikasikan.'
    );
    if (ok) {
      closeTeacherForm();
      setCurrentPage(1);
    }
  }

  async function handleCreateAssignment(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmedTitle = asgForm.title.trim();
    if (!asgForm.subject_id || !asgForm.classroom_id) {
      showToast('Mata pelajaran dan rombel yang Anda ajar wajib dipilih.', 'err');
      return;
    }
    if (trimmedTitle.length < 3) {
      showToast('Judul tugas minimal 3 karakter.', 'err');
      return;
    }
    let isoDueAt: string | null = null;
    if (asgForm.due_at) {
      const parsed = new Date(asgForm.due_at);
      if (Number.isNaN(parsed.getTime())) {
        showToast('Format tanggal tenggat tidak valid.', 'err');
        return;
      }
      isoDueAt = parsed.toISOString();
    }
    const isEditing = Boolean(editingAssignmentId);
    const ok = await postLms(
      {
        action: isEditing ? 'UPDATE_ASSIGNMENT' : 'CREATE_ASSIGNMENT',
        ...(isEditing ? { id: editingAssignmentId } : {}),
        subject_id: asgForm.subject_id,
        classroom_id: asgForm.classroom_id,
        title: trimmedTitle,
        description: asgForm.description.trim() || null,
        due_at: isoDueAt,
      },
      isEditing ? 'Tugas online berhasil diperbarui.' : 'Tugas online berhasil diterbitkan.'
    );
    if (ok) {
      closeTeacherForm();
      setCurrentPage(1);
    }
  }

  async function handleCreateQuiz(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmedTitle = quizForm.title.trim();
    if (!quizForm.subject_id || !quizForm.classroom_id) {
      showToast('Mata pelajaran dan rombel yang Anda ajar wajib dipilih.', 'err');
      return;
    }
    if (trimmedTitle.length < 3) {
      showToast('Judul kuis CBT minimal 3 karakter.', 'err');
      return;
    }

    const formattedQuestions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }> = [];

    for (let i = 0; i < quizDraftQuestions.length; i += 1) {
      const q = quizDraftQuestions[i];
      const qText = q.question.trim();
      if (qText.length < 2) {
        showToast(`Pertanyaan Soal ${i + 1} minimal 2 karakter.`, 'err');
        return;
      }
      const rawOptions = [q.optA, q.optB, q.optC, q.optD].map((o) => o.trim());
      const nonEmptyOptions = rawOptions.filter(Boolean);
      if (nonEmptyOptions.length < 2) {
        showToast(`Soal ${i + 1} minimal memiliki 2 pilihan jawaban.`, 'err');
        return;
      }
      // Validasi kunci jawaban terhadap pilihan yang benar-benar terisi
      const selectedRaw = rawOptions[q.correctIndex];
      if (!selectedRaw) {
        showToast(
          `Kunci jawaban Soal ${i + 1} menunjuk ke pilihan yang masih kosong. Pilih kunci yang terisi.`,
          'err'
        );
        return;
      }
      const mappedCorrectIndex = nonEmptyOptions.indexOf(selectedRaw);
      formattedQuestions.push({
        question: qText,
        options: nonEmptyOptions,
        correctIndex: mappedCorrectIndex >= 0 ? mappedCorrectIndex : 0,
      });
    }

    const isEditing = Boolean(editingQuizId);
    const ok = await postLms(
      {
        action: isEditing ? 'UPDATE_QUIZ' : 'CREATE_QUIZ',
        ...(isEditing ? { id: editingQuizId } : {}),
        subject_id: quizForm.subject_id,
        classroom_id: quizForm.classroom_id,
        title: trimmedTitle,
        duration_minutes: Math.min(180, Math.max(5, Number(quizForm.duration_minutes) || 30)),
        questions: formattedQuestions,
      },
      isEditing
        ? `Kuis CBT (${formattedQuestions.length} soal) berhasil diperbarui.`
        : `Kuis CBT (${formattedQuestions.length} soal) berhasil dipublikasikan.`
    );
    if (ok) {
      closeTeacherForm();
      setCurrentPage(1);
    }
  }

  async function handleConfirmSubmitAssignment(e: FormEvent) {
    e.preventDefault();
    if (!submitModal || busy) return;
    const text = submitModal.text.trim();
    if (!text) {
      showToast('Jawaban atau tautan berkas wajib diisi.', 'err');
      return;
    }
    const res = await postLms(
      {
        action: 'SUBMIT_ASSIGNMENT',
        assignment_id: submitModal.assignment.id,
        submission_text: text,
      },
      submitModal.isUpdate
        ? 'Jawaban tugas berhasil diperbarui!'
        : 'Jawaban tugas berhasil dikumpulkan!'
    );
    if (res) setSubmitModal(null);
  }

  async function handleConfirmGradeSubmission(e: FormEvent) {
    e.preventDefault();
    if (!gradeModal || busy) return;
    const rawScore = gradeModal.score.trim();
    if (!rawScore) {
      showToast('Nilai wajib diisi (angka 0 sampai 100).', 'err');
      return;
    }
    const parsedScore = parseDecimalInput(rawScore);
    if (parsedScore === null || parsedScore < 0 || parsedScore > 100) {
      showToast('Nilai harus berupa angka antara 0 sampai 100.', 'err');
      return;
    }
    const res = await postLms(
      {
        action: 'GRADE_SUBMISSION',
        submission_id: gradeModal.submission.id,
        score: parsedScore,
        teacher_feedback: gradeModal.feedback.trim() || null,
      },
      'Nilai dan umpan balik tugas berhasil disimpan.'
    );
    if (res) setGradeModal(null);
  }

  async function handleSubmitQuizAttempt() {
    if (!activeQuiz || busy) return;
    const questions = getSafeQuestions(activeQuiz);
    const answeredCount = Object.keys(quizAnswers).length;
    if (answeredCount === 0 && remainingSeconds > 0) {
      showToast('Pilih minimal 1 jawaban sebelum mengumpulkan kuis CBT.', 'err');
      return;
    }
    const res = await postLms(
      { action: 'SUBMIT_QUIZ_ATTEMPT', quiz_id: activeQuiz.id, answers: quizAnswers },
      'Jawaban kuis CBT terkirim dan dikoreksi otomatis!'
    );
    if (res?.attempt) {
      showToast(
        `Nilai CBT Anda: ${res.attempt.score} (${res.attempt.correct_count}/${res.attempt.total_questions} benar).`
      );
      setActiveQuiz(null);
      setQuizAnswers({});
      setRemainingSeconds(0);
    } else if (questions.length === 0) {
      setActiveQuiz(null);
    }
  }

  // Filter data per tab
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      const mSubjId = m.subject?.id || m.subject_id || '';
      const mClsId = m.classroom?.id || m.classroom_id || '';
      if (subjectFilter !== 'ALL' && mSubjId !== subjectFilter) return false;
      if (classroomFilter !== 'ALL' && mClsId && mClsId !== classroomFilter) return false;
      if (!q) return true;
      return (
        (m.title || '').toLowerCase().includes(q) ||
        (m.chapter_label || '').toLowerCase().includes(q) ||
        (m.content || '').toLowerCase().includes(q) ||
        (m.subject?.name || '').toLowerCase().includes(q)
      );
    });
  }, [materials, searchQuery, subjectFilter, classroomFilter]);

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assignments.filter((a) => {
      const aSubjId = a.subject?.id || a.subject_id || '';
      const aClsId = a.classroom?.id || a.classroom_id || '';
      if (subjectFilter !== 'ALL' && aSubjId !== subjectFilter) return false;
      if (classroomFilter !== 'ALL' && aClsId !== classroomFilter) return false;
      if (!q) return true;
      return (
        (a.title || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.subject?.name || '').toLowerCase().includes(q) ||
        (a.classroom?.name || '').toLowerCase().includes(q)
      );
    });
  }, [assignments, searchQuery, subjectFilter, classroomFilter]);

  const filteredQuizzes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return quizzes.filter((qz) => {
      const qSubjId = qz.subject?.id || qz.subject_id || '';
      const qClsId = qz.classroom?.id || qz.classroom_id || '';
      if (subjectFilter !== 'ALL' && qSubjId !== subjectFilter) return false;
      if (classroomFilter !== 'ALL' && qClsId !== classroomFilter) return false;
      if (!q) return true;
      return (
        (qz.title || '').toLowerCase().includes(q) ||
        (qz.subject?.name || '').toLowerCase().includes(q) ||
        (qz.classroom?.name || '').toLowerCase().includes(q)
      );
    });
  }, [quizzes, searchQuery, subjectFilter, classroomFilter]);

  const activeListLength =
    tab === 'MATERI'
      ? filteredMaterials.length
      : tab === 'TUGAS'
      ? filteredAssignments.length
      : filteredQuizzes.length;

  const totalPages = Math.max(1, Math.ceil(activeListLength / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;

  const paginatedMaterials = filteredMaterials.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const paginatedAssignments = filteredAssignments.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const paginatedQuizzes = filteredQuizzes.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const hasActiveFilter =
    searchQuery.trim().length > 0 || subjectFilter !== 'ALL' || classroomFilter !== 'ALL';

  const activeQuizQuestions = useMemo(() => getSafeQuestions(activeQuiz), [activeQuiz]);
  const answeredQuizCount = Object.keys(quizAnswers).length;

  const filterClassroomOptions = useMemo(() => {
    if (isTeacher && subjectFilter !== 'ALL') {
      return classroomsBySubject[subjectFilter] || [];
    }
    return classrooms;
  }, [isTeacher, subjectFilter, classroomsBySubject, classrooms]);

  const matClassroomOptions = useMemo(
    () => getClassroomsForSubject(matForm.subject_id),
    [getClassroomsForSubject, matForm.subject_id]
  );
  const asgClassroomOptions = useMemo(
    () => getClassroomsForSubject(asgForm.subject_id),
    [getClassroomsForSubject, asgForm.subject_id]
  );
  const quizClassroomOptions = useMemo(
    () => getClassroomsForSubject(quizForm.subject_id),
    [getClassroomsForSubject, quizForm.subject_id]
  );

  function switchTab(nextTab: 'MATERI' | 'TUGAS' | 'CBT') {
    setTab(nextTab);
    setCurrentPage(1);
    closeTeacherForm();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0">
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 left-3 right-3 sm:left-auto sm:right-6 z-[60] sm:max-w-md p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="[overflow-wrap:anywhere] leading-relaxed">{toast.text}</span>
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
            onClick={() => void loadData()}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {/* Header & Ringkasan */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                  Ruang Belajar Digital (LMS &amp; CBT)
                </h1>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Akses materi ajar per BAB, pengumpulan &amp; penilaian tugas daring, serta kuis CBT berkoreksi otomatis.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isTeacher && (
              <button
                type="button"
                disabled={!hasTeachingSchedule && !showCreateForm}
                onClick={() => {
                  if (showCreateForm) {
                    closeTeacherForm();
                  } else {
                    setEditingMaterialId(null);
                    setEditingAssignmentId(null);
                    setEditingQuizId(null);
                    setShowCreateForm(true);
                  }
                }}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  showCreateForm
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                }`}
              >
                {showCreateForm ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Tutup Form
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {tab === 'MATERI'
                        ? 'Tambah Materi'
                        : tab === 'TUGAS'
                        ? 'Buat Tugas'
                        : 'Buat Kuis CBT'}
                    </span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadData()}
              aria-label="Segarkan data pembelajaran"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Tab Navigasi Responsif */}
        <div
          role="tablist"
          aria-label="Menu Ruang Belajar Digital"
          className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 no-scrollbar"
        >
          {(
            [
              { id: 'MATERI', label: 'Materi Ajar', count: materials.length, icon: BookOpen },
              { id: 'TUGAS', label: 'Tugas / PR Online', count: assignments.length, icon: ClipboardList },
              { id: 'CBT', label: 'Kuis & CBT', count: quizzes.length, icon: PlayCircle },
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
                onClick={() => switchTab(t.id)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition mb-2 ${
                  active
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Banner jika kuis CBT sedang berlangsung di tab lain */}
        {activeQuiz && tab !== 'CBT' && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="truncate">
                Kuis <strong>{activeQuiz.title}</strong> sedang berlangsung (Sisa waktu:{' '}
                <strong className="font-mono">{formatCountdown(remainingSeconds)}</strong>)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab('CBT')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0"
            >
              Lanjutkan Kuis
            </button>
          </div>
        )}

        {/* Info cakupan jadwal mengajar guru */}
        {isTeacher && !loading && !hasTeachingSchedule && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Anda belum memiliki jadwal mengajar pada tahun ajaran aktif. Materi, tugas, dan kuis
              CBT hanya dapat dilihat serta dikelola sesuai mata pelajaran dan rombel yang Anda ajar.
            </p>
          </div>
        )}

        {/* Toolbar Pencarian & Filter (disembunyikan saat siswa sedang mengerjakan CBT) */}
        {!(tab === 'CBT' && activeQuiz) && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="relative sm:col-span-6 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={
                  tab === 'MATERI'
                    ? 'Cari judul materi, BAB, atau mapel...'
                    : tab === 'TUGAS'
                    ? 'Cari judul tugas, deskripsi, atau mapel...'
                    : 'Cari judul kuis CBT atau mapel...'
                }
                aria-label="Cari di Ruang Belajar"
                className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-9 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="sm:col-span-3 min-w-0">
              <select
                value={subjectFilter}
                onChange={(e) => {
                  const nextSubj = e.target.value;
                  setSubjectFilter(nextSubj);
                  if (isTeacher && nextSubj !== 'ALL') {
                    const allowed = classroomsBySubject[nextSubj] || [];
                    if (classroomFilter !== 'ALL' && !allowed.some((c) => c.id === classroomFilter)) {
                      setClassroomFilter('ALL');
                    }
                  }
                  setCurrentPage(1);
                }}
                aria-label="Filter mata pelajaran"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Semua Mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3 min-w-0 flex gap-2">
              <select
                value={classroomFilter}
                onChange={(e) => {
                  setClassroomFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter rombel"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Semua Rombel</option>
                {filterClassroomOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
              {hasActiveFilter && (
                <button
                  type="button"
                  title="Reset filter"
                  aria-label="Reset filter"
                  onClick={() => {
                    setSearchQuery('');
                    setSubjectFilter('ALL');
                    setClassroomFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shrink-0 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB MATERI ==================== */}
        {tab === 'MATERI' && (
          <div className="space-y-4 text-xs">
            {isTeacher && showCreateForm && (
              <form
                onSubmit={handleCreateMaterial}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingMaterialId ? 'Edit Materi Ajar' : 'Publikasikan Materi Ajar Baru'}
                  </h2>
                  <button
                    type="button"
                    onClick={closeTeacherForm}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                    aria-label="Tutup form materi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="mat-subject-id" className={LABEL_CLASS}>
                      Mata Pelajaran <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="mat-subject-id"
                      required
                      disabled={busy}
                      value={matForm.subject_id}
                      onChange={(e) => {
                        const nextSubj = e.target.value;
                        setMatForm((prev) => ({
                          ...prev,
                          subject_id: nextSubj,
                          classroom_id: pickNextClassroom(nextSubj, prev.classroom_id),
                        }));
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="mat-classroom-id" className={LABEL_CLASS}>
                      Rombel / Kelas <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="mat-classroom-id"
                      required
                      disabled={busy || !matForm.subject_id}
                      value={matForm.classroom_id}
                      onChange={(e) => setMatForm({ ...matForm, classroom_id: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="">
                        {matForm.subject_id
                          ? '-- Pilih Rombel yang Diajar --'
                          : '-- Pilih Mata Pelajaran dahulu --'}
                      </option>
                      {matClassroomOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="mat-title" className={LABEL_CLASS}>
                      Judul Materi <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="mat-title"
                      required
                      disabled={busy}
                      value={matForm.title}
                      onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
                      placeholder="Minimal 3 karakter"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="mat-type" className={LABEL_CLASS}>
                      Jenis Materi <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="mat-type"
                      disabled={busy}
                      value={matForm.material_type}
                      onChange={(e) => setMatForm({ ...matForm, material_type: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="MODUL_PDF">Modul PDF / Slide</option>
                      <option value="VIDEO">Video YouTube</option>
                      <option value="LINK">Tautan Referensi</option>
                      <option value="CATATAN">Catatan Teks</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="mat-chapter" className={LABEL_CLASS}>
                      BAB / Topik (Opsional)
                    </label>
                    <input
                      id="mat-chapter"
                      disabled={busy}
                      value={matForm.chapter_label}
                      onChange={(e) => setMatForm({ ...matForm, chapter_label: e.target.value })}
                      placeholder="Mis. BAB 1"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label htmlFor="mat-file-url" className={LABEL_CLASS}>
                      URL File / Video / Tautan (Opsional)
                    </label>
                    <input
                      id="mat-file-url"
                      type="text"
                      inputMode="url"
                      disabled={busy}
                      value={matForm.file_url}
                      onChange={(e) => setMatForm({ ...matForm, file_url: e.target.value })}
                      placeholder="https://... atau /..."
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label htmlFor="mat-content" className={LABEL_CLASS}>
                      Ringkasan / Catatan Materi (Opsional)
                    </label>
                    <textarea
                      id="mat-content"
                      rows={2}
                      disabled={busy}
                      value={matForm.content}
                      onChange={(e) => setMatForm({ ...matForm, content: e.target.value })}
                      placeholder="Ringkasan atau catatan teks materi..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  {editingMaterialId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={closeTeacherForm}
                      className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingMaterialId ? (
                      <Save className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    {editingMaterialId ? 'Simpan Perubahan Materi' : 'Terbitkan Materi'}
                  </button>
                </div>
              </form>
            )}

            {loading && materials.length === 0 ? (
              <div className="grid sm:grid-cols-2 gap-3 animate-pulse">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-slate-100 border border-slate-200/70" />
                ))}
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-2">
                <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 text-sm">
                  {materials.length === 0
                    ? 'Belum ada materi ajar yang dipublikasikan.'
                    : 'Tidak ada materi ajar yang cocok dengan filter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paginatedMaterials.map((m) => {
                  const typeMeta = MATERIAL_TYPE_META[m.material_type] || MATERIAL_TYPE_META.MODUL_PDF;
                  const TypeIcon = typeMeta.Icon;
                  return (
                    <article
                      key={m.id}
                      className="modular-card rounded-2xl p-4 flex flex-col justify-between gap-3 border border-slate-200/80 min-w-0"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                            {m.subject?.name || 'Mapel'}
                          </span>
                          {m.classroom?.name ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/60 font-bold text-[10px]">
                              Kelas {m.classroom.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                              Semua Rombel
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold text-[10px] ${typeMeta.badgeClass}`}
                          >
                            <TypeIcon className="w-3 h-3" />
                            {typeMeta.label}
                          </span>
                          {m.chapter_label && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              • {m.chapter_label}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm leading-snug [overflow-wrap:anywhere]">
                          {m.title}
                        </h3>

                        {m.content && (
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                            {m.content}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400 truncate">
                          {m.teacher?.full_name || 'Tim Pengajar'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isSafeExternalUrl(m.file_url) && (
                            <a
                              href={m.file_url!.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 font-semibold transition"
                            >
                              <span>Buka Materi</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                          {isTeacher && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => startEditMaterial(m)}
                                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold disabled:opacity-40 transition"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setDeleteModal({ kind: 'MATERIAL', id: m.id, title: m.title })
                                }
                                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold disabled:opacity-40 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB TUGAS ==================== */}
        {tab === 'TUGAS' && (
          <div className="space-y-4 text-xs">
            {isTeacher && showCreateForm && (
              <form
                onSubmit={handleCreateAssignment}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingAssignmentId ? 'Edit Tugas / PR Online' : 'Buat Tugas / PR Online Baru'}
                  </h2>
                  <button
                    type="button"
                    onClick={closeTeacherForm}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                    aria-label="Tutup form tugas"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="asg-subject-id" className={LABEL_CLASS}>
                      Mata Pelajaran <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="asg-subject-id"
                      required
                      disabled={busy}
                      value={asgForm.subject_id}
                      onChange={(e) => {
                        const nextSubj = e.target.value;
                        setAsgForm((prev) => ({
                          ...prev,
                          subject_id: nextSubj,
                          classroom_id: pickNextClassroom(nextSubj, prev.classroom_id),
                        }));
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="asg-classroom-id" className={LABEL_CLASS}>
                      Rombel / Kelas <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="asg-classroom-id"
                      required
                      disabled={busy || !asgForm.subject_id}
                      value={asgForm.classroom_id}
                      onChange={(e) => setAsgForm({ ...asgForm, classroom_id: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="">
                        {asgForm.subject_id
                          ? '-- Pilih Rombel yang Diajar --'
                          : '-- Pilih Mata Pelajaran dahulu --'}
                      </option>
                      {asgClassroomOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="asg-title" className={LABEL_CLASS}>
                      Judul Tugas / PR <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="asg-title"
                      required
                      disabled={busy}
                      value={asgForm.title}
                      onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })}
                      placeholder="Minimal 3 karakter"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="asg-due-at" className={LABEL_CLASS}>
                      Tenggat Waktu Pengumpulan (Opsional)
                    </label>
                    <input
                      id="asg-due-at"
                      type="datetime-local"
                      disabled={busy}
                      value={asgForm.due_at}
                      onChange={(e) => setAsgForm({ ...asgForm, due_at: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label htmlFor="asg-description" className={LABEL_CLASS}>
                      Instruksi / Deskripsi Tugas (Opsional)
                    </label>
                    <textarea
                      id="asg-description"
                      rows={2}
                      disabled={busy}
                      value={asgForm.description}
                      onChange={(e) => setAsgForm({ ...asgForm, description: e.target.value })}
                      placeholder="Instruksi atau deskripsi pengerjaan tugas..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  {editingAssignmentId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={closeTeacherForm}
                      className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingAssignmentId ? (
                      <Save className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    {editingAssignmentId ? 'Simpan Perubahan Tugas' : 'Terbitkan Tugas'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {loading && assignments.length === 0 ? (
                <div className="space-y-3 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-28 rounded-2xl bg-slate-100 border border-slate-200/70" />
                  ))}
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-2">
                  <ClipboardList className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700 text-sm">
                    {assignments.length === 0
                      ? 'Belum ada tugas atau PR online.'
                      : 'Tidak ada tugas yang cocok dengan filter.'}
                  </p>
                </div>
              ) : (
                paginatedAssignments.map((a) => {
                  const asgSubs = submissions.filter((s) => s.assignment_id === a.id);
                  const mySub = !isTeacher
                    ? asgSubs.find((s) => !studentId || s.student_id === studentId) || null
                    : null;
                  const dueInfo = formatDueDate(a.due_at);

                  return (
                    <article
                      key={a.id}
                      className="modular-card rounded-2xl p-4 sm:p-5 space-y-3 border border-slate-200/80 min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                              {a.subject?.name || 'Mapel'}
                            </span>
                            {a.classroom?.name && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/60 font-bold text-[10px]">
                                Kelas {a.classroom.name}
                              </span>
                            )}
                            {dueInfo && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  dueInfo.isPast
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                                }`}
                              >
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span>
                                  {dueInfo.isPast ? 'Lewat Tenggat: ' : 'Tenggat: '}
                                  {dueInfo.label}
                                </span>
                              </span>
                            )}
                            {mySub && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Sudah Dikumpulkan
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                            {a.title}
                          </h3>

                          {a.description && (
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                              {a.description}
                            </p>
                          )}
                        </div>

                        {isTeacher ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startEditAssignment(a)}
                              className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold disabled:opacity-40 transition"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setDeleteModal({ kind: 'ASSIGNMENT', id: a.id, title: a.title })
                              }
                              className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold disabled:opacity-40 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setSubmitModal({
                                assignment: a,
                                text: mySub?.submission_text || '',
                                isUpdate: Boolean(mySub),
                              })
                            }
                            className={`w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl font-semibold shrink-0 transition ${
                              mySub
                                ? 'bg-slate-900 hover:bg-emerald-700 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            } disabled:opacity-50`}
                          >
                            {mySub ? 'Perbarui Jawaban' : 'Kumpulkan Tugas'}
                          </button>
                        )}
                      </div>

                      {asgSubs.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-slate-100">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {isTeacher
                              ? `Pengumpulan Siswa (${asgSubs.length})`
                              : 'Status Pengumpulan Anda'}
                          </p>
                          {asgSubs.map((sub) => {
                            const textVal = sub.submission_text || sub.attachment_url || '';
                            return (
                              <div
                                key={sub.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200/60 min-w-0"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="font-semibold text-slate-800">
                                    {sub.student?.full_name || 'Siswa'}
                                    {sub.student?.nis ? (
                                      <span className="text-slate-400 font-normal ml-1.5">
                                        ({sub.student.nis})
                                      </span>
                                    ) : null}
                                  </p>
                                  {textVal && (
                                    <p className="text-slate-600 line-clamp-2 [overflow-wrap:anywhere]">
                                      {textVal}
                                    </p>
                                  )}
                                  {sub.teacher_feedback && (
                                    <p className="inline-flex items-start gap-1 text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg">
                                      <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
                                      <span className="[overflow-wrap:anywhere]">
                                        Catatan Guru: {sub.teacher_feedback}
                                      </span>
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2 shrink-0">
                                  {sub.score !== null ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold tabular-nums">
                                      Nilai: {sub.score}
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">
                                      Belum Dinilai
                                    </span>
                                  )}
                                  {isTeacher && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        setGradeModal({
                                          submission: sub,
                                          assignmentTitle: a.title,
                                          score: sub.score !== null ? String(sub.score) : '85',
                                          feedback: sub.teacher_feedback || '',
                                        })
                                      }
                                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                                    >
                                      {sub.score !== null ? 'Ubah Nilai' : 'Beri Nilai'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB CBT ==================== */}
        {tab === 'CBT' && (
          <div className="space-y-4 text-xs">
            {isTeacher && showCreateForm && (
              <form
                onSubmit={handleCreateQuiz}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingQuizId ? 'Edit Kuis / CBT' : 'Buat Kuis / CBT Baru'}
                  </h2>
                  <button
                    type="button"
                    onClick={closeTeacherForm}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                    aria-label="Tutup form kuis"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="quiz-subject-id" className={LABEL_CLASS}>
                      Mata Pelajaran <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="quiz-subject-id"
                      required
                      disabled={busy}
                      value={quizForm.subject_id}
                      onChange={(e) => {
                        const nextSubj = e.target.value;
                        setQuizForm((prev) => ({
                          ...prev,
                          subject_id: nextSubj,
                          classroom_id: pickNextClassroom(nextSubj, prev.classroom_id),
                        }));
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quiz-classroom-id" className={LABEL_CLASS}>
                      Rombel / Kelas <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="quiz-classroom-id"
                      required
                      disabled={busy || !quizForm.subject_id}
                      value={quizForm.classroom_id}
                      onChange={(e) => setQuizForm({ ...quizForm, classroom_id: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="">
                        {quizForm.subject_id
                          ? '-- Pilih Rombel yang Diajar --'
                          : '-- Pilih Mata Pelajaran dahulu --'}
                      </option>
                      {quizClassroomOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quiz-title" className={LABEL_CLASS}>
                      Judul Kuis / CBT <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="quiz-title"
                      required
                      disabled={busy}
                      value={quizForm.title}
                      onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                      placeholder="Minimal 3 karakter"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="quiz-duration" className={LABEL_CLASS}>
                      Durasi Pengerjaan (Menit) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="quiz-duration"
                      type="number"
                      min={5}
                      max={180}
                      disabled={busy}
                      value={quizForm.duration_minutes}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, duration_minutes: Number(e.target.value) || 30 })
                      }
                      placeholder="5 – 180 menit"
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                </div>

                {/* Daftar Soal Dinamis */}
                <div className="space-y-3">
                  {quizDraftQuestions.map((dq, qIdx) => {
                    const updateDraft = (patch: Partial<DraftQuizQuestion>) => {
                      setQuizDraftQuestions((prev) =>
                        prev.map((item, idx) => (idx === qIdx ? { ...item, ...patch } : item))
                      );
                    };
                    return (
                      <div
                        key={qIdx}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            Soal #{qIdx + 1}
                          </span>
                          {quizDraftQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setQuizDraftQuestions((prev) => prev.filter((_, i) => i !== qIdx))
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus Soal
                            </button>
                          )}
                        </div>

                        <div>
                          <label htmlFor={`quiz-q-${qIdx}-question`} className={LABEL_CLASS}>
                            Pertanyaan Soal #{qIdx + 1} <span className="text-rose-600">*</span>
                          </label>
                          <input
                            id={`quiz-q-${qIdx}-question`}
                            required
                            disabled={busy}
                            value={dq.question}
                            onChange={(e) => updateDraft({ question: e.target.value })}
                            placeholder={`Tuliskan pertanyaan untuk Soal ${qIdx + 1}...`}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label htmlFor={`quiz-q-${qIdx}-opt-a`} className={LABEL_CLASS}>
                              Pilihan A <span className="text-rose-600">*</span>
                            </label>
                            <input
                              id={`quiz-q-${qIdx}-opt-a`}
                              required
                              disabled={busy}
                              value={dq.optA}
                              onChange={(e) => updateDraft({ optA: e.target.value })}
                              placeholder="Jawaban A"
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label htmlFor={`quiz-q-${qIdx}-opt-b`} className={LABEL_CLASS}>
                              Pilihan B <span className="text-rose-600">*</span>
                            </label>
                            <input
                              id={`quiz-q-${qIdx}-opt-b`}
                              required
                              disabled={busy}
                              value={dq.optB}
                              onChange={(e) => updateDraft({ optB: e.target.value })}
                              placeholder="Jawaban B"
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label htmlFor={`quiz-q-${qIdx}-opt-c`} className={LABEL_CLASS}>
                              Pilihan C (Opsional)
                            </label>
                            <input
                              id={`quiz-q-${qIdx}-opt-c`}
                              disabled={busy}
                              value={dq.optC}
                              onChange={(e) => updateDraft({ optC: e.target.value })}
                              placeholder="Jawaban C"
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label htmlFor={`quiz-q-${qIdx}-opt-d`} className={LABEL_CLASS}>
                              Pilihan D (Opsional)
                            </label>
                            <input
                              id={`quiz-q-${qIdx}-opt-d`}
                              disabled={busy}
                              value={dq.optD}
                              onChange={(e) => updateDraft({ optD: e.target.value })}
                              placeholder="Jawaban D"
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>

                        <div className="max-w-xs">
                          <label htmlFor={`quiz-q-${qIdx}-correct`} className={LABEL_CLASS}>
                            Kunci Jawaban Benar <span className="text-rose-600">*</span>
                          </label>
                          <select
                            id={`quiz-q-${qIdx}-correct`}
                            disabled={busy}
                            value={dq.correctIndex}
                            onChange={(e) => updateDraft({ correctIndex: Number(e.target.value) })}
                            className={INPUT_CLASS}
                          >
                            <option value={0}>Kunci Jawaban: A</option>
                            <option value={1}>Kunci Jawaban: B</option>
                            <option value={2} disabled={!dq.optC.trim()}>
                              Kunci Jawaban: C {!dq.optC.trim() ? '(isi C dahulu)' : ''}
                            </option>
                            <option value={3} disabled={!dq.optD.trim()}>
                              Kunci Jawaban: D {!dq.optD.trim() ? '(isi D dahulu)' : ''}
                            </option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setQuizDraftQuestions((prev) => [...prev, { ...EMPTY_DRAFT_QUESTION }])
                    }
                    className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Soal ({quizDraftQuestions.length})
                  </button>
                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    {editingQuizId && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={closeTeacherForm}
                        className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                      >
                        Batal Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : editingQuizId ? (
                        <Save className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      {editingQuizId ? 'Simpan Perubahan Kuis' : 'Terbitkan Kuis CBT'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeQuiz ? (
              <div className="rounded-2xl bg-white border border-emerald-200 p-4 sm:p-6 space-y-4 shadow-xs">
                {/* Sticky Header CBT Runner */}
                <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 [overflow-wrap:anywhere]">
                      {activeQuiz.title}
                    </h2>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      Terjawab {answeredQuizCount} / {activeQuizQuestions.length} soal
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono tabular-nums ${
                        remainingSeconds <= 60
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {formatCountdown(remainingSeconds)}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setActiveQuiz(null);
                        setQuizAnswers({});
                        setRemainingSeconds(0);
                      }}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold disabled:opacity-40"
                    >
                      Keluar
                    </button>
                  </div>
                </div>

                {activeQuizQuestions.length === 0 ? (
                  <p className="text-center text-slate-500 py-6">
                    Kuis ini belum memiliki daftar soal.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeQuizQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70 space-y-2.5"
                      >
                        <p className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                          {idx + 1}. {q.question}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, optIdx) => {
                            const selected = quizAnswers[String(idx)] === optIdx;
                            return (
                              <label
                                key={optIdx}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition min-h-[42px] ${
                                  selected
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold'
                                    : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-700'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`q-${idx}`}
                                  checked={selected}
                                  onChange={() =>
                                    setQuizAnswers((prev) => ({ ...prev, [String(idx)]: optIdx }))
                                  }
                                  className="accent-emerald-600 shrink-0"
                                />
                                <span className="[overflow-wrap:anywhere]">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {answeredQuizCount < activeQuizQuestions.length
                      ? `Masih ada ${activeQuizQuestions.length - answeredQuizCount} soal belum dijawab.`
                      : 'Semua soal sudah terjawab.'}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSubmitQuizAttempt()}
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Kumpulkan Jawaban CBT
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {loading && quizzes.length === 0 ? (
                  <div className="space-y-3 animate-pulse">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-24 rounded-2xl bg-slate-100 border border-slate-200/70" />
                    ))}
                  </div>
                ) : filteredQuizzes.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-2">
                    <PlayCircle className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700 text-sm">
                      {quizzes.length === 0
                        ? 'Belum ada kuis CBT yang dipublikasikan.'
                        : 'Tidak ada kuis CBT yang cocok dengan filter.'}
                    </p>
                  </div>
                ) : (
                  paginatedQuizzes.map((qz) => {
                    const qzQuestions = getSafeQuestions(qz);
                    const qzAttempts = attempts.filter((at) => at.quiz_id === qz.id);
                    const myAttempt = !isTeacher
                      ? qzAttempts.find((at) => !studentId || at.student_id === studentId) || null
                      : null;

                    return (
                      <article
                        key={qz.id}
                        className="modular-card rounded-2xl p-4 sm:p-5 space-y-2.5 border border-slate-200/80 min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                                {qz.subject?.name || 'Mapel'}
                              </span>
                              {qz.classroom?.name && (
                                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/60 font-bold text-[10px]">
                                  Kelas {qz.classroom.name}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 tabular-nums">
                                • {qzQuestions.length} soal • {qz.duration_minutes} menit
                              </span>
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                              {qz.title}
                            </h3>
                          </div>

                          {isTeacher ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => startEditQuiz(qz)}
                                className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold disabled:opacity-40 transition"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setDeleteModal({ kind: 'QUIZ', id: qz.id, title: qz.title })
                                }
                                className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold disabled:opacity-40 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={qzQuestions.length === 0}
                              onClick={() => {
                                setActiveQuiz(qz);
                                setQuizAnswers({});
                                setRemainingSeconds(Math.max(1, qz.duration_minutes || 30) * 60);
                              }}
                              className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold shrink-0 transition"
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>{myAttempt ? 'Kerjakan Ulang' : 'Mulai Kuis'}</span>
                            </button>
                          )}
                        </div>

                        {qzAttempts.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            {qzAttempts.map((at) => (
                              <span
                                key={at.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-800 font-semibold text-[11px] tabular-nums"
                              >
                                {at.student?.full_name || 'Siswa'}: Nilai {at.score} (
                                {at.correct_count}/{at.total_questions})
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Pagination untuk semua tab */}
        {!(tab === 'CBT' && activeQuiz) && totalPages > 1 && (
          <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              Hal. {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 transition"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Modal Kumpulkan Tugas Siswa */}
      {submitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lms-submit-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setSubmitModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h2
                  id="lms-submit-modal-title"
                  className="text-base font-bold text-slate-900 [overflow-wrap:anywhere]"
                >
                  {submitModal.isUpdate ? 'Perbarui Jawaban' : 'Kumpulkan Tugas'} —{' '}
                  {submitModal.assignment.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {submitModal.assignment.subject?.name || 'Mapel'}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSubmitModal(null)}
                aria-label="Tutup modal"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmSubmitAssignment}
              className="p-5 sm:p-6 space-y-4 overflow-y-auto"
            >
              <div>
                <label
                  htmlFor="lms-submit-text"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Jawaban / Tautan Berkas Tugas <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="lms-submit-text"
                  required
                  rows={5}
                  disabled={busy}
                  value={submitModal.text}
                  onChange={(e) =>
                    setSubmitModal((prev) => (prev ? { ...prev, text: e.target.value } : null))
                  }
                  placeholder="Tuliskan jawaban atau tempel tautan Google Drive / dokumen tugas..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSubmitModal(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitModal.isUpdate ? 'Simpan Perubahan' : 'Kumpulkan Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Beri Nilai Tugas Guru */}
      {gradeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lms-grade-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setGradeModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h2 id="lms-grade-modal-title" className="text-base font-bold text-slate-900">
                  Beri Nilai Tugas Siswa
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 [overflow-wrap:anywhere]">
                  {gradeModal.submission.student?.full_name || 'Siswa'} • {gradeModal.assignmentTitle}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setGradeModal(null)}
                aria-label="Tutup modal"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmGradeSubmission}
              className="p-5 sm:p-6 space-y-4 overflow-y-auto"
            >
              {/* Jawaban Lengkap Siswa */}
              {(gradeModal.submission.submission_text || gradeModal.submission.attachment_url) && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Jawaban Siswa
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-line [overflow-wrap:anywhere] leading-relaxed">
                    {gradeModal.submission.submission_text || gradeModal.submission.attachment_url}
                  </p>
                  {isSafeExternalUrl(
                    gradeModal.submission.attachment_url || gradeModal.submission.submission_text
                  ) && (
                    <a
                      href={(
                        gradeModal.submission.attachment_url ||
                        gradeModal.submission.submission_text ||
                        ''
                      ).trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline pt-1"
                    >
                      Buka Tautan Jawaban <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="lms-grade-score"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Nilai (0–100) <span className="text-rose-600">*</span>
                </label>
                <DecimalInput
                  id="lms-grade-score"
                  maxDecimals={2}
                  required
                  disabled={busy}
                  value={gradeModal.score}
                  onValueChange={(next) =>
                    setGradeModal((prev) => (prev ? { ...prev, score: next } : null))
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="lms-grade-feedback"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Catatan / Umpan Balik Guru (Opsional)
                </label>
                <textarea
                  id="lms-grade-feedback"
                  rows={3}
                  disabled={busy}
                  value={gradeModal.feedback}
                  onChange={(e) =>
                    setGradeModal((prev) => (prev ? { ...prev, feedback: e.target.value } : null))
                  }
                  placeholder="Berikan apresiasi atau saran perbaikan untuk siswa..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setGradeModal(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Nilai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Hapus Materi / Tugas / Kuis CBT */}
      {deleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lms-delete-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setDeleteModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 id="lms-delete-modal-title" className="text-base font-bold text-slate-900">
                  Konfirmasi Penghapusan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteModal(null)}
                aria-label="Tutup modal"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed [overflow-wrap:anywhere]">
                Apakah Anda yakin ingin menghapus{' '}
                <strong>
                  {deleteModal.kind === 'MATERIAL'
                    ? 'materi ajar'
                    : deleteModal.kind === 'ASSIGNMENT'
                    ? 'tugas online'
                    : 'kuis CBT'}
                </strong>{' '}
                berjudul <strong>&ldquo;{deleteModal.title}&rdquo;</strong>?
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleteModal(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirmDelete()}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
