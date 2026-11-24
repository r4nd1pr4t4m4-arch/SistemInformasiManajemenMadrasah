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
  X,
} from 'lucide-react';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';
import {
  AkademikEmptyState,
  AkademikModal,
  BatchStudentAttendanceList,
} from '../akademik-ui';
import type {
  ClassroomOpt,
  EnrollmentRow,
  JournalRow,
  PendingScheduleSessionItem,
  PostPresensiFn,
  SessionConfirmationRow,
  ShowToastFn,
} from './types';

interface JurnalSectionProps {
  journals: JournalRow[];
  pendingJournalSessions: SessionConfirmationRow[];
  pendingScheduleSessionsToday: PendingScheduleSessionItem[];
  classrooms: ClassroomOpt[];
  enrollments: EnrollmentRow[];
  canSubmitPresensi: boolean;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  refreshing: boolean;
  handleRefresh: () => void;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function JurnalSection({
  journals,
  pendingJournalSessions,
  pendingScheduleSessionsToday,
  classrooms,
  enrollments,
  canSubmitPresensi,
  submitting,
  setSubmitting,
  refreshing,
  handleRefresh,
  postPresensi,
  showToast,
}: JurnalSectionProps) {
  const [subjectStudentStatuses, setSubjectStudentStatuses] = useState<
    Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>
  >({});
  const [journalFallbackClassroomId, setJournalFallbackClassroomId] = useState('');
  const [journalForm, setJournalForm] = useState({
    session_confirmation_id: '',
    topic: '',
    learning_activities: '',
    present_students_count: 30,
    absent_students_count: 0,
    student_attendance_notes: '',
    jtm_fallback: 2,
  });
  const [journalSearch, setJournalSearch] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  const [detailJournal, setDetailJournal] = useState<JournalRow | null>(null);

  const JOURNAL_PAGE_SIZE = 6;
  const totalJtmCredited = journals.reduce((sum, j) => sum + (Number(j.jtm_credited) || 0), 0);
  const query = journalSearch.trim().toLowerCase();
  const filteredJournals = query
    ? journals.filter((j) => {
        const haystack = [
          j.topic,
          j.learning_activities,
          j.teacher?.full_name,
          j.schedule?.classroom?.name,
          j.schedule?.subject?.name,
          j.journal_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : journals;
  const totalJournalPages = Math.max(1, Math.ceil(filteredJournals.length / JOURNAL_PAGE_SIZE));
  const safeJournalPage = Math.min(journalPage, totalJournalPages);
  const paginatedJournals = filteredJournals.slice(
    (safeJournalPage - 1) * JOURNAL_PAGE_SIZE,
    safeJournalPage * JOURNAL_PAGE_SIZE
  );

  const selectedJournalSession = pendingJournalSessions.find(
    (item) => item.id === journalForm.session_confirmation_id
  );
  const resolvedClassroomId =
    selectedJournalSession?.schedule?.classroom_id || journalFallbackClassroomId;
  const resolvedStudents = resolvedClassroomId
    ? enrollments
        .filter((en) => en.classroom_id === resolvedClassroomId && en.student)
        .map((en) => en.student!)
    : [];
  const subjectAttendanceSummary = resolvedStudents.reduce(
    (acc, st) => {
      const status = subjectStudentStatuses[st.id] || 'HADIR';
      acc[status] += 1;
      return acc;
    },
    { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0 }
  );
  const isSundayToday = isSundayDate(getWibTodayDateString());

  const handleBatchStatusChange = (
    studentId: string,
    statusOpt: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
  ) => {
    const next = { ...subjectStudentStatuses, [studentId]: statusOpt };
    setSubjectStudentStatuses(next);
    const entries = resolvedStudents.map((item) => ({
      name: item.full_name,
      status: next[item.id] || 'HADIR',
    }));
    const presentCount = entries.filter((x) => x.status === 'HADIR').length;
    const absentEntries = entries.filter((x) => x.status !== 'HADIR');
    setJournalForm((prev) => ({
      ...prev,
      present_students_count: presentCount,
      absent_students_count: absentEntries.length,
      student_attendance_notes: absentEntries
        .map((x) => `${x.name} (${x.status})`)
        .join(', '),
    }));
  };

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Jurnal Pembelajaran (Wajib untuk Hitung JTM)</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Setelah presensi mengajar (termasuk guru pengganti), isi Jurnal Pembelajaran agar
            JTM masuk ke hitungan honorarium. Keterlambatan input dihitung H+1 (80%), H+2
            (60%), H+3 (40%), H+4 (20%), H+5 (10%), Hari Minggu tidak dihitung.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Menunggu Jurnal</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {pendingJournalSessions.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Menunggu Konfirmasi</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {pendingScheduleSessionsToday.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Jurnal Terkirim</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {journals.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total JTM Diperoleh</p>
          <p className="text-xl font-bold text-indigo-700 mt-0.5 tabular-nums">
            {totalJtmCredited} <span className="text-xs font-semibold">JTM</span>
          </p>
        </div>
      </div>

      {pendingScheduleSessionsToday.length > 0 && (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
          Ada <strong>{pendingScheduleSessionsToday.length}</strong> jadwal mengajar hari ini
          yang menunggu konfirmasi kehadiran per jadwal dari Admin atau Guru Piket/Piket
          Pengganti sebelum Jurnal Pembelajaran dapat diisi.
        </div>
      )}

      {isSundayToday && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          Hari Minggu tidak ada pengisian Jurnal Pembelajaran. Silakan input pada hari Senin
          atau hari aktif berikutnya.
        </div>
      )}

      {canSubmitPresensi && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            if (!journalForm.session_confirmation_id) {
              showToast('error', 'Pilih jadwal mengajar terkonfirmasi terlebih dahulu.');
              return;
            }
            if (journalForm.topic.trim().length < 3) {
              showToast('error', 'Topik / materi pembelajaran minimal 3 karakter.');
              return;
            }

            const sc = pendingJournalSessions.find(
              (item) => item.id === journalForm.session_confirmation_id
            );
            const classroomId = sc?.schedule?.classroom_id || journalFallbackClassroomId;
            setSubmitting(true);
            try {
              if (
                sc?.schedule_id &&
                classroomId &&
                Object.keys(subjectStudentStatuses).length > 0
              ) {
                const records = Object.entries(subjectStudentStatuses).map(
                  ([student_id, status]) => ({
                    student_id,
                    status,
                  })
                );
                const attRes = await postPresensi({
                  action: 'RECORD_SUBJECT_STUDENT_ATTENDANCE',
                  schedule_id: sc.schedule_id,
                  classroom_id: classroomId,
                  attendance_date: sc.session_date,
                  records,
                });
                if (!attRes) return;
              }

              const res = await postPresensi({
                action: 'SUBMIT_JOURNAL',
                ...journalForm,
                topic: journalForm.topic.trim(),
                learning_activities: journalForm.learning_activities.trim(),
                student_attendance_notes: journalForm.student_attendance_notes.trim(),
              });
              if (res) {
                showToast(
                  'success',
                  `Jurnal pembelajaran & absensi siswa mapel disimpan (${res.percentage ?? 100}%). +${res.jtmCredited} JTM telah dihitung.`
                );
                setSubjectStudentStatuses({});
                setJournalFallbackClassroomId('');
                setJournalForm({
                  session_confirmation_id: '',
                  topic: '',
                  learning_activities: '',
                  present_students_count: 30,
                  absent_students_count: 0,
                  student_attendance_notes: '',
                  jtm_fallback: 2,
                });
                setJournalPage(1);
              }
            } finally {
              setSubmitting(false);
            }
          }}
          className="rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="journal-session-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Jadwal Mengajar Terkonfirmasi <span className="text-rose-500">*</span>
            </label>
            <select
              id="journal-session-select"
              required
              value={journalForm.session_confirmation_id}
              onChange={(e) => {
                const nextId = e.target.value;
                const sc = pendingJournalSessions.find((item) => item.id === nextId);
                const classroomId = sc?.schedule?.classroom_id;
                const classStudents = classroomId
                  ? enrollments
                      .filter((en) => en.classroom_id === classroomId && en.student)
                      .map((en) => en.student!)
                  : [];
                const nextStatuses: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                for (const st of classStudents) {
                  nextStatuses[st.id] = 'HADIR';
                }
                setJournalFallbackClassroomId('');
                setSubjectStudentStatuses(nextStatuses);
                setJournalForm({
                  ...journalForm,
                  session_confirmation_id: nextId,
                  present_students_count:
                    classStudents.length > 0
                      ? classStudents.length
                      : journalForm.present_students_count,
                  absent_students_count:
                    classStudents.length > 0 ? 0 : journalForm.absent_students_count,
                  student_attendance_notes: '',
                });
              }}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">
                -- Pilih Jadwal Mengajar Terkonfirmasi ({pendingJournalSessions.length} menunggu
                jurnal) --
              </option>
              {pendingJournalSessions.map((sc) => {
                const base = Number(sc.approved_jtm ?? sc.expected_jtm ?? 2);
                const preview = calculateLateJtm(base, sc.session_date);
                return (
                  <option key={sc.id} value={sc.id}>
                    {sc.session_date} • {sc.teacher?.full_name || 'Guru'}{' '}
                    {sc.delegation_id
                      ? '(Guru Pengganti)'
                      : sc.schedule
                        ? `• ${sc.schedule.classroom?.name || ''} ${sc.schedule.subject?.name || ''}`
                        : ''}{' '}
                    ({base} JTM) [
                    {preview.delayDays === 0
                      ? 'Hari Ini 100%'
                      : `H+${preview.delayDays}: ${preview.percentage}%`}
                    ]
                  </option>
                );
              })}
            </select>
          </div>

          {selectedJournalSession &&
            (() => {
              const base = Number(
                selectedJournalSession.approved_jtm ?? selectedJournalSession.expected_jtm ?? 2
              );
              const preview = calculateLateJtm(base, selectedJournalSession.session_date);
              if (!preview.allowed) {
                return (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {preview.reason}
                  </div>
                );
              }
              return (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  JTM disetujui: <strong>{base} JTM</strong>{' '}
                  {preview.delayDays === 0
                    ? '(Tepat waktu 100%)'
                    : `(Terlambat H+${preview.delayDays} → ${preview.percentage}% = ${preview.creditedJtm} JTM)`}
                </div>
              );
            })()}

          <div className="space-y-1.5">
            <label
              htmlFor="journal-topic"
              className="block text-xs font-semibold text-slate-700"
            >
              Topik / Materi Pembelajaran <span className="text-rose-500">*</span>
            </label>
            <input
              id="journal-topic"
              required
              minLength={3}
              placeholder="Contoh: Persamaan Linear Dua Variabel"
              value={journalForm.topic}
              onChange={(e) => setJournalForm({ ...journalForm, topic: e.target.value })}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="journal-activities"
              className="block text-xs font-semibold text-slate-700"
            >
              Ringkasan Kegiatan Pembelajaran / Catatan Kelas (Opsional)
            </label>
            <textarea
              id="journal-activities"
              rows={2}
              placeholder="Jelaskan metode, diskusi, atau tugas yang diberikan di kelas..."
              value={journalForm.learning_activities}
              onChange={(e) =>
                setJournalForm({ ...journalForm, learning_activities: e.target.value })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-700">
                Absensi Siswa per Nama (Batch) oleh Guru Mapel / Pengganti
              </p>
              {resolvedStudents.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allPresent: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                    for (const st of resolvedStudents) allPresent[st.id] = 'HADIR';
                    setSubjectStudentStatuses(allPresent);
                    setJournalForm((prev) => ({
                      ...prev,
                      present_students_count: resolvedStudents.length,
                      absent_students_count: 0,
                      student_attendance_notes: '',
                    }));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                >
                  Tandai Semua Hadir ({resolvedStudents.length})
                </button>
              )}
            </div>

            {resolvedStudents.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Hadir: {subjectAttendanceSummary.HADIR}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Sakit: {subjectAttendanceSummary.SAKIT}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  Izin: {subjectAttendanceSummary.IZIN}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  Alpa: {subjectAttendanceSummary.ALPA}
                </span>
              </div>
            )}

            {!selectedJournalSession ? (
              <p className="text-[11px] text-slate-500">
                Pilih jadwal mengajar di atas untuk memuat daftar siswa kelas.
              </p>
            ) : !selectedJournalSession.schedule?.classroom_id ? (
              <div className="space-y-2">
                <label
                  htmlFor="journal-fallback-classroom"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  Pilih Kelas untuk Muat Daftar Siswa (Jadwal Pengganti/Delegasi)
                </label>
                <select
                  id="journal-fallback-classroom"
                  value={journalFallbackClassroomId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setJournalFallbackClassroomId(cid);
                    const list = cid
                      ? enrollments
                          .filter((en) => en.classroom_id === cid && en.student)
                          .map((en) => en.student!)
                      : [];
                    const next: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                    for (const st of list) next[st.id] = 'HADIR';
                    setSubjectStudentStatuses(next);
                    if (list.length > 0) {
                      setJournalForm((prev) => ({
                        ...prev,
                        present_students_count: list.length,
                        absent_students_count: 0,
                        student_attendance_notes: '',
                      }));
                    }
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                >
                  <option value="">-- Pilih Kelas untuk Muat Daftar Siswa (Batch) --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {resolvedStudents.length > 0 && (
                  <BatchStudentAttendanceList
                    students={resolvedStudents}
                    statuses={subjectStudentStatuses}
                    onChangeStatus={handleBatchStatusChange}
                  />
                )}
              </div>
            ) : resolvedStudents.length === 0 ? (
              <p className="text-[11px] text-amber-700">
                Belum ada siswa terdaftar di rombel kelas ini pada tahun ajaran aktif. Anda
                tetap dapat mengisi jumlah kehadiran di bawah.
              </p>
            ) : (
              <BatchStudentAttendanceList
                students={resolvedStudents}
                statuses={subjectStudentStatuses}
                onChangeStatus={handleBatchStatusChange}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="space-y-1">
                <label
                  htmlFor="journal-present-count"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  Jumlah Siswa Hadir
                </label>
                <input
                  id="journal-present-count"
                  type="number"
                  min={0}
                  value={journalForm.present_students_count}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setJournalForm({
                      ...journalForm,
                      present_students_count: Number.isFinite(val) ? Math.max(0, val) : 0,
                    });
                  }}
                  placeholder="Jumlah Siswa Hadir"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="journal-absent-count"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  Jumlah Tidak Hadir
                </label>
                <input
                  id="journal-absent-count"
                  type="number"
                  min={0}
                  value={journalForm.absent_students_count}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setJournalForm({
                      ...journalForm,
                      absent_students_count: Number.isFinite(val) ? Math.max(0, val) : 0,
                    });
                  }}
                  placeholder="Jumlah Tidak Hadir"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="journal-student-notes"
                className="block text-[11px] font-medium text-slate-600"
              >
                Catatan Siswa Tidak Hadir (Opsional)
              </label>
              <input
                id="journal-student-notes"
                placeholder="Nama siswa sakit/izin/alpa pada jadwal ini (opsional)"
                value={journalForm.student_attendance_notes}
                onChange={(e) =>
                  setJournalForm({ ...journalForm, student_attendance_notes: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              pendingJournalSessions.length === 0 ||
              !journalForm.session_confirmation_id ||
              isSundayToday
            }
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Simpan Jurnal &amp; Hitung JTM
          </button>
        </form>
      )}

      {/* Riwayat Jurnal Pembelajaran */}
      <div className="pt-3 border-t border-slate-200/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Riwayat Jurnal Pembelajaran ({filteredJournals.length})
          </h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={journalSearch}
              onChange={(e) => {
                setJournalSearch(e.target.value);
                setJournalPage(1);
              }}
              placeholder="Cari topik, guru, kelas, mapel..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {journalSearch && (
              <button
                type="button"
                onClick={() => {
                  setJournalSearch('');
                  setJournalPage(1);
                }}
                aria-label="Hapus pencarian jurnal"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {filteredJournals.length === 0 ? (
          <AkademikEmptyState
            icon={<BookOpen className="w-6 h-6 text-slate-400" />}
            message={
              journals.length === 0
                ? 'Belum ada jurnal pembelajaran. Jurnal yang Anda simpan setelah presensi mengajar terkonfirmasi akan muncul di sini.'
                : 'Tidak ada riwayat jurnal yang cocok dengan kata kunci pencarian Anda.'
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {paginatedJournals.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:border-emerald-200 transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {j.topic}
                      </p>
                      {j.schedule?.classroom?.name && (
                        <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold">
                          {j.schedule.classroom.name}
                        </span>
                      )}
                      {j.schedule?.subject?.name && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-semibold">
                          {j.schedule.subject.name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {j.journal_date} • {j.teacher?.full_name || 'Guru'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      +{j.jtm_credited} JTM
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailJournal(j)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Detail
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalJournalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                <span>
                  Halaman <strong>{safeJournalPage}</strong> dari{' '}
                  <strong>{totalJournalPages}</strong> ({filteredJournals.length} jurnal)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeJournalPage <= 1}
                    onClick={() => setJournalPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={safeJournalPage >= totalJournalPages}
                    onClick={() =>
                      setJournalPage((p) => Math.min(totalJournalPages, p + 1))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold"
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

      <AkademikModal
        open={Boolean(detailJournal)}
        onClose={() => setDetailJournal(null)}
        title="Detail Jurnal Pembelajaran"
      >
        {detailJournal && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-slate-500">
              {detailJournal.journal_date} • {detailJournal.teacher?.full_name || 'Guru'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-medium text-slate-500">
                  Kelas &amp; Mata Pelajaran
                </p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {detailJournal.schedule?.classroom?.name || '-'} •{' '}
                  {detailJournal.schedule?.subject?.name || '-'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-medium text-emerald-700">JTM Tercatat</p>
                <p className="text-sm font-bold text-emerald-900 mt-0.5">
                  +{detailJournal.jtm_credited} JTM
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600">
                Topik / Materi Pembelajaran
              </p>
              <p className="text-sm font-semibold text-slate-900">{detailJournal.topic}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600">
                Uraian Aktivitas Pembelajaran
              </p>
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
                {detailJournal.learning_activities || 'Tidak ada uraian aktivitas.'}
              </p>
            </div>
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
