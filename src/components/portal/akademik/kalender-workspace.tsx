'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, Loader2, MailCheck, Play, Trash2 } from 'lucide-react';
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

export function KalenderWorkspace({ section }: { section: KalenderSection }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningAuto, setRunningAuto] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [logs, setLogs] = useState<PaidHolidayLogRow[]>([]);
  const [canManageCalendar, setCanManageCalendar] = useState(false);
  const [runDate, setRunDate] = useState('');

  const [form, setForm] = useState({
    event_date: '',
    title: '',
    category: 'LIBUR_BERBAYAR' as CalendarEventRow['category'],
    description: '',
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/kalender', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat Kalender Pendidikan.');
      }
      setLoadError(null);
      setEvents(data.events || []);
      setLogs(data.logs || []);
      setCanManageCalendar(Boolean(data.canManageCalendar));
      if (data.todayDate) {
        setRunDate((prev) => prev || data.todayDate);
        setForm((prev) => ({ ...prev, event_date: prev.event_date || data.todayDate }));
      }
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
      await loadData();
      return data;
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return null;
    }
  }

  if (loading) {
    return <AkademikLoading label="Memuat Kalender Pendidikan..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      {section === 'agenda' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManageCalendar && (
            <div className="lg:col-span-4 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Atur Tanggal Kalender</span>
              </h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (submitting || !form.title.trim()) return;
                  setSubmitting(true);
                  try {
                    const res = await postKalender({
                      action: 'CREATE_CALENDAR_EVENT',
                      ...form,
                      title: form.title.trim(),
                    });
                    if (res) {
                      showToast('success', 'Tanggal kalender pendidikan berhasil disimpan.');
                      setForm((prev) => ({ ...prev, title: '', description: '' }));
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Hari
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as CalendarEventRow['category'],
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="LIBUR_BERBAYAR">Libur Berbayar (JTM Otomatis 10.00 WIB)</option>
                    <option value="LIBUR_TIDAK_BERBAYAR">Libur Tidak Berbayar</option>
                    <option value="HARI_EFEKTIF">Hari Efektif Belajar</option>
                    <option value="AGENDA_KHUSUS">Agenda Khusus Lembaga</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Agenda / Hari Libur
                  </label>
                  <input
                    required
                    placeholder="Mis. Hari Kemerdekaan RI / Cuti Bersama"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Keterangan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Keterangan tambahan..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan ke Kalender Pendidikan
                </button>
              </form>
            </div>
          )}

          <div
            className={`${canManageCalendar ? 'lg:col-span-8' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-3`}
          >
            <h2 className="text-base font-bold text-slate-900">
              Daftar Tanggal Kalender Pendidikan ({events.length})
            </h2>
            {events.length === 0 ? (
              <AkademikEmptyState
                icon={<CalendarDays className="w-6 h-6" />}
                message="Belum ada tanggal yang diatur pada Kalender Pendidikan."
              />
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="modular-card rounded-2xl p-3.5 flex items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 break-words">
                          {ev.event_date} — {ev.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ev.category === 'LIBUR_BERBAYAR'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ev.category === 'LIBUR_TIDAK_BERBAYAR'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
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
                        <p className="text-slate-500 break-words">{ev.description}</p>
                      )}
                    </div>
                    {canManageCalendar && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={async () => {
                          if (!window.confirm(`Hapus agenda "${ev.title}" (${ev.event_date})?`)) {
                            return;
                          }
                          setSubmitting(true);
                          try {
                            const res = await postKalender({
                              action: 'DELETE_CALENDAR_EVENT',
                              event_id: ev.id,
                            });
                            if (res) showToast('success', 'Agenda kalender dihapus.');
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition shrink-0"
                        title="Hapus tanggal"
                        aria-label={`Hapus ${ev.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'log-jtm' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Otomasi JTM Libur Berbayar</span>
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Setiap tanggal bertipe <strong>Libur Berbayar</strong> memicu sistem otomatis pada{' '}
                <strong>pukul 10.00 WIB</strong> untuk menambahkan JTM jadwal mengajar &amp; jadwal piket
                guru hari itu serta mengirimkan <strong>email notifikasi otomatis</strong>.
              </p>
            </div>

            {canManageCalendar && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                      const res = await postKalender({ action: 'RUN_AUTO_JTM_NOW', date: runDate });
                      if (res?.result) {
                        showToast(
                          res.result.isPaidHoliday ? 'success' : 'error',
                          res.result.message
                        );
                      }
                    } finally {
                      setRunningAuto(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  {runningAuto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Jalankan Otomasi JTM Sekarang
                </button>
              </div>
            )}
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Riwayat Penambahan JTM Otomatis Libur Berbayar ({logs.length})
            </h2>
            {logs.length === 0 ? (
              <AkademikEmptyState
                icon={<Clock className="w-6 h-6" />}
                message="Belum ada log JTM otomatis hari libur berbayar."
              />
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="font-bold text-slate-900 break-words">
                        {log.holiday_date} • {log.teacher?.full_name || 'Guru'} —{' '}
                        {log.calendar_event?.title || 'Libur Berbayar'}
                      </p>
                      <p className="text-slate-600 break-words">
                        Mengajar: {log.teaching_jtm} JTM • Piket: {log.picket_jtm} JTM
                        {log.details ? ` • ${log.details}` : ''}
                      </p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
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
          </div>
        </div>
      )}
    </div>
  );
}
