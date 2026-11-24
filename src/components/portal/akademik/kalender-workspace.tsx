'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';
import { AgendaSection } from './kalender/agenda-section';
import { LogJtmSection } from './kalender/log-jtm-section';
import type {
  CalendarEventFormState,
  CalendarEventRow,
  KalenderPostResponse,
  KalenderSection,
  PaidHolidayLogRow,
} from './kalender/types';

export type { KalenderSection } from './kalender/types';

export function KalenderWorkspace({ section }: { section: KalenderSection }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [logs, setLogs] = useState<PaidHolidayLogRow[]>([]);
  const [canManageCalendar, setCanManageCalendar] = useState(false);
  const [runDate, setRunDate] = useState('');
  const [form, setForm] = useState<CalendarEventFormState>({
    event_date: '',
    title: '',
    category: 'LIBUR_BERBAYAR',
    description: '',
  });

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    const reqId = ++requestIdRef.current;
    if (isManualRefresh || hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/akademik/kalender', { cache: 'no-store' });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat Kalender Pendidikan.');
      }
      hasLoadedOnceRef.current = true;
      setLoadError(null);
      setEvents(data.events || []);
      setLogs(data.logs || []);
      setCanManageCalendar(Boolean(data.canManageCalendar));
      if (data.todayDate) {
        setRunDate((prev) => prev || data.todayDate);
        setForm((prev) => ({ ...prev, event_date: prev.event_date || data.todayDate }));
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const postKalender = useCallback(
    async (body: unknown): Promise<KalenderPostResponse | null> => {
      try {
        const res = await fetch('/api/akademik/kalender', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as KalenderPostResponse & { error?: string };
        if (!res.ok) {
          showToast('error', data.error || 'Terjadi kesalahan.');
          return null;
        }
        await loadData(true);
        return data;
      } catch {
        showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
        return null;
      }
    },
    [loadData, showToast]
  );

  const handleRefresh = useCallback(() => {
    void loadData(true);
  }, [loadData]);

  if (loading) {
    return <AkademikLoading label="Memuat Kalender Pendidikan..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={handleRefresh} />

      {section === 'agenda' && (
        <AgendaSection
          events={events}
          canManageCalendar={canManageCalendar}
          refreshing={refreshing}
          form={form}
          setForm={setForm}
          onRefresh={handleRefresh}
          postKalender={postKalender}
          showToast={showToast}
        />
      )}

      {section === 'log-jtm' && (
        <LogJtmSection
          logs={logs}
          canManageCalendar={canManageCalendar}
          refreshing={refreshing}
          runDate={runDate}
          setRunDate={setRunDate}
          onRefresh={handleRefresh}
          postKalender={postKalender}
          showToast={showToast}
        />
      )}
    </div>
  );
}
