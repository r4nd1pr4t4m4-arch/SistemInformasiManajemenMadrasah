'use client';

import { BookOpenCheck, RotateCcw, Search, UserCheck, Users, X } from 'lucide-react';
import {
  getMonthRange,
  type FilterOption,
  type GuruRecapStats,
  type RekapAbsensiSection,
  type StudentRecapStats,
} from './types';

interface RecapSummaryCardsProps {
  tab: RekapAbsensiSection;
  guruStats: GuruRecapStats;
  dailyStudentStats: StudentRecapStats;
  subjectStudentStats: StudentRecapStats;
}

export function RecapSummaryCards({
  tab,
  guruStats,
  dailyStudentStats,
  subjectStudentStats,
}: RecapSummaryCardsProps) {
  if (tab === 'guru') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Total Guru Tercatat</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {guruStats.totalTeachers}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Total Sesi Mengajar</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {guruStats.totalTeaching}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Akumulasi JTM</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {guruStats.totalJtm}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Rata-rata Kehadiran</p>
          <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
            {guruStats.avgPct != null ? `${guruStats.avgPct}%` : '-'}
          </p>
        </div>
      </div>
    );
  }

  const studentStats = tab === 'siswa-harian' ? dailyStudentStats : subjectStudentStats;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
      <div className="glass-card rounded-2xl p-3.5 sm:p-4">
        <p className="text-[11px] font-medium text-slate-500">
          {tab === 'siswa-harian' ? 'Total Siswa Tercatat' : 'Total Catatan Mapel'}
        </p>
        <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
          {studentStats.totalRows}
        </p>
      </div>
      <div className="glass-card rounded-2xl p-3.5 sm:p-4">
        <p className="text-[11px] font-medium text-slate-500">Total Kehadiran (H)</p>
        <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
          {studentStats.totalHadir}
        </p>
      </div>
      <div className="glass-card rounded-2xl p-3.5 sm:p-4">
        <p className="text-[11px] font-medium text-slate-500">Total S / I / A</p>
        <p className="text-lg sm:text-xl font-bold text-rose-700 mt-1 tabular-nums">
          {studentStats.totalAbsence}
        </p>
      </div>
      <div className="glass-card rounded-2xl p-3.5 sm:p-4">
        <p className="text-[11px] font-medium text-slate-500">Rata-rata Kehadiran</p>
        <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
          {studentStats.avgPct != null ? `${studentStats.avgPct}%` : '-'}
        </p>
      </div>
    </div>
  );
}

interface RecapFilterBarProps {
  tab: RekapAbsensiSection;
  monthValue: string;
  startDate: string;
  endDate: string;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  search: string;
  classrooms: FilterOption[];
  subjects: FilterOption[];
  teachers: FilterOption[];
  isInvalidRange: boolean;
  isMissingDate: boolean;
  hasCustomFilter: boolean;
  activeRowsCount: number;
  onMonthChange: (month: string, start: string, end: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClassroomChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onTeacherChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
}

export function RecapFilterBar({
  tab,
  monthValue,
  startDate,
  endDate,
  classroomId,
  subjectId,
  teacherId,
  search,
  classrooms,
  subjects,
  teachers,
  isInvalidRange,
  isMissingDate,
  hasCustomFilter,
  activeRowsCount,
  onMonthChange,
  onStartDateChange,
  onEndDateChange,
  onClassroomChange,
  onSubjectChange,
  onTeacherChange,
  onSearchChange,
  onResetFilters,
}: RecapFilterBarProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3.5 print:hidden">
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs ${
          tab === 'guru'
            ? 'lg:grid-cols-4'
            : tab === 'siswa-harian'
            ? 'lg:grid-cols-4'
            : 'lg:grid-cols-6'
        }`}
      >
        <div>
          <label htmlFor="rekap-month" className="block font-semibold text-slate-600 mb-1">
            Preset Bulan
          </label>
          <input
            id="rekap-month"
            type="month"
            value={monthValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                const range = getMonthRange(val);
                onMonthChange(val, range.start, range.end);
              } else {
                onMonthChange('', startDate, endDate);
              }
            }}
            className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="rekap-start" className="block font-semibold text-slate-600 mb-1">
            Tanggal Mulai
          </label>
          <input
            id="rekap-start"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="rekap-end" className="block font-semibold text-slate-600 mb-1">
            Tanggal Akhir
          </label>
          <input
            id="rekap-end"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        {tab !== 'guru' && (
          <div>
            <label htmlFor="rekap-class" className="block font-semibold text-slate-600 mb-1">
              Filter Kelas
            </label>
            <select
              id="rekap-class"
              value={classroomId}
              onChange={(e) => onClassroomChange(e.target.value)}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Semua Kelas</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tab === 'siswa-mapel' && (
          <div>
            <label htmlFor="rekap-subject" className="block font-semibold text-slate-600 mb-1">
              Filter Mapel
            </label>
            <select
              id="rekap-subject"
              value={subjectId}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tab !== 'siswa-harian' && (
          <div>
            <label htmlFor="rekap-teacher" className="block font-semibold text-slate-600 mb-1">
              Filter Guru
            </label>
            <select
              id="rekap-teacher"
              value={teacherId}
              onChange={(e) => onTeacherChange(e.target.value)}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Semua Guru</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(isInvalidRange || isMissingDate) && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          {isMissingDate
            ? 'Tanggal mulai dan tanggal akhir wajib diisi.'
            : 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir.'}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            {tab === 'guru' ? (
              <>
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Rekap Absensi Guru ({activeRowsCount})</span>
              </>
            ) : tab === 'siswa-harian' ? (
              <>
                <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Rekap Siswa Harian/Piket ({activeRowsCount})</span>
              </>
            ) : (
              <>
                <BookOpenCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Rekap Siswa per Mapel ({activeRowsCount})</span>
              </>
            )}
          </div>
          {hasCustomFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filter
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              tab === 'guru'
                ? 'Cari nama guru atau NIP...'
                : tab === 'siswa-harian'
                ? 'Cari nama, NIS, NISN, kelas...'
                : 'Cari nama, NIS, kelas, mapel...'
            }
            aria-label="Cari data rekap absensi"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
