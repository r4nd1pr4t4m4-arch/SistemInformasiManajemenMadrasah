'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardCheck, Loader2, MapPin, UserCheck } from 'lucide-react';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface ExamPeriodRow {
  id: string;
  name: string;
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

export default function UjianPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
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
  const [rooms, setRooms] = useState<{ id: string; room_name: string }[]>([]);
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
    exam_date: '2026-12-01',
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, ujRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/akademik/ujian'),
      ]);
      const bi = await biRes.json();
      const uj = await ujRes.json();
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
      setRooms(uj.rooms || []);
      setExamStudentAttendances(uj.studentAttendances || []);
      setCanManageCommittees(Boolean(uj.canManageCommittees));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postUjian(body: unknown, msg: string) {
    const res = await fetch('/api/akademik/ujian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return;
    }
    showToast(msg);
    await loadData();
  }

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

  // Jadwal pengawas ujian yang gurunya sudah presensi geofencing 1x di hari ujian, namun jadwal/sesi ini belum dikonfirmasi
  const pendingSupervisorSessions = useMemo(
    () =>
      supervisors.filter(
        (s) =>
          !confirmedSupervisorIds.has(s.id) &&
          !bapSupervisorIds.has(s.id) &&
          dailyCheckedInKeys.has(`${s.teacher_id}:${s.exam_date}`)
      ),
    [supervisors, confirmedSupervisorIds, bapSupervisorIds, dailyCheckedInKeys]
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
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data periode ujian...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Banner Alur Presensi, BAP & Konfirmasi Panitia */}
      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900">
            Alur Wajib Periode Ujian (Pengawas &amp; Panitia Ujian)
          </p>
          <p className="text-xs text-slate-600">
            Pengawas &amp; Panitia Ujian tetap wajib melakukan <strong>Presensi GPS Geofencing</strong>.
            Pengawas Ujian wajib mengisi <strong>Berita Acara Pengawasan (BAP)</strong> agar JTM dihitung,
            sedangkan Panitia Ujian wajib <strong>dikonfirmasi Admin</strong> sebelum menunjuk pengawas pengganti.
          </p>
        </div>
        <Link
          href="/portal/akademik/presensi"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 transition"
        >
          <MapPin className="w-4 h-4" /> Buka Presensi GPS
        </Link>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
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
                className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan Periode Ujian
              </button>
            </form>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
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
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={supervisorForm.exam_date}
                  onChange={(e) =>
                    setSupervisorForm({ ...supervisorForm, exam_date: e.target.value })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                />
                <input
                  value={supervisorForm.session_name}
                  onChange={(e) =>
                    setSupervisorForm({ ...supervisorForm, session_name: e.target.value })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  value={supervisorForm.jtm_allocated}
                  onChange={(e) =>
                    setSupervisorForm({
                      ...supervisorForm,
                      jtm_allocated: Number(e.target.value),
                    })
                  }
                  title="Alokasi JTM"
                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan Pengawas Ujian
              </button>
            </form>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
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
        </div>

        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Pengawas Ruang Ujian ({supervisors.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
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

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Panitia Ujian ({committees.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
                        {com.teacher?.full_name}
                        {com.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {com.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {com.committee_role} •{' '}
                        {hasLpj
                          ? 'LPJ Harian Selesai (JTM Dihitung)'
                          : isConfirmed
                          ? 'Hadir Dikonfirmasi Admin (Menunggu LPJ Harian)'
                          : 'Menunggu Presensi & Konfirmasi Admin'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                        hasLpj ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {hasLpj ? `+${com.jtm_allocated} JTM` : `0/${com.jtm_allocated} JTM`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Konfirmasi Kehadiran Pengawas Ujian (Admin / Panitia Ujian Terkonfirmasi Admin) */}
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
                Tidak ada jadwal pengawas yang menunggu konfirmasi (pastikan pengawas sudah presensi
                geofencing 1x pada tanggal ujian).
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {pendingSupervisorSessions.map((sup) => {
                  const canConfirmSup = canManageCommittees || Boolean(confirmCommitteeId);
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
                          {sup.exam_date} • {sup.session_name} ({sup.jtm_allocated} JTM) • Sudah
                          Presensi Harian
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

          {/* Input Berita Acara Pengawasan (BAP) - Req #6 */}
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700" /> Berita Acara Pengawasan (BAP)
            </h2>
            <p className="text-xs text-slate-600">
              Pengawas ujian wajib melakukan presensi GPS terlebih dahulu serta dikonfirmasi
              kehadirannya oleh Admin atau Panitia Ujian sebelum mengisi BAP di bawah ini.
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
                await postUjian(
                  { action: 'SUBMIT_BAP', ...bapForm },
                  'Berita Acara Pengawasan (BAP) disimpan & JTM pengawas dihitung.'
                );
                setBapForm({
                  exam_supervisor_id: '',
                  present_students_count: 30,
                  absent_students_count: 0,
                  incidents: '',
                });
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
                disabled={isSundayDate(getWibTodayDateString())}
                className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan BAP &amp; Hitung JTM Pengawas
              </button>
            </form>
          </div>

          {/* Penunjukkan Pengawas Pengganti oleh Panitia Ujian - Req #7 */}
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" /> Penunjukkan Pengawas Pengganti (Panitia Ujian)
            </h2>
            <p className="text-xs text-slate-600">
              Hanya Panitia Ujian yang sudah presensi GPS &amp; dikonfirmasi Admin yang dapat menunjuk pengawas pengganti.
            </p>
            {confirmedCommitteeAtts.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Belum ada Panitia Ujian yang dikonfirmasi kehadirannya oleh Admin di menu Presensi GPS.
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postUjian(
                  { action: 'SUBSTITUTE_SUPERVISOR', ...subForm },
                  'Pengawas pengganti berhasil ditunjuk. Pengawas pengganti wajib presensi & isi BAP.'
                );
                setSubForm({
                  committee_attendance_id: '',
                  exam_supervisor_id: '',
                  substitute_teacher_id: '',
                  reason: '',
                });
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
                Pengganti. Panitia Pengganti wajib presensi GPS (`PANITIA_UJIAN`) dan dikonfirmasi
                Admin agar JTM-nya dihitung.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postUjian(
                    { action: 'SUBSTITUTE_COMMITTEE', ...subCommitteeForm },
                    'Panitia Ujian Pengganti berhasil ditunjuk. Wajib presensi GPS & konfirmasi Admin.'
                  );
                  setSubCommitteeForm({
                    exam_committee_id: '',
                    substitute_teacher_id: '',
                    reason: '',
                  });
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
      </div>

      {/* Absensi Siswa Ujian (Khusus Panitia / Panitia Pengganti Terkonfirmasi Admin) */}
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
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await postUjian(
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
              setExamStudentAttForm((prev) => ({ ...prev, student_id: '' }));
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

          <div className="lg:col-span-6 space-y-2 max-h-72 overflow-y-auto">
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

      {/* Laporan Pertanggungjawaban Harian (LPJ Harian) Panitia Ujian */}
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
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await postUjian(
                { action: 'SUBMIT_COMMITTEE_REPORT', ...committeeReportForm },
                'LPJ Harian Panitia Ujian disimpan & JTM panitia dihitung.'
              );
              setCommitteeReportForm({
                attendance_id: '',
                activities_summary: '',
                logistics_notes: '',
                issues_and_solutions: '',
              });
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
              disabled={pendingCommitteeReports.length === 0}
              className="w-full bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan LPJ Harian Panitia &amp; Hitung JTM
            </button>
          </form>

          <div className="lg:col-span-6 space-y-2 max-h-72 overflow-y-auto">
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

      {/* Modal 1: Penyesuaian JTM Pengawas Ujian */}
      {supAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Konfirmasi Kehadiran &amp; Penyesuaian JTM Pengawas
            </h3>
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
                onChange={(e) =>
                  setSupAdjustModal({
                    ...supAdjustModal,
                    approvedJtm: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSupAdjustModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const diff = Number(
                    (supAdjustModal.expectedJtm - supAdjustModal.approvedJtm).toFixed(2)
                  );
                  if (diff > 0) {
                    setSupDiffModal({
                      sup: supAdjustModal.sup,
                      expectedJtm: supAdjustModal.expectedJtm,
                      approvedJtm: supAdjustModal.approvedJtm,
                      diffJtm: diff,
                      recipientTeacherId: '',
                      reason: '',
                    });
                    setSupAdjustModal(null);
                    return;
                  }
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
                      approved_jtm: supAdjustModal.approvedJtm,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    showToast(data.error || 'Gagal mengonfirmasi pengawas.');
                    return;
                  }
                  showToast('Jadwal Pengawas Ujian dikonfirmasi. Pengawas siap mengisi BAP.');
                  setSupAdjustModal(null);
                  await loadData();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
              >
                {supAdjustModal.approvedJtm < supAdjustModal.expectedJtm
                  ? 'Lanjut Alokasi Selisih JTM →'
                  : 'Konfirmasi Hadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Alokasi Selisih JTM Pengawas Ujian */}
      {supDiffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Alokasi Selisih JTM Pengawas</h3>
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSupDiffModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!supDiffModal.recipientTeacherId}
                onClick={async () => {
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
                    showToast(data.error || 'Gagal mengonfirmasi & mengalokasikan selisih.');
                    return;
                  }
                  showToast(
                    `Kehadiran dikonfirmasi (${supDiffModal.approvedJtm} JTM) & selisih ${supDiffModal.diffJtm} JTM dialokasikan.`
                  );
                  setSupDiffModal(null);
                  await loadData();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold"
              >
                Konfirmasi &amp; Alokasikan Selisih
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
