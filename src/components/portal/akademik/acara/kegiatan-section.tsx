'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PlusCircle,
  Search,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { AkademikEmptyState } from '../akademik-ui';
import {
  DAY_NAMES,
  type PostAcaraFn,
  type SchoolEvent,
  type ShowToastFn,
} from './types';

interface KegiatanSectionProps {
  events: SchoolEvent[];
  canManageEvents: boolean;
  submitting: boolean;
  postAcara: PostAcaraFn;
  showToast: ShowToastFn;
}

const EVENT_PAGE_SIZE = 6;

export function KegiatanSection({
  events,
  canManageEvents,
  submitting,
  postAcara,
  showToast,
}: KegiatanSectionProps) {
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

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE));
  const safeEventPage = Math.min(eventPage, totalEventPages);
  const paginatedEvents = filteredEvents.slice(
    (safeEventPage - 1) * EVENT_PAGE_SIZE,
    safeEventPage * EVENT_PAGE_SIZE
  );

  return (
    <>
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

      <div className="grid lg:grid-cols-12 gap-6">
        {canManageEvents && (
          <div className="lg:col-span-5 space-y-5">
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
                        eventForm.event_type === 'RUTIN_MINGGUAN' ? eventForm.day_of_week : null,
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
                        onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
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
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
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
          </div>
        )}

        <div className={`${canManageEvents ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5`}>
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
                          <span className="font-bold text-slate-900 break-words">{ev.title}</span>
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
                        onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
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
    </>
  );
}
