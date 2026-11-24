'use client';

import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserCheck,
  Users,
} from 'lucide-react';
import { AkademikEmptyState } from '../akademik-ui';
import {
  PAGE_SIZE,
  type DailyStudentRecapRow,
  type RekapAbsensiSection,
  type SubjectStudentRecapRow,
  type TeacherRecapRow,
} from './types';

interface RecapTablesProps {
  tab: RekapAbsensiSection;
  loading: boolean;
  pagedGuru: TeacherRecapRow[];
  pagedDailyStudent: DailyStudentRecapRow[];
  pagedSubjectStudent: SubjectStudentRecapRow[];
  activeRowsCount: number;
  currentPage: number;
  totalPages: number;
  pageStart: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function RecapTables({
  tab,
  loading,
  pagedGuru,
  pagedDailyStudent,
  pagedSubjectStudent,
  activeRowsCount,
  currentPage,
  totalPages,
  pageStart,
  onPrevPage,
  onNextPage,
}: RecapTablesProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat rekapitulasi
          absensi...
        </div>
      ) : (
        <>
          {tab === 'guru' && (
            <div className="md:hidden print:hidden space-y-3">
              {pagedGuru.length === 0 ? (
                <AkademikEmptyState
                  compact
                  icon={<UserCheck className="w-6 h-6 text-slate-300" />}
                  message="Tidak ada data absensi guru pada periode ini."
                />
              ) : (
                pagedGuru.map((r) => (
                  <div
                    key={r.teacher_id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 break-words">
                          {r.full_name}
                        </p>
                        <p className="text-[11px] text-slate-400">NIP: {r.nip || '-'}</p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                        {r.total_jtm} JTM
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] bg-slate-50 rounded-xl p-2">
                      <div>
                        <p className="text-slate-400">Hari Hadir</p>
                        <p className="font-bold text-slate-800 tabular-nums">
                          {r.total_days_present}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Terkonfirmasi</p>
                        <p className="font-bold text-emerald-700 tabular-nums">
                          {r.confirmed_sessions}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Rata-rata</p>
                        <p className="font-bold text-sky-700 tabular-nums">
                          {r.avg_presence_pct != null ? `${r.avg_presence_pct}%` : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100">
                        Mengajar: <b>{r.teaching_sessions}</b>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100">
                        Piket: <b>{r.picket_sessions}</b>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100">
                        Ujian: <b>{r.exam_sessions}</b>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100">
                        Acara: <b>{r.event_sessions}</b>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100">
                        Izin Keluar: <b>{r.total_short_leave_minutes} mnt</b>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'siswa-harian' && (
            <div className="md:hidden print:hidden space-y-3">
              {pagedDailyStudent.length === 0 ? (
                <AkademikEmptyState
                  compact
                  icon={<Users className="w-6 h-6 text-slate-300" />}
                  message="Tidak ada data absensi siswa harian (piket) pada periode ini."
                />
              ) : (
                pagedDailyStudent.map((r) => (
                  <div
                    key={`${r.student_id}-${r.classroom_id}`}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 break-words">
                          {r.full_name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          NIS: {r.nis || '-'} • {r.classroom_name}
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                        {r.presence_pct}%
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] bg-slate-50 rounded-xl p-2 tabular-nums">
                      <div>
                        <p className="text-slate-400">Hadir</p>
                        <p className="font-bold text-emerald-700">{r.hadir}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Sakit</p>
                        <p className="font-bold text-amber-700">{r.sakit}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Izin</p>
                        <p className="font-bold text-sky-700">{r.izin}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Alpa</p>
                        <p className="font-bold text-rose-700">{r.alpa}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Total</p>
                        <p className="font-bold text-slate-800">{r.total}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'siswa-mapel' && (
            <div className="md:hidden print:hidden space-y-3">
              {pagedSubjectStudent.length === 0 ? (
                <AkademikEmptyState
                  compact
                  icon={<BookOpenCheck className="w-6 h-6 text-slate-300" />}
                  message="Tidak ada data absensi siswa per mata pelajaran pada periode ini."
                />
              ) : (
                pagedSubjectStudent.map((r) => (
                  <div
                    key={r.key}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 break-words">
                          {r.full_name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          NIS: {r.nis || '-'} • {r.classroom_name}
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                        {r.presence_pct}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium">
                        {r.subject_name}
                      </span>
                      <span className="text-slate-500">Guru: {r.teacher_name}</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] bg-slate-50 rounded-xl p-2 tabular-nums">
                      <div>
                        <p className="text-slate-400">H</p>
                        <p className="font-bold text-emerald-700">{r.hadir}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">S</p>
                        <p className="font-bold text-amber-700">{r.sakit}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">I</p>
                        <p className="font-bold text-sky-700">{r.izin}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">A</p>
                        <p className="font-bold text-rose-700">{r.alpa}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Total</p>
                        <p className="font-bold text-slate-800">{r.total}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 hidden md:block print:block">
            {tab === 'guru' ? (
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Guru</th>
                    <th className="py-3 px-3 text-center">Hari Hadir</th>
                    <th className="py-3 px-3 text-center">Mengajar</th>
                    <th className="py-3 px-3 text-center">Piket</th>
                    <th className="py-3 px-3 text-center">Ujian</th>
                    <th className="py-3 px-3 text-center">Acara</th>
                    <th className="py-3 px-3 text-center">Terkonfirmasi</th>
                    <th className="py-3 px-3 text-center">Total JTM</th>
                    <th className="py-3 px-3 text-center">Izin Keluar</th>
                    <th className="py-3 px-3 text-center">Rata-rata Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {pagedGuru.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6">
                        <AkademikEmptyState
                          compact
                          icon={<UserCheck className="w-6 h-6 text-slate-300" />}
                          message="Tidak ada data absensi guru pada periode ini."
                        />
                      </td>
                    </tr>
                  ) : (
                    pagedGuru.map((r) => (
                      <tr key={r.teacher_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{r.full_name}</p>
                          <p className="text-[11px] text-slate-400">NIP: {r.nip || '-'}</p>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">
                          {r.total_days_present}
                        </td>
                        <td className="py-3 px-3 text-center">{r.teaching_sessions}</td>
                        <td className="py-3 px-3 text-center">{r.picket_sessions}</td>
                        <td className="py-3 px-3 text-center">{r.exam_sessions}</td>
                        <td className="py-3 px-3 text-center">{r.event_sessions}</td>
                        <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                          {r.confirmed_sessions}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {r.total_jtm}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {r.total_short_leave_minutes} mnt
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">
                          {r.avg_presence_pct != null ? `${r.avg_presence_pct}%` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : tab === 'siswa-harian' ? (
              <table className="w-full text-xs min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Siswa</th>
                    <th className="py-3 px-3">NIS</th>
                    <th className="py-3 px-3">Kelas</th>
                    <th className="py-3 px-3 text-center text-emerald-700">Hadir</th>
                    <th className="py-3 px-3 text-center text-amber-700">Sakit</th>
                    <th className="py-3 px-3 text-center text-sky-700">Izin</th>
                    <th className="py-3 px-3 text-center text-rose-700">Alpa</th>
                    <th className="py-3 px-3 text-center">Total</th>
                    <th className="py-3 px-3 text-center">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {pagedDailyStudent.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6">
                        <AkademikEmptyState
                          compact
                          icon={<Users className="w-6 h-6 text-slate-300" />}
                          message="Tidak ada data absensi siswa harian (piket) pada periode ini."
                        />
                      </td>
                    </tr>
                  ) : (
                    pagedDailyStudent.map((r) => (
                      <tr
                        key={`${r.student_id}-${r.classroom_id}`}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-3 font-semibold text-slate-900">{r.full_name}</td>
                        <td className="py-3 px-3 text-slate-600">{r.nis || '-'}</td>
                        <td className="py-3 px-3 text-slate-600">{r.classroom_name}</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700">
                          {r.hadir}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-amber-700">
                          {r.sakit}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-sky-700">
                          {r.izin}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-rose-700">
                          {r.alpa}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">{r.total}</td>
                        <td className="py-3 px-3 text-center font-bold">{r.presence_pct}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs min-w-[780px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Siswa</th>
                    <th className="py-3 px-3">Kelas</th>
                    <th className="py-3 px-3">Mata Pelajaran</th>
                    <th className="py-3 px-3">Guru Mapel</th>
                    <th className="py-3 px-3 text-center text-emerald-700">H</th>
                    <th className="py-3 px-3 text-center text-amber-700">S</th>
                    <th className="py-3 px-3 text-center text-sky-700">I</th>
                    <th className="py-3 px-3 text-center text-rose-700">A</th>
                    <th className="py-3 px-3 text-center">Total</th>
                    <th className="py-3 px-3 text-center">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {pagedSubjectStudent.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6">
                        <AkademikEmptyState
                          compact
                          icon={<BookOpenCheck className="w-6 h-6 text-slate-300" />}
                          message="Tidak ada data absensi siswa per mata pelajaran pada periode ini."
                        />
                      </td>
                    </tr>
                  ) : (
                    pagedSubjectStudent.map((r) => (
                      <tr key={r.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{r.full_name}</p>
                          <p className="text-[11px] text-slate-400">NIS: {r.nis || '-'}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{r.classroom_name}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{r.subject_name}</td>
                        <td className="py-3 px-3 text-slate-600">{r.teacher_name}</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700">
                          {r.hadir}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-amber-700">
                          {r.sakit}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-sky-700">
                          {r.izin}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-rose-700">
                          {r.alpa}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">{r.total}</td>
                        <td className="py-3 px-3 text-center font-bold">{r.presence_pct}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {activeRowsCount > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 print:hidden">
              <span>
                Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, activeRowsCount)} dari{' '}
                {activeRowsCount} data
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onPrevPage}
                  disabled={currentPage <= 1}
                  aria-label="Halaman sebelumnya"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-slate-700 tabular-nums">
                  Hal {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={onNextPage}
                  disabled={currentPage >= totalPages}
                  aria-label="Halaman berikutnya"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
