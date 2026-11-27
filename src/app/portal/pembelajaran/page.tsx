'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface MaterialRow {
  id: string;
  title: string;
  chapter_label: string | null;
  material_type: string;
  file_url: string | null;
  content: string | null;
  subject?: { name: string } | null;
  classroom?: { name: string } | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  max_score: number;
  subject?: { name: string } | null;
  classroom?: { name: string } | null;
}

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  attachment_url: string | null;
  score: number | null;
  teacher_feedback: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

interface QuizRow {
  id: string;
  title: string;
  duration_minutes: number;
  questions: QuizQuestion[];
  subject?: { name: string } | null;
  classroom?: { name: string } | null;
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

function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

export default function PembelajaranLmsPage() {
  const [tab, setTab] = useState<'MATERI' | 'TUGAS' | 'CBT'>('MATERI');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);

  // Modals pengganti window.prompt
  const [submitModal, setSubmitModal] = useState<{
    assignment: AssignmentRow;
    text: string;
  } | null>(null);
  const [gradeModal, setGradeModal] = useState<{
    submission: SubmissionRow;
    score: string;
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
    qText: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    correctIndex: 0,
  });

  // Siswa CBT Runner
  const [activeQuiz, setActiveQuiz] = useState<QuizRow | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

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
        setMaterials(data.materials || []);
        setAssignments(data.assignments || []);
        setSubmissions(data.submissions || []);
        setQuizzes(data.quizzes || []);
        setAttempts(data.attempts || []);
        setSubjects(data.subjects || []);
        setClassrooms(data.classrooms || []);
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

  useEffect(() => {
    if (!submitModal && !gradeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      if (submitModal) setSubmitModal(null);
      if (gradeModal) setGradeModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitModal, gradeModal, busy]);

  async function postLms(payload: Record<string, unknown>, msg: string) {
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
  }

  async function handleConfirmSubmitAssignment(e: FormEvent) {
    e.preventDefault();
    if (!submitModal) return;
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
      'Jawaban tugas berhasil dikumpulkan!'
    );
    if (res) setSubmitModal(null);
  }

  async function handleConfirmGradeSubmission(e: FormEvent) {
    e.preventDefault();
    if (!gradeModal) return;
    const parsedScore = Number(gradeModal.score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      showToast('Nilai harus berupa angka antara 0 sampai 100.', 'err');
      return;
    }
    const res = await postLms(
      {
        action: 'GRADE_SUBMISSION',
        submission_id: gradeModal.submission.id,
        score: parsedScore,
      },
      'Nilai tugas berhasil disimpan.'
    );
    if (res) setGradeModal(null);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
            <span className="break-words">{toast.text}</span>
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
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Ruang Belajar Digital (LMS Ringan &amp; CBT)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Akses materi ajar per BAB, pengumpulan &amp; penilaian tugas daring, serta kuis CBT berkoreksi otomatis.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'MATERI', label: `Materi Ajar (${materials.length})`, icon: BookOpen },
              { id: 'TUGAS', label: `Tugas / PR Online (${assignments.length})`, icon: ClipboardList },
              { id: 'CBT', label: `Kuis & CBT (${quizzes.length})`, icon: PlayCircle },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'MATERI' && (
          <div className="space-y-4 text-xs">
            {isTeacher && (
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  const ok = await postLms(
                    {
                      action: 'CREATE_MATERIAL',
                      ...matForm,
                      classroom_id: matForm.classroom_id || null,
                    },
                    'Materi ajar berhasil dipublikasikan.'
                  );
                  if (ok) setMatForm((p) => ({ ...p, title: '', chapter_label: '', file_url: '', content: '' }));
                }}
                className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <select
                  required
                  value={matForm.subject_id}
                  onChange={(e) => setMatForm({ ...matForm, subject_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Mata Pelajaran --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={matForm.classroom_id}
                  onChange={(e) => setMatForm({ ...matForm, classroom_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">Semua Rombel</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={matForm.title}
                  onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
                  placeholder="Judul Materi *"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <select
                  value={matForm.material_type}
                  onChange={(e) => setMatForm({ ...matForm, material_type: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="MODUL_PDF">Modul PDF / Slide</option>
                  <option value="VIDEO">Video YouTube</option>
                  <option value="LINK">Tautan Referensi</option>
                  <option value="CATATAN">Catatan Teks</option>
                </select>
                <input
                  value={matForm.chapter_label}
                  onChange={(e) => setMatForm({ ...matForm, chapter_label: e.target.value })}
                  placeholder="BAB / Topik (mis. BAB 1)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  type="url"
                  value={matForm.file_url}
                  onChange={(e) => setMatForm({ ...matForm, file_url: e.target.value })}
                  placeholder="URL File / Video (Opsional)"
                  className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Terbitkan Materi
                </button>
              </form>
            )}

            {materials.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {loading ? 'Memuat materi ajar...' : 'Belum ada materi ajar yang dipublikasikan.'}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {materials.map((m) => (
                  <div key={m.id} className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        {m.subject?.name || 'Mapel'}
                      </span>
                      {m.classroom?.name && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold text-[10px]">
                          Kelas {m.classroom.name}
                        </span>
                      )}
                      {m.chapter_label && (
                        <span className="text-[10px] font-semibold text-slate-500">{m.chapter_label}</span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-sm break-words">{m.title}</p>
                    {isSafeExternalUrl(m.file_url) && (
                      <a
                        href={m.file_url!.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                      >
                        Buka Materi ({m.material_type}) <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'TUGAS' && (
          <div className="space-y-4 text-xs">
            {isTeacher && (
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  const ok = await postLms(
                    { action: 'CREATE_ASSIGNMENT', ...asgForm },
                    'Tugas online berhasil diterbitkan.'
                  );
                  if (ok) setAsgForm({ subject_id: '', classroom_id: '', title: '', description: '', due_at: '' });
                }}
                className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <select
                  required
                  value={asgForm.subject_id}
                  onChange={(e) => setAsgForm({ ...asgForm, subject_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Mapel --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={asgForm.classroom_id}
                  onChange={(e) => setAsgForm({ ...asgForm, classroom_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Rombel --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={asgForm.title}
                  onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })}
                  placeholder="Judul Tugas / PR *"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  type="datetime-local"
                  value={asgForm.due_at}
                  onChange={(e) => setAsgForm({ ...asgForm, due_at: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Buat Tugas
                </button>
              </form>
            )}

            <div className="space-y-3">
              {assignments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat daftar tugas...' : 'Belum ada tugas atau PR online.'}
                </div>
              ) : (
                assignments.map((a) => {
                  const asgSubs = submissions.filter((s) => s.assignment_id === a.id);
                  return (
                    <div key={a.id} className="modular-card rounded-2xl p-4 space-y-2.5 border border-slate-200/80">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm break-words">
                            {a.title} — <span className="text-emerald-700">{a.subject?.name}</span> ({a.classroom?.name})
                          </p>
                          {a.due_at && (
                            <p className="text-[11px] text-slate-500">
                              Tenggat: {new Date(a.due_at).toLocaleString('id-ID')}
                            </p>
                          )}
                        </div>
                        {!isTeacher && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setSubmitModal({ assignment: a, text: '' })}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shrink-0 transition"
                          >
                            Kumpulkan Tugas
                          </button>
                        )}
                      </div>
                      {asgSubs.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          {asgSubs.map((sub) => (
                            <div key={sub.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800">{sub.student?.full_name || 'Siswa'}</p>
                                <p className="text-slate-600 truncate max-w-md">{sub.submission_text || sub.attachment_url}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {sub.score !== null && (
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                                    Nilai: {sub.score}
                                  </span>
                                )}
                                {isTeacher && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      setGradeModal({
                                        submission: sub,
                                        score: String(sub.score ?? 85),
                                      })
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                                  >
                                    Beri Nilai
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'CBT' && (
          <div className="space-y-4 text-xs">
            {isTeacher && (
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  const ok = await postLms(
                    {
                      action: 'CREATE_QUIZ',
                      subject_id: quizForm.subject_id,
                      classroom_id: quizForm.classroom_id,
                      title: quizForm.title,
                      duration_minutes: Number(quizForm.duration_minutes) || 30,
                      questions: [
                        {
                          question: quizForm.qText,
                          options: [quizForm.optA, quizForm.optB, quizForm.optC, quizForm.optD].filter(Boolean),
                          correctIndex: Number(quizForm.correctIndex) || 0,
                        },
                      ],
                    },
                    'Kuis CBT berhasil dipublikasikan.'
                  );
                  if (ok) setQuizForm((p) => ({ ...p, title: '', qText: '', optA: '', optB: '', optC: '', optD: '' }));
                }}
                className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <select
                  required
                  value={quizForm.subject_id}
                  onChange={(e) => setQuizForm({ ...quizForm, subject_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Mapel --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={quizForm.classroom_id}
                  onChange={(e) => setQuizForm({ ...quizForm, classroom_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Rombel --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                  placeholder="Judul Kuis / CBT *"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={quizForm.duration_minutes}
                  onChange={(e) => setQuizForm({ ...quizForm, duration_minutes: Number(e.target.value) || 30 })}
                  placeholder="Durasi (menit)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono"
                />
                <input
                  required
                  value={quizForm.qText}
                  onChange={(e) => setQuizForm({ ...quizForm, qText: e.target.value })}
                  placeholder="Pertanyaan Soal 1 *"
                  className="sm:col-span-2 lg:col-span-4 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  required
                  value={quizForm.optA}
                  onChange={(e) => setQuizForm({ ...quizForm, optA: e.target.value })}
                  placeholder="Pilihan A *"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  required
                  value={quizForm.optB}
                  onChange={(e) => setQuizForm({ ...quizForm, optB: e.target.value })}
                  placeholder="Pilihan B *"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  value={quizForm.optC}
                  onChange={(e) => setQuizForm({ ...quizForm, optC: e.target.value })}
                  placeholder="Pilihan C"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  value={quizForm.optD}
                  onChange={(e) => setQuizForm({ ...quizForm, optD: e.target.value })}
                  placeholder="Pilihan D"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <select
                  value={quizForm.correctIndex}
                  onChange={(e) => setQuizForm({ ...quizForm, correctIndex: Number(e.target.value) })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value={0}>Kunci Jawaban: A</option>
                  <option value={1}>Kunci Jawaban: B</option>
                  <option value={2}>Kunci Jawaban: C</option>
                  <option value={3}>Kunci Jawaban: D</option>
                </select>
                <div className="sm:col-span-1 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Terbitkan Kuis CBT
                  </button>
                </div>
              </form>
            )}

            {activeQuiz ? (
              <div className="rounded-2xl bg-white border border-emerald-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Mengerjakan: {activeQuiz.title} ({activeQuiz.duration_minutes} menit)
                  </h2>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setActiveQuiz(null)}
                    className="text-slate-500 hover:text-slate-800 font-semibold disabled:opacity-40"
                  >
                    Batal
                  </button>
                </div>
                {activeQuiz.questions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 space-y-2">
                    <p className="font-bold text-slate-900 break-words">
                      {idx + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            checked={quizAnswers[String(idx)] === optIdx}
                            onChange={() =>
                              setQuizAnswers((prev) => ({ ...prev, [String(idx)]: optIdx }))
                            }
                          />
                          <span className="break-words">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
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
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Kumpulkan Jawaban CBT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {quizzes.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                    {loading ? 'Memuat daftar kuis CBT...' : 'Belum ada kuis CBT yang dipublikasikan.'}
                  </div>
                ) : (
                  quizzes.map((qz) => {
                    const qzAttempts = attempts.filter((at) => at.quiz_id === qz.id);
                    return (
                      <div key={qz.id} className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm break-words">{qz.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {qz.subject?.name} • Kelas {qz.classroom?.name} • {qz.questions.length} soal • {qz.duration_minutes} menit
                            </p>
                          </div>
                          {!isTeacher && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveQuiz(qz);
                                setQuizAnswers({});
                              }}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0 transition"
                            >
                              <PlayCircle className="w-3.5 h-3.5" /> Mulai Kuis
                            </button>
                          )}
                        </div>
                        {qzAttempts.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {qzAttempts.map((at) => (
                              <span
                                key={at.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-[11px]"
                              >
                                {at.student?.full_name || 'Siswa'}: Nilai {at.score} ({at.correct_count}/{at.total_questions})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
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
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <h2 id="lms-submit-modal-title" className="text-base font-bold text-slate-900 break-words">
                  Kumpulkan Tugas — {submitModal.assignment.title}
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
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSubmitAssignment} className="space-y-4">
              <div>
                <label htmlFor="lms-submit-text" className="block text-xs font-semibold text-slate-700 mb-1">
                  Jawaban / Tautan Berkas Tugas *
                </label>
                <textarea
                  id="lms-submit-text"
                  required
                  rows={4}
                  value={submitModal.text}
                  onChange={(e) =>
                    setSubmitModal((prev) => (prev ? { ...prev, text: e.target.value } : null))
                  }
                  placeholder="Tuliskan jawaban atau tempel tautan Google Drive / dokumen tugas..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSubmitModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Kumpulkan Tugas
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
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <h2 id="lms-grade-modal-title" className="text-base font-bold text-slate-900">
                  Beri Nilai Tugas Siswa
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 break-words">
                  {gradeModal.submission.student?.full_name || 'Siswa'}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setGradeModal(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmGradeSubmission} className="space-y-4">
              <div>
                <label htmlFor="lms-grade-score" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nilai (0–100) *
                </label>
                <input
                  id="lms-grade-score"
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={gradeModal.score}
                  onChange={(e) =>
                    setGradeModal((prev) => (prev ? { ...prev, score: e.target.value } : null))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setGradeModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Nilai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
