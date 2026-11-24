'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AkademikEmptyState,
  AkademikModal,
  BatchStudentAttendanceList,
} from '../akademik-ui';
import type {
  ClassroomOpt,
  EnrollmentRow,
  PicketReportRow,
  PostPresensiFn,
  ShowToastFn,
  StudentAttendanceRow,
  TeacherAttendanceRow,
} from './types';

interface AbsensiSiswaSectionProps {
  studentAttendances: StudentAttendanceRow[];
  confirmedPicketAttendances: TeacherAttendanceRow[];
  classrooms: ClassroomOpt[];
  enrollments: EnrollmentRow[];
  canAdminConfirm: boolean;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  refreshing: boolean;
  handleRefresh: () => void;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function AbsensiSiswaSection({
  studentAttendances,
  confirmedPicketAttendances,
  classrooms,
  enrollments,
  canAdminConfirm,
  submitting,
  setSubmitting,
  refreshing,
  handleRefresh,
  postPresensi,
  showToast,
}: AbsensiSiswaSectionProps) {
  const [picketBatchStatuses, setPicketBatchStatuses] = useState<
    Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>
  >({});
  const [studentAttForm, setStudentAttForm] = useState({
    picket_attendance_id: '',
    classroom_id: '',
    student_id: '',
    status: 'HADIR' as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA',
    notes: '',
  });
  const [studentAttSearch, setStudentAttSearch] = useState('');
  const [studentAttStatusFilter, setStudentAttStatusFilter] = useState<
    'ALL' | 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
  >('ALL');
  const [studentAttPage, setStudentAttPage] = useState(1);

  const STUDENT_ATT_PAGE_SIZE = 10;
  const totalHadir = studentAttendances.filter((sa) => sa.status === 'HADIR').length;
  const totalSakitIzin = studentAttendances.filter(
    (sa) => sa.status === 'SAKIT' || sa.status === 'IZIN'
  ).length;
  const totalAlpa = studentAttendances.filter((sa) => sa.status === 'ALPA').length;

  const filteredByStatus =
    studentAttStatusFilter === 'ALL'
      ? studentAttendances
      : studentAttendances.filter((sa) => sa.status === studentAttStatusFilter);

  const query = studentAttSearch.trim().toLowerCase();
  const filteredAttendances = query
    ? filteredByStatus.filter((sa) => {
        const haystack = [
          sa.student?.full_name,
          sa.classroom?.name,
          sa.attendance_date,
          sa.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByStatus;

  const totalStudentAttPages = Math.max(
    1,
    Math.ceil(filteredAttendances.length / STUDENT_ATT_PAGE_SIZE)
  );
  const safeStudentAttPage = Math.min(studentAttPage, totalStudentAttPages);
  const paginatedAttendances = filteredAttendances.slice(
    (safeStudentAttPage - 1) * STUDENT_ATT_PAGE_SIZE,
    safeStudentAttPage * STUDENT_ATT_PAGE_SIZE
  );

  const selectedClassStudents = studentAttForm.classroom_id
    ? enrollments
        .filter((en) => en.classroom_id === studentAttForm.classroom_id && en.student)
        .map((en) => en.student!)
    : [];

  const canShowForm = canAdminConfirm || confirmedPicketAttendances.length > 0;

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
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Absensi Siswa Reguler oleh Guru Piket ({studentAttendances.length})
            </span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Hanya dapat dilakukan oleh <strong>Guru Piket / Guru Piket Pengganti</strong> yang
            kehadirannya sudah dikonfirmasi Admin. (Guru pengajar/pengganti mencatat absensi
            siswa langsung di dalam <strong>Jurnal Pembelajaran</strong>).
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
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
            {studentAttendances.length}
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

      {confirmedPicketAttendances.length === 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          Belum ada presensi <strong>Guru Piket / Pengganti</strong> yang dikonfirmasi Admin.
          Konfirmasi kehadiran Guru Piket terlebih dahulu pada menu{' '}
          <strong>Konfirmasi Kehadiran</strong> sebelum menyimpan absensi batch siswa.
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {canShowForm && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              if (!studentAttForm.picket_attendance_id) {
                showToast(
                  'error',
                  'Pilih presensi Guru Piket / Pengganti terkonfirmasi Admin terlebih dahulu.'
                );
                return;
              }
              if (!studentAttForm.classroom_id || selectedClassStudents.length === 0) {
                showToast('error', 'Pilih kelas yang memiliki siswa terdaftar pada rombel.');
                return;
              }
              const trimmedNotes = studentAttForm.notes.trim();
              const records = selectedClassStudents.map((st) => ({
                student_id: st.id,
                status: picketBatchStatuses[st.id] || 'HADIR',
                notes: trimmedNotes || null,
              }));
              setSubmitting(true);
              try {
                const res = await postPresensi({
                  action: 'BATCH_STUDENT_ATTENDANCE',
                  picket_attendance_id: studentAttForm.picket_attendance_id,
                  classroom_id: studentAttForm.classroom_id,
                  records,
                });
                if (res) {
                  showToast(
                    'success',
                    `Absensi batch kelas (${res.savedCount ?? records.length} siswa) berhasil disimpan.`
                  );
                  setStudentAttForm((prev) => ({ ...prev, notes: '' }));
                  setStudentAttPage(1);
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="absensi-picket-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Guru Piket / Pengganti Terkonfirmasi Admin{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                id="absensi-picket-select"
                required
                value={studentAttForm.picket_attendance_id}
                onChange={(e) =>
                  setStudentAttForm({
                    ...studentAttForm,
                    picket_attendance_id: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  -- Pilih Guru Piket / Pengganti Terkonfirmasi Admin --
                </option>
                {confirmedPicketAttendances.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'}{' '}
                    (Terkonfirmasi Admin)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="absensi-classroom-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Pilih Kelas (Batch) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="absensi-classroom-select"
                  required
                  value={studentAttForm.classroom_id}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setStudentAttForm({ ...studentAttForm, classroom_id: cid });
                    const classStudents = cid
                      ? enrollments
                          .filter((en) => en.classroom_id === cid && en.student)
                          .map((en) => en.student!)
                      : [];
                    const next: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                    for (const st of classStudents) next[st.id] = 'HADIR';
                    setPicketBatchStatuses(next);
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Kelas (Batch) --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="absensi-notes-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Catatan Umum Kelas (Opsional)
                </label>
                <input
                  id="absensi-notes-input"
                  placeholder="Contoh: Upacara bendera / jam ke-1"
                  value={studentAttForm.notes}
                  onChange={(e) =>
                    setStudentAttForm({ ...studentAttForm, notes: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
            </div>

            {(() => {
              if (!studentAttForm.classroom_id) {
                return (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    Pilih kelas di atas untuk memuat daftar seluruh siswa secara batch.
                  </div>
                );
              }
              if (selectedClassStudents.length === 0) {
                return (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    Belum ada siswa terdaftar di kelas ini pada tahun ajaran aktif.
                  </div>
                );
              }
              const hadirCount = selectedClassStudents.filter(
                (st) => (picketBatchStatuses[st.id] || 'HADIR') === 'HADIR'
              ).length;
              const sakitCount = selectedClassStudents.filter(
                (st) => picketBatchStatuses[st.id] === 'SAKIT'
              ).length;
              const izinCount = selectedClassStudents.filter(
                (st) => picketBatchStatuses[st.id] === 'IZIN'
              ).length;
              const alpaCount = selectedClassStudents.filter(
                (st) => picketBatchStatuses[st.id] === 'ALPA'
              ).length;

              return (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        H: {hadirCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        S: {sakitCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        I: {izinCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        A: {alpaCount}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allPresent: Record<
                          string,
                          'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
                        > = {};
                        for (const st of selectedClassStudents) allPresent[st.id] = 'HADIR';
                        setPicketBatchStatuses(allPresent);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                    >
                      Tandai Semua Hadir ({selectedClassStudents.length})
                    </button>
                  </div>
                  <BatchStudentAttendanceList
                    students={selectedClassStudents}
                    statuses={picketBatchStatuses}
                    onChangeStatus={(studentId, statusOpt) =>
                      setPicketBatchStatuses((prev) => ({
                        ...prev,
                        [studentId]: statusOpt,
                      }))
                    }
                  />
                </div>
              );
            })()}

            <button
              type="submit"
              disabled={
                submitting ||
                confirmedPicketAttendances.length === 0 ||
                !studentAttForm.classroom_id ||
                selectedClassStudents.length === 0
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Absensi Kelas (Batch)
            </button>
          </form>
        )}

        <div
          className={`${canShowForm ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-3 min-w-0`}
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `Semua (${studentAttendances.length})` },
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
                    setStudentAttStatusFilter(tab.id);
                    setStudentAttPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                    studentAttStatusFilter === tab.id
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
                value={studentAttSearch}
                onChange={(e) => {
                  setStudentAttSearch(e.target.value);
                  setStudentAttPage(1);
                }}
                placeholder="Cari nama siswa, kelas, tanggal..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {studentAttSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentAttSearch('');
                    setStudentAttPage(1);
                  }}
                  aria-label="Hapus pencarian absensi siswa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredAttendances.length === 0 ? (
            <AkademikEmptyState
              icon={<UserCheck className="w-6 h-6 text-slate-400" />}
              message={
                studentAttendances.length === 0
                  ? 'Belum ada catatan absensi siswa.'
                  : 'Tidak ada catatan absensi siswa yang cocok dengan filter atau pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedAttendances.map((sa) => (
                  <div
                    key={sa.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {sa.student?.full_name || 'Siswa'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {sa.attendance_date} • {sa.classroom?.name || '-'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] shrink-0 ${statusBadgeClass(
                        sa.status
                      )}`}
                    >
                      {sa.status}
                    </span>
                  </div>
                ))}
              </div>

              {totalStudentAttPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safeStudentAttPage}</strong> dari{' '}
                    <strong>{totalStudentAttPages}</strong> ({filteredAttendances.length}{' '}
                    catatan)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeStudentAttPage <= 1}
                      onClick={() => setStudentAttPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safeStudentAttPage >= totalStudentAttPages}
                      onClick={() =>
                        setStudentAttPage((p) => Math.min(totalStudentAttPages, p + 1))
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

interface LaporanPiketSectionProps {
  picketReports: PicketReportRow[];
  pendingPicketReports: TeacherAttendanceRow[];
  confirmedPicketAttendances: TeacherAttendanceRow[];
  canSubmitPresensi: boolean;
  canAdminConfirm: boolean;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  refreshing: boolean;
  handleRefresh: () => void;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function LaporanPiketSection({
  picketReports,
  pendingPicketReports,
  confirmedPicketAttendances,
  canSubmitPresensi,
  canAdminConfirm,
  submitting,
  setSubmitting,
  refreshing,
  handleRefresh,
  postPresensi,
  showToast,
}: LaporanPiketSectionProps) {
  const [picketReportForm, setPicketReportForm] = useState({
    attendance_id: '',
    summary: '',
    late_students_notes: '',
    teacher_substitution_notes: '',
    incidents: '',
  });
  const [picketReportSearch, setPicketReportSearch] = useState('');
  const [picketReportPage, setPicketReportPage] = useState(1);
  const [detailPicketReport, setDetailPicketReport] = useState<PicketReportRow | null>(null);

  const PICKET_REPORT_PAGE_SIZE = 6;
  const totalJtmPiket = picketReports.reduce(
    (sum, pr) => sum + (Number(pr.jtm_credited) || 0),
    0
  );
  const query = picketReportSearch.trim().toLowerCase();
  const filteredReports = query
    ? picketReports.filter((pr) => {
        const haystack = [
          pr.report_date,
          pr.teacher?.full_name,
          pr.summary,
          pr.late_students_notes,
          pr.teacher_substitution_notes,
          pr.incidents,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : picketReports;

  const totalReportPages = Math.max(
    1,
    Math.ceil(filteredReports.length / PICKET_REPORT_PAGE_SIZE)
  );
  const safeReportPage = Math.min(picketReportPage, totalReportPages);
  const paginatedReports = filteredReports.slice(
    (safeReportPage - 1) * PICKET_REPORT_PAGE_SIZE,
    safeReportPage * PICKET_REPORT_PAGE_SIZE
  );

  const canShowForm =
    canSubmitPresensi && (canAdminConfirm || confirmedPicketAttendances.length > 0);

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Laporan Harian Piket ({picketReports.length})</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Setelah kehadiran dikonfirmasi Admin,{' '}
            <strong>Guru Piket / Guru Piket Pengganti</strong> wajib mengisi Laporan Harian
            Piket di bawah ini agar JTM piket dihitung untuk honorarium.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Menunggu Laporan</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {pendingPicketReports.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Laporan</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {picketReports.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total JTM Piket</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {totalJtmPiket} <span className="text-xs font-semibold">JTM</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket Terkonfirmasi</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {confirmedPicketAttendances.length}
          </p>
        </div>
      </div>

      {pendingPicketReports.length === 0 && (
        <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
          {confirmedPicketAttendances.length === 0
            ? 'Belum ada presensi Guru Piket / Pengganti yang dikonfirmasi Admin. Konfirmasi kehadiran Guru Piket terlebih dahulu pada menu Konfirmasi Kehadiran.'
            : 'Semua presensi Guru Piket yang sudah dikonfirmasi Admin telah memiliki Laporan Harian Piket.'}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {canShowForm && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              if (!picketReportForm.attendance_id) {
                showToast(
                  'error',
                  'Pilih presensi Guru Piket terkonfirmasi Admin terlebih dahulu.'
                );
                return;
              }
              const trimmedSummary = picketReportForm.summary.trim();
              if (trimmedSummary.length < 5) {
                showToast('error', 'Ringkasan laporan piket minimal 5 karakter.');
                return;
              }

              setSubmitting(true);
              try {
                const res = await postPresensi({
                  action: 'SUBMIT_PICKET_REPORT',
                  attendance_id: picketReportForm.attendance_id,
                  summary: trimmedSummary,
                  late_students_notes: picketReportForm.late_students_notes.trim() || null,
                  teacher_substitution_notes:
                    picketReportForm.teacher_substitution_notes.trim() || null,
                  incidents: picketReportForm.incidents.trim() || null,
                });
                if (res) {
                  showToast(
                    'success',
                    `Laporan Harian Piket disimpan. +${res.jtmCredited} JTM telah dihitung.`
                  );
                  setPicketReportForm({
                    attendance_id: '',
                    summary: '',
                    late_students_notes: '',
                    teacher_substitution_notes: '',
                    incidents: '',
                  });
                  setPicketReportPage(1);
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="picket-report-att-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Presensi Guru Piket Terkonfirmasi <span className="text-rose-500">*</span>
              </label>
              <select
                id="picket-report-att-select"
                required
                value={picketReportForm.attendance_id}
                onChange={(e) =>
                  setPicketReportForm({
                    ...picketReportForm,
                    attendance_id: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  -- Pilih Presensi Guru Piket Terkonfirmasi ({pendingPicketReports.length}{' '}
                  menunggu laporan) --
                </option>
                {pendingPicketReports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'} (
                    {p.approved_jtm != null
                      ? p.approved_jtm
                      : p.delegation?.jtm_transferred || 2}{' '}
                    JTM)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="picket-report-summary"
                className="block text-xs font-semibold text-slate-700"
              >
                Ringkasan Pelaksanaan Tugas Piket <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="picket-report-summary"
                required
                minLength={5}
                rows={3}
                placeholder="Ringkasan pelaksanaan tugas piket hari ini (minimal 5 karakter)..."
                value={picketReportForm.summary}
                onChange={(e) =>
                  setPicketReportForm({ ...picketReportForm, summary: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="picket-report-late-students"
                className="block text-xs font-semibold text-slate-700"
              >
                Catatan Siswa Terlambat / Izin / Pulang Awal (Opsional)
              </label>
              <input
                id="picket-report-late-students"
                placeholder="Contoh: 2 siswa kelas VIII-A terlambat pukul 07.15"
                value={picketReportForm.late_students_notes}
                onChange={(e) =>
                  setPicketReportForm({
                    ...picketReportForm,
                    late_students_notes: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="picket-report-substitution"
                className="block text-xs font-semibold text-slate-700"
              >
                Catatan Penggantian Guru / Kelas Kosong (Opsional)
              </label>
              <input
                id="picket-report-substitution"
                placeholder="Contoh: Jam ke-3 kelas VII-B diisi tugas terstruktur"
                value={picketReportForm.teacher_substitution_notes}
                onChange={(e) =>
                  setPicketReportForm({
                    ...picketReportForm,
                    teacher_substitution_notes: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="picket-report-incidents"
                className="block text-xs font-semibold text-slate-700"
              >
                Kejadian Khusus / Ketertiban Lingkungan (Opsional)
              </label>
              <input
                id="picket-report-incidents"
                placeholder="Contoh: Lingkungan kondusif, tidak ada kejadian menonjol"
                value={picketReportForm.incidents}
                onChange={(e) =>
                  setPicketReportForm({ ...picketReportForm, incidents: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                pendingPicketReports.length === 0 ||
                !picketReportForm.attendance_id
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Laporan Harian Piket &amp; Hitung JTM
            </button>
          </form>
        )}

        <div className={`${canShowForm ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-3 min-w-0`}>
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={picketReportSearch}
              onChange={(e) => {
                setPicketReportSearch(e.target.value);
                setPicketReportPage(1);
              }}
              placeholder="Cari tanggal, guru piket, ringkasan..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {picketReportSearch && (
              <button
                type="button"
                onClick={() => {
                  setPicketReportSearch('');
                  setPicketReportPage(1);
                }}
                aria-label="Hapus pencarian laporan piket"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredReports.length === 0 ? (
            <AkademikEmptyState
              icon={<BookOpen className="w-6 h-6 text-slate-400" />}
              message={
                picketReports.length === 0
                  ? 'Belum ada Laporan Harian Piket yang dikirimkan.'
                  : 'Tidak ada laporan piket yang cocok dengan kata kunci pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedReports.map((pr) => (
                  <div
                    key={pr.id}
                    className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-slate-900 truncate">
                        {pr.report_date} • {pr.teacher?.full_name || 'Guru Piket'}
                      </p>
                      <p className="text-slate-600 line-clamp-2">{pr.summary}</p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                        +{pr.jtm_credited} JTM
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailPicketReport(pr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        Detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalReportPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safeReportPage}</strong> dari{' '}
                    <strong>{totalReportPages}</strong> ({filteredReports.length} laporan)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeReportPage <= 1}
                      onClick={() => setPicketReportPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safeReportPage >= totalReportPages}
                      onClick={() =>
                        setPicketReportPage((p) => Math.min(totalReportPages, p + 1))
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

      <AkademikModal
        open={Boolean(detailPicketReport)}
        onClose={() => setDetailPicketReport(null)}
        title="Detail Laporan Harian Piket"
      >
        {detailPicketReport && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Tanggal &amp; Guru Piket
                </p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {detailPicketReport.report_date} •{' '}
                  {detailPicketReport.teacher?.full_name || 'Guru Piket'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                +{detailPicketReport.jtm_credited} JTM
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600">
                Ringkasan Pelaksanaan Tugas Piket
              </p>
              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
                {detailPicketReport.summary}
              </p>
            </div>

            {detailPicketReport.late_students_notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">
                  Catatan Siswa Terlambat / Izin
                </p>
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {detailPicketReport.late_students_notes}
                </p>
              </div>
            )}

            {detailPicketReport.teacher_substitution_notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">
                  Catatan Penggantian Guru / Kelas Kosong
                </p>
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {detailPicketReport.teacher_substitution_notes}
                </p>
              </div>
            )}

            {detailPicketReport.incidents && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">
                  Kejadian Khusus / Ketertiban
                </p>
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {detailPicketReport.incidents}
                </p>
              </div>
            )}
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
