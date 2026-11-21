'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MailCheck,
  Play,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

export type KalenderSection = 'agenda' | 'log-jtm';

interface CalendarEventRow {
  id: string;
  event_date: string;
  title: string;
  category: 'LIBUR_BERBAYAR' | 'LIBUR_TIDAK_BERBAYAR' | 'HARI_EFEKTIF' | 'AGENDA_KHUSUS';
  description: string | null;
  auto_jtm_processed: boolean;
  auto_jtm_processed_at: string | null;
}

interface PaidHolidayLogRow {
  id: string;
  holiday_date: string;
  teaching_jtm: number;
  picket_jtm: number;
  total_jtm: number;
  email_sent: boolean;
  details: string | null;
  teacher?: { full_name: string } | null;
  calendar_event?: { title: string } | null;
}

const CATEGORY_LABELS: Record<CalendarEventRow['category'], string> = {
  LIBUR_BERBAYAR: 'Libur Berbayar (Otomatis JTM)',
  LIBUR_TIDAK_BERBAYAR: 'Libur Tidak Berbayar',
  HARI_EFEKTIF: 'Hari Efektif Belajar',
  AGENDA_KHUSUS: 'Agenda Khusus Lembaga',
};

const CATEGORY_BADGES: Record<CalendarEventRow['category'], string> = {
  LIBUR_BERBAYAR: 'bg-emerald-50 text-emerald-700',
  LIBUR_TIDAK_BERBAYAR: 'bg-rose-50 text-rose-700',
  HARI_EFEKTIF: 'bg-sky-50 text-sky-700',
  AGENDA_KHUSUS: 'bg-amber-50 text-amber-700',
};

const PAGE_SIZE = 8;

export function KalenderWorkspace({ section }: { section: KalenderSection }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [runningAuto, setRunningAuto] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [logs, setLogs] = useState<PaidHolidayLogRow[]>([]);
  const [canManageCalendar, setCanManageCalendar] = useState(false);
  const [runDate, setRunDate] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | CalendarEventRow['category']>('ALL');
  const [eventPage, setEventPage] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState<'ALL' | 'SENT' | 'UNSENT'>('ALL');
  const [logPage, setLogPage] = useState(1);

  const [form, setForm] = useState({
    event_date: '',
    title: '',
    category: 'LIBUR_BERBAYAR' as CalendarEventRow['category'],
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

  async function postKalender(body: unknown) {
    try {
      const res = await fetch('/api/akademik/kalender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
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
  }

  const agendaStats = useMemo(() => {
    const paidHolidays = events.filter((e) => e.category === 'LIBUR_BERBAYAR');
    const processedCount = paidHolidays.filter((e) => e.auto_jtm_processed).length;
    const pendingCount = paidHolidays.length - processedCount;
    return {
      total: events.length,
      paidHolidays: paidHolidays.length,
      processedCount,
      pendingCount,
    };
  }, [events]);

  const existingDateEvent = useMemo(
    () => (form.event_date ? events.find((e) => e.event_date === form.event_date) || null : null),
    [events, form.event_date]
  );

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.event_date.toLowerCase().includes(q) ||
        (ev.description || '').toLowerCase().includes(q)
      );
    });
  }, [events, categoryFilter, search]);

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentEventPage = Math.min(eventPage, totalEventPages);
  const eventPageStart = (currentEventPage - 1) * PAGE_SIZE;
  const pagedEvents = useMemo(
    () => filteredEvents.slice(eventPageStart, eventPageStart + PAGE_SIZE),
    [filteredEvents, eventPageStart]
  );

  const logStats = useMemo(() => {
    const totalJtm = Number(
      logs.reduce((acc, l) => acc + Number(l.total_jtm || 0), 0).toFixed(2)
    );
    const emailSent = logs.filter((l) => l.email_sent).length;
    return {
      total: logs.length,
      totalJtm,
      emailSent,
      emailUnsent: logs.length - emailSent,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((log) => {
      if (emailFilter === 'SENT' && !log.email_sent) return false;
      if (emailFilter === 'UNSENT' && log.email_sent) return false;
      if (!q) return true;
      return (
        log.holiday_date.toLowerCase().includes(q) ||
        (log.teacher?.full_name || '').toLowerCase().includes(q) ||
        (log.calendar_event?.title || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q)
      );
    });
  }, [logs, emailFilter, logSearch]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentLogPage = Math.min(logPage, totalLogPages);
  const logPageStart = (currentLogPage - 1) * PAGE_SIZE;
  const pagedLogs = useMemo(
    () => filteredLogs.slice(logPageStart, logPageStart + PAGE_SIZE),
    [filteredLogs, logPageStart]
  );

  if (loading) {
    return <AkademikLoading label="Memuat Kalender Pendidikan..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={() => void loadData(true)} />

      {section === 'agenda' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Kalender Pendidikan &amp; Agenda
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                Kelola hari libur berbayar (otomasi JTM 10.00 WIB), libur tidak berbayar, hari
                efektif, dan agenda khusus lembaga.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition self-start sm:self-auto shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Total Agenda</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
                {agendaStats.total}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Libur Berbayar</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                {agendaStats.paidHolidays}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Otomasi JTM Selesai</p>
              <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
                {agendaStats.processedCount}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Menunggu Trigger</p>
              <p className="text-lg sm:text-xl font-bold text-amber-700 mt-1 tabular-nums">
                {agendaStats.pendingCount}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {canManageCalendar && (
              <div className="lg:col-span-4 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Atur Tanggal Kalender</span>
                </h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (submitting) return;
                    const trimmedTitle = form.title.trim();
                    if (!form.event_date) {
                      showToast('error', 'Tanggal kalender wajib dipilih.');
                      return;
                    }
                    if (trimmedTitle.length < 3) {
                      showToast('error', 'Judul agenda/libur minimal 3 karakter.');
                      return;
                    }
                    setSubmitting(true);
                    try {
                      const res = await postKalender({
                        action: 'CREATE_CALENDAR_EVENT',
                        event_date: form.event_date,
                        title: trimmedTitle,
                        category: form.category,
                        description: form.description.trim() || null,
                      });
                      if (res) {
                        showToast(
                          'success',
                          existingDateEvent
                            ? 'Tanggal kalender pendidikan berhasil diperbarui.'
                            : 'Tanggal kalender pendidikan berhasil disimpan.'
                        );
                        setForm((prev) => ({ ...prev, title: '', description: '' }));
                        setEventPage(1);
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor="kalender-date"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Tanggal
                    </label>
                    <input
                      id="kalender-date"
                      type="date"
                      required
                      value={form.event_date}
                      onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    {existingDateEvent && (
                      <p className="mt-1 text-[11px] text-amber-700 leading-snug">
                        Tanggal ini sudah terdaftar (&ldquo;{existingDateEvent.title}&rdquo;).
                        Menyimpan akan memperbarui agenda pada tanggal ini.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="kalender-category"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kategori Hari
                    </label>
                    <select
                      id="kalender-category"
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value as CalendarEventRow['category'],
                        })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="LIBUR_BERBAYAR">
                        Libur Berbayar (JTM Otomatis 10.00 WIB)
                      </option>
                      <option value="LIBUR_TIDAK_BERBAYAR">Libur Tidak Berbayar</option>
                      <option value="HARI_EFEKTIF">Hari Efektif Belajar</option>
                      <option value="AGENDA_KHUSUS">Agenda Khusus Lembaga</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="kalender-title"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nama Agenda / Hari Libur
                    </label>
                    <input
                      id="kalender-title"
                      required
                      minLength={3}
                      placeholder="Mis. Hari Kemerdekaan RI / Cuti Bersama"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="kalender-desc"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Keterangan (Opsional)
                    </label>
                    <textarea
                      id="kalender-desc"
                      rows={2}
                      placeholder="Keterangan tambahan..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {existingDateEvent
                      ? 'Perbarui Agenda Tanggal Ini'
                      : 'Simpan ke Kalender Pendidikan'}
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManageCalendar ? 'lg:col-span-8' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Tanggal Kalender ({filteredEvents.length})
                </h2>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <select
                    aria-label="Filter kategori agenda"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(
                        e.target.value as 'ALL' | CalendarEventRow['category']
                      );
                      setEventPage(1);
                    }}
                    className="w-full sm:w-44 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="LIBUR_BERBAYAR">Libur Berbayar</option>
                    <option value="LIBUR_TIDAK_BERBAYAR">Libur Tidak Berbayar</option>
                    <option value="HARI_EFEKTIF">Hari Efektif</option>
                    <option value="AGENDA_KHUSUS">Agenda Khusus</option>
                  </select>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setEventPage(1);
                      }}
                      placeholder="Cari tanggal atau agenda..."
                      aria-label="Cari agenda kalender"
                      className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setEventPage(1);
                        }}
                        aria-label="Hapus pencarian"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {pagedEvents.length === 0 ? (
                <AkademikEmptyState
                  icon={<CalendarDays className="w-6 h-6 text-slate-300" />}
                  message={
                    events.length === 0
                      ? 'Belum ada tanggal yang diatur pada Kalender Pendidikan.'
                      : 'Tidak ada agenda yang cocok dengan filter pencarian.'
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {pagedEvents.map((ev) => {
                    const isDeleting = deletingId === ev.id;
                    const isConfirming = confirmDeleteId === ev.id;
                    return (
                      <div
                        key={ev.id}
                        className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 break-words tabular-nums">
                              {ev.event_date} — {ev.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_BADGES[ev.category]}`}
                            >
                              {CATEGORY_LABELS[ev.category]}
                            </span>
                            {ev.category === 'LIBUR_BERBAYAR' && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  ev.auto_jtm_processed
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {ev.auto_jtm_processed
                                  ? 'Otomasi JTM Selesai'
                                  : 'Menunggu Trigger 10.00 WIB'}
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-slate-500 break-words leading-relaxed">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        {canManageCalendar && (
                          <div className="flex items-center justify-end gap-1.5 shrink-0">
                            {isConfirming ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={async () => {
                                    setDeletingId(ev.id);
                                    try {
                                      const res = await postKalender({
                                        action: 'DELETE_CALENDAR_EVENT',
                                        event_id: ev.id,
                                      });
                                      if (res) {
                                        showToast('success', 'Agenda kalender dihapus.');
                                        setConfirmDeleteId(null);
                                      }
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                                >
                                  {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-medium transition"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={Boolean(deletingId)}
                                onClick={() => setConfirmDeleteId(ev.id)}
                                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
                                title="Hapus tanggal"
                                aria-label={`Hapus ${ev.title}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredEvents.length > PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Menampilkan {eventPageStart + 1}–
                    {Math.min(eventPageStart + PAGE_SIZE, filteredEvents.length)} dari{' '}
                    {filteredEvents.length} agenda
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                      disabled={currentEventPage <= 1}
                      aria-label="Halaman sebelumnya"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-medium text-slate-700 tabular-nums">
                      Hal {currentEventPage} / {totalEventPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
                      disabled={currentEventPage >= totalEventPages}
                      aria-label="Halaman berikutnya"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {section === 'log-jtm' && (
        <div className="space-y-5 sm:space-y-6">
          <div className="glass-card rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Otomasi JTM Libur Berbayar</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Setiap tanggal bertipe <strong>Libur Berbayar</strong> memicu sistem otomatis pada{' '}
                <strong>pukul 10.00 WIB</strong> untuk menambahkan JTM jadwal mengajar &amp; jadwal
                piket guru hari itu serta mengirimkan <strong>email notifikasi otomatis</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Muat Ulang
              </button>

              {canManageCalendar && (
                <>
                  <input
                    type="date"
                    aria-label="Tanggal eksekusi otomasi JTM"
                    value={runDate}
                    onChange={(e) => setRunDate(e.target.value)}
                    className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={runningAuto || !runDate}
                    onClick={async () => {
                      if (!runDate) {
                        showToast('error', 'Pilih tanggal terlebih dahulu.');
                        return;
                      }
                      setRunningAuto(true);
                      try {
                        const res = await postKalender({
                          action: 'RUN_AUTO_JTM_NOW',
                          date: runDate,
                        });
                        if (res?.result) {
                          showToast(
                            res.result.isPaidHoliday ? 'success' : 'error',
                            res.result.message
                          );
                          if (res.result.isPaidHoliday) {
                            setLogPage(1);
                          }
                        }
                      } finally {
                        setRunningAuto(false);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
                  >
                    {runningAuto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Jalankan Otomasi JTM Sekarang
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Total Log JTM</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
                {logStats.total}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Akumulasi JTM</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                +{logStats.totalJtm}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Email Terkirim</p>
              <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
                {logStats.emailSent}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-slate-500">Email Belum Terkirim</p>
              <p className="text-lg sm:text-xl font-bold text-amber-700 mt-1 tabular-nums">
                {logStats.emailUnsent}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">
                Riwayat Penambahan JTM Otomatis Libur Berbayar ({filteredLogs.length})
              </h2>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <select
                  aria-label="Filter status email log JTM"
                  value={emailFilter}
                  onChange={(e) => {
                    setEmailFilter(e.target.value as 'ALL' | 'SENT' | 'UNSENT');
                    setLogPage(1);
                  }}
                  className="w-full sm:w-44 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="ALL">Semua Status Email</option>
                  <option value="SENT">Email Terkirim</option>
                  <option value="UNSENT">Email Tidak Terkirim</option>
                </select>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                    placeholder="Cari guru, tanggal, agenda..."
                    aria-label="Cari riwayat log JTM"
                    className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {logSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogSearch('');
                        setLogPage(1);
                      }}
                      aria-label="Hapus pencarian log"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {pagedLogs.length === 0 ? (
              <AkademikEmptyState
                icon={<Clock className="w-6 h-6 text-slate-300" />}
                message={
                  logs.length === 0
                    ? 'Belum ada log JTM otomatis hari libur berbayar.'
                    : 'Tidak ada log JTM yang cocok dengan filter pencarian.'
                }
              />
            ) : (
              <div className="space-y-2.5">
                {pagedLogs.map((log) => (
                  <div
                    key={log.id}
                    className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-bold text-slate-900 break-words tabular-nums">
                        {log.holiday_date} • {log.teacher?.full_name || 'Guru'} —{' '}
                        {log.calendar_event?.title || 'Libur Berbayar'}
                      </p>
                      <p className="text-slate-600 break-words leading-relaxed">
                        Mengajar: {log.teaching_jtm} JTM • Piket: {log.picket_jtm} JTM
                        {log.details ? ` • ${log.details}` : ''}
                      </p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold tabular-nums">
                        +{log.total_jtm} JTM
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                          log.email_sent ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        <MailCheck className="w-3 h-3" />
                        {log.email_sent ? 'Email Terkirim' : 'Email Tidak Terkirim'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredLogs.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Menampilkan {logPageStart + 1}–
                  {Math.min(logPageStart + PAGE_SIZE, filteredLogs.length)} dari{' '}
                  {filteredLogs.length} log
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={currentLogPage <= 1}
                    aria-label="Halaman log sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Hal {currentLogPage} / {totalLogPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                    disabled={currentLogPage >= totalLogPages}
                    aria-label="Halaman log berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
