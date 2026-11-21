'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';

interface Opt {
  id: string;
  full_name: string;
  nis?: string | null;
}

interface AssignmentRow {
  id: string;
  teacher?: { full_name: string } | null;
  student?: { full_name: string; nis?: string | null } | null;
}

interface MentoringLogRow {
  id: string;
  mentoring_date: string;
  topic: string;
  aspect?: string | null;
  notes: string;
  recommendation?: string | null;
  assignment?: {
    teacher?: { full_name: string } | null;
    student?: { full_name: string } | null;
  } | null;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type MentoringAspect = 'AKADEMIK' | 'IBADAH_KARAKTER' | 'SOSIAL' | 'KESEHATAN' | 'LAINNYA';

const ASPECT_LABELS: Record<MentoringAspect, string> = {
  AKADEMIK: 'Akademik',
  IBADAH_KARAKTER: 'Ibadah & Karakter',
  SOSIAL: 'Sosial',
  KESEHATAN: 'Kesehatan',
  LAINNYA: 'Lainnya',
};

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GuruWaliPage() {
  const { hasPermission } = usePortalSession();
  const canAssign = hasPermission(PERMISSIONS.GURU_WALI_ASSIGN);
  const canLog = hasPermission(PERMISSIONS.GURU_WALI_LOG);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [students, setStudents] = useState<Opt[]>([]);
  const [teachers, setTeachers] = useState<Opt[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [logs, setLogs] = useState<MentoringLogRow[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [aspectFilter, setAspectFilter] = useState<'ALL' | MentoringAspect>('ALL');

  const [assignForm, setAssignForm] = useState({ teacher_id: '', student_id: '' });
  const [logForm, setLogForm] = useState(() => ({
    assignment_id: '',
    mentoring_date: getTodayIsoDate(),
    topic: '',
    aspect: 'AKADEMIK' as MentoringAspect,
    notes: '',
    recommendation: '',
  }));

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

  const fetchGuruWaliData = useCallback(async () => {
    const [biRes, gwRes] = await Promise.all([
      fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
      fetch('/api/layanan/guru-wali', { cache: 'no-store' }),
    ]);

    const bi = await biRes.json().catch(() => null);
    const gw = await gwRes.json().catch(() => null);

    if (!gwRes.ok || !gw) {
      throw new Error(gw?.error || 'Gagal memuat data Guru Wali dari server.');
    }
    if (!biRes.ok || !bi) {
      throw new Error(bi?.error || 'Gagal memuat daftar guru & siswa dari server.');
    }

    return {
      students: (bi.students || []) as Opt[],
      teachers: (bi.teachers || []) as Opt[],
      assignments: (gw.assignments || []) as AssignmentRow[],
      logs: (gw.logs || []) as MentoringLogRow[],
    };
  }, []);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchGuruWaliData();
        setStudents(data.students);
        setTeachers(data.teachers);
        setAssignments(data.assignments);
        setLogs(data.logs);
        setLoadError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data Guru Wali.';
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
    [fetchGuruWaliData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchGuruWaliData();
        if (!cancelled) {
          setStudents(data.students);
          setTeachers(data.teachers);
          setAssignments(data.assignments);
          setLogs(data.logs);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data Guru Wali.'
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
  }, [fetchGuruWaliData]);

  async function postGw(body: { action?: string; [key: string]: unknown }, msg: string) {
    const actionKey = body.action || 'POST';
    if (submittingAction) return false;
    setSubmittingAction(actionKey);
    try {
      const res = await fetch('/api/layanan/guru-wali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Terjadi kesalahan saat menyimpan data.', 'error');
        return false;
      }
      showToast(msg, 'success');
      await loadData('refresh');
      return true;
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
      return false;
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAssign || submittingAction) return;
    if (!assignForm.teacher_id || !assignForm.student_id) {
      showToast('Pilih Guru Wali dan siswa terlebih dahulu.', 'error');
      return;
    }
    const ok = await postGw(
      { action: 'ASSIGN_GURU_WALI', ...assignForm },
      'Guru Wali siswa berhasil ditetapkan.'
    );
    if (ok) {
      setAssignForm({ teacher_id: '', student_id: '' });
    }
  }

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canLog || submittingAction) return;
    const topic = logForm.topic.trim();
    const notes = logForm.notes.trim();
    const recommendation = logForm.recommendation.trim();
    if (!logForm.assignment_id) {
      showToast('Pilih siswa bimbingan terlebih dahulu.', 'error');
      return;
    }
    if (topic.length < 2) {
      showToast('Topik bimbingan minimal 2 karakter.', 'error');
      return;
    }
    if (notes.length < 3) {
      showToast('Catatan perkembangan minimal 3 karakter.', 'error');
      return;
    }
    const ok = await postGw(
      {
        action: 'ADD_MENTORING_LOG',
        assignment_id: logForm.assignment_id,
        mentoring_date: logForm.mentoring_date || undefined,
        topic,
        aspect: logForm.aspect,
        notes,
        recommendation: recommendation || null,
      },
      'Rekam jejak bimbingan Guru Wali tersimpan.'
    );
    if (ok) {
      setLogForm((prev) => ({ ...prev, topic: '', notes: '', recommendation: '' }));
    }
  }

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((l) => {
      if (aspectFilter !== 'ALL' && l.aspect !== aspectFilter) return false;
      if (q) {
        const haystack = `${l.assignment?.student?.full_name || ''} ${
          l.assignment?.teacher?.full_name || ''
        } ${l.topic} ${l.notes} ${l.mentoring_date}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [aspectFilter, logSearch, logs]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat manajemen Guru Wali...</span>
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
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Data Guru Wali</h1>
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 shadow-sm ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Manajemen Guru Wali &amp; Pendampingan Siswa</span>
            </h1>
            {!canAssign && !canLog && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Tetapkan Guru Wali pendamping tiap siswa dan catat log bimbingan perkembangan akademik,
            karakter, maupun sosial.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Binaan: </span>
            <span className="font-bold text-emerald-800">{assignments.length} siswa</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px]">
            <span className="text-slate-500">Log: </span>
            <span className="font-bold text-sky-800">{logs.length}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData('refresh')}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang data Guru Wali"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {(canAssign || canLog) && (
          <div className="lg:col-span-5 space-y-6">
            {canAssign && (
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Tetapkan Guru Wali Siswa (Terpisah dari BK)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Penetapan baru untuk siswa pada tahun ajaran aktif otomatis memperbarui Guru
                    Walinya.
                  </p>
                </div>

                <form onSubmit={handleAssignSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="gw-assign-teacher"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Guru Wali
                    </label>
                    <select
                      id="gw-assign-teacher"
                      required
                      disabled={submittingAction === 'ASSIGN_GURU_WALI'}
                      value={assignForm.teacher_id}
                      onChange={(e) => setAssignForm({ ...assignForm, teacher_id: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Guru Wali --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="gw-assign-student"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Siswa Binaan
                    </label>
                    <select
                      id="gw-assign-student"
                      required
                      disabled={submittingAction === 'ASSIGN_GURU_WALI'}
                      value={assignForm.student_id}
                      onChange={(e) => setAssignForm({ ...assignForm, student_id: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {s.nis ? `(${s.nis})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={Boolean(submittingAction)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'ASSIGN_GURU_WALI' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Penugasan</span>
                  </button>
                </form>
              </div>
            )}

            {canLog && (
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">Catat Bimbingan Guru Wali</h2>
                  <p className="text-[11px] text-slate-500">
                    Dokumentasikan topik bimbingan, aspek, catatan perkembangan, dan rekomendasi.
                  </p>
                </div>

                <form onSubmit={handleLogSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="gw-log-assignment"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Siswa Bimbingan
                    </label>
                    <select
                      id="gw-log-assignment"
                      required
                      disabled={submittingAction === 'ADD_MENTORING_LOG'}
                      value={logForm.assignment_id}
                      onChange={(e) => setLogForm({ ...logForm, assignment_id: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Siswa Bimbingan --</option>
                      {assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.student?.full_name || 'Siswa'} (Wali:{' '}
                          {a.teacher?.full_name || 'Guru'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="gw-log-aspect"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Aspek Bimbingan
                      </label>
                      <select
                        id="gw-log-aspect"
                        disabled={submittingAction === 'ADD_MENTORING_LOG'}
                        value={logForm.aspect}
                        onChange={(e) =>
                          setLogForm({ ...logForm, aspect: e.target.value as MentoringAspect })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                      >
                        {Object.entries(ASPECT_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="gw-log-date"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Tanggal Bimbingan
                      </label>
                      <input
                        id="gw-log-date"
                        type="date"
                        required
                        disabled={submittingAction === 'ADD_MENTORING_LOG'}
                        value={logForm.mentoring_date}
                        onChange={(e) => setLogForm({ ...logForm, mentoring_date: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="gw-log-topic"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Topik Bimbingan
                    </label>
                    <input
                      id="gw-log-topic"
                      required
                      minLength={2}
                      disabled={submittingAction === 'ADD_MENTORING_LOG'}
                      placeholder="Topik Bimbingan"
                      value={logForm.topic}
                      onChange={(e) => setLogForm({ ...logForm, topic: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="gw-log-notes"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Catatan Perkembangan
                    </label>
                    <textarea
                      id="gw-log-notes"
                      required
                      minLength={3}
                      rows={3}
                      disabled={submittingAction === 'ADD_MENTORING_LOG'}
                      placeholder="Catatan Perkembangan"
                      value={logForm.notes}
                      onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="gw-log-rec"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Rekomendasi / Tindak Lanjut (Opsional)
                    </label>
                    <input
                      id="gw-log-rec"
                      disabled={submittingAction === 'ADD_MENTORING_LOG'}
                      placeholder="Rekomendasi tindak lanjut"
                      value={logForm.recommendation}
                      onChange={(e) => setLogForm({ ...logForm, recommendation: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={Boolean(submittingAction) || assignments.length === 0}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'ADD_MENTORING_LOG' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Log Bimbingan</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <div
          className={`${
            canAssign || canLog ? 'lg:col-span-7' : 'lg:col-span-12'
          } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Rekam Jejak Bimbingan Guru Wali ({filteredLogs.length})
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setAspectFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  aspectFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semua
              </button>
              {(Object.entries(ASPECT_LABELS) as Array<[MentoringAspect, string]>).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAspectFilter(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      aspectFilter === key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="relative">
            <label htmlFor="gw-log-search" className="sr-only">
              Cari log bimbingan Guru Wali
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="gw-log-search"
              type="search"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Cari siswa, Guru Wali, topik, atau catatan..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {logs.length === 0
                  ? 'Belum ada rekam jejak bimbingan Guru Wali.'
                  : 'Tidak ada log bimbingan yang cocok dengan filter pencarian.'}
              </p>
              {(logSearch || aspectFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setLogSearch('');
                    setAspectFilter('ALL');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[36rem] overflow-y-auto pr-0.5">
              {filteredLogs.map((l) => {
                const aspectLabel =
                  l.aspect && l.aspect in ASPECT_LABELS
                    ? ASPECT_LABELS[l.aspect as MentoringAspect]
                    : l.aspect || 'Akademik';
                return (
                  <div
                    key={l.id}
                    className="modular-card rounded-xl p-3.5 text-xs space-y-1.5 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        {aspectLabel}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {l.mentoring_date}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 break-words">
                      {l.assignment?.student?.full_name || 'Siswa'} — {l.topic}
                    </p>
                    <p className="text-slate-600 break-words">{l.notes}</p>
                    {l.recommendation && (
                      <p className="text-[11px] text-emerald-700 font-medium break-words">
                        Rekomendasi: {l.recommendation}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 break-words">
                      Guru Wali: {l.assignment?.teacher?.full_name || '-'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
