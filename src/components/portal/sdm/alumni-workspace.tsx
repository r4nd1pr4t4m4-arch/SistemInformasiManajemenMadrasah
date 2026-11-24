'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Plus,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import type {
  ActiveAccount,
  ActiveStudent,
  AlumniStudent,
  AlumniTracer,
  SdmAlumniSection,
  WorkspaceMessage,
} from './alumni/types';
import { LulusanSection } from './alumni/lulusan-section';
import { TracerSection } from './alumni/tracer-section';

export type { SdmAlumniSection };

export function SdmAlumniWorkspace({ section }: { section: SdmAlumniSection }) {
  const { hasPermission } = usePortalSession();
  const canManageLulusan = hasPermission(PERMISSIONS.SDM_MANAGE);
  const canManageTracer = hasPermission(PERMISSIONS.SDM_ALUMNI_MANAGE);
  const tab = section;

  const [alumniStudents, setAlumniStudents] = useState<AlumniStudent[]>([]);
  const [tracers, setTracers] = useState<AlumniTracer[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<WorkspaceMessage | null>(null);

  const [graduateModalOpen, setGraduateModalOpen] = useState(false);
  const [createTracerOpen, setCreateTracerOpen] = useState(false);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadData = useCallback(async (isManualRefresh = false, signal?: AbortSignal) => {
    const reqId = ++requestIdRef.current;
    if (isManualRefresh || hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/sdm?scope=alumni', { cache: 'no-store', signal });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data alumni.');
      hasLoadedOnceRef.current = true;
      setAlumniStudents(data.alumniStudents || []);
      setTracers(data.tracers || []);
      setActiveStudents(data.activeStudents || []);
      setAccounts(data.activeAccounts || []);
    } catch (e) {
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadData(false, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  const handleReload = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  const handleCloseGraduateModal = useCallback(() => {
    setGraduateModalOpen(false);
  }, []);

  const handleCloseCreateTracer = useCallback(() => {
    setCreateTracerOpen(false);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {tab === 'lulusan' ? 'Manajemen Alumni & Lulusan' : 'Tracer Study Alumni'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            {tab === 'lulusan'
              ? 'Kelola data lulusan madrasah, penetapan kelulusan siswa, dan penautan akun alumni.'
              : 'Pantau dan kelola perkembangan studi, pekerjaan, serta testimoni alumni.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          {tab === 'lulusan' && canManageLulusan && (
            <button
              type="button"
              onClick={() => setGraduateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Luluskan Siswa
            </button>
          )}
          {tab === 'tracer' && canManageTracer && (
            <button
              type="button"
              onClick={() => setCreateTracerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Tambah Tracer Alumni
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl text-xs font-medium border flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            message.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <span className="break-words leading-relaxed">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Tutup pesan"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Alumni (Siswa Lulus)</span>
            <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {alumniStudents.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Data Tracer Study</span>
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {tracers.length}
          </p>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Akun Alumni Tertaut</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {alumniStudents.filter((a) => !!a.profile_id).length}
          </p>
        </div>
      </div>

      {tab === 'lulusan' ? (
        <LulusanSection
          alumniStudents={alumniStudents}
          activeStudents={activeStudents}
          accounts={accounts}
          loading={loading}
          canManageLulusan={canManageLulusan}
          graduateModalOpen={graduateModalOpen}
          onCloseGraduateModal={handleCloseGraduateModal}
          onMessage={setMessage}
          onReload={handleReload}
        />
      ) : (
        <TracerSection
          tracers={tracers}
          alumniStudents={alumniStudents}
          loading={loading}
          canManageTracer={canManageTracer}
          createModalOpen={createTracerOpen}
          onCloseCreateModal={handleCloseCreateTracer}
          onMessage={setMessage}
          onReload={handleReload}
        />
      )}
    </div>
  );
}
