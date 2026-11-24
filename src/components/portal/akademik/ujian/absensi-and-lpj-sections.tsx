'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { AkademikEmptyState, AkademikModal } from '../akademik-ui';
import type {
  CommitteeAttRow,
  CommitteeDailyReportRow,
  CommitteeRow,
  ExamPeriodRow,
  ExamRoomRow,
  ExamRoomStudentRow,
  ExamStudentAttendanceRow,
  StudentOpt,
} from './types';

export interface AbsensiSiswaSectionProps {
  canManageCommittees: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  examPeriods: ExamPeriodRow[];
  rooms: ExamRoomRow[];
  examRoomStudents: ExamRoomStudentRow[];
  students: StudentOpt[];
  examStudentAttendances: ExamStudentAttendanceRow[];
  confirmedCommitteeAtts: CommitteeAttRow[];
}

export function AbsensiSiswaSection({
  canManageCommittees,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  examPeriods,
  rooms,
  examRoomStudents,
  students,
  examStudentAttendances,
  confirmedCommitteeAtts,
}: AbsensiSiswaSectionProps) {
  const [examStudentAttForm, setExamStudentAttForm] = useState({
    committee_attendance_id: '',
    exam_period_id: '',
    exam_room_id: '',
    student_id: '',
    exam_date: getWibTodayDateString(),
    session_name: 'Sesi 1',
    status: 'HADIR' as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA',
  });
  const [examStudentAttSearch, setExamStudentAttSearch] = useState('');
  const [examStudentAttFilter, setExamStudentAttFilter] = useState<
    'ALL' | 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
  >('ALL');
  const [examStudentAttPage, setExamStudentAttPage] = useState(1);

  const EXAM_ATT_PAGE_SIZE = 10;
  const totalHadir = examStudentAttendances.filter((esa) => esa.status === 'HADIR').length;
  const totalSakitIzin = examStudentAttendances.filter(
    (esa) => esa.status === 'SAKIT' || esa.status === 'IZIN'
  ).length;
  const totalAlpa = examStudentAttendances.filter((esa) => esa.status === 'ALPA').length;

  const periodRooms = examStudentAttForm.exam_period_id
    ? rooms.filter((r) => r.exam_period_id === examStudentAttForm.exam_period_id)
    : rooms;

  const roomStudentIds = examStudentAttForm.exam_room_id
    ? new Set(
        examRoomStudents
          .filter((ers) => ers.exam_room_id === examStudentAttForm.exam_room_id)
          .map((ers) => ers.student_id)
      )
    : null;
  const selectableStudents =
    roomStudentIds && roomStudentIds.size > 0
      ? students.filter((s) => roomStudentIds.has(s.id))
      : students;

  const filteredByStatus =
    examStudentAttFilter === 'ALL'
      ? examStudentAttendances
      : examStudentAttendances.filter((esa) => esa.status === examStudentAttFilter);

  const query = examStudentAttSearch.trim().toLowerCase();
  const filteredExamAtts = query
    ? filteredByStatus.filter((esa) => {
        const haystack = [
          esa.student?.full_name,
          esa.room?.room_name,
          esa.exam_date,
          esa.session_name,
          esa.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByStatus;

  const totalExamAttPages = Math.max(
    1,
    Math.ceil(filteredExamAtts.length / EXAM_ATT_PAGE_SIZE)
  );
  const safeExamAttPage = Math.min(examStudentAttPage, totalExamAttPages);
  const paginatedExamAtts = filteredExamAtts.slice(
    (safeExamAttPage - 1) * EXAM_ATT_PAGE_SIZE,
    safeExamAttPage * EXAM_ATT_PAGE_SIZE
  );

  const canShowForm = canManageCommittees || confirmedCommitteeAtts.length > 0;

  const statusBadgeClass = (status: string) => {
    if (status === 'HADIR') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'SAKIT') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (status === 'IZIN') return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Absensi Siswa Ujian oleh Panitia Ujian ({examStudentAttendances.length})
            </span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Hanya dapat dilakukan oleh <strong>Panitia Ujian / Panitia Pengganti</strong> yang
            kehadirannya sudah dikonfirmasi Admin. (Pengawas / Pengawas Pengganti mencantumkan
            jumlah siswa hadir/tidak hadir &amp; catatan langsung di dalam{' '}
            <strong>Berita Acara Pengawasan (BAP)</strong>).
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Catatan</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {examStudentAttendances.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Hadir</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {totalHadir}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Sakit / Izin</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {totalSakitIzin}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Alpa</p>
          <p className="text-xl font-bold text-rose-700 mt-0.5 tabular-nums">
            {totalAlpa}
          </p>
        </div>
      </div>

      {confirmedCommitteeAtts.length === 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          Belum ada presensi <strong>Panitia Ujian / Pengganti</strong> yang dikonfirmasi
          Admin. Konfirmasi kehadiran Panitia Ujian terlebih dahulu sebelum mencatat absensi
          siswa ujian.
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {canShowForm && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!examStudentAttForm.committee_attendance_id) {
                showToast(
                  'error',
                  'Pilih Panitia Ujian / Pengganti terkonfirmasi Admin terlebih dahulu.'
                );
                return;
              }
              if (!examStudentAttForm.exam_period_id || !examStudentAttForm.student_id) {
                showToast('error', 'Pilih periode ujian dan siswa terlebih dahulu.');
                return;
              }
              const trimmedSession = examStudentAttForm.session_name.trim();
              if (!trimmedSession) {
                showToast('error', 'Nama sesi ujian wajib diisi.');
                return;
              }
              const ok = await postUjian(
                {
                  action: 'EXAM_STUDENT_ATTENDANCE',
                  committee_attendance_id: examStudentAttForm.committee_attendance_id,
                  exam_period_id: examStudentAttForm.exam_period_id,
                  exam_room_id: examStudentAttForm.exam_room_id || null,
                  student_id: examStudentAttForm.student_id,
                  exam_date: examStudentAttForm.exam_date,
                  session_name: trimmedSession,
                  status: examStudentAttForm.status,
                },
                'Absensi siswa ujian berhasil dicatat.'
              );
              if (ok) {
                setExamStudentAttForm((prev) => ({ ...prev, student_id: '' }));
                setExamStudentAttPage(1);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1">
              <label
                htmlFor="ujian-abs-committee-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Panitia Ujian / Pengganti Terkonfirmasi Admin{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                id="ujian-abs-committee-select"
                required
                value={examStudentAttForm.committee_attendance_id}
                onChange={(e) =>
                  setExamStudentAttForm({
                    ...examStudentAttForm,
                    committee_attendance_id: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  -- Pilih Panitia Ujian / Pengganti Terkonfirmasi Admin --
                </option>
                {confirmedCommitteeAtts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.attendance_date} • {c.teacher?.full_name || 'Panitia'} (Terkonfirmasi
                    Admin)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="ujian-abs-period-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Periode Ujian <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ujian-abs-period-select"
                  required
                  value={examStudentAttForm.exam_period_id}
                  onChange={(e) =>
                    setExamStudentAttForm({
                      ...examStudentAttForm,
                      exam_period_id: e.target.value,
                      exam_room_id: '',
                      student_id: '',
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Periode Ujian --</option>
                  {examPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="ujian-abs-room-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ruang Ujian (Opsional)
                </label>
                <select
                  id="ujian-abs-room-select"
                  value={examStudentAttForm.exam_room_id}
                  onChange={(e) =>
                    setExamStudentAttForm({
                      ...examStudentAttForm,
                      exam_room_id: e.target.value,
                      student_id: '',
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Ruang Ujian (Opsional) --</option>
                  {periodRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="ujian-abs-date-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tanggal Ujian <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ujian-abs-date-input"
                  type="date"
                  required
                  value={examStudentAttForm.exam_date}
                  onChange={(e) =>
                    setExamStudentAttForm({
                      ...examStudentAttForm,
                      exam_date: e.target.value,
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="ujian-abs-session-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Sesi Ujian <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ujian-abs-session-input"
                  required
                  placeholder="Sesi (mis. Sesi 1)"
                  value={examStudentAttForm.session_name}
                  onChange={(e) =>
                    setExamStudentAttForm({
                      ...examStudentAttForm,
                      session_name: e.target.value,
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="ujian-abs-student-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Siswa ({selectableStudents.length}){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ujian-abs-student-select"
                  required
                  value={examStudentAttForm.student_id}
                  onChange={(e) =>
                    setExamStudentAttForm({
                      ...examStudentAttForm,
                      student_id: e.target.value,
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {selectableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="ujian-abs-status-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Status Kehadiran
                </label>
                <select
                  id="ujian-abs-status-select"
                  value={examStudentAttForm.status}
                  onChange={(e) =>
                    setExamStudentAttForm({
                      ...examStudentAttForm,
                      status: e.target.value as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA',
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="HADIR">HADIR</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="IZIN">IZIN</option>
                  <option value="ALPA">ALPA</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || confirmedCommitteeAtts.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Absensi Siswa Ujian
            </button>
          </form>
        )}

        <div className={`${canShowForm ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-3 min-w-0`}>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `Semua (${examStudentAttendances.length})` },
                  { id: 'HADIR', label: 'Hadir' },
                  { id: 'SAKIT', label: 'Sakit' },
                  { id: 'IZIN', label: 'Izin' },
                  { id: 'ALPA', label: 'Alpa' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setExamStudentAttFilter(tab.id);
                    setExamStudentAttPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                    examStudentAttFilter === tab.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={examStudentAttSearch}
                onChange={(e) => {
                  setExamStudentAttSearch(e.target.value);
                  setExamStudentAttPage(1);
                }}
                placeholder="Cari nama siswa, ruang, sesi, tanggal..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {examStudentAttSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setExamStudentAttSearch('');
                    setExamStudentAttPage(1);
                  }}
                  aria-label="Hapus pencarian absensi siswa ujian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredExamAtts.length === 0 ? (
            <AkademikEmptyState
              icon={<UserCheck className="w-6 h-6 text-slate-400" />}
              message={
                examStudentAttendances.length === 0
                  ? 'Belum ada catatan absensi siswa ujian.'
                  : 'Tidak ada catatan absensi siswa ujian yang cocok dengan filter atau pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedExamAtts.map((esa) => (
                  <div
                    key={esa.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {esa.student?.full_name || 'Siswa'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {esa.exam_date} • {esa.session_name} • {esa.room?.room_name || 'Ruang'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] shrink-0 ${statusBadgeClass(
                        esa.status
                      )}`}
                    >
                      {esa.status}
                    </span>
                  </div>
                ))}
              </div>

              {totalExamAttPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safeExamAttPage}</strong> dari{' '}
                    <strong>{totalExamAttPages}</strong> ({filteredExamAtts.length} catatan)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeExamAttPage <= 1}
                      onClick={() => setExamStudentAttPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safeExamAttPage >= totalExamAttPages}
                      onClick={() =>
                        setExamStudentAttPage((p) => Math.min(totalExamAttPages, p + 1))
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
  );
}

export interface LpjPanitiaSectionProps {
  canSubmitUjian: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  committees: CommitteeRow[];
  committeeDailyReports: CommitteeDailyReportRow[];
  confirmedCommitteeAtts: CommitteeAttRow[];
  pendingCommitteeReports: CommitteeAttRow[];
}

export function LpjPanitiaSection({
  canSubmitUjian,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  committees,
  committeeDailyReports,
  confirmedCommitteeAtts,
  pendingCommitteeReports,
}: LpjPanitiaSectionProps) {
  const [committeeReportForm, setCommitteeReportForm] = useState({
    attendance_id: '',
    activities_summary: '',
    logistics_notes: '',
    issues_and_solutions: '',
  });
  const [lpjSearch, setLpjSearch] = useState('');
  const [lpjPage, setLpjPage] = useState(1);
  const [detailLpj, setDetailLpj] = useState<CommitteeDailyReportRow | null>(null);

  const LPJ_PAGE_SIZE = 6;
  const totalJtmPanitia = committeeDailyReports.reduce(
    (sum, cr) => sum + (Number(cr.jtm_credited) || 0),
    0
  );
  const query = lpjSearch.trim().toLowerCase();
  const filteredLpj = query
    ? committeeDailyReports.filter((cr) => {
        const haystack = [
          cr.report_date,
          cr.teacher?.full_name,
          cr.committee?.committee_role,
          cr.activities_summary,
          cr.logistics_notes,
          cr.issues_and_solutions,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : committeeDailyReports;

  const totalLpjPages = Math.max(1, Math.ceil(filteredLpj.length / LPJ_PAGE_SIZE));
  const safeLpjPage = Math.min(lpjPage, totalLpjPages);
  const paginatedLpj = filteredLpj.slice(
    (safeLpjPage - 1) * LPJ_PAGE_SIZE,
    safeLpjPage * LPJ_PAGE_SIZE
  );

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-sky-700 shrink-0" />
            <span>
              Laporan Pertanggungjawaban Harian Panitia Ujian ({committeeDailyReports.length})
            </span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Setelah kehadiran dikonfirmasi Admin,{' '}
            <strong>Panitia Ujian / Panitia Pengganti</strong> wajib mengisi Laporan
            Pertanggungjawaban Harian (LPJ) di bawah ini agar JTM panitia dihitung untuk
            honorarium.
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Menunggu LPJ</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {pendingCommitteeReports.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total LPJ Terkirim</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {committeeDailyReports.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total JTM Panitia</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {totalJtmPanitia} <span className="text-xs font-semibold">JTM</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Panitia Terkonfirmasi</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {confirmedCommitteeAtts.length}
          </p>
        </div>
      </div>

      {pendingCommitteeReports.length === 0 && (
        <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
          {confirmedCommitteeAtts.length === 0
            ? 'Belum ada presensi Panitia Ujian / Pengganti yang dikonfirmasi Admin. Konfirmasi kehadiran panitia terlebih dahulu sebelum mengisi LPJ Harian.'
            : 'Semua presensi Panitia Ujian yang sudah dikonfirmasi Admin telah memiliki LPJ Harian.'}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {canSubmitUjian && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!committeeReportForm.attendance_id) {
                showToast(
                  'error',
                  'Pilih presensi Panitia Ujian terkonfirmasi Admin terlebih dahulu.'
                );
                return;
              }
              const trimmedSummary = committeeReportForm.activities_summary.trim();
              if (trimmedSummary.length < 5) {
                showToast('error', 'Ringkasan pertanggungjawaban minimal 5 karakter.');
                return;
              }
              const ok = await postUjian(
                {
                  action: 'SUBMIT_COMMITTEE_REPORT',
                  attendance_id: committeeReportForm.attendance_id,
                  activities_summary: trimmedSummary,
                  logistics_notes: committeeReportForm.logistics_notes.trim() || null,
                  issues_and_solutions:
                    committeeReportForm.issues_and_solutions.trim() || null,
                },
                'LPJ Harian Panitia Ujian disimpan & JTM panitia dihitung.'
              );
              if (ok) {
                setCommitteeReportForm({
                  attendance_id: '',
                  activities_summary: '',
                  logistics_notes: '',
                  issues_and_solutions: '',
                });
                setLpjPage(1);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1">
              <label
                htmlFor="lpj-panitia-att-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Presensi Panitia Terkonfirmasi <span className="text-rose-500">*</span>
              </label>
              <select
                id="lpj-panitia-att-select"
                required
                value={committeeReportForm.attendance_id}
                onChange={(e) =>
                  setCommitteeReportForm({
                    ...committeeReportForm,
                    attendance_id: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              >
                <option value="">
                  -- Pilih Presensi Panitia Terkonfirmasi ({pendingCommitteeReports.length}{' '}
                  menunggu LPJ) --
                </option>
                {pendingCommitteeReports.map((c) => {
                  const com = committees.find((x) => x.id === c.exam_committee_id);
                  const jtmVal =
                    c.approved_jtm != null ? c.approved_jtm : com?.jtm_allocated ?? 4;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.attendance_date} • {c.teacher?.full_name || 'Panitia'} (
                      {com?.committee_role || 'Panitia'} • {jtmVal} JTM)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="lpj-panitia-summary"
                className="block text-xs font-semibold text-slate-700"
              >
                Ringkasan Pelaksanaan Tugas &amp; Koordinasi{' '}
                <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="lpj-panitia-summary"
                required
                minLength={5}
                rows={3}
                placeholder="Ringkasan pelaksanaan tugas & koordinasi panitia ujian hari ini (minimal 5 karakter)..."
                value={committeeReportForm.activities_summary}
                onChange={(e) =>
                  setCommitteeReportForm({
                    ...committeeReportForm,
                    activities_summary: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="lpj-panitia-logistics"
                className="block text-xs font-semibold text-slate-700"
              >
                Catatan Logistik (Opsional)
              </label>
              <input
                id="lpj-panitia-logistics"
                placeholder="Distribusi naskah, kesiapan ruang, kehadiran pengawas..."
                value={committeeReportForm.logistics_notes}
                onChange={(e) =>
                  setCommitteeReportForm({
                    ...committeeReportForm,
                    logistics_notes: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="lpj-panitia-issues"
                className="block text-xs font-semibold text-slate-700"
              >
                Kendala &amp; Solusi Penanganan (Opsional)
              </label>
              <input
                id="lpj-panitia-issues"
                placeholder="Kendala & solusi penanganan selama ujian (opsional)"
                value={committeeReportForm.issues_and_solutions}
                onChange={(e) =>
                  setCommitteeReportForm({
                    ...committeeReportForm,
                    issues_and_solutions: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                pendingCommitteeReports.length === 0 ||
                !committeeReportForm.attendance_id
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan LPJ Harian Panitia &amp; Hitung JTM
            </button>
          </form>
        )}

        <div className={`${canSubmitUjian ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-3 min-w-0`}>
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={lpjSearch}
              onChange={(e) => {
                setLpjSearch(e.target.value);
                setLpjPage(1);
              }}
              placeholder="Cari tanggal, panitia, jabatan, ringkasan..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
            {lpjSearch && (
              <button
                type="button"
                onClick={() => {
                  setLpjSearch('');
                  setLpjPage(1);
                }}
                aria-label="Hapus pencarian LPJ"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredLpj.length === 0 ? (
            <AkademikEmptyState
              icon={<ClipboardCheck className="w-6 h-6 text-slate-400" />}
              message={
                committeeDailyReports.length === 0
                  ? 'Belum ada LPJ Harian Panitia Ujian yang dikirimkan.'
                  : 'Tidak ada LPJ Harian yang cocok dengan kata kunci pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedLpj.map((cr) => (
                  <div
                    key={cr.id}
                    className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-slate-900 truncate">
                        {cr.report_date} • {cr.teacher?.full_name || 'Panitia'} (
                        {cr.committee?.committee_role || 'Panitia'})
                      </p>
                      <p className="text-slate-600 line-clamp-2">{cr.activities_summary}</p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-bold text-[11px]">
                        +{cr.jtm_credited} JTM
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailLpj(cr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        Detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalLpjPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safeLpjPage}</strong> dari{' '}
                    <strong>{totalLpjPages}</strong> ({filteredLpj.length} LPJ)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeLpjPage <= 1}
                      onClick={() => setLpjPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safeLpjPage >= totalLpjPages}
                      onClick={() => setLpjPage((p) => Math.min(totalLpjPages, p + 1))}
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

      <AkademikModal
        open={Boolean(detailLpj)}
        onClose={() => setDetailLpj(null)}
        title="Detail LPJ Harian Panitia Ujian"
      >
        {detailLpj && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Tanggal &amp; Panitia
                </p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {detailLpj.report_date} • {detailLpj.teacher?.full_name || 'Panitia'} (
                  {detailLpj.committee?.committee_role || 'Panitia'})
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                +{detailLpj.jtm_credited} JTM
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600">
                Ringkasan Pelaksanaan Tugas &amp; Koordinasi
              </p>
              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
                {detailLpj.activities_summary}
              </p>
            </div>

            {detailLpj.logistics_notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">Catatan Logistik</p>
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {detailLpj.logistics_notes}
                </p>
              </div>
            )}

            {detailLpj.issues_and_solutions && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">
                  Kendala &amp; Solusi Penanganan
                </p>
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {detailLpj.issues_and_solutions}
                </p>
              </div>
            )}
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
