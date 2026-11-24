'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DAY_NAMES,
  PersonalEmptyState,
  formatTimeShort,
  parseTimeToMinutes,
  type PersonalPayload,
  type PersonalScope,
} from './types';

export function JadwalPelajaranSection({
  data,
  scope,
  todayDay,
  nowMinutes,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
  todayDay: number;
  nowMinutes: number | null;
}) {
  const [scheduleDayFilter, setScheduleDayFilter] = useState<'ALL' | 'TODAY' | number>('ALL');
  const [scheduleSearch, setScheduleSearch] = useState('');

  const hasSunday = data.schedules.some((s) => s.day_of_week === 7);
  const activeDayNumbers = hasSunday ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];

  const q = scheduleSearch.trim().toLowerCase();
  const matchingSchedules = data.schedules.filter((s) => {
    if (!q) return true;
    const haystack = `${s.subject?.name || ''} ${s.subject?.code || ''} ${
      s.teacher?.full_name || ''
    } ${s.classroom?.name || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  const effectiveDayFilter =
    scheduleDayFilter === 'TODAY' && !activeDayNumbers.includes(todayDay)
      ? 'ALL'
      : scheduleDayFilter;

  const visibleDays =
    effectiveDayFilter === 'TODAY'
      ? [todayDay]
      : typeof effectiveDayFilter === 'number'
        ? [effectiveDayFilter]
        : activeDayNumbers;

  const displayedSchedules = matchingSchedules.filter((s) =>
    visibleDays.includes(s.day_of_week)
  );
  const displayedJtm = displayedSchedules.reduce(
    (acc, s) => acc + (Number(s.jtm_count) || 0),
    0
  );
  const totalWeeklyJtm = data.schedules.reduce(
    (acc, s) => acc + (Number(s.jtm_count) || 0),
    0
  );

  const todaySchedules = data.schedules
    .filter((s) => s.day_of_week === todayDay)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const todayJtm = todaySchedules.reduce(
    (acc, s) => acc + (Number(s.jtm_count) || 0),
    0
  );

  const ongoingToday =
    nowMinutes !== null
      ? todaySchedules.find((s) => {
          const start = parseTimeToMinutes(s.start_time);
          const end = parseTimeToMinutes(s.end_time);
          return start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
        })
      : undefined;

  const nextToday =
    nowMinutes !== null && !ongoingToday
      ? todaySchedules.find((s) => {
          const start = parseTimeToMinutes(s.start_time);
          return start !== null && start > nowMinutes;
        })
      : undefined;

  const emptyTitle =
    scope === 'orang-tua' && !data.student
      ? 'Belum ada data putra/putri terhubung'
      : scope === 'orang-tua' && !data.classroom
        ? 'Rombel kelas anak belum ditetapkan'
        : scope === 'gtk' && !data.teacher
          ? 'Akun belum tertaut ke data GTK'
          : 'Belum ada jadwal tersedia';

  const emptyDescription =
    scope === 'orang-tua' && !data.student
      ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
      : scope === 'orang-tua' && !data.classroom
        ? 'Putra/putri Anda belum ditempatkan pada rombongan belajar aktif pada tahun ajaran ini.'
        : scope === 'gtk' && !data.teacher
          ? 'Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha.'
          : scope === 'gtk'
            ? 'Jadwal mengajar Anda belum ditetapkan oleh bagian kurikulum.'
            : 'Jadwal pelajaran kelas belum tersedia atau Anda belum ditempatkan di rombel aktif.';

  return (
    <div className="space-y-4">
      {data.schedules.length === 0 ? (
        <PersonalEmptyState
          icon={<CalendarDays className="w-8 h-8 text-slate-300" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <>
          {/* Ringkasan Jadwal Sepekan & Hari Ini */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Total Sepekan
                </p>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {data.schedules.length} Sesi{' '}
                  <span className="text-xs font-bold text-slate-500">
                    • {totalWeeklyJtm} JTM
                  </span>
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Hari Ini ({DAY_NAMES[todayDay] || 'Hari Ini'})
                </p>
                <p className="text-lg font-black text-emerald-950 mt-0.5">
                  {todaySchedules.length > 0 ? (
                    <>
                      {todaySchedules.length} Sesi{' '}
                      <span className="text-xs font-bold text-emerald-700">
                        • {todayJtm} JTM
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-emerald-800">
                      Tidak ada jadwal
                    </span>
                  )}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {ongoingToday
                    ? 'Sedang Berlangsung'
                    : nextToday
                      ? 'Sesi Berikutnya'
                      : 'Status Hari Ini'}
                </p>
                {ongoingToday ? (
                  <p className="text-xs font-bold text-emerald-700 mt-0.5 truncate">
                    {ongoingToday.subject?.name || 'Mapel'}
                    {scope === 'gtk' && ongoingToday.classroom?.name
                      ? ` • ${ongoingToday.classroom.name}`
                      : ''}{' '}
                    ({formatTimeShort(ongoingToday.start_time)}–
                    {formatTimeShort(ongoingToday.end_time)})
                  </p>
                ) : nextToday ? (
                  <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                    {nextToday.subject?.name || 'Mapel'}
                    {scope === 'gtk' && nextToday.classroom?.name
                      ? ` • ${nextToday.classroom.name}`
                      : ''}{' '}
                    ({formatTimeShort(nextToday.start_time)})
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {todaySchedules.length > 0
                      ? 'Seluruh sesi hari ini selesai'
                      : 'Hari libur / di luar jam KBM'}
                  </p>
                )}
              </div>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  ongoingToday
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Filter Hari & Pencarian */}
          <div className="glass-card rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1">
              <button
                type="button"
                aria-pressed={effectiveDayFilter === 'ALL'}
                onClick={() => setScheduleDayFilter('ALL')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                  effectiveDayFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semua Hari
              </button>
              {activeDayNumbers.includes(todayDay) && (
                <button
                  type="button"
                  aria-pressed={effectiveDayFilter === 'TODAY'}
                  onClick={() => setScheduleDayFilter('TODAY')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                    effectiveDayFilter === 'TODAY'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70'
                  }`}
                >
                  Hari Ini ({DAY_NAMES[todayDay]})
                </button>
              )}
              {activeDayNumbers.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={effectiveDayFilter === d}
                  onClick={() => setScheduleDayFilter(d)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                    effectiveDayFilter === d
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {DAY_NAMES[d]}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <span className="inline-flex items-center justify-center text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl shrink-0">
                {displayedSchedules.length} Sesi • {displayedJtm} JTM
              </span>
              <div className="relative min-w-0 sm:w-64">
                <label htmlFor="schedule-search-input" className="sr-only">
                  {scope === 'gtk'
                    ? 'Cari mata pelajaran atau kelas'
                    : 'Cari mata pelajaran atau guru'}
                </label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="schedule-search-input"
                  type="text"
                  value={scheduleSearch}
                  onChange={(e) => setScheduleSearch(e.target.value)}
                  placeholder={
                    scope === 'gtk' ? 'Cari mapel atau kelas...' : 'Cari mapel atau guru...'
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {scheduleSearch && (
                  <button
                    type="button"
                    onClick={() => setScheduleSearch('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {displayedSchedules.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                {scheduleSearch.trim()
                  ? `Tidak ada jadwal yang cocok dengan pencarian "${scheduleSearch.trim()}"${
                      effectiveDayFilter !== 'ALL' ? ' pada hari terpilih' : ''
                    }.`
                  : 'Tidak ada jadwal pelajaran pada hari yang dipilih.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {effectiveDayFilter !== 'ALL' && matchingSchedules.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScheduleDayFilter('ALL')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    Lihat di Semua Hari ({matchingSchedules.length})
                  </button>
                )}
                {(scheduleSearch || effectiveDayFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleSearch('');
                      setScheduleDayFilter('ALL');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                visibleDays.length === 1
                  ? 'grid-cols-1'
                  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
              }`}
            >
              {visibleDays.map((day) => {
                const dayItems = matchingSchedules
                  .filter((s) => s.day_of_week === day)
                  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                const dayTotalJtm = dayItems.reduce(
                  (acc, s) => acc + (Number(s.jtm_count) || 0),
                  0
                );
                const isToday = day === todayDay;
                return (
                  <div
                    key={day}
                    className={`rounded-3xl border p-4 sm:p-5 transition min-w-0 ${
                      isToday
                        ? 'border-emerald-400 bg-emerald-50/40 shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarDays
                          className={`w-4 h-4 shrink-0 ${
                            isToday ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
                        <h3 className="font-bold text-slate-900 text-sm">
                          {DAY_NAMES[day] || `Hari ${day}`}
                        </h3>
                        {dayItems.length > 0 && (
                          <span className="text-[11px] font-medium text-slate-500">
                            ({dayItems.length} sesi • {dayTotalJtm} JTM)
                          </span>
                        )}
                      </div>
                      {isToday && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                          HARI INI
                        </span>
                      )}
                    </div>
                    {dayItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-6 text-center">
                        Tidak ada jadwal
                      </p>
                    ) : (
                      <div
                        className={
                          visibleDays.length === 1
                            ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
                            : 'space-y-2.5'
                        }
                      >
                        {dayItems.map((item) => {
                          const startMin = parseTimeToMinutes(item.start_time);
                          const endMin = parseTimeToMinutes(item.end_time);
                          const isOngoing =
                            isToday &&
                            nowMinutes !== null &&
                            startMin !== null &&
                            endMin !== null &&
                            nowMinutes >= startMin &&
                            nowMinutes < endMin;

                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl border p-3.5 space-y-1.5 min-w-0 transition ${
                                isOngoing
                                  ? 'border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-300'
                                  : 'border-slate-100 bg-slate-50/70 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  {formatTimeShort(item.start_time)} –{' '}
                                  {formatTimeShort(item.end_time)}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isOngoing && (
                                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                      BERLANGSUNG
                                    </span>
                                  )}
                                  <span className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">
                                    {item.jtm_count || 0} JTM
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs sm:text-[13px] font-bold text-slate-900 break-words leading-snug">
                                  {item.subject?.name || 'Mata Pelajaran'}
                                </p>
                                {item.subject?.code && (
                                  <span className="text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                                    {item.subject.code}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 break-words">
                                {scope === 'gtk'
                                  ? `Kelas: ${item.classroom?.name || '-'}`
                                  : `Guru: ${item.teacher?.full_name || '-'}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function JadwalPiketSection({
  data,
  scope,
  todayDay,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
  todayDay: number;
}) {
  const [picketFilter, setPicketFilter] = useState<'ALL' | 'MY_DAYS' | 'TODAY'>('ALL');

  const myPicketDays = useMemo(() => {
    if (scope === 'gtk') {
      return Array.from(new Set(data.pickets.map((p) => p.day_of_week))).sort((a, b) => a - b);
    }
    if (!data.student?.id) return [];
    return Array.from(
      new Set(
        data.pickets
          .filter((p) => p.student_id === data.student?.id)
          .map((p) => p.day_of_week)
      )
    ).sort((a, b) => a - b);
  }, [data, scope]);

  const hasSundayPicket = data.pickets.some((p) => p.day_of_week === 7);
  const activePicketDays = hasSundayPicket
    ? [1, 2, 3, 4, 5, 6, 7]
    : [1, 2, 3, 4, 5, 6];

  const effectivePicketFilter =
    (picketFilter === 'MY_DAYS' && myPicketDays.length === 0) ||
    (picketFilter === 'TODAY' && !activePicketDays.includes(todayDay))
      ? 'ALL'
      : picketFilter;

  const picketDaysToRender =
    effectivePicketFilter === 'TODAY'
      ? [todayDay]
      : effectivePicketFilter === 'MY_DAYS'
        ? myPicketDays.filter((d) => activePicketDays.includes(d))
        : activePicketDays;

  const emptyPicketTitle =
    scope === 'orang-tua' && !data.student
      ? 'Belum ada data putra/putri terhubung'
      : scope === 'orang-tua' && !data.classroom
        ? 'Rombel kelas anak belum ditetapkan'
        : 'Jadwal piket kelas belum tersedia';

  const emptyPicketDescription =
    scope === 'orang-tua' && !data.student
      ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
      : scope === 'orang-tua' && !data.classroom
        ? 'Putra/putri Anda belum ditempatkan pada rombongan belajar aktif pada tahun ajaran ini.'
        : scope === 'orang-tua'
          ? 'Wali kelas belum menambahkan jadwal piket untuk kelas putra/putri Anda.'
          : 'Wali kelas belum menambahkan jadwal piket untuk kelas Anda.';

  if (scope !== 'gtk' && data.pickets.length === 0) {
    return (
      <PersonalEmptyState
        icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
        title={emptyPicketTitle}
        description={emptyPicketDescription}
      />
    );
  }

  if (scope === 'gtk' && data.pickets.length === 0) {
    return (
      <PersonalEmptyState
        icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
        title={
          !data.teacher ? 'Akun belum tertaut ke data GTK' : 'Belum ada jadwal piket guru'
        }
        description={
          !data.teacher
            ? 'Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha.'
            : 'Jadwal piket guru/petugas piket Anda belum ditetapkan.'
        }
      />
    );
  }

  const isMyPicketToday = myPicketDays.includes(todayDay);
  const sortedGtkPickets =
    scope === 'gtk'
      ? [...data.pickets].sort((a, b) => (a.day_of_week || 0) - (b.day_of_week || 0))
      : [];

  return (
    <div className="space-y-4">
      {/* Banner penanda khusus hari piketnya */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
          isMyPicketToday
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isMyPicketToday
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
              {scope === 'orang-tua'
                ? 'Jadwal Piket Putra/Putri Anda'
                : 'Jadwal Piket Anda'}
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5 break-words">
              {myPicketDays.length > 0
                ? `Hari ${myPicketDays.map((d) => DAY_NAMES[d] || `Hari ${d}`).join(', ')}`
                : 'Belum ada hari piket yang ditetapkan'}
            </p>
            {isMyPicketToday && (
              <p className="text-xs font-semibold text-amber-800 mt-1 leading-relaxed">
                Hari ini ({DAY_NAMES[todayDay]}) adalah jadwal piket! Pastikan
                melaksanakan tugas piket tepat waktu.
              </p>
            )}
          </div>
        </div>

        {scope !== 'gtk' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
            <button
              type="button"
              aria-pressed={effectivePicketFilter === 'ALL'}
              onClick={() => setPicketFilter('ALL')}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                effectivePicketFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/85 hover:bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Semua Hari
            </button>
            {myPicketDays.length > 0 && (
              <button
                type="button"
                aria-pressed={effectivePicketFilter === 'MY_DAYS'}
                onClick={() => setPicketFilter('MY_DAYS')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                  effectivePicketFilter === 'MY_DAYS'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white/85 hover:bg-white text-amber-800 border border-amber-200'
                }`}
              >
                {scope === 'orang-tua' ? 'Piket Anak' : 'Piket Saya'} ({myPicketDays.length})
              </button>
            )}
            {activePicketDays.includes(todayDay) && (
              <button
                type="button"
                aria-pressed={effectivePicketFilter === 'TODAY'}
                onClick={() => setPicketFilter('TODAY')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                  effectivePicketFilter === 'TODAY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white/85 hover:bg-white text-emerald-800 border border-emerald-200'
                }`}
              >
                Hari Ini ({DAY_NAMES[todayDay]})
              </button>
            )}
          </div>
        )}
      </div>

      {scope === 'gtk' ? (
        <div
          className={`grid gap-4 ${
            sortedGtkPickets.length === 1
              ? 'grid-cols-1 max-w-xl'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {sortedGtkPickets.map((p) => {
            const isToday = p.day_of_week === todayDay;
            return (
              <div
                key={p.id}
                className={`rounded-3xl border p-4 sm:p-5 min-w-0 transition ${
                  isToday
                    ? 'border-amber-400 bg-amber-50/70 ring-1 ring-amber-300/60 shadow-sm'
                    : 'border-emerald-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-900">
                    {DAY_NAMES[p.day_of_week] || `Hari ${p.day_of_week}`}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold shrink-0 ${
                      isToday ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                  >
                    {isToday ? 'PIKET HARI INI' : 'TUGAS PIKET'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 break-words leading-relaxed">
                  {p.notes || 'Piket harian madrasah / pemantauan gerbang & KBM.'}
                </p>
                {p.academic_year?.name && (
                  <p className="text-[11px] font-medium text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
                    Tahun Ajaran: {p.academic_year.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            picketDaysToRender.length === 1
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {picketDaysToRender.map((day) => {
            const dayPickets = data.pickets
              .filter((p) => p.day_of_week === day)
              .sort((a, b) => {
                const aSelf = Boolean(data.student?.id && a.student_id === data.student.id);
                const bSelf = Boolean(data.student?.id && b.student_id === data.student.id);
                if (aSelf !== bSelf) return aSelf ? -1 : 1;
                return (a.student?.full_name || '').localeCompare(
                  b.student?.full_name || ''
                );
              });
            const isMyDay = myPicketDays.includes(day);
            const isToday = day === todayDay;
            return (
              <div
                key={day}
                className={`rounded-3xl border p-4 sm:p-5 transition min-w-0 ${
                  isMyDay
                    ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-300/60 shadow-sm'
                    : isToday
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm">
                      {DAY_NAMES[day] || `Hari ${day}`}
                    </h3>
                    <span className="text-[11px] font-medium text-slate-500">
                      ({dayPickets.length} petugas)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-bold">
                        HARI INI
                      </span>
                    )}
                    {isMyDay && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                        <Sparkles className="w-3 h-3" />
                        {scope === 'orang-tua' ? 'PIKET ANAK' : 'PIKET SAYA'}
                      </span>
                    )}
                  </div>
                </div>

                {dayPickets.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center">
                    Belum ada petugas
                  </p>
                ) : (
                  <ul
                    className={
                      picketDaysToRender.length === 1
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
                        : 'space-y-2'
                    }
                  >
                    {dayPickets.map((p) => {
                      const isSelf = Boolean(
                        data.student?.id && p.student_id === data.student.id
                      );
                      return (
                        <li
                          key={p.id}
                          className={`rounded-2xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 min-w-0 ${
                            isSelf
                              ? 'bg-amber-100 border border-amber-300 font-bold text-amber-950'
                              : 'bg-slate-50 border border-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="break-words leading-snug">
                              {p.student?.full_name || 'Siswa'}
                            </p>
                            {p.task_notes && (
                              <p className="text-[11px] text-slate-500 font-normal break-words mt-0.5">
                                Tugas: {p.task_notes}
                              </p>
                            )}
                          </div>
                          {isSelf && (
                            <span className="text-[10px] font-black text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-300 shrink-0">
                              ★ {scope === 'orang-tua' ? 'Anak' : 'Anda'}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
