'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AkademikEmptyState, AkademikModal } from '../akademik-ui';
import {
  DAY_NAMES,
  SCHEDULE_PAGE_SIZE,
  type ClassroomRow,
  type PostActionFn,
  type ScheduleRow,
  type ShowToastFn,
  type SubjectRow,
  type TeacherOpt,
} from './types';

interface JadwalSectionProps {
  canManage: boolean;
  canManageScheduleApi: boolean;
  homeroomClassroomIds: string[];
  refreshing: boolean;
  submitting: boolean;
  teachers: TeacherOpt[];
  classrooms: ClassroomRow[];
  subjects: SubjectRow[];
  schedules: ScheduleRow[];
  onRefresh: () => void;
  postAction: PostActionFn;
  showToast: ShowToastFn;
}

export function JadwalSection({
  canManage,
  canManageScheduleApi,
  homeroomClassroomIds,
  refreshing,
  submitting,
  teachers,
  classrooms,
  subjects,
  schedules,
  onRefresh,
  postAction,
  showToast,
}: JadwalSectionProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<ScheduleRow | null>(null);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [batchDeleteScheduleOpen, setBatchDeleteScheduleOpen] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleDayFilter, setScheduleDayFilter] = useState<string>('ALL');
  const [scheduleClassroomFilter, setScheduleClassroomFilter] = useState<string>('ALL');
  const [schedulePage, setSchedulePage] = useState(1);
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');
  const [scheduleForm, setScheduleForm] = useState({
    classroom_id: '',
    subject_id: '',
    teacher_id: '',
    day_of_week: 1,
    start_time: '07:30',
    end_time: '09:00',
    jtm_count: 2,
  });

  const canManageSchedule = canManage || canManageScheduleApi;
  const homeroomClassroomSet = useMemo(
    () => new Set(homeroomClassroomIds),
    [homeroomClassroomIds]
  );
  const manageableScheduleClassrooms = useMemo(
    () => (canManage ? classrooms : classrooms.filter((c) => homeroomClassroomSet.has(c.id))),
    [canManage, classrooms, homeroomClassroomSet]
  );
  const canManageScheduleRow = useCallback(
    (classroomId?: string | null) =>
      canManage ||
      (Boolean(classroomId) && canManageSchedule && homeroomClassroomSet.has(classroomId!)),
    [canManage, canManageSchedule, homeroomClassroomSet]
  );

  const selectedSchedulesList = useMemo(() => {
    if (selectedScheduleIds.length === 0) return [];
    const selectedSet = new Set(selectedScheduleIds);
    return schedules.filter((sch) => selectedSet.has(sch.id));
  }, [schedules, selectedScheduleIds]);

  const scheduleStats = useMemo(() => {
    let totalJtm = 0;
    const roomSet = new Set<string>();
    const teacherSet = new Set<string>();
    for (const sch of schedules) {
      totalJtm += Number(sch.jtm_count || 0);
      if (sch.classroom_id) roomSet.add(sch.classroom_id);
      if (sch.teacher_id) teacherSet.add(sch.teacher_id);
    }
    return {
      totalSessions: schedules.length,
      totalJtm,
      activeClassrooms: roomSet.size,
      activeTeachers: teacherSet.size,
    };
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    return schedules.filter((sch) => {
      if (scheduleDayFilter !== 'ALL' && String(sch.day_of_week) !== scheduleDayFilter) {
        return false;
      }
      if (scheduleClassroomFilter !== 'ALL' && sch.classroom_id !== scheduleClassroomFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (sch.classroom?.name || '').toLowerCase().includes(q) ||
        (sch.subject?.name || '').toLowerCase().includes(q) ||
        (sch.teacher?.full_name || '').toLowerCase().includes(q) ||
        (DAY_NAMES[sch.day_of_week] || '').toLowerCase().includes(q)
      );
    });
  }, [schedules, scheduleSearch, scheduleDayFilter, scheduleClassroomFilter]);

  const totalSchedulePages = Math.max(1, Math.ceil(filteredSchedules.length / SCHEDULE_PAGE_SIZE));
  const safeSchedulePage = Math.min(schedulePage, totalSchedulePages);
  const paginatedSchedules = useMemo(() => {
    const start = (safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE;
    return filteredSchedules.slice(start, start + SCHEDULE_PAGE_SIZE);
  }, [filteredSchedules, safeSchedulePage]);

  return (
    <div className="space-y-5">
      {/* Ringkasan Statistik Jadwal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Sesi Jadwal</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{scheduleStats.totalSessions}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Beban JTM</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">{scheduleStats.totalJtm}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Rombel Terjadwal</p>
          <p className="text-xl font-black text-sky-700 mt-0.5">{scheduleStats.activeClassrooms}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Guru Mengajar</p>
          <p className="text-xl font-black text-indigo-700 mt-0.5">
            {scheduleStats.activeTeachers}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Penyusunan Jadwal Pelajaran (JTM)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Susun jadwal mengajar per rombel, mata pelajaran, guru pengampu, dan alokasi JTM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
            {editingScheduleId && canManageSchedule && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Pencil className="w-3 h-3" /> Mode Edit Jadwal
              </span>
            )}
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {canManageSchedule && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (scheduleForm.end_time <= scheduleForm.start_time) {
                showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
                return;
              }
              const clampedJtm = Math.min(12, Math.max(1, Number(scheduleForm.jtm_count) || 1));
              const startHHMM = scheduleForm.start_time.slice(0, 5);
              const endHHMM = scheduleForm.end_time.slice(0, 5);

              // Deteksi bentrok jadwal pada rombel atau guru yang sama di hari & jam tumpang tindih
              const conflict = schedules.find((sch) => {
                if (sch.id === editingScheduleId) return false;
                if (sch.day_of_week !== scheduleForm.day_of_week) return false;
                const sStart = (sch.start_time || '').slice(0, 5);
                const sEnd = (sch.end_time || '').slice(0, 5);
                const overlaps = startHHMM < sEnd && endHHMM > sStart;
                if (!overlaps) return false;
                return (
                  sch.classroom_id === scheduleForm.classroom_id ||
                  sch.teacher_id === scheduleForm.teacher_id
                );
              });

              if (conflict) {
                const who =
                  conflict.classroom_id === scheduleForm.classroom_id
                    ? `Rombel ${conflict.classroom?.name || ''}`
                    : `Guru ${conflict.teacher?.full_name || ''}`;
                showToast(
                  'error',
                  `Bentrok jadwal: ${who} sudah memiliki jadwal pada hari ${
                    DAY_NAMES[conflict.day_of_week]
                  } (${(conflict.start_time || '').slice(0, 5)}–${(
                    conflict.end_time || ''
                  ).slice(0, 5)}).`
                );
                return;
              }

              if (editingScheduleId) {
                const ok = await postAction(
                  {
                    action: 'UPDATE_SCHEDULE',
                    id: editingScheduleId,
                    ...scheduleForm,
                    jtm_count: clampedJtm,
                  },
                  'Jadwal pelajaran berhasil diperbarui.'
                );
                if (ok) {
                  setEditingScheduleId(null);
                  setScheduleForm({
                    classroom_id: '',
                    subject_id: '',
                    teacher_id: '',
                    day_of_week: 1,
                    start_time: '07:30',
                    end_time: '09:00',
                    jtm_count: 2,
                  });
                }
              } else {
                const ok = await postAction(
                  {
                    action: 'CREATE_SCHEDULE',
                    ...scheduleForm,
                    jtm_count: clampedJtm,
                  },
                  'Jadwal pelajaran berhasil ditambahkan.'
                );
                if (ok) {
                  setSchedulePage(1);
                  setScheduleForm((prev) => ({
                    ...prev,
                    subject_id: '',
                  }));
                }
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 items-end"
          >
            <div className="lg:col-span-4">
              <label
                htmlFor="jadwal-classroom"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Rombel <span className="text-rose-600">*</span>
              </label>
              <select
                id="jadwal-classroom"
                required
                value={scheduleForm.classroom_id}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, classroom_id: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">-- Pilih Rombel --</option>
                {manageableScheduleClassrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4">
              <label
                htmlFor="jadwal-subject"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Mata Pelajaran <span className="text-rose-600">*</span>
              </label>
              <select
                id="jadwal-subject"
                required
                value={scheduleForm.subject_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, subject_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">-- Pilih Mapel --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4">
              <label
                htmlFor="jadwal-teacher"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Guru Pengampu <span className="text-rose-600">*</span>
              </label>
              <select
                id="jadwal-teacher"
                required
                value={scheduleForm.teacher_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, teacher_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">-- Pilih Guru Pengampu --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="jadwal-day"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Hari
              </label>
              <select
                id="jadwal-day"
                value={scheduleForm.day_of_week}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, day_of_week: Number(e.target.value) })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="jadwal-start"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Jam Mulai
              </label>
              <input
                id="jadwal-start"
                type="time"
                required
                value={scheduleForm.start_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="jadwal-end"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Jam Selesai
              </label>
              <input
                id="jadwal-end"
                type="time"
                required
                value={scheduleForm.end_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="jadwal-jtm"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                JTM (1–12)
              </label>
              <input
                id="jadwal-jtm"
                type="number"
                min={1}
                max={12}
                required
                value={scheduleForm.jtm_count}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    jtm_count: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2 text-xs transition"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingScheduleId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
              </button>
              {editingScheduleId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingScheduleId(null);
                    setScheduleForm({
                      classroom_id: '',
                      subject_id: '',
                      teacher_id: '',
                      day_of_week: 1,
                      start_time: '07:30',
                      end_time: '09:00',
                      jtm_count: 2,
                    });
                  }}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
                  title="Batal Edit"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        )}

        {/* Pencarian & Filter Jadwal */}
        {schedules.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={scheduleSearch}
                onChange={(e) => {
                  setScheduleSearch(e.target.value);
                  setSchedulePage(1);
                }}
                placeholder="Cari rombel, mapel, guru, atau hari..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {scheduleSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduleSearch('');
                    setSchedulePage(1);
                  }}
                  aria-label="Hapus pencarian jadwal"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
              <select
                aria-label="Filter hari jadwal"
                value={scheduleDayFilter}
                onChange={(e) => {
                  setScheduleDayFilter(e.target.value);
                  setSchedulePage(1);
                }}
                className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="ALL">Semua Hari</option>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={String(d)}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter rombel jadwal"
                value={scheduleClassroomFilter}
                onChange={(e) => {
                  setScheduleClassroomFilter(e.target.value);
                  setSchedulePage(1);
                }}
                className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="ALL">Semua Rombel</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="col-span-2 sm:col-span-1 inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('LIST')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                    viewMode === 'LIST'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daftar
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('GRID')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                    viewMode === 'GRID'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Timetable Grid
                </button>
              </div>
            </div>
          </div>
        )}

        {schedules.length === 0 ? (
          <AkademikEmptyState
            icon={<BookOpenCheck className="w-6 h-6" />}
            message="Belum ada jadwal pelajaran yang disusun."
          />
        ) : filteredSchedules.length === 0 ? (
          <AkademikEmptyState
            icon={<BookOpenCheck className="w-6 h-6" />}
            message="Tidak ada jadwal pelajaran yang sesuai dengan filter atau pencarian."
            compact
          />
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((dayNum) => {
              const dayItems = filteredSchedules
                .filter((s) => s.day_of_week === dayNum)
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
              return (
                <div
                  key={dayNum}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                      {DAY_NAMES[dayNum]}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                      {dayItems.length} sesi
                    </span>
                  </div>
                  {dayItems.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-3 text-center">
                      Tidak ada jadwal
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayItems.map((sch) => (
                        <div
                          key={sch.id}
                          className="rounded-xl bg-white border border-slate-200/80 p-2.5 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {(sch.start_time || '').slice(0, 5)}–{(sch.end_time || '').slice(0, 5)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {sch.jtm_count} JTM
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 leading-snug">
                            {sch.subject?.name || '-'}
                          </p>
                          <p className="text-[11px] text-slate-600 flex items-center justify-between gap-1">
                            <span className="font-semibold text-sky-700">
                              {sch.classroom?.name || '-'}
                            </span>
                            <span className="truncate">{sch.teacher?.full_name || '-'}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {canManageSchedule &&
              filteredSchedules.some((s) => canManageScheduleRow(s.classroom_id)) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50/90 border border-slate-200/80 px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        const manageableIds = filteredSchedules
                          .filter((s) => canManageScheduleRow(s.classroom_id))
                          .map((s) => s.id);
                        const selectedSet = new Set(selectedScheduleIds);
                        const allSelected =
                          manageableIds.length > 0 &&
                          manageableIds.every((id) => selectedSet.has(id));
                        if (allSelected) {
                          const manageableSet = new Set(manageableIds);
                          setSelectedScheduleIds((prev) =>
                            prev.filter((id) => !manageableSet.has(id))
                          );
                        } else {
                          setSelectedScheduleIds((prev) =>
                            Array.from(new Set([...prev, ...manageableIds]))
                          );
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 font-semibold text-slate-700 transition"
                    >
                      {(() => {
                        const manageableIds = filteredSchedules
                          .filter((s) => canManageScheduleRow(s.classroom_id))
                          .map((s) => s.id);
                        return manageableIds.length > 0 &&
                          manageableIds.every((id) => selectedScheduleIds.includes(id))
                          ? 'Batal Pilih Semua'
                          : `Pilih Semua (${manageableIds.length})`;
                      })()}
                    </button>
                    {selectedSchedulesList.length > 0 && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setSelectedScheduleIds([])}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 font-medium text-slate-600 transition"
                      >
                        Reset ({selectedSchedulesList.length})
                      </button>
                    )}
                  </div>
                  {selectedSchedulesList.length > 0 && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setBatchDeleteScheduleOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Terpilih ({selectedSchedulesList.length})</span>
                    </button>
                  )}
                </div>
              )}

            <div className="space-y-2">
              {paginatedSchedules.map((sch) => {
                const isEditingThis = editingScheduleId === sch.id;
                const isSelected = selectedScheduleIds.includes(sch.id);
                const canEditThisRow = canManageScheduleRow(sch.classroom_id);
                return (
                  <div
                    key={sch.id}
                    className={`modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs border transition ${
                      isEditingThis
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : isSelected
                        ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/30'
                        : 'border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      {canEditThisRow && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={submitting}
                          onChange={() =>
                            setSelectedScheduleIds((prev) =>
                              prev.includes(sch.id)
                                ? prev.filter((id) => id !== sch.id)
                                : [...prev, sch.id]
                            )
                          }
                          aria-label={`Pilih jadwal ${sch.classroom?.name || ''} ${sch.subject?.name || ''}`}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {DAY_NAMES[sch.day_of_week] || '-'}
                          </span>
                          <p className="font-bold text-slate-900 break-words">
                            {sch.classroom?.name || '-'} — {sch.subject?.name || '-'}
                          </p>
                        </div>
                        <p className="text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="break-words">{sch.teacher?.full_name || '-'}</span>
                          <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {(sch.start_time || '').slice(0, 5)}–
                            {(sch.end_time || '').slice(0, 5)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                        {sch.jtm_count} JTM
                      </span>
                      {canEditThisRow && (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              setEditingScheduleId(sch.id);
                              setScheduleForm({
                                classroom_id: sch.classroom_id || '',
                                subject_id: sch.subject_id || '',
                                teacher_id: sch.teacher_id || '',
                                day_of_week: sch.day_of_week || 1,
                                start_time: (sch.start_time || '07:30').slice(0, 5),
                                end_time: (sch.end_time || '09:00').slice(0, 5),
                                jtm_count: sch.jtm_count || 2,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 disabled:opacity-40 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setDeleteScheduleTarget(sch)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 font-semibold text-[11px] transition"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Menampilkan{' '}
                <strong className="text-slate-800">
                  {(safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE + 1}–
                  {Math.min(safeSchedulePage * SCHEDULE_PAGE_SIZE, filteredSchedules.length)}
                </strong>{' '}
                dari <strong className="text-slate-800">{filteredSchedules.length}</strong> jadwal
              </span>
              {totalSchedulePages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeSchedulePage <= 1}
                    onClick={() => setSchedulePage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                  </button>
                  <span className="px-2 font-semibold text-slate-700">
                    {safeSchedulePage} / {totalSchedulePages}
                  </span>
                  <button
                    type="button"
                    disabled={safeSchedulePage >= totalSchedulePages}
                    onClick={() => setSchedulePage((p) => Math.min(totalSchedulePages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                  >
                    Berikutnya <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Jadwal Pelajaran */}
      <AkademikModal
        open={Boolean(deleteScheduleTarget)}
        onClose={() => {
          if (!submitting) setDeleteScheduleTarget(null);
        }}
        title="Konfirmasi Hapus Jadwal Pelajaran"
      >
        {deleteScheduleTarget && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-slate-600 leading-relaxed">
                Anda yakin ingin menghapus sesi jadwal pelajaran berikut?
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Hari &amp; Jam</span>
                <span className="font-bold text-slate-900">
                  {DAY_NAMES[deleteScheduleTarget.day_of_week] || '-'} (
                  {(deleteScheduleTarget.start_time || '').slice(0, 5)}–
                  {(deleteScheduleTarget.end_time || '').slice(0, 5)})
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Rombel / Mapel</span>
                <span className="font-bold text-slate-900 text-right break-words">
                  {deleteScheduleTarget.classroom?.name || '-'} —{' '}
                  {deleteScheduleTarget.subject?.name || '-'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                <span className="text-slate-500 shrink-0">Guru Pengampu</span>
                <span className="font-semibold text-emerald-700 text-right break-words">
                  {deleteScheduleTarget.teacher?.full_name || '-'} ({deleteScheduleTarget.jtm_count}{' '}
                  JTM)
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-amber-900 leading-relaxed">
              <strong>Catatan:</strong> Jadwal yang sudah terhubung dengan data presensi atau jurnal
              pembelajaran tidak dapat dihapus untuk menjaga integritas riwayat JTM.
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteScheduleTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  if (submitting) return;
                  const ok = await postAction(
                    { action: 'DELETE_SCHEDULE', id: deleteScheduleTarget.id },
                    'Jadwal pelajaran berhasil dihapus.'
                  );
                  if (ok) {
                    if (editingScheduleId === deleteScheduleTarget.id) {
                      setEditingScheduleId(null);
                      setScheduleForm({
                        classroom_id: '',
                        subject_id: '',
                        teacher_id: '',
                        day_of_week: 1,
                        start_time: '07:30',
                        end_time: '09:00',
                        jtm_count: 2,
                      });
                    }
                    setSelectedScheduleIds((prev) =>
                      prev.filter((id) => id !== deleteScheduleTarget.id)
                    );
                    setDeleteScheduleTarget(null);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{submitting ? 'Menghapus...' : 'Ya, Hapus Jadwal'}</span>
              </button>
            </div>
          </div>
        )}
      </AkademikModal>

      {/* Modal Konfirmasi Hapus Batch Jadwal Pelajaran */}
      <AkademikModal
        open={batchDeleteScheduleOpen && selectedSchedulesList.length > 0}
        onClose={() => {
          if (!submitting) setBatchDeleteScheduleOpen(false);
        }}
        title={`Konfirmasi Hapus ${selectedSchedulesList.length} Jadwal Pelajaran`}
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                Hapus {selectedSchedulesList.length} sesi jadwal pelajaran terpilih?
              </p>
              <p className="text-slate-600 leading-relaxed">
                Seluruh jadwal yang dipilih akan dihapus permanen. Jika ada jadwal yang sudah
                terhubung dengan data presensi atau jurnal, penghapusan batch akan dibatalkan.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 max-h-52 overflow-y-auto space-y-2">
            {selectedSchedulesList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {DAY_NAMES[item.day_of_week] || '-'} · {item.classroom?.name || '-'} —{' '}
                    {item.subject?.name || '-'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {item.teacher?.full_name || '-'} · {(item.start_time || '').slice(0, 5)}–
                    {(item.end_time || '').slice(0, 5)}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                  {item.jtm_count} JTM
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setBatchDeleteScheduleOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                if (submitting || selectedSchedulesList.length === 0) return;
                const ids = selectedSchedulesList.map((s) => s.id);
                const ok = await postAction(
                  { action: 'DELETE_SCHEDULES_BATCH', ids },
                  `${ids.length} jadwal pelajaran berhasil dihapus.`
                );
                if (ok) {
                  if (editingScheduleId && ids.includes(editingScheduleId)) {
                    setEditingScheduleId(null);
                    setScheduleForm({
                      classroom_id: '',
                      subject_id: '',
                      teacher_id: '',
                      day_of_week: 1,
                      start_time: '07:30',
                      end_time: '09:00',
                      jtm_count: 2,
                    });
                  }
                  setSelectedScheduleIds([]);
                  setBatchDeleteScheduleOpen(false);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>
                {submitting ? 'Menghapus...' : `Ya, Hapus ${selectedSchedulesList.length} Jadwal`}
              </span>
            </button>
          </div>
        </div>
      </AkademikModal>
    </div>
  );
}
