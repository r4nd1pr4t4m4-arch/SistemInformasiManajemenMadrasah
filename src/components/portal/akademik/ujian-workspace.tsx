'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  DoorOpen,
  Loader2,
  MapPin,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikModal,
  AkademikToast,
  BatchStudentAttendanceList,
  useAkademikToast,
} from './akademik-ui';

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface ExamPeriodRow {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
}

interface SupervisorRow {
  id: string;
  teacher_id: string;
  exam_date: string;
  session_name: string;
  jtm_allocated: number;
  original_teacher_id?: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

interface CommitteeRow {
  id: string;
  teacher_id: string;
  committee_role: string;
  jtm_allocated: number;
  original_teacher_id?: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

interface BapRow {
  id: string;
  exam_supervisor_id: string;
  report_date: string;
  present_students_count: number;
  absent_students_count: number;
  incidents: string | null;
  teacher?: { full_name: string } | null;
}

interface SupervisorAttRow {
  id: string;
  teacher_id: string;
  exam_supervisor_id: string | null;
  attendance_date?: string;
  admin_confirmed?: boolean;
  approved_jtm?: number | null;
  teacher?: { full_name: string } | null;
  exam_supervisor?: { jtm_allocated: number; exam_date: string; session_name: string } | null;
}

interface CommitteeAttRow {
  id: string;
  teacher_id: string;
  exam_committee_id: string | null;
  attendance_date: string;
  admin_confirmed: boolean;
  approved_jtm?: number | null;
  teacher?: { full_name: string } | null;
}

export type UjianSection =
  | 'periode'
  | 'pengawas'
  | 'panitia'
  | 'konfirmasi-pengawas'
  | 'bap'
  | 'pengganti'
  | 'absensi-siswa'
  | 'lpj-panitia';

export function UjianWorkspace({ section }: { section: UjianSection }) {
  const { hasPermission } = usePortalSession();
  const canManageUjian = hasPermission(PERMISSIONS.UJIAN_MANAGE);
  const canSubmitUjian = hasPermission(PERMISSIONS.PRESENSI_SUBMIT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [examPeriods, setExamPeriods] = useState<ExamPeriodRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [bapReports, setBapReports] = useState<BapRow[]>([]);
  const [committeeDailyReports, setCommitteeDailyReports] = useState<
    {
      id: string;
      attendance_id: string;
      exam_committee_id: string;
      report_date: string;
      activities_summary: string;
      jtm_credited: number;
      teacher?: { full_name: string } | null;
      committee?: { committee_role: string } | null;
    }[]
  >([]);
  const [supervisorAttendances, setSupervisorAttendances] = useState<SupervisorAttRow[]>([]);
  const [committeeAttendances, setCommitteeAttendances] = useState<CommitteeAttRow[]>([]);
  const [dailyGeofenceAttendances, setDailyGeofenceAttendances] = useState<
    { id: string; teacher_id: string; attendance_date: string }[]
  >([]);
  const [supervisorSessionConfirmations, setSupervisorSessionConfirmations] = useState<
    { id: string; exam_supervisor_id: string | null; teacher_id: string; approved_jtm: number }[]
  >([]);

  const [bapForm, setBapForm] = useState({
    exam_supervisor_id: '',
    present_students_count: 30,
    absent_students_count: 0,
    incidents: '',
  });
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [enrollments, setEnrollments] = useState<
    {
      student_id: string;
      classroom_id: string;
      student?: { id: string; full_name: string; nis: string | null; status: string } | null;
    }[]
  >([]);
  const [bapClassroomId, setBapClassroomId] = useState('');
  const [bapStudentStatuses, setBapStudentStatuses] = useState<
    Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>
  >({});

  const [subForm, setSubForm] = useState({
    committee_attendance_id: '',
    exam_supervisor_id: '',
    substitute_teacher_id: '',
    reason: '',
  });
  const [subCommitteeForm, setSubCommitteeForm] = useState({
    exam_committee_id: '',
    substitute_teacher_id: '',
    reason: '',
  });
  const [canManageCommittees, setCanManageCommittees] = useState(false);
  const [geofenceEnabled, setGeofenceEnabled] = useState(true);
  const [committeeConfirmForm, setCommitteeConfirmForm] = useState({
    exam_committee_id: '',
    attendance_date: getWibTodayDateString(),
  });
  const [confirmCommitteeId, setConfirmCommitteeId] = useState('');
  const [supAdjustModal, setSupAdjustModal] = useState<{
    sup: SupervisorRow;
    expectedJtm: number;
    approvedJtm: number;
  } | null>(null);
  const [supDiffModal, setSupDiffModal] = useState<{
    sup: SupervisorRow;
    expectedJtm: number;
    approvedJtm: number;
    diffJtm: number;
    recipientTeacherId: string;
    reason: string;
  } | null>(null);
  const [students, setStudents] = useState<{ id: string; full_name: string; nis: string | null }[]>([]);
  const [rooms, setRooms] = useState<
    {
      id: string;
      exam_period_id: string;
      room_name: string;
      capacity: number;
      period?: { name: string } | null;
    }[]
  >([]);
  const [examRoomStudents, setExamRoomStudents] = useState<
    {
      id: string;
      exam_period_id: string;
      exam_room_id: string;
      student_id: string;
      student?: { id: string; full_name: string; nis: string | null; status?: string | null } | null;
      room?: { id: string; room_name: string; exam_period_id: string } | null;
    }[]
  >([]);
  const [roomForm, setRoomForm] = useState({
    exam_period_id: '',
    room_name: '',
    capacity: 30,
  });
  const [selectedExamPeriodId, setSelectedExamPeriodId] = useState('');
  const [selectedExamRoomId, setSelectedExamRoomId] = useState('');
  const [examRoomClassroomFilter, setExamRoomClassroomFilter] = useState('');
  const [examRoomSearch, setExamRoomSearch] = useState('');
  const [examRoomOnlyUnassigned, setExamRoomOnlyUnassigned] = useState(true);
  const [selectedExamStudentIds, setSelectedExamStudentIds] = useState<string[]>([]);
  const [assigningExamStudents, setAssigningExamStudents] = useState(false);
  const [examStudentAttendances, setExamStudentAttendances] = useState<
    {
      id: string;
      exam_date: string;
      session_name: string;
      status: string;
      student?: { full_name: string } | null;
      room?: { room_name: string } | null;
    }[]
  >([]);
  const [examStudentAttForm, setExamStudentAttForm] = useState({
    committee_attendance_id: '',
    exam_period_id: '',
    exam_room_id: '',
    student_id: '',
    exam_date: getWibTodayDateString(),
    session_name: 'Sesi 1',
    status: 'HADIR' as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA',
  });
  const [committeeReportForm, setCommitteeReportForm] = useState({
    attendance_id: '',
    activities_summary: '',
    logistics_notes: '',
    issues_and_solutions: '',
  });

  const [periodForm, setPeriodForm] = useState({
    name: 'PAS Ganjil 2026/2027',
    start_date: '2026-12-01',
    end_date: '2026-12-10',
  });
  const [supervisorForm, setSupervisorForm] = useState({
    exam_period_id: '',
    teacher_id: '',
    exam_date: '2026-12-01',
    session_name: 'Sesi 1',
    jtm_allocated: 2,
  });
  const [committeeForm, setCommitteeForm] = useState({
    exam_period_id: '',
    teacher_id: '',
    committee_role: 'Ketua Panitia',
    jtm_allocated: 6,
  });

  const loadData = useCallback(async () => {
    try {
      const [biRes, ujRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
        fetch('/api/akademik/ujian', { cache: 'no-store' }),
      ]);
      const bi = await biRes.json();
      const uj = await ujRes.json();
      if (!biRes.ok) throw new Error(bi.error || 'Gagal memuat data GTK.');
      if (!ujRes.ok) throw new Error(uj.error || 'Gagal memuat data ujian.');

      setLoadError(null);

      setTeachers(bi.teachers || []);
      setExamPeriods(uj.periods || []);
      setSupervisors(uj.supervisors || []);
      setCommittees(uj.committees || []);
      setBapReports(uj.bapReports || []);
      setCommitteeDailyReports(uj.committeeDailyReports || []);
      setSupervisorAttendances(uj.supervisorAttendances || []);
      setCommitteeAttendances(uj.committeeAttendances || []);
      setDailyGeofenceAttendances(uj.dailyGeofenceAttendances || []);
      setSupervisorSessionConfirmations(uj.supervisorSessionConfirmations || []);
      setStudents(uj.students || []);
      setClassrooms(uj.classrooms || []);
      setEnrollments(uj.enrollments || []);
      const loadedPeriods: ExamPeriodRow[] = uj.periods || [];
      const loadedRooms: {
        id: string;
        exam_period_id: string;
        room_name: string;
        capacity: number;
        period?: { name: string } | null;
      }[] = uj.rooms || [];
      setRooms(loadedRooms);
      setExamRoomStudents(uj.examRoomStudents || []);

      setSelectedExamPeriodId((prevPeriodId) => {
        const activePeriodId =
          prevPeriodId && loadedPeriods.some((p) => p.id === prevPeriodId)
            ? prevPeriodId
            : loadedPeriods[0]?.id || '';
        setRoomForm((prev) =>
          prev.exam_period_id ? prev : { ...prev, exam_period_id: activePeriodId }
        );
        const periodRooms = loadedRooms.filter((r) => r.exam_period_id === activePeriodId);
        setSelectedExamRoomId((prevRoomId) =>
          prevRoomId && periodRooms.some((r) => r.id === prevRoomId)
            ? prevRoomId
            : periodRooms[0]?.id || ''
        );
        return activePeriodId;
      });

      setExamStudentAttendances(uj.studentAttendances || []);
      setCanManageCommittees(Boolean(uj.canManageCommittees));
      setGeofenceEnabled(uj.geofenceEnabled ?? true);
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

  async function postUjian(body: unknown, msg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/ujian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Terjadi kesalahan.');
        return false;
      }
      showToast('success', msg);
      await loadData();
      return true;
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  const studentClassroomMap = useMemo(() => {
    const clsNameById = new Map(classrooms.map((c) => [c.id, c.name]));
    const map = new Map<string, { classroom_id: string; classroom_name: string }>();
    for (const en of enrollments) {
      map.set(en.student_id, {
        classroom_id: en.classroom_id,
        classroom_name: clsNameById.get(en.classroom_id) || '-',
      });
    }
    return map;
  }, [classrooms, enrollments]);

  const roomsForSelectedPeriod = useMemo(
    () =>
      selectedExamPeriodId
        ? rooms.filter((r) => r.exam_period_id === selectedExamPeriodId)
        : rooms,
    [rooms, selectedExamPeriodId]
  );

  const countByExamRoomId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of examRoomStudents) {
      map.set(row.exam_room_id, (map.get(row.exam_room_id) || 0) + 1);
    }
    return map;
  }, [examRoomStudents]);

  const examAssignmentByStudentInPeriod = useMemo(() => {
    const map = new Map<string, { exam_room_id: string; room_name: string }>();
    for (const row of examRoomStudents) {
      if (row.exam_period_id === selectedExamPeriodId) {
        map.set(row.student_id, {
          exam_room_id: row.exam_room_id,
          room_name: row.room?.room_name || '-',
        });
      }
    }
    return map;
  }, [examRoomStudents, selectedExamPeriodId]);

  const selectedExamRoom = useMemo(
    () => rooms.find((r) => r.id === selectedExamRoomId) || null,
    [rooms, selectedExamRoomId]
  );

  const selectedExamRoomMembers = useMemo(
    () =>
      examRoomStudents
        .filter((row) => row.exam_room_id === selectedExamRoomId)
        .sort((a, b) =>
          (a.student?.full_name || '').localeCompare(b.student?.full_name || '', 'id')
        ),
    [examRoomStudents, selectedExamRoomId]
  );

  const availableStudentsForExamRoom = useMemo(() => {
    const q = examRoomSearch.trim().toLowerCase();
    return students.filter((st) => {
      const assigned = examAssignmentByStudentInPeriod.get(st.id);
      if (assigned?.exam_room_id === selectedExamRoomId) return false;
      if (examRoomOnlyUnassigned && assigned) return false;
      if (examRoomClassroomFilter) {
        const rombel = studentClassroomMap.get(st.id);
        if (!rombel || rombel.classroom_id !== examRoomClassroomFilter) return false;
      }
      if (!q) return true;
      return (
        st.full_name.toLowerCase().includes(q) ||
        (st.nis || '').toLowerCase().includes(q)
      );
    });
  }, [
    students,
    examAssignmentByStudentInPeriod,
    selectedExamRoomId,
    examRoomOnlyUnassigned,
    examRoomClassroomFilter,
    studentClassroomMap,
    examRoomSearch,
  ]);

  const bapSupervisorIds = useMemo(
    () => new Set(bapReports.map((b) => b.exam_supervisor_id)),
    [bapReports]
  );

  const attendedSupervisorIds = useMemo(
    () =>
      new Set(
        supervisorAttendances
          .map((a) => a.exam_supervisor_id)
          .filter((x): x is string => Boolean(x))
      ),
    [supervisorAttendances]
  );

  const confirmedSupervisorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sc of supervisorSessionConfirmations) {
      if (sc.exam_supervisor_id) ids.add(sc.exam_supervisor_id);
    }
    for (const a of supervisorAttendances) {
      if (a.admin_confirmed && a.exam_supervisor_id) ids.add(a.exam_supervisor_id);
    }
    return ids;
  }, [supervisorSessionConfirmations, supervisorAttendances]);

  const dailyCheckedInKeys = useMemo(
    () => new Set(dailyGeofenceAttendances.map((a) => `${a.teacher_id}:${a.attendance_date}`)),
    [dailyGeofenceAttendances]
  );

  // Jadwal pengawas ujian yang siap dikonfirmasi:
  // - Jika geofencing aktif: wajib sudah presensi geofencing 1x di hari ujian
  // - Jika geofencing nonaktif: pengawas / pengawas pengganti tidak wajib presensi geofencing
  const pendingSupervisorSessions = useMemo(
    () =>
      supervisors.filter(
        (s) =>
          !confirmedSupervisorIds.has(s.id) &&
          !bapSupervisorIds.has(s.id) &&
          (!geofenceEnabled || dailyCheckedInKeys.has(`${s.teacher_id}:${s.exam_date}`))
      ),
    [supervisors, confirmedSupervisorIds, bapSupervisorIds, dailyCheckedInKeys, geofenceEnabled]
  );

  const confirmedCommitteeAtts = useMemo(
    () => committeeAttendances.filter((c) => c.admin_confirmed),
    [committeeAttendances]
  );

  const confirmedCommitteeIds = useMemo(
    () =>
      new Set(
        confirmedCommitteeAtts
          .map((c) => c.exam_committee_id)
          .filter((x): x is string => Boolean(x))
      ),
    [confirmedCommitteeAtts]
  );

  const reportedCommitteeAttIds = useMemo(
    () => new Set(committeeDailyReports.map((r) => r.attendance_id)),
    [committeeDailyReports]
  );

  const reportedCommitteeIds = useMemo(
    () => new Set(committeeDailyReports.map((r) => r.exam_committee_id)),
    [committeeDailyReports]
  );

  const pendingCommitteeReports = useMemo(
    () => confirmedCommitteeAtts.filter((c) => !reportedCommitteeAttIds.has(c.id)),
    [confirmedCommitteeAtts, reportedCommitteeAttIds]
  );

  if (loading) {
    return <AkademikLoading label="Memuat data periode ujian..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      {/* Banner Alur Presensi, BAP & Konfirmasi Panitia */}
      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900">
            Alur Periode Ujian (Pengawas &amp; Panitia Ujian){' '}
            {!geofenceEnabled && (
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                Geofencing Nonaktif
              </span>
            )}
          </p>
          <p className="text-xs text-slate-600">
            {geofenceEnabled ? (
              <>
                Karena fitur geofencing diaktifkan Admin, Pengawas/Pengganti &amp; Panitia Ujian/Pengganti{' '}
                <strong>wajib melakukan Presensi GPS Geofencing</strong> terlebih dahulu. Pengawas wajib
                mengisi <strong>Berita Acara Pengawasan (BAP)</strong> agar JTM dihitung, sedangkan Panitia
                Ujian wajib <strong>dikonfirmasi Admin</strong> sebelum menunjuk pengawas pengganti.
              </>
            ) : (
              <>
                Fitur geofencing sedang <strong>dinonaktifkan oleh Admin</strong>. Pengawas/Pengganti dan
                Panitia Ujian/Pengganti <strong>tidak wajib presensi geofencing</strong> dan dapat
                langsung dikonfirmasi kehadirannya oleh Admin atau Panitia Ujian.
              </>
            )}
          </p>
        </div>
        <Link
          href="/portal/akademik/presensi/gps"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 transition"
        >
          <MapPin className="w-4 h-4" /> {geofenceEnabled ? 'Buka Presensi GPS' : 'Buka Presensi'}
        </Link>
      </div>

      {section === 'periode' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">
            {canManageUjian && (
            <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
              <h1 className="text-sm font-bold text-slate-900">Buat Periode Ujian</h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postUjian(
                    { action: 'CREATE_PERIOD', ...periodForm },
                    'Periode ujian dibuat.'
                  );
                }}
                className="space-y-2.5"
              >
                <input
                  required
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={periodForm.start_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    type="date"
                    value={periodForm.end_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Periode Ujian
                </button>
              </form>
            </div>
            )}

            <div className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
              <h2 className="text-base font-bold text-slate-900">
                Daftar Periode Ujian ({examPeriods.length})
              </h2>
              {examPeriods.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Belum ada periode ujian yang dibuat.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {examPeriods.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedExamPeriodId(p.id);
                        setRoomForm((prev) => ({ ...prev, exam_period_id: p.id }));
                        const firstRoom = rooms.find((r) => r.exam_period_id === p.id);
                        setSelectedExamRoomId(firstRoom?.id || '');
                        setSelectedExamStudentIds([]);
                      }}
                      className={`modular-card rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer border transition ${
                        selectedExamPeriodId === p.id
                          ? 'border-emerald-500 bg-emerald-50/40'
                          : 'border-slate-200/80'
                      }`}
                    >
                      <span className="font-bold text-slate-900">{p.name}</span>
                      <span className="text-slate-500">
                        {p.start_date} s.d. {p.end_date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {canManageUjian && (
              <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-emerald-700" /> Buat Ruang Ujian
                </h2>
                <p className="text-[11px] text-slate-500">
                  Ruang ujian terpisah dari rombel reguler (dapat berisi campuran siswa dari beberapa rombel).
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await postUjian(
                      {
                        action: 'CREATE_ROOM',
                        exam_period_id: roomForm.exam_period_id || selectedExamPeriodId,
                        room_name: roomForm.room_name,
                        capacity: Number(roomForm.capacity) || 30,
                      },
                      'Ruang ujian berhasil ditambahkan.'
                    );
                    if (ok) {
                      setRoomForm((prev) => ({ ...prev, room_name: '', capacity: 30 }));
                    }
                  }}
                  className="space-y-2.5"
                >
                  <select
                    required
                    value={roomForm.exam_period_id || selectedExamPeriodId}
                    onChange={(e) => {
                      setRoomForm({ ...roomForm, exam_period_id: e.target.value });
                      setSelectedExamPeriodId(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Periode Ujian --</option>
                    {examPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      required
                      placeholder="Nama Ruang (cth: Ruang 01)"
                      value={roomForm.room_name}
                      onChange={(e) => setRoomForm({ ...roomForm, room_name: e.target.value })}
                      className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="Kapasitas"
                      value={roomForm.capacity}
                      onChange={(e) =>
                        setRoomForm({ ...roomForm, capacity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      title="Kapasitas Ruang"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Ruang Ujian
                  </button>
                </form>
              </div>
            )}

            <div className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-emerald-700" /> Daftar Ruang Ujian ({roomsForSelectedPeriod.length})
                </h2>
                <select
                  value={selectedExamPeriodId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedExamPeriodId(pid);
                    const firstRoom = rooms.find((r) => r.exam_period_id === pid);
                    setSelectedExamRoomId(firstRoom?.id || '');
                    setSelectedExamStudentIds([]);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  {examPeriods.length === 0 ? (
                    <option value="">Belum ada periode</option>
                  ) : (
                    examPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {roomsForSelectedPeriod.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Belum ada ruang ujian pada periode ini. Silakan buat ruang ujian terlebih dahulu.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
                  {roomsForSelectedPeriod.map((r) => {
                    const count = countByExamRoomId.get(r.id) || 0;
                    const isSelected = selectedExamRoomId === r.id;
                    return (
                      <div
                        key={r.id}
                        className={`modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 text-xs border transition ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                            : 'border-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{r.room_name}</p>
                          <p className="text-[11px] text-slate-500">
                            Peserta: <strong className="text-emerald-700">{count}</strong> / {r.capacity} kursi
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExamRoomId(r.id);
                            setSelectedExamStudentIds([]);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-[11px] shrink-0 transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <Users className="w-3 h-3" /> Kelola Peserta
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {roomsForSelectedPeriod.length > 0 && (
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-700" /> Penempatan Siswa ke Ruang Ujian
                  </h2>
                  <p className="text-xs text-slate-500">
                    Masukkan siswa ke ruang ujian pada periode terpilih. Siswa dapat diambil dari rombel mana saja (tidak terikat rombel).
                  </p>
                </div>
                <select
                  value={selectedExamRoomId}
                  onChange={(e) => {
                    setSelectedExamRoomId(e.target.value);
                    setSelectedExamStudentIds([]);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {roomsForSelectedPeriod.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_name} ({countByExamRoomId.get(r.id) || 0}/{r.capacity} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              <div className={`grid gap-4 ${canManageUjian ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {canManageUjian && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">
                        Pilih Siswa untuk {selectedExamRoom?.room_name || 'Ruang Ujian'}
                      </p>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={examRoomOnlyUnassigned}
                          onChange={(e) => setExamRoomOnlyUnassigned(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        Belum dapat ruang di periode ini
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      <select
                        value={examRoomClassroomFilter}
                        onChange={(e) => setExamRoomClassroomFilter(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Filter Rombel Asal (Semua) --</option>
                        {classrooms.map((c) => (
                          <option key={c.id} value={c.id}>
                            Rombel {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Cari nama siswa / NIS..."
                          value={examRoomSearch}
                          onChange={(e) => setExamRoomSearch(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{availableStudentsForExamRoom.length} siswa tersedia</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedExamStudentIds(availableStudentsForExamRoom.map((s) => s.id))
                          }
                          className="text-emerald-700 font-semibold hover:underline"
                        >
                          Pilih Semua
                        </button>
                        {selectedExamStudentIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedExamStudentIds([])}
                            className="text-slate-500 hover:underline"
                          >
                            Reset ({selectedExamStudentIds.length})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {availableStudentsForExamRoom.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">
                          Tidak ada siswa yang sesuai filter.
                        </p>
                      ) : (
                        availableStudentsForExamRoom.map((st) => {
                          const checked = selectedExamStudentIds.includes(st.id);
                          const rombel = studentClassroomMap.get(st.id);
                          const currentRoom = examAssignmentByStudentInPeriod.get(st.id);
                          return (
                            <label
                              key={st.id}
                              className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedExamStudentIds((prev) =>
                                      prev.includes(st.id)
                                        ? prev.filter((id) => id !== st.id)
                                        : [...prev, st.id]
                                    )
                                  }
                                  className="rounded border-slate-300 text-emerald-600"
                                />
                                <div className="truncate">
                                  <span className="font-semibold text-slate-900">{st.full_name}</span>
                                  {st.nis && <span className="text-slate-400 ml-1.5">({st.nis})</span>}
                                  {rombel && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                      {rombel.classroom_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {currentRoom && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold shrink-0">
                                  Pindah dari {currentRoom.room_name}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        assigningExamStudents ||
                        selectedExamStudentIds.length === 0 ||
                        !selectedExamRoomId ||
                        !selectedExamPeriodId
                      }
                      onClick={async () => {
                        setAssigningExamStudents(true);
                        try {
                          const ok = await postUjian(
                            {
                              action: 'ASSIGN_EXAM_ROOM_STUDENTS',
                              exam_period_id: selectedExamPeriodId,
                              exam_room_id: selectedExamRoomId,
                              student_ids: selectedExamStudentIds,
                            },
                            `${selectedExamStudentIds.length} siswa berhasil ditempatkan ke ${selectedExamRoom?.room_name || 'ruang ujian'}.`
                          );
                          if (ok) setSelectedExamStudentIds([]);
                        } finally {
                          setAssigningExamStudents(false);
                        }
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl text-xs transition"
                    >
                      {assigningExamStudents
                        ? 'Menyimpan...'
                        : `Masukkan ke Ruang Ujian (${selectedExamStudentIds.length} Siswa)`}
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">
                      Peserta {selectedExamRoom?.room_name || 'Ruang Ujian'} ({selectedExamRoomMembers.length} / {selectedExamRoom?.capacity ?? '-'})
                    </p>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {selectedExamRoomMembers.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">
                        Belum ada siswa ditempatkan di ruang ujian ini.
                      </p>
                    ) : (
                      selectedExamRoomMembers.map((member, idx) => {
                        const rombel = studentClassroomMap.get(member.student_id);
                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200/80 text-xs"
                          >
                            <div className="truncate">
                              <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                              <span className="font-semibold text-slate-900">
                                {member.student?.full_name || 'Siswa'}
                              </span>
                              {member.student?.nis && (
                                <span className="text-slate-400 ml-1.5">({member.student.nis})</span>
                              )}
                              {rombel && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                  {rombel.classroom_name}
                                </span>
                              )}
                            </div>
                            {canManageUjian && (
                              <button
                                type="button"
                                onClick={() =>
                                  postUjian(
                                    {
                                      action: 'REMOVE_EXAM_ROOM_STUDENT',
                                      exam_room_student_id: member.id,
                                    },
                                    `Siswa ${member.student?.full_name || ''} dikeluarkan dari ruang ujian.`
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold shrink-0 transition"
                                title="Keluarkan dari ruang ujian"
                              >
                                <Trash2 className="w-3 h-3" /> Keluarkan
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'pengawas' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManageUjian && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
            <h2 className="text-sm font-bold text-slate-900">
              Tugaskan Pengawas Ruang Ujian (Atur JTM)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postUjian(
                  { action: 'ASSIGN_SUPERVISOR', ...supervisorForm },
                  'Pengawas Ruang Ujian & alokasi JTM disimpan.'
                );
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={supervisorForm.exam_period_id}
                onChange={(e) =>
                  setSupervisorForm({ ...supervisorForm, exam_period_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Periode Ujian --</option>
                {examPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={supervisorForm.teacher_id}
                onChange={(e) =>
                  setSupervisorForm({ ...supervisorForm, teacher_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru Pengawas --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={supervisorForm.exam_date}
                        onChange={(e) =>
                          setSupervisorForm({ ...supervisorForm, exam_date: e.target.value })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"
                      />
                      <input
                        value={supervisorForm.session_name}
                        onChange={(e) =>
                          setSupervisorForm({ ...supervisorForm, session_name: e.target.value })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        value={supervisorForm.jtm_allocated}
                        onChange={(e) =>
                          setSupervisorForm({
                            ...supervisorForm,
                            jtm_allocated: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        title="Alokasi JTM"
                        className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Pengawas Ujian
                    </button>
            </form>
          </div>
          )}

          <div className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
            <h2 className="text-base font-bold text-slate-900">
              Daftar Pengawas Ruang Ujian ({supervisors.length})
            </h2>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {supervisors.map((sup) => {
                const hasAtt =
                  attendedSupervisorIds.has(sup.id) ||
                  dailyCheckedInKeys.has(`${sup.teacher_id}:${sup.exam_date}`);
                const isConfirmed = confirmedSupervisorIds.has(sup.id);
                const hasBap = bapSupervisorIds.has(sup.id);
                return (
                  <div
                    key={sup.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {sup.teacher?.full_name}
                        {sup.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {sup.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {sup.exam_date} • {sup.session_name} •{' '}
                        {hasBap
                          ? 'BAP Selesai (JTM Dihitung)'
                          : isConfirmed
                          ? 'Terkonfirmasi (Siap Input BAP)'
                          : hasAtt
                          ? 'Sudah Presensi (Menunggu Konfirmasi Admin/Panitia)'
                          : 'Belum Presensi GPS'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                        hasBap
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {hasBap ? `+${sup.jtm_allocated} JTM` : `0/${sup.jtm_allocated} JTM`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {section === 'panitia' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManageUjian && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
            <h2 className="text-sm font-bold text-slate-900">
              Tugaskan Panitia Ujian (Atur JTM)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postUjian(
                  { action: 'ASSIGN_COMMITTEE', ...committeeForm },
                  'Panitia Ujian & alokasi JTM disimpan.'
                );
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={committeeForm.exam_period_id}
                onChange={(e) =>
                  setCommitteeForm({ ...committeeForm, exam_period_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Periode Ujian --</option>
                {examPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={committeeForm.teacher_id}
                onChange={(e) =>
                  setCommitteeForm({ ...committeeForm, teacher_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru Panitia --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Jabatan Panitia"
                  value={committeeForm.committee_role}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, committee_role: e.target.value })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  value={committeeForm.jtm_allocated}
                  onChange={(e) =>
                    setCommitteeForm({
                      ...committeeForm,
                      jtm_allocated: Number(e.target.value),
                    })
                  }
                  placeholder="JTM"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan Panitia Ujian
              </button>
            </form>
          </div>
          )}

          <div className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
            <h2 className="text-base font-bold text-slate-900">
              Daftar Panitia Ujian ({committees.length})
            </h2>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {committees.map((com) => {
                const isConfirmed = confirmedCommitteeIds.has(com.id);
                const hasLpj = reportedCommitteeIds.has(com.id);
                return (
                  <div
                    key={com.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {com.teacher?.full_name} — {com.committee_role}
                        {com.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {com.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {hasLpj
                          ? 'LPJ Harian Terkirim (JTM Dihitung)'
                          : isConfirmed
                          ? 'Terkonfirmasi Admin (Wajib Isi LPJ Harian)'
                          : 'Belum Dikonfirmasi Admin'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                        hasLpj
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {hasLpj ? `+${com.jtm_allocated} JTM` : `0/${com.jtm_allocated} JTM`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

          {/* Konfirmasi Kehadiran Pengawas Ujian (Admin / Panitia Ujian Terkonfirmasi Admin) */}
          {section === 'konfirmasi-pengawas' && (
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" /> Konfirmasi Kehadiran Pengawas
              Ujian (Admin / Panitia)
            </h2>
            <p className="text-xs text-slate-600">
              Pengawas / Pengawas Pengganti wajib dikonfirmasi kehadirannya oleh Admin atau Panitia
              Ujian/Panitia Pengganti terkonfirmasi Admin sebelum dapat mengisi BAP.
            </p>
            {confirmedCommitteeAtts.length > 0 && (
              <select
                value={confirmCommitteeId}
                onChange={(e) => setConfirmCommitteeId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">
                  {canManageCommittees
                    ? '-- Konfirmasi sebagai Admin (atau pilih Panitia Ujian Terkonfirmasi) --'
                    : '-- Pilih Presensi Panitia Ujian Anda untuk Mengonfirmasi Pengawas --'}
                </option>
                {confirmedCommitteeAtts.map((c) => (
                  <option key={c.id} value={c.id}>
                    Panitia: {c.teacher?.full_name} ({c.attendance_date})
                  </option>
                ))}
              </select>
            )}
            {pendingSupervisorSessions.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                {geofenceEnabled
                  ? 'Tidak ada jadwal pengawas yang menunggu konfirmasi (pastikan pengawas sudah presensi geofencing 1x pada tanggal ujian).'
                  : 'Semua jadwal pengawas sudah dikonfirmasi atau belum ada jadwal pengawas yang dibuat.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {pendingSupervisorSessions.map((sup) => {
                  const canConfirmSup = canManageCommittees || Boolean(confirmCommitteeId);
                  const hasCheckedIn = dailyCheckedInKeys.has(`${sup.teacher_id}:${sup.exam_date}`);
                  return (
                    <div
                      key={sup.id}
                      className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {sup.teacher?.full_name || 'Pengawas'}
                        </p>
                        <p className="text-slate-500">
                          {sup.exam_date} • {sup.session_name} ({sup.jtm_allocated} JTM) •{' '}
                          {hasCheckedIn
                            ? 'Sudah Presensi Harian'
                            : 'Geofencing Nonaktif — Siap Dikonfirmasi'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canConfirmSup}
                        onClick={() => {
                          const expectedJtm = sup.jtm_allocated ?? 2;
                          setSupAdjustModal({
                            sup,
                            expectedJtm,
                            approvedJtm: expectedJtm,
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold shrink-0"
                      >
                        Konfirmasi Jadwal
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {section === 'konfirmasi-pengawas' && !geofenceEnabled && canManageCommittees && (
            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-700" /> Konfirmasi Kehadiran Panitia Ujian (Tanpa Geofencing)
              </h2>
              <p className="text-xs text-slate-600">
                Karena fitur geofencing dinonaktifkan Admin, Panitia Ujian / Panitia Pengganti tidak
                wajib presensi GPS terlebih dahulu. Admin dapat mengonfirmasi kehadiran panitia di sini
                agar dapat mengonfirmasi pengawas, menunjuk pengganti, dan mengisi LPJ Harian.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postUjian(
                    {
                      action: 'CONFIRM_COMMITTEE_WITHOUT_GEOFENCE',
                      ...committeeConfirmForm,
                    },
                    'Kehadiran Panitia Ujian berhasil dikonfirmasi (tanpa geofencing).'
                  );
                }}
                className="grid sm:grid-cols-3 gap-2.5"
              >
                <select
                  required
                  value={committeeConfirmForm.exam_committee_id}
                  onChange={(e) =>
                    setCommitteeConfirmForm({
                      ...committeeConfirmForm,
                      exam_committee_id: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
                >
                  <option value="">-- Pilih Panitia Ujian / Panitia Pengganti --</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.committee_role} • {c.teacher?.full_name} ({c.jtm_allocated} JTM)
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={committeeConfirmForm.attendance_date}
                  onChange={(e) =>
                    setCommitteeConfirmForm({
                      ...committeeConfirmForm,
                      attendance_date: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="sm:col-span-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Konfirmasi Hadir Panitia Ujian
                </button>
              </form>
            </div>
          )}

          {/* Input Berita Acara Pengawasan (BAP) - Req #6 */}
          {section === 'bap' && (
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700" /> Berita Acara Pengawasan (BAP)
            </h2>
            <p className="text-xs text-slate-600">
              {geofenceEnabled
                ? 'Pengawas ujian wajib melakukan presensi GPS terlebih dahulu serta dikonfirmasi kehadirannya oleh Admin atau Panitia Ujian sebelum mengisi BAP di bawah ini.'
                : 'Pengawas ujian wajib dikonfirmasi kehadirannya oleh Admin atau Panitia Ujian sebelum mengisi BAP di bawah ini (presensi GPS geofencing tidak wajib karena fitur dinonaktifkan Admin).'}{' '}
              Keterlambatan input: H+1 (80%), H+2 (60%), H+3 (40%), H+4 (20%), H+5 (10%), Hari
              Minggu tidak dihitung.
            </p>
            {isSundayDate(getWibTodayDateString()) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Hari Minggu tidak ada pengisian BAP. Silakan input pada hari Senin atau hari aktif
                berikutnya.
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitting) return;
                if (bapForm.exam_supervisor_id && Object.keys(bapStudentStatuses).length > 0) {
                  const records = Object.entries(bapStudentStatuses).map(([student_id, status]) => ({
                    student_id,
                    status,
                  }));
                  const attOk = await postUjian(
                    {
                      action: 'BATCH_EXAM_STUDENT_ATTENDANCE',
                      exam_supervisor_id: bapForm.exam_supervisor_id,
                      records,
                    },
                    'Absensi batch siswa ujian disimpan.'
                  );
                  if (!attOk) return;
                }
                const bapOk = await postUjian(
                  { action: 'SUBMIT_BAP', ...bapForm },
                  'Berita Acara Pengawasan (BAP) & absensi siswa ujian disimpan, JTM pengawas dihitung.'
                );
                if (bapOk) {
                  setBapClassroomId('');
                  setBapStudentStatuses({});
                  setBapForm({
                    exam_supervisor_id: '',
                    present_students_count: 30,
                    absent_students_count: 0,
                    incidents: '',
                  });
                }
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={bapForm.exam_supervisor_id}
                onChange={(e) => setBapForm({ ...bapForm, exam_supervisor_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">
                  -- Pilih Jadwal Pengawas (Terkonfirmasi Admin/Panitia, Belum BAP) --
                </option>
                {supervisors
                  .filter((s) => confirmedSupervisorIds.has(s.id) && !bapSupervisorIds.has(s.id))
                  .map((s) => {
                    const preview = calculateLateJtm(s.jtm_allocated, s.exam_date);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.exam_date} • {s.session_name} • {s.teacher?.full_name} (
                        {preview.creditedJtm}/{s.jtm_allocated} JTM •{' '}
                        {preview.delayDays === 0
                          ? 'Hari Ini 100%'
                          : `H+${preview.delayDays}: ${preview.percentage}%`}
                        )
                      </option>
                    );
                  })}
              </select>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Absensi Siswa Ujian per Kelas (Batch) oleh Pengawas / Pengganti
                  </p>
                  {(() => {
                    const classStudents = bapClassroomId
                      ? enrollments
                          .filter((en) => en.classroom_id === bapClassroomId && en.student)
                          .map((en) => en.student!)
                      : [];
                    if (classStudents.length === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const allPresent: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                          for (const st of classStudents) allPresent[st.id] = 'HADIR';
                          setBapStudentStatuses(allPresent);
                          setBapForm((prev) => ({
                            ...prev,
                            present_students_count: classStudents.length,
                            absent_students_count: 0,
                          }));
                        }}
                        className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold hover:bg-emerald-200"
                      >
                        Tandai Semua Hadir ({classStudents.length})
                      </button>
                    );
                  })()}
                </div>

                <select
                  value={bapClassroomId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setBapClassroomId(cid);
                    const classStudents = cid
                      ? enrollments
                          .filter((en) => en.classroom_id === cid && en.student)
                          .map((en) => en.student!)
                      : [];
                    const next: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                    for (const st of classStudents) next[st.id] = 'HADIR';
                    setBapStudentStatuses(next);
                    if (classStudents.length > 0) {
                      setBapForm((prev) => ({
                        ...prev,
                        present_students_count: classStudents.length,
                        absent_students_count: 0,
                      }));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">-- Pilih Kelas Peserta Ujian (Batch) --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {bapClassroomId &&
                  (() => {
                    const classStudents = enrollments
                      .filter((en) => en.classroom_id === bapClassroomId && en.student)
                      .map((en) => en.student!);
                    if (classStudents.length === 0) {
                      return (
                        <p className="text-[11px] text-amber-700">
                          Belum ada siswa terdaftar di kelas ini.
                        </p>
                      );
                    }
                    return (
                      <BatchStudentAttendanceList
                        students={classStudents}
                        statuses={bapStudentStatuses}
                        onChangeStatus={(studentId, statusOpt) => {
                          const next = { ...bapStudentStatuses, [studentId]: statusOpt };
                          setBapStudentStatuses(next);
                          const presentCount = classStudents.filter(
                            (x) => (next[x.id] || 'HADIR') === 'HADIR'
                          ).length;
                          const absentCount = classStudents.length - presentCount;
                          setBapForm((prev) => ({
                            ...prev,
                            present_students_count: presentCount,
                            absent_students_count: absentCount,
                          }));
                        }}
                      />
                    );
                  })()}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={bapForm.present_students_count}
                  onChange={(e) =>
                    setBapForm({ ...bapForm, present_students_count: Number(e.target.value) })
                  }
                  placeholder="Jumlah Siswa Hadir"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={bapForm.absent_students_count}
                  onChange={(e) =>
                    setBapForm({ ...bapForm, absent_students_count: Number(e.target.value) })
                  }
                  placeholder="Jumlah Siswa Tidak Hadir"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Catatan / kejadian selama pengawasan ujian (opsional)"
                value={bapForm.incidents}
                onChange={(e) => setBapForm({ ...bapForm, incidents: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={submitting || isSundayDate(getWibTodayDateString())}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan BAP &amp; Hitung JTM Pengawas
              </button>
            </form>
          </div>
          )}

          {/* Penunjukkan Pengawas Pengganti oleh Panitia Ujian - Req #7 */}
          {section === 'pengganti' && (
          <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" /> Penunjukkan Pengawas Pengganti (Panitia Ujian)
            </h2>
            <p className="text-xs text-slate-600">
              {geofenceEnabled
                ? 'Hanya Panitia Ujian yang sudah presensi GPS & dikonfirmasi Admin yang dapat menunjuk pengawas pengganti.'
                : 'Hanya Panitia Ujian yang sudah dikonfirmasi kehadirannya oleh Admin yang dapat menunjuk pengawas pengganti.'}
            </p>
            {confirmedCommitteeAtts.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                {geofenceEnabled
                  ? 'Belum ada Panitia Ujian yang dikonfirmasi kehadirannya oleh Admin di menu Presensi GPS.'
                  : 'Belum ada Panitia Ujian yang dikonfirmasi kehadirannya oleh Admin (konfirmasi melalui menu Konfirmasi Pengawas atau Presensi).'}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postUjian(
                  { action: 'SUBSTITUTE_SUPERVISOR', ...subForm },
                  geofenceEnabled
                    ? 'Pengawas pengganti berhasil ditunjuk. Pengawas pengganti wajib presensi GPS & isi BAP.'
                    : 'Pengawas pengganti berhasil ditunjuk. Pengawas pengganti siap dikonfirmasi & mengisi BAP.'
                );
                if (ok) {
                  setSubForm({
                    committee_attendance_id: '',
                    exam_supervisor_id: '',
                    substitute_teacher_id: '',
                    reason: '',
                  });
                }
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={subForm.committee_attendance_id}
                onChange={(e) =>
                  setSubForm({ ...subForm, committee_attendance_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Panitia Ujian Terkonfirmasi Admin --</option>
                {confirmedCommitteeAtts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.attendance_date} • {c.teacher?.full_name} (Terkonfirmasi)
                  </option>
                ))}
              </select>
              <select
                required
                value={subForm.exam_supervisor_id}
                onChange={(e) => setSubForm({ ...subForm, exam_supervisor_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Jadwal Pengawas yang Berhalangan --</option>
                {supervisors
                  .filter((s) => !bapSupervisorIds.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.exam_date} • {s.session_name} • {s.teacher?.full_name}
                    </option>
                  ))}
              </select>
              <select
                required
                value={subForm.substitute_teacher_id}
                onChange={(e) =>
                  setSubForm({ ...subForm, substitute_teacher_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru Pengawas Pengganti --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                value={subForm.reason}
                onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={confirmedCommitteeAtts.length === 0}
                className="w-full bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Tunjuk Pengawas Pengganti
              </button>
            </form>
          </div>

          {/* Penunjukkan Panitia Ujian Pengganti (Admin / Kurikulum / TU) */}
          {canManageCommittees && (
            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-700" /> Penunjukkan Panitia Ujian Pengganti
              </h2>
              <p className="text-xs text-slate-600">
                Jika ada anggota Panitia Ujian berhalangan, Admin/Kurikulum dapat menunjuk Panitia
                Pengganti.{' '}
                {geofenceEnabled
                  ? 'Panitia Pengganti wajib presensi GPS (`PANITIA_UJIAN`) dan dikonfirmasi Admin agar JTM-nya dihitung.'
                  : 'Panitia Pengganti wajib dikonfirmasi Admin agar JTM-nya dihitung (tanpa wajib presensi GPS geofencing).'}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await postUjian(
                    { action: 'SUBSTITUTE_COMMITTEE', ...subCommitteeForm },
                    geofenceEnabled
                      ? 'Panitia Ujian Pengganti berhasil ditunjuk. Wajib presensi GPS & konfirmasi Admin.'
                      : 'Panitia Ujian Pengganti berhasil ditunjuk. Siap dikonfirmasi Admin.'
                  );
                  if (ok) {
                    setSubCommitteeForm({
                      exam_committee_id: '',
                      substitute_teacher_id: '',
                      reason: '',
                    });
                  }
                }}
                className="space-y-2.5"
              >
                <select
                  required
                  value={subCommitteeForm.exam_committee_id}
                  onChange={(e) =>
                    setSubCommitteeForm({ ...subCommitteeForm, exam_committee_id: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Panitia Ujian yang Berhalangan --</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.committee_role} • {c.teacher?.full_name} ({c.jtm_allocated} JTM)
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={subCommitteeForm.substitute_teacher_id}
                  onChange={(e) =>
                    setSubCommitteeForm({
                      ...subCommitteeForm,
                      substitute_teacher_id: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Guru Panitia Pengganti --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                  value={subCommitteeForm.reason}
                  onChange={(e) =>
                    setSubCommitteeForm({ ...subCommitteeForm, reason: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full bg-sky-700 hover:bg-sky-800 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Tunjuk Panitia Ujian Pengganti
                </button>
              </form>
            </div>
          )}
          </div>
          )}

      {/* Absensi Siswa Ujian (Khusus Panitia / Panitia Pengganti Terkonfirmasi Admin) */}
      {section === 'absensi-siswa' && (
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Absensi Siswa Ujian oleh Panitia Ujian ({examStudentAttendances.length})
          </h2>
          <p className="text-xs text-slate-600">
            Hanya dapat dilakukan oleh <strong>Panitia Ujian / Panitia Pengganti</strong> yang
            kehadirannya sudah dikonfirmasi Admin. (Pengawas / Pengawas Pengganti mencantumkan
            jumlah siswa hadir/tidak hadir &amp; catatan langsung di dalam{' '}
            <strong>Berita Acara Pengawasan (BAP)</strong>).
          </p>
        </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {(canManageCommittees || confirmedCommitteeAtts.length > 0) && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await postUjian(
                    {
                      action: 'EXAM_STUDENT_ATTENDANCE',
                      committee_attendance_id: examStudentAttForm.committee_attendance_id,
                      exam_period_id: examStudentAttForm.exam_period_id,
                      exam_room_id: examStudentAttForm.exam_room_id || null,
                      student_id: examStudentAttForm.student_id,
                      exam_date: examStudentAttForm.exam_date,
                      session_name: examStudentAttForm.session_name,
                      status: examStudentAttForm.status,
                    },
                    'Absensi siswa ujian berhasil dicatat.'
                  );
                  if (ok) {
                    setExamStudentAttForm((prev) => ({ ...prev, student_id: '' }));
                  }
                }}
                className="lg:col-span-6 space-y-2.5"
              >
            <select
              required
              value={examStudentAttForm.committee_attendance_id}
              onChange={(e) =>
                setExamStudentAttForm({
                  ...examStudentAttForm,
                  committee_attendance_id: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Panitia Ujian / Pengganti Terkonfirmasi Admin --</option>
              {confirmedCommitteeAtts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.attendance_date} • {c.teacher?.full_name} (Terkonfirmasi Admin)
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                required
                value={examStudentAttForm.exam_period_id}
                onChange={(e) =>
                  setExamStudentAttForm({ ...examStudentAttForm, exam_period_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Periode Ujian --</option>
                {examPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={examStudentAttForm.exam_room_id}
                onChange={(e) =>
                  setExamStudentAttForm({ ...examStudentAttForm, exam_room_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Ruang Ujian (Opsional) --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                value={examStudentAttForm.exam_date}
                onChange={(e) =>
                  setExamStudentAttForm({ ...examStudentAttForm, exam_date: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <input
                required
                placeholder="Sesi (mis. Sesi 1)"
                value={examStudentAttForm.session_name}
                onChange={(e) =>
                  setExamStudentAttForm({ ...examStudentAttForm, session_name: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                required
                value={examStudentAttForm.student_id}
                onChange={(e) =>
                  setExamStudentAttForm({ ...examStudentAttForm, student_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.nis ? `(${s.nis})` : ''}
                  </option>
                ))}
              </select>
              <select
                value={examStudentAttForm.status}
                onChange={(e) =>
                  setExamStudentAttForm({
                    ...examStudentAttForm,
                    status: e.target.value as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA',
                  })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="HADIR">HADIR</option>
                <option value="SAKIT">SAKIT</option>
                <option value="IZIN">IZIN</option>
                <option value="ALPA">ALPA</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={confirmedCommitteeAtts.length === 0}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan Absensi Siswa Ujian
            </button>
          </form>
          )}

          <div className={`${canManageCommittees || confirmedCommitteeAtts.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-2 max-h-72 overflow-y-auto`}>
            {examStudentAttendances.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Belum ada catatan absensi siswa ujian.
              </p>
            ) : (
              examStudentAttendances.slice(0, 20).map((esa) => (
                <div
                  key={esa.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{esa.student?.full_name || 'Siswa'}</p>
                    <p className="text-slate-500">
                      {esa.exam_date} • {esa.session_name} • {esa.room?.room_name || 'Ruang'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold ${
                      esa.status === 'HADIR'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {esa.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}

      {/* Laporan Pertanggungjawaban Harian (LPJ Harian) Panitia Ujian */}
      {section === 'lpj-panitia' && (
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Laporan Pertanggungjawaban Harian Panitia Ujian ({committeeDailyReports.length})
          </h2>
          <p className="text-xs text-slate-600">
            Setelah kehadiran dikonfirmasi Admin,{' '}
            <strong>Panitia Ujian / Panitia Pengganti</strong> wajib mengisi Laporan
            Pertanggungjawaban Harian (LPJ) di bawah ini agar JTM panitia dihitung untuk
            honorarium.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {canSubmitUjian && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await postUjian(
                { action: 'SUBMIT_COMMITTEE_REPORT', ...committeeReportForm },
                'LPJ Harian Panitia Ujian disimpan & JTM panitia dihitung.'
              );
              if (ok) {
                setCommitteeReportForm({
                  attendance_id: '',
                  activities_summary: '',
                  logistics_notes: '',
                  issues_and_solutions: '',
                });
              }
            }}
            className="lg:col-span-6 space-y-2.5"
          >
            <select
              required
              value={committeeReportForm.attendance_id}
              onChange={(e) =>
                setCommitteeReportForm({ ...committeeReportForm, attendance_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">
                -- Pilih Presensi Panitia Terkonfirmasi ({pendingCommitteeReports.length} menunggu
                LPJ) --
              </option>
              {pendingCommitteeReports.map((c) => {
                const com = committees.find((x) => x.id === c.exam_committee_id);
                const jtmVal = c.approved_jtm != null ? c.approved_jtm : com?.jtm_allocated ?? 4;
                return (
                  <option key={c.id} value={c.id}>
                    {c.attendance_date} • {c.teacher?.full_name} ({com?.committee_role || 'Panitia'}{' '}
                    • {jtmVal} JTM)
                  </option>
                );
              })}
            </select>

            <textarea
              required
              rows={2}
              placeholder="Ringkasan pelaksanaan tugas & koordinasi panitia ujian hari ini..."
              value={committeeReportForm.activities_summary}
              onChange={(e) =>
                setCommitteeReportForm({
                  ...committeeReportForm,
                  activities_summary: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <input
              placeholder="Catatan logistik (distribusi naskah, kesiapan ruang, kehadiran pengawas)"
              value={committeeReportForm.logistics_notes}
              onChange={(e) =>
                setCommitteeReportForm({ ...committeeReportForm, logistics_notes: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <input
              placeholder="Kendala & solusi penanganan selama ujian (opsional)"
              value={committeeReportForm.issues_and_solutions}
              onChange={(e) =>
                setCommitteeReportForm({
                  ...committeeReportForm,
                  issues_and_solutions: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <button
              type="submit"
              disabled={submitting || pendingCommitteeReports.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan LPJ Harian Panitia &amp; Hitung JTM
            </button>
          </form>
          )}

          <div className={`${canSubmitUjian ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-2 max-h-72 overflow-y-auto`}>
            {committeeDailyReports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Belum ada LPJ Harian Panitia Ujian yang dikirimkan.
              </p>
            ) : (
              committeeDailyReports.map((cr) => (
                <div
                  key={cr.id}
                  className="modular-card rounded-xl p-3 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">
                      {cr.report_date} • {cr.teacher?.full_name || 'Panitia'} (
                      {cr.committee?.committee_role || 'Panitia'})
                    </p>
                    <p className="text-slate-600">{cr.activities_summary}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold shrink-0">
                    +{cr.jtm_credited} JTM
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}

      {/* Modal 1: Penyesuaian JTM Pengawas Ujian */}
      <AkademikModal
        open={Boolean(supAdjustModal)}
        onClose={() => setSupAdjustModal(null)}
        title="Konfirmasi Kehadiran & Penyesuaian JTM Pengawas"
      >
        {supAdjustModal && (
          <>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuaikan JTM yang akan diperoleh{' '}
              <strong>{supAdjustModal.sup.teacher?.full_name}</strong> ({supAdjustModal.sup.exam_date} •{' '}
              {supAdjustModal.sup.session_name}) setelah mengisi BAP.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex justify-between">
              <span>JTM Pengawasan Seharusnya:</span>
              <strong>{supAdjustModal.expectedJtm} JTM</strong>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                JTM yang Diperoleh (Disetujui)
              </label>
              <input
                type="number"
                min={0}
                max={supAdjustModal.expectedJtm}
                step="0.5"
                value={supAdjustModal.approvedJtm}
                onChange={(e) => {
                  const val = Math.min(
                    supAdjustModal.expectedJtm,
                    Math.max(0, Number(e.target.value) || 0)
                  );
                  setSupAdjustModal({
                    ...supAdjustModal,
                    approvedJtm: val,
                  });
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSupAdjustModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const clampedApproved = Math.min(
                    supAdjustModal.expectedJtm,
                    Math.max(0, Number(supAdjustModal.approvedJtm) || 0)
                  );
                  const diff = Number((supAdjustModal.expectedJtm - clampedApproved).toFixed(2));
                  if (diff > 0) {
                    setSupDiffModal({
                      sup: supAdjustModal.sup,
                      expectedJtm: supAdjustModal.expectedJtm,
                      approvedJtm: clampedApproved,
                      diffJtm: diff,
                      recipientTeacherId: '',
                      reason: '',
                    });
                    setSupAdjustModal(null);
                    return;
                  }
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/akademik/presensi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'PENGAWAS_UJIAN',
                        session_date: supAdjustModal.sup.exam_date,
                        teacher_id: supAdjustModal.sup.teacher_id,
                        exam_supervisor_id: supAdjustModal.sup.id,
                        committee_attendance_id: confirmCommitteeId || null,
                        approved_jtm: clampedApproved,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast('error', data.error || 'Gagal mengonfirmasi pengawas.');
                      return;
                    }
                    showToast('success', 'Jadwal Pengawas Ujian dikonfirmasi. Pengawas siap mengisi BAP.');
                    setSupAdjustModal(null);
                    await loadData();
                  } catch {
                    showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {supAdjustModal.approvedJtm < supAdjustModal.expectedJtm
                  ? 'Lanjut Alokasi Selisih JTM →'
                  : 'Konfirmasi Hadir'}
              </button>
            </div>
          </>
        )}
      </AkademikModal>

      {/* Modal 2: Alokasi Selisih JTM Pengawas Ujian */}
      <AkademikModal
        open={Boolean(supDiffModal)}
        onClose={() => setSupDiffModal(null)}
        title="Alokasi Selisih JTM Pengawas"
      >
        {supDiffModal && (
          <>
            <p className="text-xs text-slate-600 leading-relaxed">
              Terdapat selisih <strong>{supDiffModal.diffJtm} JTM</strong> (dari{' '}
              {supDiffModal.expectedJtm} JTM menjadi {supDiffModal.approvedJtm} JTM). Pilih pengawas
              pengganti/penerima selisih JTM ini. Penerima wajib melakukan presensi, dikonfirmasi
              Admin/Panitia, dan mengisi BAP.
            </p>
            <select
              required
              value={supDiffModal.recipientTeacherId}
              onChange={(e) =>
                setSupDiffModal({ ...supDiffModal, recipientTeacherId: e.target.value })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Pengawas Penerima Selisih JTM --</option>
              {teachers
                .filter((t) => t.id !== supDiffModal.sup.teacher_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
            </select>
            <input
              placeholder="Keterangan / alasan penyesuaian JTM (opsional)"
              value={supDiffModal.reason}
              onChange={(e) => setSupDiffModal({ ...supDiffModal, reason: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSupDiffModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !supDiffModal.recipientTeacherId}
                onClick={async () => {
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/akademik/presensi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'PENGAWAS_UJIAN',
                        session_date: supDiffModal.sup.exam_date,
                        teacher_id: supDiffModal.sup.teacher_id,
                        exam_supervisor_id: supDiffModal.sup.id,
                        committee_attendance_id: confirmCommitteeId || null,
                        approved_jtm: supDiffModal.approvedJtm,
                        diff_recipient_teacher_id: supDiffModal.recipientTeacherId,
                        diff_reason: supDiffModal.reason,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast('error', data.error || 'Gagal mengonfirmasi & mengalokasikan selisih.');
                      return;
                    }
                    showToast(
                      'success',
                      `Kehadiran dikonfirmasi (${supDiffModal.approvedJtm} JTM) & selisih ${supDiffModal.diffJtm} JTM dialokasikan.`
                    );
                    setSupDiffModal(null);
                    await loadData();
                  } catch {
                    showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Konfirmasi &amp; Alokasikan Selisih
              </button>
            </div>
          </>
        )}
      </AkademikModal>
    </div>
  );
}
