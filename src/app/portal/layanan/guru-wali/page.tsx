'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { GuruWaliFormsSection } from '@/components/portal/layanan/guru-wali/guru-wali-forms-section';
import { MentoringLogsSection } from '@/components/portal/layanan/guru-wali/mentoring-logs-section';
import { MenteeDirectorySection } from '@/components/portal/layanan/guru-wali/mentee-directory-section';
import type {
  AssignmentRow,
  HafalanItem,
  MentoringLogRow,
  Opt,
  ToastState,
} from '@/components/portal/layanan/guru-wali/types';

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
  const [menteeDirectory, setMenteeDirectory] = useState<AssignmentRow[]>([]);
  const [canViewMenteeDirectory, setCanViewMenteeDirectory] = useState(false);
  const [logs, setLogs] = useState<MentoringLogRow[]>([]);
  const [hafalanItems, setHafalanItems] = useState<HafalanItem[]>([]);

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
      menteeDirectory: (gw.menteeDirectory || []) as AssignmentRow[],
      canViewMenteeDirectory: Boolean(gw.canViewMenteeDirectory),
      logs: (gw.logs || []) as MentoringLogRow[],
      hafalanItems: (gw.hafalanItems || []) as HafalanItem[],
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
        setMenteeDirectory(data.menteeDirectory);
        setCanViewMenteeDirectory(data.canViewMenteeDirectory);
        setLogs(data.logs);
        setHafalanItems(data.hafalanItems);
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
          setMenteeDirectory(data.menteeDirectory);
          setCanViewMenteeDirectory(data.canViewMenteeDirectory);
          setLogs(data.logs);
          setHafalanItems(data.hafalanItems);
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

  const hasFormsColumn = canAssign || canLog;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
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
            {!hasFormsColumn && (
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
        {hasFormsColumn && (
          <GuruWaliFormsSection
            canAssign={canAssign}
            canLog={canLog}
            students={students}
            teachers={teachers}
            assignments={assignments}
            hafalanItems={hafalanItems}
            submittingAction={submittingAction}
            onSubmitAction={postGw}
            onToast={showToast}
          />
        )}

        <MentoringLogsSection logs={logs} hasFormsColumn={hasFormsColumn} />
      </div>

      {/* Daftar Siswa Binaan per Guru Wali (Hanya Admin, Wali Kelas, & Guru Wali) */}
      {canViewMenteeDirectory && (
        <MenteeDirectorySection menteeDirectory={menteeDirectory} canAssign={canAssign} />
      )}
    </div>
  );
}
