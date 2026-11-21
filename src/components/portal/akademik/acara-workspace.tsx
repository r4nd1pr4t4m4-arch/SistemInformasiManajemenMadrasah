'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: 'RUTIN_MINGGUAN' | 'INSIDENTAL';
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  jtm_allocated: number;
  is_active: boolean;
}

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface PicketAttOpt {
  id: string;
  teacher_id: string;
  attendance_date: string;
  teacher?: { full_name: string } | null;
}

interface ConfirmationRow {
  id: string;
  event_date: string;
  confirmed_by_role: 'ADMIN' | 'GURU_PIKET';
  event?: { title: string; jtm_allocated: number } | null;
  teacher?: { full_name: string } | null;
}

interface CeremonyRow {
  id: string;
  ceremony_date: string;
  teacher_id: string;
  original_teacher_id: string | null;
  jtm_allocated: number;
  status: 'TERJADWAL' | 'TERLAKSANA' | 'DIBATALKAN';
  substitution_reason: string | null;
  substituted_by_role: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export type AcaraSection = 'kegiatan' | 'konfirmasi' | 'upacara';

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

  const [ceremonyForm, setCeremonyForm] = useState(() => ({
    ceremony_date: getWibTodayDateString(),
    teacher_id: '',
    jtm_allocated: 2,
    notes: '',
  }));
  const [subCeremonyForm, setSubCeremonyForm] = useState({
    ceremony_id: '',
    substitute_teacher_id: '',
    picket_attendance_id: '',
    reason: '',
  });

  const [eventForm, setEventForm] = useState(() => {
    const today = getWibTodayDateString();
    return {
      title: '',
      description: '',
      event_type: 'RUTIN_MINGGUAN' as 'RUTIN_MINGGUAN' | 'INSIDENTAL',
      day_of_week: 1,
      start_date: today,
      end_date: today,
      start_time: '07:00',
      end_time: '08:30',
      location: '',
      jtm_allocated: 2,
    };
  });
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<
    'ALL' | 'RUTIN_MINGGUAN' | 'INSIDENTAL' | 'INACTIVE'
  >('ALL');
  const [eventPage, setEventPage] = useState(1);

  const [confirmForm, setConfirmForm] = useState(() => ({
    event_id: '',
    teacher_id: '',
    event_date: getWibTodayDateString(),
    picket_attendance_id: '',
    notes: '',
  }));
  const [confirmSearch, setConfirmSearch] = useState('');
  const [confirmRoleFilter, setConfirmRoleFilter] = useState<'ALL' | 'ADMIN' | 'GURU_PIKET'>(
    'ALL'
  );
  const [confirmPage, setConfirmPage] = useState(1);
  const [upacaraSearch, setUpacaraSearch] = useState('');
  const [upacaraFilter, setUpacaraFilter] = useState<
    'ALL' | 'TERJADWAL' | 'TERLAKSANA' | 'DIBATALKAN'
  >('ALL');
  const [upacaraPage, setUpacaraPage] = useState(1);

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

      {section === 'konfirmasi' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total Konfirmasi</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              {confirmations.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Acara Aktif</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {events.filter((ev) => ev.is_active).length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Oleh Guru Piket</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {confirmations.filter((c) => c.confirmed_by_role === 'GURU_PIKET').length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Piket Terkonfirmasi</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {confirmedPickets.length}
            </p>
          </div>
        </div>
      )}

      {section === 'kegiatan' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total Acara</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{events.length}</p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Acara Aktif</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {events.filter((ev) => ev.is_active).length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Rutin Mingguan</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {events.filter((ev) => ev.event_type === 'RUTIN_MINGGUAN').length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Insidental</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {events.filter((ev) => ev.event_type === 'INSIDENTAL').length}
            </p>
          </div>
        </div>
      )}

      {section !== 'upacara' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {((section === 'konfirmasi' && (canManageEvents || confirmedPickets.length > 0)) ||
            (section === 'kegiatan' && canManageEvents)) && (
            <div className="lg:col-span-5 space-y-5">
              {section === 'kegiatan' && canManageEvents && (
                <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3.5">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Tambah Acara / Kegiatan</span>
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const trimmedTitle = eventForm.title.trim();
                      if (trimmedTitle.length < 3) {
                        showToast('error', 'Judul acara minimal 3 karakter.');
                        return;
                      }
                      if (eventForm.event_type === 'INSIDENTAL') {
                        if (!eventForm.start_date) {
                          showToast('error', 'Tanggal mulai wajib diisi untuk acara insidental.');
                          return;
                        }
                        if (eventForm.end_date && eventForm.end_date < eventForm.start_date) {
                          showToast('error', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
                          return;
                        }
                      }
                      if (
                        eventForm.start_time &&
                        eventForm.end_time &&
                        eventForm.end_time <= eventForm.start_time
                      ) {
                        showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
                        return;
                      }
                      const safeJtm = Math.min(
                        24,
                        Math.max(
                          1,
                          Number.isFinite(eventForm.jtm_allocated) ? eventForm.jtm_allocated : 2
                        )
                      );
                      const ok = await postAcara(
                        {
                          action: 'CREATE_EVENT',
                          title: trimmedTitle,
                          description: eventForm.description.trim() || null,
                          event_type: eventForm.event_type,
                          day_of_week:
                            eventForm.event_type === 'RUTIN_MINGGUAN'
                              ? eventForm.day_of_week
                              : null,
                          start_date:
                            eventForm.event_type === 'INSIDENTAL' ? eventForm.start_date : null,
                          end_date:
                            eventForm.event_type === 'INSIDENTAL'
                              ? eventForm.end_date || eventForm.start_date
                              : null,
                          start_time: eventForm.start_time || null,
                          end_time: eventForm.end_time || null,
                          location: eventForm.location.trim() || null,
                          jtm_allocated: safeJtm,
                        },
                        'Acara/kegiatan berhasil ditambahkan.'
                      );
                      if (ok) {
                        setEventForm((prev) => ({
                          ...prev,
                          title: '',
                          description: '',
                          location: '',
                        }));
                        setEventPage(1);
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor="acara-event-title"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Nama Acara / Kegiatan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="acara-event-title"
                        required
                        minLength={3}
                        placeholder="Contoh: Upacara Bendera / Rapat Kerja"
                        value={eventForm.title}
                        onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label
                          htmlFor="acara-event-type"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Jenis Acara
                        </label>
                        <select
                          id="acara-event-type"
                          value={eventForm.event_type}
                          onChange={(e) =>
                            setEventForm({
                              ...eventForm,
                              event_type: e.target.value as 'RUTIN_MINGGUAN' | 'INSIDENTAL',
                            })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        >
                          <option value="RUTIN_MINGGUAN">Rutin Mingguan</option>
                          <option value="INSIDENTAL">Insidental (Tanggal/Rentang)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="acara-event-jtm"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Alokasi JTM (1–24)
                        </label>
                        <input
                          id="acara-event-jtm"
                          type="number"
                          min={1}
                          max={24}
                          value={eventForm.jtm_allocated}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            setEventForm({
                              ...eventForm,
                              jtm_allocated: Number.isFinite(val)
                                ? Math.min(24, Math.max(1, val))
                                : 1,
                            });
                          }}
                          placeholder="Alokasi JTM"
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {eventForm.event_type === 'RUTIN_MINGGUAN' ? (
                      <div className="space-y-1">
                        <label
                          htmlFor="acara-event-day"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Hari Pelaksanaan
                        </label>
                        <select
                          id="acara-event-day"
                          value={eventForm.day_of_week}
                          onChange={(e) =>
                            setEventForm({ ...eventForm, day_of_week: Number(e.target.value) })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        >
                          {DAY_NAMES.slice(1).map((d, idx) => (
                            <option key={d} value={idx + 1}>
                              Setiap Hari {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label
                            htmlFor="acara-event-start-date"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Tanggal Mulai <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="acara-event-start-date"
                            type="date"
                            required
                            value={eventForm.start_date}
                            onChange={(e) =>
                              setEventForm({ ...eventForm, start_date: e.target.value })
                            }
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="acara-event-end-date"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Tanggal Selesai <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="acara-event-end-date"
                            type="date"
                            required
                            value={eventForm.end_date}
                            onChange={(e) =>
                              setEventForm({ ...eventForm, end_date: e.target.value })
                            }
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label
                          htmlFor="acara-event-start-time"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Jam Mulai (WIB)
                        </label>
                        <input
                          id="acara-event-start-time"
                          type="time"
                          value={eventForm.start_time}
                          onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="acara-event-end-time"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Jam Selesai (WIB)
                        </label>
                        <input
                          id="acara-event-end-time"
                          type="time"
                          value={eventForm.end_time}
                          onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="acara-event-location"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Lokasi (Opsional)
                      </label>
                      <input
                        id="acara-event-location"
                        placeholder="Contoh: Lapangan Utama / Aula"
                        value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="acara-event-description"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Deskripsi Singkat (Opsional)
                      </label>
                      <textarea
                        id="acara-event-description"
                        rows={2}
                        placeholder="Deskripsi singkat kegiatan (opsional)"
                        value={eventForm.description}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, description: e.target.value })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Acara / Kegiatan
                    </button>
                  </form>
                </div>
              )}

              {section === 'konfirmasi' && (canManageEvents || confirmedPickets.length > 0) && (() => {
                const activeEvents = events.filter((ev) => ev.is_active);
                const selectedEvent = activeEvents.find((ev) => ev.id === confirmForm.event_id);
                const selectedPicket = confirmedPickets.find(
                  (p) => p.id === confirmForm.picket_attendance_id
                );

                let dateMismatchError: string | null = null;
                if (selectedEvent && confirmForm.event_date) {
                  if (selectedEvent.event_type === 'RUTIN_MINGGUAN') {
                    const d = new Date(`${confirmForm.event_date}T00:00:00Z`);
                    const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
                    if (selectedEvent.day_of_week !== isoDay) {
                      dateMismatchError = `Tanggal ${confirmForm.event_date} (${DAY_NAMES[isoDay]}) tidak sesuai jadwal rutin setiap hari ${DAY_NAMES[selectedEvent.day_of_week || 1]}.`;
                    }
                  } else if (
                    (selectedEvent.start_date && confirmForm.event_date < selectedEvent.start_date) ||
                    (selectedEvent.end_date && confirmForm.event_date > selectedEvent.end_date)
                  ) {
                    dateMismatchError = `Tanggal ${confirmForm.event_date} di luar rentang acara (${selectedEvent.start_date} s.d. ${selectedEvent.end_date}).`;
                  }
                }

                const picketDateMismatch =
                  Boolean(selectedPicket) &&
                  Boolean(confirmForm.event_date) &&
                  selectedPicket!.attendance_date !== confirmForm.event_date;

                return (
                  <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3.5">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Konfirmasi Kehadiran Guru di Acara</span>
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Dapat dikonfirmasi oleh <strong>Admin</strong> atau{' '}
                      <strong>Guru Piket hari itu</strong> (yang sudah dikonfirmasi kehadirannya).
                      Setelah dikonfirmasi, guru dapat mengisi Jurnal Acara.
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!confirmForm.event_id || !confirmForm.teacher_id) {
                          showToast('error', 'Pilih acara/kegiatan dan guru yang hadir.');
                          return;
                        }
                        if (!canManageEvents && !confirmForm.picket_attendance_id) {
                          showToast(
                            'error',
                            'Pilih presensi Guru Piket hari ini terlebih dahulu.'
                          );
                          return;
                        }
                        if (dateMismatchError) {
                          showToast('error', dateMismatchError);
                          return;
                        }
                        if (picketDateMismatch) {
                          showToast(
                            'error',
                            `Guru Piket hanya dapat mengonfirmasi acara pada tanggal piketnya (${selectedPicket?.attendance_date}).`
                          );
                          return;
                        }
                        const ok = await postAcara(
                          {
                            action: 'CONFIRM_EVENT_ATTENDANCE',
                            event_id: confirmForm.event_id,
                            teacher_id: confirmForm.teacher_id,
                            event_date: confirmForm.event_date,
                            picket_attendance_id: confirmForm.picket_attendance_id || null,
                            notes: confirmForm.notes.trim() || null,
                          },
                          'Kehadiran guru pada acara berhasil dikonfirmasi.'
                        );
                        if (ok) {
                          setConfirmForm((prev) => ({ ...prev, teacher_id: '', notes: '' }));
                          setConfirmPage(1);
                        }
                      }}
                      className="space-y-3"
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor="acara-konf-event-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Acara / Kegiatan Aktif <span className="text-rose-500">*</span>
                        </label>
                        <select
                          id="acara-konf-event-select"
                          required
                          value={confirmForm.event_id}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, event_id: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        >
                          <option value="">-- Pilih Acara / Kegiatan --</option>
                          {activeEvents.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.title} (
                              {ev.event_type === 'RUTIN_MINGGUAN'
                                ? `Rutin ${DAY_NAMES[ev.day_of_week || 1]}`
                                : `${ev.start_date} s.d. ${ev.end_date}`}{' '}
                              • {ev.jtm_allocated} JTM)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="acara-konf-teacher-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Guru yang Hadir <span className="text-rose-500">*</span>
                        </label>
                        <select
                          id="acara-konf-teacher-select"
                          required
                          value={confirmForm.teacher_id}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, teacher_id: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        >
                          <option value="">-- Pilih Guru yang Hadir --</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="acara-konf-date-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="acara-konf-date-input"
                          type="date"
                          required
                          value={confirmForm.event_date}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, event_date: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="acara-konf-picket-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Aktor Konfirmasi
                        </label>
                        <select
                          id="acara-konf-picket-select"
                          value={confirmForm.picket_attendance_id}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, picket_attendance_id: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        >
                          <option value="">
                            {canManageEvents
                              ? '-- Konfirmasi sebagai Admin (atau pilih Guru Piket) --'
                              : '-- Pilih Presensi Guru Piket Hari Ini --'}
                          </option>
                          {confirmedPickets.map((p) => (
                            <option key={p.id} value={p.id}>
                              Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                            </option>
                          ))}
                        </select>
                      </div>

                      {dateMismatchError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                          {dateMismatchError}
                        </div>
                      )}

                      {picketDateMismatch && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                          Tanggal Guru Piket (<strong>{selectedPicket?.attendance_date}</strong>)
                          berbeda dengan tanggal acara (<strong>{confirmForm.event_date}</strong>).
                        </div>
                      )}

                      <div className="space-y-1">
                        <label
                          htmlFor="acara-konf-notes-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Catatan Konfirmasi (Opsional)
                        </label>
                        <input
                          id="acara-konf-notes-input"
                          placeholder="Catatan konfirmasi (opsional)"
                          value={confirmForm.notes}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, notes: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={
                          submitting ||
                          Boolean(dateMismatchError) ||
                          picketDateMismatch ||
                          (!canManageEvents && !confirmForm.picket_attendance_id)
                        }
                        className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                      >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Konfirmasi Kehadiran Acara
                      </button>
                    </form>
                  </div>
                );
              })()}
            </div>
          )}

          <div
            className={`${
              (section === 'konfirmasi' && (canManageEvents || confirmedPickets.length > 0)) ||
              (section === 'kegiatan' && canManageEvents)
                ? 'lg:col-span-7'
                : 'lg:col-span-12'
            } space-y-5`}
          >
            {section === 'kegiatan' && (() => {
              const EVENT_PAGE_SIZE = 6;
              const filteredByType =
                eventFilter === 'ALL'
                  ? events
                  : eventFilter === 'INACTIVE'
                    ? events.filter((ev) => !ev.is_active)
                    : events.filter((ev) => ev.event_type === eventFilter);

              const query = eventSearch.trim().toLowerCase();
              const filteredEvents = query
                ? filteredByType.filter((ev) => {
                    const haystack = [
                      ev.title,
                      ev.description,
                      ev.location,
                      ev.start_date,
                      ev.end_date,
                      ev.day_of_week ? DAY_NAMES[ev.day_of_week] : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                      .toLowerCase();
                    return haystack.includes(query);
                  })
                : filteredByType;

              const totalEventPages = Math.max(
                1,
                Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE)
              );
              const safeEventPage = Math.min(eventPage, totalEventPages);
              const paginatedEvents = filteredEvents.slice(
                (safeEventPage - 1) * EVENT_PAGE_SIZE,
                safeEventPage * EVENT_PAGE_SIZE
              );

              return (
                <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col gap-2.5">
                    <h2 className="text-base font-bold text-slate-900">
                      Daftar Acara / Kegiatan ({filteredEvents.length})
                    </h2>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { id: 'ALL', label: `Semua (${events.length})` },
                            {
                              id: 'RUTIN_MINGGUAN',
                              label: `Rutin (${events.filter((e) => e.event_type === 'RUTIN_MINGGUAN').length})`,
                            },
                            {
                              id: 'INSIDENTAL',
                              label: `Insidental (${events.filter((e) => e.event_type === 'INSIDENTAL').length})`,
                            },
                            {
                              id: 'INACTIVE',
                              label: `Nonaktif (${events.filter((e) => !e.is_active).length})`,
                            },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setEventFilter(tab.id);
                              setEventPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                              eventFilter === tab.id
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-full sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={eventSearch}
                          onChange={(e) => {
                            setEventSearch(e.target.value);
                            setEventPage(1);
                          }}
                          placeholder="Cari acara, lokasi, hari..."
                          className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                        {eventSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setEventSearch('');
                              setEventPage(1);
                            }}
                            aria-label="Hapus pencarian acara"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {filteredEvents.length === 0 ? (
                    <AkademikEmptyState
                      icon={<CalendarDays className="w-6 h-6" />}
                      message={
                        events.length === 0
                          ? 'Belum ada acara/kegiatan yang terdaftar.'
                          : 'Tidak ada acara/kegiatan yang cocok dengan filter atau pencarian Anda.'
                      }
                    />
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {paginatedEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className={`modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                              !ev.is_active ? 'opacity-75' : ''
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-slate-900 break-words">
                                  {ev.title}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    ev.event_type === 'RUTIN_MINGGUAN'
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {ev.event_type === 'RUTIN_MINGGUAN'
                                    ? `Rutin: Setiap ${DAY_NAMES[ev.day_of_week || 1]}`
                                    : `Insidental: ${ev.start_date}${
                                        ev.end_date && ev.end_date !== ev.start_date
                                          ? ` s.d. ${ev.end_date}`
                                          : ''
                                      }`}
                                </span>
                                {!ev.is_active && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                                    Nonaktif
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 break-words">
                                {ev.start_time
                                  ? `${ev.start_time.slice(0, 5)}–${(ev.end_time || '').slice(0, 5)}`
                                  : 'Waktu fleksibel'}
                                {ev.location ? ` • ${ev.location}` : ''}
                              </p>
                              {ev.description && (
                                <p className="text-[11px] text-slate-600 line-clamp-2">
                                  {ev.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                +{ev.jtm_allocated} JTM
                              </span>
                              {canManageEvents && (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  title={
                                    ev.is_active
                                      ? 'Klik untuk menonaktifkan acara'
                                      : 'Klik untuk mengaktifkan acara'
                                  }
                                  onClick={() =>
                                    postAcara(
                                      {
                                        action: 'TOGGLE_EVENT',
                                        event_id: ev.id,
                                        is_active: !ev.is_active,
                                      },
                                      `Acara ${!ev.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`
                                    )
                                  }
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition cursor-pointer ${
                                    ev.is_active
                                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  }`}
                                >
                                  {ev.is_active ? 'Aktif' : 'Nonaktif'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {totalEventPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                          <span>
                            Halaman <strong>{safeEventPage}</strong> dari{' '}
                            <strong>{totalEventPages}</strong> ({filteredEvents.length} acara)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeEventPage <= 1}
                              onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={safeEventPage >= totalEventPages}
                              onClick={() =>
                                setEventPage((p) => Math.min(totalEventPages, p + 1))
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              Berikutnya
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {section === 'konfirmasi' && (() => {
              const CONFIRM_PAGE_SIZE = 8;
              const filteredByRole =
                confirmRoleFilter === 'ALL'
                  ? confirmations
                  : confirmations.filter((c) => c.confirmed_by_role === confirmRoleFilter);

              const query = confirmSearch.trim().toLowerCase();
              const filteredConfirmations = query
                ? filteredByRole.filter((c) => {
                    const haystack = [
                      c.teacher?.full_name,
                      c.event?.title,
                      c.event_date,
                      c.confirmed_by_role,
                    ]
                      .filter(Boolean)
                      .join(' ')
                      .toLowerCase();
                    return haystack.includes(query);
                  })
                : filteredByRole;

              const totalConfirmPages = Math.max(
                1,
                Math.ceil(filteredConfirmations.length / CONFIRM_PAGE_SIZE)
              );
              const safeConfirmPage = Math.min(confirmPage, totalConfirmPages);
              const paginatedConfirmations = filteredConfirmations.slice(
                (safeConfirmPage - 1) * CONFIRM_PAGE_SIZE,
                safeConfirmPage * CONFIRM_PAGE_SIZE
              );

              return (
                <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col gap-2.5">
                    <h2 className="text-base font-bold text-slate-900">
                      Riwayat Konfirmasi Kehadiran Acara ({filteredConfirmations.length})
                    </h2>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { id: 'ALL', label: `Semua (${confirmations.length})` },
                            {
                              id: 'ADMIN',
                              label: `Admin (${confirmations.filter((c) => c.confirmed_by_role === 'ADMIN').length})`,
                            },
                            {
                              id: 'GURU_PIKET',
                              label: `Guru Piket (${confirmations.filter((c) => c.confirmed_by_role === 'GURU_PIKET').length})`,
                            },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setConfirmRoleFilter(tab.id);
                              setConfirmPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                              confirmRoleFilter === tab.id
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-full sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={confirmSearch}
                          onChange={(e) => {
                            setConfirmSearch(e.target.value);
                            setConfirmPage(1);
                          }}
                          placeholder="Cari guru, acara, tanggal..."
                          className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                        {confirmSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmSearch('');
                              setConfirmPage(1);
                            }}
                            aria-label="Hapus pencarian konfirmasi"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {filteredConfirmations.length === 0 ? (
                    <AkademikEmptyState
                      icon={<UserCheck className="w-6 h-6" />}
                      message={
                        confirmations.length === 0
                          ? 'Belum ada konfirmasi kehadiran guru pada acara.'
                          : 'Tidak ada riwayat konfirmasi yang cocok dengan filter atau pencarian Anda.'
                      }
                    />
                  ) : (
                    <>
                      <div className="space-y-2">
                        {paginatedConfirmations.map((c) => (
                          <div
                            key={c.id}
                            className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="font-bold text-slate-900 break-words">
                                {c.teacher?.full_name || 'Guru'} • {c.event?.title || 'Acara'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Tanggal: {c.event_date} • Dikonfirmasi oleh{' '}
                                <span className="font-semibold text-slate-700">
                                  {c.confirmed_by_role === 'GURU_PIKET' ? 'Guru Piket' : 'Admin'}
                                </span>
                              </p>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shrink-0 self-start sm:self-center">
                              +{c.event?.jtm_allocated ?? 0} JTM
                            </span>
                          </div>
                        ))}
                      </div>

                      {totalConfirmPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                          <span>
                            Halaman <strong>{safeConfirmPage}</strong> dari{' '}
                            <strong>{totalConfirmPages}</strong> ({filteredConfirmations.length}{' '}
                            konfirmasi)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeConfirmPage <= 1}
                              onClick={() => setConfirmPage((p) => Math.max(1, p - 1))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={safeConfirmPage >= totalConfirmPages}
                              onClick={() =>
                                setConfirmPage((p) => Math.min(totalConfirmPages, p + 1))
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              Berikutnya
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Upacara Bendera Hari Senin (Pembina & Pengganti) */}
      {section === 'upacara' && (() => {
        const UPACARA_PAGE_SIZE = 8;
        const scheduledCeremonies = ceremonies.filter((c) => c.status === 'TERJADWAL');
        const completedCeremonies = ceremonies.filter((c) => c.status === 'TERLAKSANA');
        const totalJtmUpacara = completedCeremonies.reduce(
          (sum, c) => sum + (Number(c.jtm_allocated) || 0),
          0
        );

        const isCeremonyDateMonday = (() => {
          if (!ceremonyForm.ceremony_date) return true;
          const d = new Date(`${ceremonyForm.ceremony_date}T00:00:00Z`);
          return d.getUTCDay() === 1;
        })();

        const selectedCeremony = scheduledCeremonies.find(
          (c) => c.id === subCeremonyForm.ceremony_id
        );
        const selectedSubPicket = confirmedPickets.find(
          (p) => p.id === subCeremonyForm.picket_attendance_id
        );
        const isSameCeremonyTeacher =
          Boolean(selectedCeremony) &&
          selectedCeremony!.teacher_id === subCeremonyForm.substitute_teacher_id;
        const isSubPicketDateMismatch =
          Boolean(selectedCeremony) &&
          Boolean(selectedSubPicket) &&
          selectedSubPicket!.attendance_date !== selectedCeremony!.ceremony_date;

        const filteredByStatus =
          upacaraFilter === 'ALL'
            ? ceremonies
            : ceremonies.filter((c) => c.status === upacaraFilter);

        const query = upacaraSearch.trim().toLowerCase();
        const filteredCeremonies = query
          ? filteredByStatus.filter((c) => {
              const haystack = [
                c.ceremony_date,
                c.teacher?.full_name,
                c.original_teacher?.full_name,
                c.substitution_reason,
                c.status,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return haystack.includes(query);
            })
          : filteredByStatus;

        const totalUpacaraPages = Math.max(
          1,
          Math.ceil(filteredCeremonies.length / UPACARA_PAGE_SIZE)
        );
        const safeUpacaraPage = Math.min(upacaraPage, totalUpacaraPages);
        const paginatedCeremonies = filteredCeremonies.slice(
          (safeUpacaraPage - 1) * UPACARA_PAGE_SIZE,
          safeUpacaraPage * UPACARA_PAGE_SIZE
        );

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Total Jadwal</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {ceremonies.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Terjadwal</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {scheduledCeremonies.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Terlaksana</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                  {completedCeremonies.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Total JTM Terlaksana</p>
                <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
                  {totalJtmUpacara} <span className="text-xs font-semibold">JTM</span>
                </p>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">
                  Upacara Bendera Hari Senin — Pembina Upacara &amp; Pengganti ({ceremonies.length})
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Guru yang bertugas sebagai <strong>Pembina Upacara Bendera Hari Senin</strong>{' '}
                  (atau <strong>Pembina Pengganti</strong> yang ditunjuk Admin / Guru Piket
                  terkonfirmasi Admin) mendapatkan JTM setelah pelaksanaan upacara dikonfirmasi.
                </p>
              </div>

              <div className="grid lg:grid-cols-12 gap-6">
                {(canManageEvents || confirmedPickets.length > 0) && (
                  <div className="lg:col-span-5 space-y-4">
                    {canManageEvents && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!ceremonyForm.ceremony_date || !ceremonyForm.teacher_id) {
                            showToast('error', 'Pilih tanggal Senin dan guru pembina upacara.');
                            return;
                          }
                          if (!isCeremonyDateMonday) {
                            showToast('error', 'Jadwal Upacara Bendera harus pada hari Senin.');
                            return;
                          }
                          const safeJtm = Math.min(
                            12,
                            Math.max(
                              1,
                              Number.isFinite(ceremonyForm.jtm_allocated)
                                ? ceremonyForm.jtm_allocated
                                : 2
                            )
                          );
                          const ok = await postAcara(
                            {
                              action: 'CREATE_CEREMONY',
                              ceremony_date: ceremonyForm.ceremony_date,
                              teacher_id: ceremonyForm.teacher_id,
                              jtm_allocated: safeJtm,
                              notes: ceremonyForm.notes.trim() || null,
                            },
                            'Jadwal Pembina Upacara Hari Senin berhasil disimpan.'
                          );
                          if (ok) {
                            setCeremonyForm((prev) => ({
                              ...prev,
                              teacher_id: '',
                              jtm_allocated: 2,
                              notes: '',
                            }));
                            setUpacaraPage(1);
                          }
                        }}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                      >
                        <p className="text-xs font-bold text-slate-800">
                          Jadwalkan Pembina Upacara (Hari Senin)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label
                              htmlFor="upacara-date-input"
                              className="block text-[11px] font-semibold text-slate-700"
                            >
                              Tanggal (Hari Senin) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id="upacara-date-input"
                              type="date"
                              required
                              value={ceremonyForm.ceremony_date}
                              onChange={(e) =>
                                setCeremonyForm({ ...ceremonyForm, ceremony_date: e.target.value })
                              }
                              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <label
                              htmlFor="upacara-jtm-input"
                              className="block text-[11px] font-semibold text-slate-700"
                            >
                              Alokasi JTM (1–12)
                            </label>
                            <input
                              id="upacara-jtm-input"
                              type="number"
                              min={1}
                              max={12}
                              value={ceremonyForm.jtm_allocated}
                              onChange={(e) => {
                                const val = Number.parseInt(e.target.value, 10);
                                setCeremonyForm({
                                  ...ceremonyForm,
                                  jtm_allocated: Number.isFinite(val)
                                    ? Math.min(12, Math.max(1, val))
                                    : 1,
                                });
                              }}
                              placeholder="JTM"
                              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                            />
                          </div>
                        </div>

                        {!isCeremonyDateMonday && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                            Tanggal yang dipilih bukan hari Senin. Jadwal upacara wajib jatuh pada
                            hari Senin.
                          </div>
                        )}

                        <div className="space-y-1">
                          <label
                            htmlFor="upacara-teacher-select"
                            className="block text-[11px] font-semibold text-slate-700"
                          >
                            Guru Pembina Upacara <span className="text-rose-500">*</span>
                          </label>
                          <select
                            id="upacara-teacher-select"
                            required
                            value={ceremonyForm.teacher_id}
                            onChange={(e) =>
                              setCeremonyForm({ ...ceremonyForm, teacher_id: e.target.value })
                            }
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          >
                            <option value="">-- Pilih Guru Pembina Upacara --</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="upacara-notes-input"
                            className="block text-[11px] font-semibold text-slate-700"
                          >
                            Catatan (Opsional)
                          </label>
                          <input
                            id="upacara-notes-input"
                            placeholder="Catatan (opsional)"
                            value={ceremonyForm.notes}
                            onChange={(e) =>
                              setCeremonyForm({ ...ceremonyForm, notes: e.target.value })
                            }
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submitting || !isCeremonyDateMonday}
                          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                        >
                          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Simpan Jadwal Pembina Upacara
                        </button>
                      </form>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!subCeremonyForm.ceremony_id || !subCeremonyForm.substitute_teacher_id) {
                          showToast('error', 'Pilih jadwal upacara dan guru pembina pengganti.');
                          return;
                        }
                        if (!canManageEvents && !subCeremonyForm.picket_attendance_id) {
                          showToast(
                            'error',
                            'Pilih presensi Guru Piket terkonfirmasi Admin terlebih dahulu.'
                          );
                          return;
                        }
                        if (isSameCeremonyTeacher) {
                          showToast(
                            'error',
                            'Pembina pengganti tidak boleh sama dengan pembina saat ini.'
                          );
                          return;
                        }
                        if (isSubPicketDateMismatch) {
                          showToast(
                            'error',
                            `Guru Piket hanya dapat menunjuk pembina pengganti pada tanggal piketnya (${selectedCeremony?.ceremony_date}).`
                          );
                          return;
                        }
                        const ok = await postAcara(
                          {
                            action: 'SUBSTITUTE_CEREMONY_LEADER',
                            ceremony_id: subCeremonyForm.ceremony_id,
                            substitute_teacher_id: subCeremonyForm.substitute_teacher_id,
                            picket_attendance_id: subCeremonyForm.picket_attendance_id || null,
                            reason: subCeremonyForm.reason.trim() || null,
                          },
                          'Pembina Upacara Pengganti berhasil ditunjuk.'
                        );
                        if (ok) {
                          setSubCeremonyForm({
                            ceremony_id: '',
                            substitute_teacher_id: '',
                            picket_attendance_id: '',
                            reason: '',
                          });
                        }
                      }}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                    >
                      <p className="text-xs font-bold text-slate-800">
                        Tunjuk Pembina Upacara Pengganti (Admin / Guru Piket Terkonfirmasi)
                      </p>

                      <div className="space-y-1">
                        <label
                          htmlFor="upacara-sub-ceremony-select"
                          className="block text-[11px] font-semibold text-slate-700"
                        >
                          Jadwal Upacara Senin (Terjadwal){' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <select
                          id="upacara-sub-ceremony-select"
                          required
                          value={subCeremonyForm.ceremony_id}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const nextCer = scheduledCeremonies.find((c) => c.id === nextId);
                            setSubCeremonyForm({
                              ...subCeremonyForm,
                              ceremony_id: nextId,
                              substitute_teacher_id:
                                nextCer &&
                                nextCer.teacher_id === subCeremonyForm.substitute_teacher_id
                                  ? ''
                                  : subCeremonyForm.substitute_teacher_id,
                            });
                          }}
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="">-- Pilih Jadwal Upacara Senin (Terjadwal) --</option>
                          {scheduledCeremonies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.ceremony_date} • Pembina: {c.teacher?.full_name || 'Guru'} (
                              {c.jtm_allocated} JTM)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="upacara-sub-teacher-select"
                          className="block text-[11px] font-semibold text-slate-700"
                        >
                          Guru Pembina Pengganti <span className="text-rose-500">*</span>
                        </label>
                        <select
                          id="upacara-sub-teacher-select"
                          required
                          value={subCeremonyForm.substitute_teacher_id}
                          onChange={(e) =>
                            setSubCeremonyForm({
                              ...subCeremonyForm,
                              substitute_teacher_id: e.target.value,
                            })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="">-- Pilih Guru Pembina Pengganti --</option>
                          {teachers
                            .filter((t) => !selectedCeremony || t.id !== selectedCeremony.teacher_id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="upacara-sub-picket-select"
                          className="block text-[11px] font-semibold text-slate-700"
                        >
                          Aktor Penunjukkan
                        </label>
                        <select
                          id="upacara-sub-picket-select"
                          value={subCeremonyForm.picket_attendance_id}
                          onChange={(e) =>
                            setSubCeremonyForm({
                              ...subCeremonyForm,
                              picket_attendance_id: e.target.value,
                            })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="">
                            {canManageEvents
                              ? '-- Sebagai Admin (atau pilih Guru Piket Terkonfirmasi) --'
                              : '-- Pilih Presensi Guru Piket / Pengganti Terkonfirmasi Admin --'}
                          </option>
                          {confirmedPickets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {isSubPicketDateMismatch && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                          Tanggal Guru Piket (<strong>{selectedSubPicket?.attendance_date}</strong>)
                          berbeda dengan tanggal upacara (
                          <strong>{selectedCeremony?.ceremony_date}</strong>).
                        </div>
                      )}

                      <div className="space-y-1">
                        <label
                          htmlFor="upacara-sub-reason-input"
                          className="block text-[11px] font-semibold text-slate-700"
                        >
                          Alasan Penggantian (Opsional)
                        </label>
                        <input
                          id="upacara-sub-reason-input"
                          placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                          value={subCeremonyForm.reason}
                          onChange={(e) =>
                            setSubCeremonyForm({ ...subCeremonyForm, reason: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={
                          submitting ||
                          scheduledCeremonies.length === 0 ||
                          isSameCeremonyTeacher ||
                          isSubPicketDateMismatch ||
                          (!canManageEvents && !subCeremonyForm.picket_attendance_id)
                        }
                        className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                      >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Tunjuk Pembina Pengganti
                      </button>
                    </form>
                  </div>
                )}

                <div
                  className={`${
                    canManageEvents || confirmedPickets.length > 0
                      ? 'lg:col-span-7'
                      : 'lg:col-span-12'
                  } space-y-3 min-w-0`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'ALL', label: `Semua (${ceremonies.length})` },
                          { id: 'TERJADWAL', label: `Terjadwal (${scheduledCeremonies.length})` },
                          { id: 'TERLAKSANA', label: `Terlaksana (${completedCeremonies.length})` },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setUpacaraFilter(tab.id);
                            setUpacaraPage(1);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                            upacaraFilter === tab.id
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={upacaraSearch}
                        onChange={(e) => {
                          setUpacaraSearch(e.target.value);
                          setUpacaraPage(1);
                        }}
                        placeholder="Cari pembina, tanggal..."
                        className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                      {upacaraSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setUpacaraSearch('');
                            setUpacaraPage(1);
                          }}
                          aria-label="Hapus pencarian upacara"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredCeremonies.length === 0 ? (
                    <AkademikEmptyState
                      icon={<CalendarDays className="w-6 h-6" />}
                      message={
                        ceremonies.length === 0
                          ? 'Belum ada jadwal Pembina Upacara Bendera Hari Senin.'
                          : 'Tidak ada jadwal upacara yang cocok dengan filter atau pencarian Anda.'
                      }
                    />
                  ) : (
                    <>
                      <div className="space-y-2">
                        {paginatedCeremonies.map((c) => {
                          const matchingPicket = confirmedPickets.find(
                            (p) => p.attendance_date === c.ceremony_date
                          );
                          return (
                            <div
                              key={c.id}
                              className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <p className="font-bold text-slate-900 break-words">
                                  Senin, {c.ceremony_date} • {c.teacher?.full_name || 'Guru'}
                                  {c.original_teacher?.full_name && (
                                    <span className="font-normal text-slate-500">
                                      {' '}
                                      (menggantikan {c.original_teacher.full_name})
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 break-words">
                                  Status:{' '}
                                  <strong
                                    className={
                                      c.status === 'TERLAKSANA'
                                        ? 'text-emerald-700'
                                        : 'text-amber-700'
                                    }
                                  >
                                    {c.status}
                                  </strong>
                                  {c.substitution_reason
                                    ? ` • Alasan: ${c.substitution_reason}`
                                    : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full font-bold ${
                                    c.status === 'TERLAKSANA'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {c.status === 'TERLAKSANA'
                                    ? `+${c.jtm_allocated} JTM`
                                    : `0/${c.jtm_allocated} JTM`}
                                </span>
                                {c.status === 'TERJADWAL' && (canManageEvents || matchingPicket) && (
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() =>
                                      postAcara(
                                        {
                                          action: 'CONFIRM_CEREMONY',
                                          ceremony_id: c.id,
                                          picket_attendance_id: !canManageEvents
                                            ? matchingPicket?.id || null
                                            : null,
                                        },
                                        `Upacara ${c.ceremony_date} dikonfirmasi terlaksana (+${c.jtm_allocated} JTM).`
                                      )
                                    }
                                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold transition cursor-pointer"
                                  >
                                    Konfirmasi Terlaksana
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalUpacaraPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                          <span>
                            Halaman <strong>{safeUpacaraPage}</strong> dari{' '}
                            <strong>{totalUpacaraPages}</strong> ({filteredCeremonies.length} jadwal)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeUpacaraPage <= 1}
                              onClick={() => setUpacaraPage((p) => Math.max(1, p - 1))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={safeUpacaraPage >= totalUpacaraPages}
                              onClick={() =>
                                setUpacaraPage((p) => Math.min(totalUpacaraPages, p + 1))
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              Berikutnya
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
