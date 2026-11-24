'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ClipboardList, RefreshCw } from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';
import { KegiatanSection } from './acara/kegiatan-section';
import { KonfirmasiSection } from './acara/konfirmasi-section';
import { UpacaraSection } from './acara/upacara-section';
import type {
  AcaraSection,
  CeremonyRow,
  ConfirmationRow,
  PicketAttOpt,
  SchoolEvent,
  TeacherOpt,
} from './acara/types';

export type { AcaraSection } from './acara/types';

export function AcaraWorkspace({ section }: { section: AcaraSection }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([]);
  const [ceremonies, setCeremonies] = useState<CeremonyRow[]>([]);
  const [confirmedPickets, setConfirmedPickets] = useState<PicketAttOpt[]>([]);
  const [canManageEvents, setCanManageEvents] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/acara', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat manajemen acara.');
      setLoadError(null);
      setEvents(data.events || []);
      setTeachers(data.teachers || []);
      setConfirmations(data.confirmations || []);
      setCeremonies(data.ceremonies || []);
      setConfirmedPickets(data.confirmedPicketAttendances || []);
      setCanManageEvents(Boolean(data.canManageEvents));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function postAcara(body: unknown, successMsg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/acara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Terjadi kesalahan.');
        return false;
      }
      showToast('success', successMsg);
      await loadData();
      return true;
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <AkademikLoading label="Memuat manajemen acara & kegiatan..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Manajemen Acara &amp; Kegiatan</span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Kelola acara rutin mingguan maupun insidental (1 hari / rentang beberapa hari) serta
            konfirmasi kehadiran guru oleh Admin atau Guru Piket hari itu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              if (refreshing) return;
              setRefreshing(true);
              try {
                await loadData();
              } finally {
                setRefreshing(false);
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Memuat...' : 'Muat Ulang'}
          </button>
          <Link
            href="/portal/akademik/jurnal-acara"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
          >
            <ClipboardList className="w-4 h-4" /> Input Jurnal Acara
          </Link>
        </div>
      </div>

      {section === 'kegiatan' && (
        <KegiatanSection
          events={events}
          canManageEvents={canManageEvents}
          submitting={submitting}
          postAcara={postAcara}
          showToast={showToast}
        />
      )}

      {section === 'konfirmasi' && (
        <KonfirmasiSection
          events={events}
          teachers={teachers}
          confirmations={confirmations}
          confirmedPickets={confirmedPickets}
          canManageEvents={canManageEvents}
          submitting={submitting}
          postAcara={postAcara}
          showToast={showToast}
        />
      )}

      {section === 'upacara' && (
        <UpacaraSection
          teachers={teachers}
          ceremonies={ceremonies}
          confirmedPickets={confirmedPickets}
          canManageEvents={canManageEvents}
          submitting={submitting}
          postAcara={postAcara}
          showToast={showToast}
        />
      )}
    </div>
  );
}
