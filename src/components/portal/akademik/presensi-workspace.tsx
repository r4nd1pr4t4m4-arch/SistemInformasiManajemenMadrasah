'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { verifyGeofence } from '@/lib/domain/geofence';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikEmptyState,
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

interface ScheduleRow {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  jtm_count: number;
  classroom?: { name: string } | null;
  subject?: { name: string } | null;
  teacher?: { full_name: string } | null;
}

interface ExamSupervisorOpt {
  id: string;
  teacher_id: string;
  exam_date: string;
  session_name: string;
  subject_name: string | null;
  jtm_allocated: number;
  teacher?: { full_name: string } | null;
  room?: { room_name: string } | null;
}

interface ExamCommitteeOpt {
  id: string;
  teacher_id: string;
  committee_role: string;
  jtm_allocated: number;
  teacher?: { full_name: string } | null;
  period?: { name: string } | null;
}

interface TeacherAttendanceRow {
  id: string;
  teacher_id: string;
  attendance_date: string;
  check_in_time?: string;
  check_out_time?: string | null;
  attendance_type: 'HARIAN' | 'MENGAJAR' | 'PIKET' | 'PENGAWAS_UJIAN' | 'PANITIA_UJIAN';
  schedule_id: string | null;
  delegation_id: string | null;
  exam_supervisor_id: string | null;
  exam_committee_id: string | null;
  jtm_earned: number;
  approved_jtm?: number | null;
  distance_meters: number | null;
  is_within_geofence: boolean;
  admin_confirmed: boolean;
  teacher?: { full_name: string } | null;
  delegation?: { jtm_transferred: number } | null;
  schedule?: {
    classroom_id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    jtm_count: number;
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
}

interface DelegationRow {
  id: string;
  delegation_date: string;
  delegation_type: string;
  original_teacher_id: string;
  substitute_teacher_id: string;
  schedule_id: string | null;
  jtm_transferred: number;
  reason: string | null;
  original?: { full_name: string } | null;
  substitute?: { full_name: string } | null;
  schedule?: {
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
}

interface JournalRow {
  id: string;
  attendance_id: string;
  session_confirmation_id?: string | null;
  journal_date: string;
  topic: string;
  learning_activities: string | null;
  jtm_credited: number;
  teacher?: { full_name: string } | null;
  schedule?: {
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
}

interface SessionConfirmationRow {
  id: string;
  session_type: 'MENGAJAR' | 'PENGAWAS_UJIAN';
  session_date: string;
  teacher_id: string;
  schedule_id: string | null;
  delegation_id: string | null;
  exam_supervisor_id: string | null;
  expected_jtm: number;
  approved_jtm: number;
  teacher?: { full_name: string } | null;
  schedule?: {
    classroom_id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    jtm_count: number;
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
  delegation?: {
    jtm_transferred: number;
    reason: string | null;
    original?: { full_name: string } | null;
  } | null;
}

interface PendingScheduleSessionItem {
  key: string;
  session_type: 'MENGAJAR';
  session_date: string;
  teacher_id: string;
  teacher_name: string;
  schedule_id: string | null;
  delegation_id: string | null;
  label: string;
  expectedJtm: number;
}

interface GeofenceModalState {
  distanceMeters: number;
  radiusMeters: number;
  schoolLat: number;
  schoolLng: number;
  teacherLat: number;
  teacherLng: number;
}

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export type PresensiSection =
  | 'gps'
  | 'jurnal'
  | 'konfirmasi'
  | 'pengganti'
  | 'absensi-siswa'
  | 'laporan-piket'
  | 'jam-manual'
  | 'izin-keluar';

export function PresensiWorkspace({ section }: { section: PresensiSection }) {
  const { hasPermission } = usePortalSession();
  const canSubmitPresensi = hasPermission(PERMISSIONS.PRESENSI_SUBMIT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [enrollments, setEnrollments] = useState<
    {
      student_id: string;
      classroom_id: string;
      student?: { id: string; full_name: string; nis: string | null; status: string } | null;
    }[]
  >([]);
  const [subjectStudentStatuses, setSubjectStudentStatuses] = useState<
    Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>
  >({});
  const [journalFallbackClassroomId, setJournalFallbackClassroomId] = useState('');
  const [picketBatchStatuses, setPicketBatchStatuses] = useState<
    Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>
  >({});
  const [studentAttendances, setStudentAttendances] = useState<
    {
      id: string;
      attendance_date: string;
      status: string;
      student?: { full_name: string } | null;
      classroom?: { name: string } | null;
    }[]
  >([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [examSupervisors, setExamSupervisors] = useState<ExamSupervisorOpt[]>([]);
  const [examCommittees, setExamCommittees] = useState<ExamCommitteeOpt[]>([]);
  const [teacherAttendances, setTeacherAttendances] = useState<TeacherAttendanceRow[]>([]);
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [picketReports, setPicketReports] = useState<
    {
      id: string;
      attendance_id: string;
      report_date: string;
      summary: string;
      late_students_notes?: string | null;
      teacher_substitution_notes?: string | null;
      incidents?: string | null;
      jtm_credited: number;
      teacher?: { full_name: string } | null;
    }[]
  >([]);
  const [shortLeaves, setShortLeaves] = useState<
    {
      id: string;
      leave_date: string;
      leave_start_time: string;
      leave_end_time: string;
      duration_minutes: number;
      reason: string | null;
      recorded_by_role: string;
      teacher?: { full_name: string } | null;
    }[]
  >([]);
  const [sessionConfirmations, setSessionConfirmations] = useState<SessionConfirmationRow[]>([]);
  const [todayDate, setTodayDate] = useState('');
  const [canAdminConfirm, setCanAdminConfirm] = useState(false);
  const [confirmPicketId, setConfirmPicketId] = useState('');
  const [konfirmasiSearch, setKonfirmasiSearch] = useState('');
  const [konfirmasiFilter, setKonfirmasiFilter] = useState<'ALL' | 'MENGAJAR' | 'ADMIN'>('ALL');
  const [konfirmasiPage, setKonfirmasiPage] = useState(1);
  const [geofenceConfig, setGeofenceConfig] = useState({
    enabled: true,
    latitude: -6.2,
    longitude: 106.816666,
    radiusMeters: 100,
  });

  // Status izin lokasi browser (Req #1)
  const [locationStatus, setLocationStatus] = useState<
    'checking' | 'granted' | 'denied' | 'unsupported'
  >('checking');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsCaptured, setGpsCaptured] = useState(false);

  // Modal di luar radius (Req #2)
  const [outsideModal, setOutsideModal] = useState<GeofenceModalState | null>(null);

  // Modal 1: Penyesuaian JTM saat konfirmasi kehadiran per jadwal
  const [jtmAdjustModal, setJtmAdjustModal] = useState<{
    sessionItem?: PendingScheduleSessionItem;
    att?: TeacherAttendanceRow;
    teacherName: string;
    label: string;
    expectedJtm: number;
    approvedJtm: number;
    picketAttendanceId: string | null;
  } | null>(null);

  // Modal 2: Alokasi selisih JTM jika approvedJtm < expectedJtm
  const [jtmDiffModal, setJtmDiffModal] = useState<{
    sessionItem?: PendingScheduleSessionItem;
    att?: TeacherAttendanceRow;
    teacherId: string;
    expectedJtm: number;
    approvedJtm: number;
    diffJtm: number;
    picketAttendanceId: string | null;
    recipientTeacherId: string;
    reason: string;
  } | null>(null);

  const [teacherAttForm, setTeacherAttForm] = useState({
    teacher_id: '',
    attendance_type: 'MENGAJAR' as
      | 'HARIAN'
      | 'MENGAJAR'
      | 'PIKET'
      | 'PENGAWAS_UJIAN'
      | 'PANITIA_UJIAN',
    schedule_id: '',
    delegation_id: '',
    exam_supervisor_id: '',
    exam_committee_id: '',
    notes: '',
    latitude: 0,
    longitude: 0,
  });

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

  const [delegationForm, setDelegationForm] = useState(() => ({
    picket_attendance_id: '',
    delegation_date: getWibTodayDateString(),
    delegation_type: 'MENGAJAR' as 'MENGAJAR' | 'PIKET',
    original_teacher_id: '',
    substitute_teacher_id: '',
    schedule_id: '',
    jtm_transferred: 2,
    reason: '',
  }));
  const [penggantiSearch, setPenggantiSearch] = useState('');
  const [penggantiFilter, setPenggantiFilter] = useState<'ALL' | 'MENGAJAR' | 'PIKET'>('ALL');
  const [penggantiPage, setPenggantiPage] = useState(1);

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

  const [picketReportForm, setPicketReportForm] = useState({
    attendance_id: '',
    summary: '',
    late_students_notes: '',
    teacher_substitution_notes: '',
    incidents: '',
  });
  const [picketReportSearch, setPicketReportSearch] = useState('');
  const [picketReportPage, setPicketReportPage] = useState(1);
  const [detailPicketReport, setDetailPicketReport] = useState<{
    id: string;
    attendance_id: string;
    report_date: string;
    summary: string;
    late_students_notes?: string | null;
    teacher_substitution_notes?: string | null;
    incidents?: string | null;
    jtm_credited: number;
    teacher?: { full_name: string } | null;
  } | null>(null);

  const [manualTimeForm, setManualTimeForm] = useState({
    attendance_id: '',
    check_in_hhmm: '07:30',
    check_out_hhmm: '12:30',
    actor_ref: '', // '' = Admin, 'picket:<id>', 'committee:<id>'
  });
  const [manualTimeSearch, setManualTimeSearch] = useState('');
  const [manualTimeFilter, setManualTimeFilter] = useState<'ALL' | 'MISSING' | 'FILLED'>('ALL');
  const [manualTimePage, setManualTimePage] = useState(1);

  const [shortLeaveForm, setShortLeaveForm] = useState({
    attendance_id: '',
    leave_start_time: '09:30',
    leave_end_time: '10:30',
    reason: '',
    actor_ref: '',
  });
  const [shortLeaveSearch, setShortLeaveSearch] = useState('');
  const [shortLeavePage, setShortLeavePage] = useState(1);

  const loadData = useCallback(async () => {
    try {
      const [biRes, prRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
        fetch('/api/akademik/presensi', { cache: 'no-store' }),
      ]);
      const bi = await biRes.json();
      const pr = await prRes.json();
      if (!biRes.ok) throw new Error(bi.error || 'Gagal memuat data GTK.');
      if (!prRes.ok) throw new Error(pr.error || 'Gagal memuat data presensi.');
      setLoadError(null);
      const loadedTeachers: TeacherOpt[] = bi.teachers || [];
      setTeachers(loadedTeachers);
      if (loadedTeachers.length === 1) {
        setTeacherAttForm((prev) =>
          prev.teacher_id ? prev : { ...prev, teacher_id: loadedTeachers[0].id }
        );
      }
      setClassrooms(pr.classrooms || []);
      setEnrollments(pr.enrollments || []);
      setStudentAttendances(pr.studentAttendances || []);
      setSchedules(pr.schedules || []);
      setExamSupervisors(pr.examSupervisors || []);
      setExamCommittees(pr.examCommittees || []);
      setTeacherAttendances(pr.teacherAttendances || []);
      setDelegations(pr.delegations || []);
      setJournals(pr.journals || []);
      setPicketReports(pr.picketReports || []);
      setShortLeaves(pr.shortLeaves || []);
      setSessionConfirmations(pr.sessionConfirmations || []);
      if (pr.todayDate) setTodayDate(pr.todayDate);
      setCanAdminConfirm(Boolean(pr.canAdminConfirm));
      if (pr.geofenceConfig) {
        setGeofenceConfig(pr.geofenceConfig);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const captureBrowserGps = useCallback((notify = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unsupported');
      setGpsCaptured(false);
      setLocationError('Browser/perangkat Anda tidak mendukung layanan lokasi (GPS).');
      return;
    }

    setLocationStatus('checking');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTeacherAttForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setLocationStatus('granted');
        setGpsCaptured(true);
        setLocationError(null);
        if (notify) {
          showToast('success', 'Koordinat GPS perangkat berhasil diperbarui.');
        }
      },
      (err) => {
        setLocationStatus('denied');
        setGpsCaptured(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError(
            'Izin lokasi (GPS) ditolak. Aktifkan izin lokasi pada browser agar tombol presensi dapat digunakan.'
          );
        } else {
          setLocationError(
            'Gagal membaca koordinat GPS perangkat. Pastikan GPS aktif lalu klik "Ambil GPS Perangkat".'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
      captureBrowserGps(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, captureBrowserGps]);

  async function postPresensi(body: unknown) {
    try {
      const res = await fetch('/api/akademik/presensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.code === 'OUTSIDE_GEOFENCE' && data.geofence) {
          setOutsideModal(data.geofence);
          return null;
        }
        showToast('error', data.error || 'Terjadi kesalahan.');
        return null;
      }
      await loadData();
      return data;
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return null;
    }
  }

  // Jurnal Pembelajaran yang sudah diisi (berdasarkan session_confirmation_id)
  const journaledSessionIds = useMemo(
    () =>
      new Set(
        journals
          .map((j) => j.session_confirmation_id)
          .filter((x): x is string => Boolean(x))
      ),
    [journals]
  );

  // Jadwal mengajar terkonfirmasi yang belum diisi jurnal pembelajarannya
  const pendingJournalSessions = useMemo(
    () =>
      sessionConfirmations.filter(
        (sc) => sc.session_type === 'MENGAJAR' && !journaledSessionIds.has(sc.id)
      ),
    [sessionConfirmations, journaledSessionIds]
  );

  // Guru yang sudah presensi geofencing 1x pada hari ini
  const activeDate = todayDate || getWibTodayDateString();
  const checkedInTeacherIdsToday = useMemo(
    () =>
      new Set(
        teacherAttendances
          .filter((a) => a.attendance_date === activeDate && a.is_within_geofence)
          .map((a) => a.teacher_id)
      ),
    [teacherAttendances, activeDate]
  );

  const todayAttendances = useMemo(
    () => teacherAttendances.filter((a) => a.attendance_date === activeDate),
    [teacherAttendances, activeDate]
  );

  const selectedTeacherDailyCheckIn = useMemo(() => {
    if (!teacherAttForm.teacher_id) return null;
    return (
      todayAttendances.find(
        (a) =>
          a.teacher_id === teacherAttForm.teacher_id &&
          a.is_within_geofence &&
          ['HARIAN', 'MENGAJAR', 'PENGAWAS_UJIAN'].includes(a.attendance_type)
      ) || null
    );
  }, [todayAttendances, teacherAttForm.teacher_id]);

  // Daftar jadwal mengajar & delegasi hari ini untuk guru yang sudah presensi geofencing 1x, belum dikonfirmasi per jadwalnya
  const pendingScheduleSessionsToday = useMemo<PendingScheduleSessionItem[]>(() => {
    const confirmedSchedKeys = new Set(
      sessionConfirmations
        .filter((sc) => sc.session_type === 'MENGAJAR' && sc.session_date === activeDate)
        .map((sc) =>
          sc.delegation_id
            ? `del:${sc.delegation_id}:${sc.teacher_id}`
            : `sch:${sc.schedule_id}:${sc.teacher_id}`
        )
    );

    const d = new Date(`${activeDate}T00:00:00Z`);
    const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();

    const items: PendingScheduleSessionItem[] = [];

    for (const s of schedules) {
      if (s.day_of_week !== isoDay) continue;
      if (!checkedInTeacherIdsToday.has(s.teacher_id)) continue;
      const key = `sch:${s.id}:${s.teacher_id}`;
      if (confirmedSchedKeys.has(key)) continue;
      items.push({
        key,
        session_type: 'MENGAJAR',
        session_date: activeDate,
        teacher_id: s.teacher_id,
        teacher_name: s.teacher?.full_name || 'Guru',
        schedule_id: s.id,
        delegation_id: null,
        label: `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} • ${s.classroom?.name || 'Kelas'} • ${s.subject?.name || 'Mapel'}`,
        expectedJtm: s.jtm_count || 2,
      });
    }

    for (const del of delegations) {
      if (del.delegation_type !== 'MENGAJAR' || del.delegation_date !== activeDate) continue;
      if (!checkedInTeacherIdsToday.has(del.substitute_teacher_id)) continue;
      const key = `del:${del.id}:${del.substitute_teacher_id}`;
      if (confirmedSchedKeys.has(key)) continue;
      items.push({
        key,
        session_type: 'MENGAJAR',
        session_date: activeDate,
        teacher_id: del.substitute_teacher_id,
        teacher_name: del.substitute?.full_name || 'Guru Pengganti',
        schedule_id: del.schedule_id || null,
        delegation_id: del.id,
        label: `Guru Pengganti (menggantikan ${del.original?.full_name || 'Guru'})${del.reason ? ` • ${del.reason}` : ''}`,
        expectedJtm: del.jtm_transferred || 2,
      });
    }

    return items;
  }, [schedules, delegations, sessionConfirmations, checkedInTeacherIdsToday, activeDate]);

  // Presensi PIKET & PANITIA_UJIAN yang menunggu konfirmasi Admin
  const unconfirmedAdminAttendances = useMemo(
    () =>
      teacherAttendances.filter(
        (a) =>
          (a.attendance_type === 'PIKET' || a.attendance_type === 'PANITIA_UJIAN') &&
          a.is_within_geofence &&
          !a.admin_confirmed
      ),
    [teacherAttendances]
  );

  // Presensi PIKET yang sudah dikonfirmasi Admin (syarat menunjuk guru pengganti)
  const confirmedPicketAttendances = useMemo(
    () =>
      teacherAttendances.filter(
        (a) => a.attendance_type === 'PIKET' && a.is_within_geofence && a.admin_confirmed
      ),
    [teacherAttendances]
  );

  const confirmedCommitteeAttendances = useMemo(
    () =>
      teacherAttendances.filter(
        (a) => a.attendance_type === 'PANITIA_UJIAN' && a.is_within_geofence && a.admin_confirmed
      ),
    [teacherAttendances]
  );

  const reportedPicketAttIds = useMemo(
    () => new Set(picketReports.map((r) => r.attendance_id)),
    [picketReports]
  );

  const pendingPicketReports = useMemo(
    () => confirmedPicketAttendances.filter((a) => !reportedPicketAttIds.has(a.id)),
    [confirmedPicketAttendances, reportedPicketAttIds]
  );

  const liveDistanceInfo = useMemo(() => {
    if (!gpsCaptured) return null;
    return verifyGeofence(
      { lat: teacherAttForm.latitude, lng: teacherAttForm.longitude },
      { lat: geofenceConfig.latitude, lng: geofenceConfig.longitude },
      geofenceConfig.radiusMeters
    );
  }, [gpsCaptured, teacherAttForm.latitude, teacherAttForm.longitude, geofenceConfig]);

  if (loading) {
    return <AkademikLoading label="Memuat data presensi, jurnal & delegasi..." />;
  }

  const isLocationBlocked =
    geofenceConfig.enabled && (locationStatus !== 'granted' || !gpsCaptured);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={handleRefresh} />

      {/* 1. Presensi Guru GPS Geofencing */}
      {section === 'gps' && (
        <div className="space-y-5">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>
                    Presensi Guru{' '}
                    {geofenceConfig.enabled ? '(GPS Geofencing)' : '(Mode Tanpa Geofencing)'}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tanggal aktif: <strong className="text-slate-700">{activeDate}</strong> • Presensi
                  harian/mengajar/pengawas cukup 1x per hari.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
                {geofenceConfig.enabled && (
                  <button
                    type="button"
                    disabled={locationStatus === 'checking'}
                    onClick={() => captureBrowserGps(true)}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 transition"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${locationStatus === 'checking' ? 'animate-spin' : ''}`}
                    />
                    {locationStatus === 'checking' ? 'Membaca GPS...' : 'Ambil GPS Perangkat'}
                  </button>
                )}
              </div>
            </div>

            {!geofenceConfig.enabled && (
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
                <strong>Geofencing Nonaktif (Pengaturan Admin):</strong> Presensi guru dapat
                dilakukan langsung tanpa verifikasi lokasi GPS dan radius sekolah.
              </div>
            )}

            {geofenceConfig.enabled && isLocationBlocked && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {locationStatus === 'checking'
                    ? 'Memeriksa izin lokasi GPS...'
                    : 'Izin Lokasi GPS Diperlukan'}
                </div>
                <p className="leading-relaxed">
                  {locationError ||
                    'Aplikasi harus diizinkan membaca lokasi perangkat untuk memverifikasi radius geofencing. Tombol presensi dinonaktifkan sampai koordinat GPS berhasil terbaca.'}
                </p>
              </div>
            )}

            {geofenceConfig.enabled && gpsCaptured && liveDistanceInfo && (
              <div
                className={`p-3 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${liveDistanceInfo.isWithinGeofence
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/80 border-rose-200 text-rose-800'
                  }`}
              >
                <span>
                  Jarak dari titik lembaga: <strong>{liveDistanceInfo.distanceMeters} m</strong> (batas{' '}
                  {liveDistanceInfo.radiusMeters} m)
                </span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-white/70">
                  {liveDistanceInfo.isWithinGeofence ? 'Dalam Radius' : 'Di Luar Radius'}
                </span>
              </div>
            )}

            {selectedTeacherDailyCheckIn &&
              ['HARIAN', 'MENGAJAR', 'PENGAWAS_UJIAN'].includes(teacherAttForm.attendance_type) && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Guru terpilih sudah presensi geofencing hari ini</p>
                    <p className="text-emerald-800 leading-relaxed">
                      Presensi ({selectedTeacherDailyCheckIn.attendance_type}) sudah tercatat untuk{' '}
                      {activeDate}. Untuk mengajar atau mengawas ujian, silakan langsung konfirmasi
                      kehadiran per jadwal di menu <strong>Konfirmasi Kehadiran</strong>.
                    </p>
                  </div>
                </div>
              )}

            {canSubmitPresensi ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (submitting || isLocationBlocked) return;

                  // Verifikasi radius di sisi klien terlebih dahulu jika geofencing aktif (Req #2)
                  if (
                    geofenceConfig.enabled &&
                    liveDistanceInfo &&
                    !liveDistanceInfo.isWithinGeofence
                  ) {
                    setOutsideModal({
                      distanceMeters: liveDistanceInfo.distanceMeters,
                      radiusMeters: liveDistanceInfo.radiusMeters,
                      schoolLat: geofenceConfig.latitude,
                      schoolLng: geofenceConfig.longitude,
                      teacherLat: teacherAttForm.latitude,
                      teacherLng: teacherAttForm.longitude,
                    });
                    return;
                  }

                  setSubmitting(true);
                  try {
                    const res = await postPresensi({
                      action: 'TEACHER_ATTENDANCE',
                      teacher_id: teacherAttForm.teacher_id,
                      attendance_type: teacherAttForm.attendance_type,
                      schedule_id:
                        teacherAttForm.attendance_type === 'MENGAJAR' && teacherAttForm.schedule_id
                          ? teacherAttForm.schedule_id
                          : null,
                      delegation_id:
                        (teacherAttForm.attendance_type === 'MENGAJAR' ||
                          teacherAttForm.attendance_type === 'PIKET') &&
                          teacherAttForm.delegation_id
                          ? teacherAttForm.delegation_id
                          : null,
                      exam_supervisor_id:
                        teacherAttForm.attendance_type === 'PENGAWAS_UJIAN'
                          ? teacherAttForm.exam_supervisor_id
                          : null,
                      exam_committee_id:
                        teacherAttForm.attendance_type === 'PANITIA_UJIAN'
                          ? teacherAttForm.exam_committee_id
                          : null,
                      notes: teacherAttForm.notes.trim() || null,
                      latitude: geofenceConfig.enabled ? teacherAttForm.latitude : null,
                      longitude: geofenceConfig.enabled ? teacherAttForm.longitude : null,
                    });
                    if (res?.geofence) {
                      const typeMsg =
                        teacherAttForm.attendance_type === 'MENGAJAR'
                          ? 'Presensi Mengajar VALID. Menunggu konfirmasi Admin/Guru Piket sebelum isi Jurnal Pembelajaran.'
                          : teacherAttForm.attendance_type === 'PIKET'
                            ? 'Presensi Guru Piket VALID. Menunggu konfirmasi Admin sebelum menunjuk guru pengganti.'
                            : teacherAttForm.attendance_type === 'PENGAWAS_UJIAN'
                              ? 'Presensi Pengawas Ujian VALID. Menunggu konfirmasi Admin/Panitia sebelum isi BAP.'
                              : teacherAttForm.attendance_type === 'PANITIA_UJIAN'
                                ? 'Presensi Panitia Ujian VALID. Menunggu konfirmasi Admin.'
                                : 'Presensi Harian VALID.';
                      const distSuffix = res.geofence.enabled
                        ? ` (Jarak ${res.geofence.distanceMeters} m)`
                        : ' (Tanpa Geofencing)';
                      showToast('success', `${typeMsg}${distSuffix}`);
                      setTeacherAttForm((prev) => ({
                        ...prev,
                        schedule_id: '',
                        delegation_id: '',
                        exam_supervisor_id: '',
                        exam_committee_id: '',
                        notes: '',
                      }));
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="gps-teacher"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Guru / GTK <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="gps-teacher"
                      required
                      value={teacherAttForm.teacher_id}
                      onChange={(e) =>
                        setTeacherAttForm({ ...teacherAttForm, teacher_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">-- Pilih Guru / GTK --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="gps-attendance-type"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Jenis Presensi
                    </label>
                    <select
                      id="gps-attendance-type"
                      value={teacherAttForm.attendance_type}
                      onChange={(e) =>
                        setTeacherAttForm({
                          ...teacherAttForm,
                          attendance_type: e.target.value as
                            | 'HARIAN'
                            | 'MENGAJAR'
                            | 'PIKET'
                            | 'PENGAWAS_UJIAN'
                            | 'PANITIA_UJIAN',
                          schedule_id: '',
                          delegation_id: '',
                          exam_supervisor_id: '',
                          exam_committee_id: '',
                        })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="MENGAJAR">Mengajar (Wajib Jurnal untuk Hitung JTM)</option>
                      <option value="PIKET">Guru Piket (Wajib Konfirmasi Admin)</option>
                      <option value="PENGAWAS_UJIAN">
                        Pengawas Ujian (Wajib BAP untuk Hitung JTM)
                      </option>
                      <option value="PANITIA_UJIAN">Panitia Ujian (Wajib Konfirmasi Admin)</option>
                      <option value="HARIAN">Harian</option>
                    </select>
                  </div>
                </div>

                {teacherAttForm.attendance_type === 'MENGAJAR' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="gps-schedule"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Jadwal Mengajar Reguler (Opsional)
                      </label>
                      <select
                        id="gps-schedule"
                        value={teacherAttForm.schedule_id}
                        onChange={(e) =>
                          setTeacherAttForm({
                            ...teacherAttForm,
                            schedule_id: e.target.value,
                            delegation_id: '',
                          })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        <option value="">-- Jadwal Mengajar Reguler (Opsional) --</option>
                        {schedules.map((s) => (
                          <option key={s.id} value={s.id}>
                            {DAY_NAMES[s.day_of_week]} {(s.start_time || '').slice(0, 5)} •{' '}
                            {s.classroom?.name || 'Kelas'} • {s.subject?.name || 'Mapel'} (
                            {s.jtm_count} JTM)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="gps-delegation-teach"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Atau Tugas Guru Pengganti
                      </label>
                      <select
                        id="gps-delegation-teach"
                        value={teacherAttForm.delegation_id}
                        onChange={(e) =>
                          setTeacherAttForm({
                            ...teacherAttForm,
                            delegation_id: e.target.value,
                            schedule_id: '',
                          })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        <option value="">-- Atau Tugas Guru Pengganti --</option>
                        {delegations.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.delegation_date}: Gantikan {d.original?.full_name || 'Guru'} →{' '}
                            {d.substitute?.full_name || 'Pengganti'} ({d.jtm_transferred} JTM)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {teacherAttForm.attendance_type === 'PIKET' && (
                  <div>
                    <label
                      htmlFor="gps-delegation-picket"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Penugasan Piket (Reguler / Pengganti)
                    </label>
                    <select
                      id="gps-delegation-picket"
                      value={teacherAttForm.delegation_id}
                      onChange={(e) =>
                        setTeacherAttForm({
                          ...teacherAttForm,
                          delegation_id: e.target.value,
                        })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">
                        -- Guru Piket Reguler (atau pilih Tugas Piket Pengganti) --
                      </option>
                      {delegations
                        .filter((d) => d.delegation_type === 'PIKET')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.delegation_date}: Piket Pengganti ({d.original?.full_name || 'Guru'}{' '}
                            → {d.substitute?.full_name || 'Pengganti'}, {d.jtm_transferred} JTM)
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {teacherAttForm.attendance_type === 'PENGAWAS_UJIAN' && (
                  <div>
                    <label
                      htmlFor="gps-exam-supervisor"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Jadwal Tugas Pengawas Ujian <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="gps-exam-supervisor"
                      required
                      value={teacherAttForm.exam_supervisor_id}
                      onChange={(e) =>
                        setTeacherAttForm({ ...teacherAttForm, exam_supervisor_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">-- Pilih Jadwal Tugas Pengawas Ujian --</option>
                      {examSupervisors.map((es) => (
                        <option key={es.id} value={es.id}>
                          {es.exam_date} • {es.session_name} • {es.room?.room_name || 'Ruang'} •{' '}
                          {es.teacher?.full_name} ({es.jtm_allocated} JTM)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {teacherAttForm.attendance_type === 'PANITIA_UJIAN' && (
                  <div>
                    <label
                      htmlFor="gps-exam-committee"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Penugasan Panitia Ujian <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="gps-exam-committee"
                      required
                      value={teacherAttForm.exam_committee_id}
                      onChange={(e) =>
                        setTeacherAttForm({ ...teacherAttForm, exam_committee_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">-- Pilih Penugasan Panitia Ujian --</option>
                      {examCommittees.map((ec) => (
                        <option key={ec.id} value={ec.id}>
                          {ec.period?.name || 'Ujian'} • {ec.committee_role} •{' '}
                          {ec.teacher?.full_name} ({ec.jtm_allocated} JTM)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="gps-notes"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Catatan Presensi (Opsional)
                  </label>
                  <input
                    id="gps-notes"
                    type="text"
                    placeholder="Keterangan tambahan jika diperlukan..."
                    value={teacherAttForm.notes}
                    onChange={(e) =>
                      setTeacherAttForm({ ...teacherAttForm, notes: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {geofenceConfig.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      readOnly
                      aria-label="Latitude perangkat"
                      value={
                        gpsCaptured
                          ? `Lat: ${teacherAttForm.latitude}`
                          : 'Lat: Belum terbaca'
                      }
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600"
                    />
                    <input
                      type="text"
                      readOnly
                      aria-label="Longitude perangkat"
                      value={
                        gpsCaptured
                          ? `Lng: ${teacherAttForm.longitude}`
                          : 'Lng: Belum terbaca'
                      }
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || isLocationBlocked}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting
                    ? 'Memproses...'
                    : geofenceConfig.enabled
                      ? 'Catat Presensi GPS'
                      : 'Catat Presensi'}
                </button>
              </form>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Mode Baca Saja (Read-Only): Peran akun Anda tidak melakukan input presensi guru.
              </div>
            )}
          </div>

          {/* Riwayat Presensi Hari Ini */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Presensi Tercatat Hari Ini ({todayAttendances.length})</span>
            </h2>
            {todayAttendances.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Belum ada presensi guru yang tercatat pada tanggal {activeDate}.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {todayAttendances.map((att) => (
                  <div
                    key={att.id}
                    className="modular-card rounded-2xl p-3.5 flex flex-col justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">
                        {att.teacher?.full_name || 'Guru'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {att.attendance_type} •{' '}
                        {att.distance_meters != null ? `Jarak ${att.distance_meters} m` : 'Valid'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${att.admin_confirmed
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                          }`}
                      >
                        {att.admin_confirmed ? 'Terkonfirmasi' : 'Menunggu Konfirmasi'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {att.check_in_time ? att.check_in_time.slice(11, 16) : activeDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Input Jurnal Pembelajaran (Req #4) */}
      {section === 'jurnal' && (() => {
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
                          const allPresent: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> =
                            {};
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
      })()}

      {/* 3. Konfirmasi Admin (Guru Piket & Panitia Ujian) */}
      {section === 'konfirmasi' && (() => {
        const KONFIRMASI_PAGE_SIZE = 8;
        const confirmedPicketAttendancesToday = confirmedPicketAttendances.filter(
          (p) => p.attendance_date === activeDate
        );
        const effectivePicketId = confirmedPicketAttendancesToday.some(
          (p) => p.id === confirmPicketId
        )
          ? confirmPicketId
          : '';
        const canConfirmMengajar = canAdminConfirm || Boolean(effectivePicketId);
        const query = konfirmasiSearch.trim().toLowerCase();

        type KonfirmasiUnifiedItem =
          | { kind: 'MENGAJAR'; key: string; item: PendingScheduleSessionItem }
          | { kind: 'ADMIN'; key: string; att: TeacherAttendanceRow };

        const allItems: KonfirmasiUnifiedItem[] = [
          ...(konfirmasiFilter === 'ALL' || konfirmasiFilter === 'MENGAJAR'
            ? pendingScheduleSessionsToday.map((item) => ({
              kind: 'MENGAJAR' as const,
              key: `m-${item.key}`,
              item,
            }))
            : []),
          ...(konfirmasiFilter === 'ALL' || konfirmasiFilter === 'ADMIN'
            ? unconfirmedAdminAttendances.map((att) => ({
              kind: 'ADMIN' as const,
              key: `a-${att.id}`,
              att,
            }))
            : []),
        ];

        const filteredItems = query
          ? allItems.filter((entry) => {
            const haystack =
              entry.kind === 'MENGAJAR'
                ? [entry.item.teacher_name, entry.item.label, entry.item.session_date]
                  .join(' ')
                  .toLowerCase()
                : [
                  entry.att.teacher?.full_name,
                  entry.att.attendance_type,
                  entry.att.attendance_date,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();
            return haystack.includes(query);
          })
          : allItems;

        const totalKonfirmasiPages = Math.max(
          1,
          Math.ceil(filteredItems.length / KONFIRMASI_PAGE_SIZE)
        );
        const safeKonfirmasiPage = Math.min(konfirmasiPage, totalKonfirmasiPages);
        const paginatedItems = filteredItems.slice(
          (safeKonfirmasiPage - 1) * KONFIRMASI_PAGE_SIZE,
          safeKonfirmasiPage * KONFIRMASI_PAGE_SIZE
        );

        const totalPendingAll =
          pendingScheduleSessionsToday.length + unconfirmedAdminAttendances.length;

        return (
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Konfirmasi Kehadiran (Admin / Guru Piket)</span>
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Admin mengonfirmasi Guru Piket, Panitia Ujian, dan Guru Mengajar. Guru Piket /
                  Piket Pengganti yang sudah dikonfirmasi hari ini juga dapat mengonfirmasi
                  kehadiran Guru Mengajar agar guru dapat mengisi Jurnal Pembelajaran.
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
                <p className="text-[11px] font-medium text-slate-500">Total Antrean</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {totalPendingAll}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Jadwal Mengajar</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                  {pendingScheduleSessionsToday.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Piket &amp; Panitia</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {unconfirmedAdminAttendances.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Piket Aktif Hari Ini</p>
                <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
                  {confirmedPicketAttendancesToday.length}
                </p>
              </div>
            </div>

            {
              confirmedPicketAttendancesToday.length > 0 ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="konfirmasi-picket-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Aktor Konfirmasi Jadwal Mengajar
                  </label>
                  <select
                    id="konfirmasi-picket-select"
                    value={effectivePicketId}
                    onChange={(e) => setConfirmPicketId(e.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">
                      {canAdminConfirm
                        ? '-- Konfirmasi sebagai Admin (atau pilih Guru Piket hari ini) --'
                        : '-- Pilih Presensi Guru Piket / Pengganti Hari Ini untuk Konfirmasi --'}
                    </option>
                    {confirmedPicketAttendancesToday.map((p) => (
                      <option key={p.id} value={p.id}>
                        Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                !canAdminConfirm && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                    Belum ada Guru Piket / Piket Pengganti yang dikonfirmasi Admin untuk hari ini (
                    <strong>{activeDate}</strong>). Konfirmasi Guru Mengajar memerlukan peran Admin
                    atau Guru Piket yang sudah dikonfirmasi Admin.
                  </div>
                )
              )
            }

            {
              !canAdminConfirm &&
              confirmedPicketAttendancesToday.length > 0 &&
              !effectivePicketId &&
              pendingScheduleSessionsToday.length > 0 && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
                  Pilih presensi <strong>Guru Piket / Pengganti</strong> di atas terlebih dahulu
                  untuk mengaktifkan tombol <strong>Konfirmasi Jadwal</strong>.
                </div>
              )
            }

            {/* Filter & Pencarian */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${totalPendingAll})` },
                    {
                      id: 'MENGAJAR',
                      label: `Mengajar (${pendingScheduleSessionsToday.length})`,
                    },
                    {
                      id: 'ADMIN',
                      label: `Piket & Panitia (${unconfirmedAdminAttendances.length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setKonfirmasiFilter(tab.id);
                      setKonfirmasiPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${konfirmasiFilter === tab.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={konfirmasiSearch}
                  onChange={(e) => {
                    setKonfirmasiSearch(e.target.value);
                    setKonfirmasiPage(1);
                  }}
                  placeholder="Cari nama guru, mapel, kelas..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {konfirmasiSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setKonfirmasiSearch('');
                      setKonfirmasiPage(1);
                    }}
                    aria-label="Hapus pencarian konfirmasi"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <AkademikEmptyState
                icon={<CheckCircle2 className="w-6 h-6 text-slate-400" />}
                message={
                  totalPendingAll === 0
                    ? 'Tidak ada presensi atau jadwal hari ini yang menunggu konfirmasi kehadiran.'
                    : 'Tidak ada item konfirmasi yang cocok dengan filter atau pencarian Anda.'
                }
              />
            ) : (
              <>
                <div className="space-y-2.5">
                  {paginatedItems.map((entry) => {
                    if (entry.kind === 'MENGAJAR') {
                      const { item } = entry;
                      return (
                        <div
                          key={entry.key}
                          className="p-3.5 rounded-2xl bg-white/85 border border-emerald-200/80 hover:border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-slate-900 truncate">
                                {item.teacher_name}
                              </p>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                                {item.delegation_id ? 'Guru Pengganti' : 'Mengajar'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {item.expectedJtm} JTM
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 break-words leading-relaxed">
                              {item.session_date} • {item.label}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!canConfirmMengajar}
                            onClick={() =>
                              setJtmAdjustModal({
                                sessionItem: item,
                                teacherName: item.teacher_name,
                                label: item.label,
                                expectedJtm: item.expectedJtm,
                                approvedJtm: item.expectedJtm,
                                picketAttendanceId: effectivePicketId || null,
                              })
                            }
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold shrink-0 transition cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Konfirmasi Jadwal
                          </button>
                        </div>
                      );
                    }

                    const { att: a } = entry;
                    const comJtm = examCommittees.find(
                      (ec) => ec.id === a.exam_committee_id
                    )?.jtm_allocated;
                    const expectedJtm =
                      a.attendance_type === 'PANITIA_UJIAN'
                        ? comJtm || 4
                        : a.delegation?.jtm_transferred || 2;

                    return (
                      <div
                        key={entry.key}
                        className="p-3.5 rounded-2xl bg-white/85 border border-slate-200 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold text-slate-900 truncate">
                              {a.teacher?.full_name || 'Guru'}
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              {a.attendance_type === 'PANITIA_UJIAN'
                                ? 'Panitia Ujian'
                                : 'Guru Piket'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {expectedJtm} JTM
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 break-words">
                            {a.attendance_date} • Jarak {a.distance_meters ?? 0} m
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!canAdminConfirm}
                          title={
                            !canAdminConfirm
                              ? 'Hanya Admin / Operator / Pimpinan / TU yang dapat mengonfirmasi Piket & Panitia Ujian'
                              : undefined
                          }
                          onClick={() =>
                            setJtmAdjustModal({
                              att: a,
                              teacherName: a.teacher?.full_name || 'Guru',
                              label: a.attendance_type,
                              expectedJtm,
                              approvedJtm: expectedJtm,
                              picketAttendanceId: null,
                            })
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold shrink-0 transition cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Konfirmasi Hadir
                        </button>
                      </div>
                    );
                  })}
                </div>

                {totalKonfirmasiPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span>
                      Halaman <strong>{safeKonfirmasiPage}</strong> dari{' '}
                      <strong>{totalKonfirmasiPages}</strong> ({filteredItems.length} item)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeKonfirmasiPage <= 1}
                        onClick={() => setKonfirmasiPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={safeKonfirmasiPage >= totalKonfirmasiPages}
                        onClick={() =>
                          setKonfirmasiPage((p) => Math.min(totalKonfirmasiPages, p + 1))
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
        );
      })()}

      {section === 'pengganti' && (() => {
        const PENGGANTI_PAGE_SIZE = 6;
        const mengajarDelegationCount = delegations.filter(
          (d) => d.delegation_type === 'MENGAJAR'
        ).length;
        const piketDelegationCount = delegations.filter(
          (d) => d.delegation_type === 'PIKET'
        ).length;

        const filteredByType =
          penggantiFilter === 'ALL'
            ? delegations
            : delegations.filter((d) => d.delegation_type === penggantiFilter);

        const query = penggantiSearch.trim().toLowerCase();
        const filteredDelegations = query
          ? filteredByType.filter((d) => {
            const haystack = [
              d.original?.full_name,
              d.substitute?.full_name,
              d.schedule?.classroom?.name,
              d.schedule?.subject?.name,
              d.reason,
              d.delegation_date,
              d.delegation_type,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(query);
          })
          : filteredByType;

        const totalPenggantiPages = Math.max(
          1,
          Math.ceil(filteredDelegations.length / PENGGANTI_PAGE_SIZE)
        );
        const safePenggantiPage = Math.min(penggantiPage, totalPenggantiPages);
        const paginatedDelegations = filteredDelegations.slice(
          (safePenggantiPage - 1) * PENGGANTI_PAGE_SIZE,
          safePenggantiPage * PENGGANTI_PAGE_SIZE
        );

        const isSameTeacher =
          Boolean(delegationForm.original_teacher_id) &&
          delegationForm.original_teacher_id === delegationForm.substitute_teacher_id;

        return (
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Penunjukkan Guru Pengganti oleh Guru Piket</span>
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hanya Guru Piket yang sudah presensi &amp; dikonfirmasi Admin yang dapat menunjuk
                  guru pengganti. Guru pengganti wajib presensi &amp; isi Jurnal agar JTM dihitung.
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
                <p className="text-[11px] font-medium text-slate-500">Total Delegasi</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {delegations.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Pengganti Mengajar</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                  {mengajarDelegationCount}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Piket Pengganti</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {piketDelegationCount}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Piket Terkonfirmasi</p>
                <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
                  {confirmedPicketAttendances.length}
                </p>
              </div>
            </div>

            {confirmedPicketAttendances.length === 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                Belum ada presensi Guru Piket yang dikonfirmasi Admin. Konfirmasi kehadiran Guru
                Piket terlebih dahulu pada menu <strong>Konfirmasi Kehadiran</strong> sebelum
                menunjuk guru pengganti.
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitting) return;
                if (!delegationForm.picket_attendance_id) {
                  showToast('error', 'Pilih Guru Piket terkonfirmasi Admin terlebih dahulu.');
                  return;
                }
                if (!delegationForm.delegation_date) {
                  showToast('error', 'Tanggal penunjukkan guru pengganti wajib diisi.');
                  return;
                }
                if (!delegationForm.original_teacher_id || !delegationForm.substitute_teacher_id) {
                  showToast('error', 'Pilih guru berhalangan dan guru pengganti.');
                  return;
                }
                if (delegationForm.original_teacher_id === delegationForm.substitute_teacher_id) {
                  showToast(
                    'error',
                    'Guru pengganti tidak boleh sama dengan guru yang berhalangan.'
                  );
                  return;
                }

                const safeJtm = Math.min(
                  12,
                  Math.max(1, Number.isFinite(delegationForm.jtm_transferred) ? delegationForm.jtm_transferred : 2)
                );

                setSubmitting(true);
                try {
                  const res = await postPresensi({
                    action: 'CREATE_DELEGATION',
                    picket_attendance_id: delegationForm.picket_attendance_id,
                    delegation_date: delegationForm.delegation_date,
                    delegation_type: delegationForm.delegation_type,
                    original_teacher_id: delegationForm.original_teacher_id,
                    substitute_teacher_id: delegationForm.substitute_teacher_id,
                    schedule_id:
                      delegationForm.delegation_type === 'MENGAJAR' && delegationForm.schedule_id
                        ? delegationForm.schedule_id
                        : null,
                    jtm_transferred: safeJtm,
                    reason: delegationForm.reason.trim() || null,
                  });
                  if (res) {
                    showToast(
                      'success',
                      'Guru pengganti berhasil ditunjuk. Guru pengganti wajib presensi & isi Jurnal Pembelajaran agar JTM dihitung.'
                    );
                    setDelegationForm((prev) => ({
                      ...prev,
                      original_teacher_id: '',
                      substitute_teacher_id: '',
                      schedule_id: '',
                      jtm_transferred: 2,
                      reason: '',
                    }));
                    setPenggantiPage(1);
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="pengganti-picket-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Guru Piket Terkonfirmasi Admin <span className="text-rose-500">*</span>
                </label>
                <select
                  id="pengganti-picket-select"
                  required
                  value={delegationForm.picket_attendance_id}
                  onChange={(e) =>
                    setDelegationForm({ ...delegationForm, picket_attendance_id: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Guru Piket Terkonfirmasi Admin --</option>
                  {confirmedPicketAttendances.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'} (Terkonfirmasi)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-date-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal Tugas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="pengganti-date-input"
                    required
                    type="date"
                    value={delegationForm.delegation_date}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, delegation_date: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-type-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Jenis Penunjukkan
                  </label>
                  <select
                    id="pengganti-type-select"
                    value={delegationForm.delegation_type}
                    onChange={(e) =>
                      setDelegationForm({
                        ...delegationForm,
                        delegation_type: e.target.value as 'MENGAJAR' | 'PIKET',
                        schedule_id: '',
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="MENGAJAR">Pengganti Mengajar</option>
                    <option value="PIKET">Guru Piket Pengganti</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-schedule-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Jadwal Mengajar (Opsional)
                  </label>
                  <select
                    id="pengganti-schedule-select"
                    disabled={delegationForm.delegation_type === 'PIKET'}
                    value={delegationForm.schedule_id}
                    onChange={(e) => {
                      const nextSchedId = e.target.value;
                      const sched = schedules.find((s) => s.id === nextSchedId);
                      setDelegationForm({
                        ...delegationForm,
                        schedule_id: nextSchedId,
                        original_teacher_id:
                          sched?.teacher_id || delegationForm.original_teacher_id,
                        substitute_teacher_id:
                          sched?.teacher_id &&
                            sched.teacher_id === delegationForm.substitute_teacher_id
                            ? ''
                            : delegationForm.substitute_teacher_id,
                        jtm_transferred: sched?.jtm_count || delegationForm.jtm_transferred,
                      });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Jadwal Mengajar (Opsional) --</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)} • {s.classroom?.name}{' '}
                        • {s.subject?.name} ({s.jtm_count} JTM)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-original-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Guru Berhalangan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="pengganti-original-select"
                    required
                    value={delegationForm.original_teacher_id}
                    onChange={(e) => {
                      const nextOriginal = e.target.value;
                      setDelegationForm({
                        ...delegationForm,
                        original_teacher_id: nextOriginal,
                        substitute_teacher_id:
                          delegationForm.substitute_teacher_id === nextOriginal
                            ? ''
                            : delegationForm.substitute_teacher_id,
                      });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Guru Berhalangan --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-substitute-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Guru Pengganti <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="pengganti-substitute-select"
                    required
                    value={delegationForm.substitute_teacher_id}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, substitute_teacher_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Guru Pengganti --</option>
                    {teachers
                      .filter((t) => t.id !== delegationForm.original_teacher_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {isSameTeacher && (
                <p className="text-xs text-rose-600 font-medium">
                  Guru pengganti tidak boleh sama dengan guru yang berhalangan.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-jtm-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    JTM Dialihkan (1–12 JTM)
                  </label>
                  <input
                    id="pengganti-jtm-input"
                    type="number"
                    min={1}
                    max={12}
                    value={delegationForm.jtm_transferred}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setDelegationForm({
                        ...delegationForm,
                        jtm_transferred: Number.isFinite(val)
                          ? Math.min(12, Math.max(1, val))
                          : 1,
                      });
                    }}
                    placeholder="JTM Jadwal"
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="pengganti-reason-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Alasan / Keterangan (Opsional)
                  </label>
                  <input
                    id="pengganti-reason-input"
                    placeholder="Contoh: Sakit, Dinas Luar, Izin Keluarga"
                    value={delegationForm.reason}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, reason: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  submitting || confirmedPicketAttendances.length === 0 || isSameTeacher
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Tunjuk Guru Pengganti
              </button>
            </form>

            {/* Daftar Penunjukkan Guru Pengganti */}
            <div className="pt-3 border-t border-slate-200/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: `Semua (${delegations.length})` },
                      { id: 'MENGAJAR', label: `Mengajar (${mengajarDelegationCount})` },
                      { id: 'PIKET', label: `Piket (${piketDelegationCount})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setPenggantiFilter(tab.id);
                        setPenggantiPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${penggantiFilter === tab.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={penggantiSearch}
                    onChange={(e) => {
                      setPenggantiSearch(e.target.value);
                      setPenggantiPage(1);
                    }}
                    placeholder="Cari guru, kelas, alasan..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  {penggantiSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPenggantiSearch('');
                        setPenggantiPage(1);
                      }}
                      aria-label="Hapus pencarian delegasi"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filteredDelegations.length === 0 ? (
                <AkademikEmptyState
                  icon={<UserCheck className="w-6 h-6 text-slate-400" />}
                  message={
                    delegations.length === 0
                      ? 'Belum ada penunjukkan guru pengganti yang tercatat.'
                      : 'Tidak ada data penunjukkan guru pengganti yang cocok dengan filter atau pencarian Anda.'
                  }
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {paginatedDelegations.map((del) => (
                      <div
                        key={del.id}
                        className="p-3.5 rounded-2xl bg-white/85 border border-slate-200/80 hover:border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              {del.substitute?.full_name || 'Guru Pengganti'}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="text-slate-700 font-medium">
                              menggantikan {del.original?.full_name || 'Guru'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${del.delegation_type === 'PIKET'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                            >
                              {del.delegation_type === 'PIKET' ? 'Piket Pengganti' : 'Mengajar'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 break-words">
                            {del.delegation_date}
                            {del.schedule?.classroom?.name || del.schedule?.subject?.name
                              ? ` • ${del.schedule?.classroom?.name || ''} ${del.schedule?.subject?.name || ''}`.trimEnd()
                              : ''}
                            {del.reason ? ` • Alasan: ${del.reason}` : ''}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold shrink-0 self-start sm:self-center">
                          {del.jtm_transferred} JTM
                        </span>
                      </div>
                    ))}
                  </div>

                  {totalPenggantiPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                      <span>
                        Halaman <strong>{safePenggantiPage}</strong> dari{' '}
                        <strong>{totalPenggantiPages}</strong> ({filteredDelegations.length}{' '}
                        delegasi)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safePenggantiPage <= 1}
                          onClick={() => setPenggantiPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Sebelumnya
                        </button>
                        <button
                          type="button"
                          disabled={safePenggantiPage >= totalPenggantiPages}
                          onClick={() =>
                            setPenggantiPage((p) => Math.min(totalPenggantiPages, p + 1))
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
        );
      })()}

      {/* 4. Absensi Siswa Reguler (Khusus Guru Piket / Guru Piket Pengganti Terkonfirmasi Admin) */}
      {section === 'absensi-siswa' && (() => {
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
      })()}

      {/* 5. Laporan Harian Piket (Syarat Hitung JTM Guru Piket / Piket Pengganti) */}
      {section === 'laporan-piket' && (() => {
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
      })()}

      {/* 6. Input Manual Jam Masuk & Pulang */}
      {section === 'jam-manual' && (() => {
        const MANUAL_TIME_PAGE_SIZE = 6;
        const validAttendances = teacherAttendances.filter((a) => a.is_within_geofence);
        const missingCheckoutCount = validAttendances.filter((a) => !a.check_out_time).length;
        const filledCheckoutCount = validAttendances.filter((a) => Boolean(a.check_out_time)).length;
        const piketPanitiaCount = validAttendances.filter(
          (a) => a.attendance_type === 'PIKET' || a.attendance_type === 'PANITIA_UJIAN'
        ).length;

        const toWibHhmm = (iso?: string | null): string | null => {
          if (!iso) return null;
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return null;
          const formatted = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(d);
          return /^\d{2}:\d{2}$/.test(formatted) ? formatted : null;
        };

        const selectAttendanceForManualTime = (attendanceId: string) => {
          const target = validAttendances.find((a) => a.id === attendanceId);
          const existingIn = toWibHhmm(target?.check_in_time);
          const existingOut = toWibHhmm(target?.check_out_time);
          setManualTimeForm((prev) => ({
            ...prev,
            attendance_id: attendanceId,
            check_in_hhmm: existingIn || prev.check_in_hhmm || '07:30',
            check_out_hhmm: existingOut || prev.check_out_hhmm || '12:30',
          }));
        };

        const selectedAttendance = validAttendances.find(
          (a) => a.id === manualTimeForm.attendance_id
        );
        const isAdminOnlyTarget =
          selectedAttendance?.attendance_type === 'PIKET' ||
          selectedAttendance?.attendance_type === 'PANITIA_UJIAN';
        const [selectedActorKind, selectedActorId] = manualTimeForm.actor_ref.split(':');
        const selectedPicketActor =
          selectedActorKind === 'picket'
            ? confirmedPicketAttendances.find((p) => p.id === selectedActorId)
            : null;
        const isPicketDateMismatch =
          Boolean(selectedAttendance) &&
          Boolean(selectedPicketActor) &&
          selectedPicketActor!.attendance_date !== selectedAttendance!.attendance_date;

        const filteredByStatus =
          manualTimeFilter === 'ALL'
            ? validAttendances
            : manualTimeFilter === 'MISSING'
              ? validAttendances.filter((a) => !a.check_out_time)
              : validAttendances.filter((a) => Boolean(a.check_out_time));

        const query = manualTimeSearch.trim().toLowerCase();
        const filteredAttendances = query
          ? filteredByStatus.filter((a) => {
              const haystack = [a.teacher?.full_name, a.attendance_date, a.attendance_type]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return haystack.includes(query);
            })
          : filteredByStatus;

        const totalManualPages = Math.max(
          1,
          Math.ceil(filteredAttendances.length / MANUAL_TIME_PAGE_SIZE)
        );
        const safeManualPage = Math.min(manualTimePage, totalManualPages);
        const paginatedAttendances = filteredAttendances.slice(
          (safeManualPage - 1) * MANUAL_TIME_PAGE_SIZE,
          safeManualPage * MANUAL_TIME_PAGE_SIZE
        );

        const canAccessForm =
          canAdminConfirm ||
          confirmedPicketAttendances.length > 0 ||
          confirmedCommitteeAttendances.length > 0;

        return (
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Input Manual Jam Masuk &amp; Jam Pulang</span>
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Diisi manual oleh <strong>Admin</strong>, <strong>Guru Piket/Pengganti</strong>,
                  atau <strong>Panitia Ujian/Pengganti</strong> (khusus jam masuk &amp; pulang Guru
                  Piket dan Panitia Ujian wajib diisi manual oleh Admin).
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
                <p className="text-[11px] font-medium text-slate-500">Presensi Valid</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {validAttendances.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Belum Jam Pulang</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {missingCheckoutCount}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Sudah Jam Pulang</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                  {filledCheckoutCount}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Piket &amp; Panitia</p>
                <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
                  {piketPanitiaCount}
                </p>
              </div>
            </div>

            {canAccessForm ? (
              <div className="grid lg:grid-cols-12 gap-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (submitting) return;
                    if (!manualTimeForm.attendance_id) {
                      showToast('error', 'Pilih data presensi terlebih dahulu.');
                      return;
                    }
                    if (!canAdminConfirm && !manualTimeForm.actor_ref) {
                      showToast(
                        'error',
                        'Pilih peran Anda (Guru Piket / Panitia Terkonfirmasi) terlebih dahulu.'
                      );
                      return;
                    }
                    if (!canAdminConfirm && isAdminOnlyTarget) {
                      showToast(
                        'error',
                        'Jam masuk dan jam pulang Guru Piket atau Panitia Ujian hanya dapat diisi manual oleh Admin.'
                      );
                      return;
                    }
                    if (isPicketDateMismatch) {
                      showToast(
                        'error',
                        'Tanggal presensi Guru Piket harus sama dengan tanggal presensi target.'
                      );
                      return;
                    }
                    if (
                      !/^\d{2}:\d{2}$/.test(manualTimeForm.check_in_hhmm) ||
                      !/^\d{2}:\d{2}$/.test(manualTimeForm.check_out_hhmm)
                    ) {
                      showToast('error', 'Format jam masuk dan jam pulang harus HH:MM.');
                      return;
                    }
                    if (manualTimeForm.check_out_hhmm <= manualTimeForm.check_in_hhmm) {
                      showToast('error', 'Jam pulang harus lebih besar dari jam masuk.');
                      return;
                    }
                    const [kind, refId] = manualTimeForm.actor_ref.split(':');
                    setSubmitting(true);
                    try {
                      const res = await postPresensi({
                        action: 'SET_ATTENDANCE_TIMES',
                        attendance_id: manualTimeForm.attendance_id,
                        check_in_hhmm: manualTimeForm.check_in_hhmm,
                        check_out_hhmm: manualTimeForm.check_out_hhmm,
                        picket_attendance_id: kind === 'picket' ? refId : null,
                        committee_attendance_id: kind === 'committee' ? refId : null,
                      });
                      if (res) {
                        showToast('success', 'Jam masuk & jam pulang berhasil disimpan.');
                        setManualTimeForm((prev) => ({
                          ...prev,
                          attendance_id: '',
                        }));
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="jam-manual-att-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Presensi Target <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="jam-manual-att-select"
                      required
                      value={manualTimeForm.attendance_id}
                      onChange={(e) => selectAttendanceForManualTime(e.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="">
                        -- Pilih Presensi Guru / Pengawas / Piket / Panitia --
                      </option>
                      {validAttendances.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.attendance_date} • {a.teacher?.full_name || 'Guru'} ({a.attendance_type}
                          ) {a.check_out_time ? '[Sudah ada jam pulang]' : '[Belum ada jam pulang]'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="jam-manual-actor-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Peran Penginput
                    </label>
                    <select
                      id="jam-manual-actor-select"
                      value={manualTimeForm.actor_ref}
                      onChange={(e) =>
                        setManualTimeForm({ ...manualTimeForm, actor_ref: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="">
                        {canAdminConfirm
                          ? '-- Input sebagai Admin --'
                          : '-- Pilih Peran Anda (Guru Piket / Panitia Terkonfirmasi) --'}
                      </option>
                      {confirmedPicketAttendances.map((p) => (
                        <option key={`p:${p.id}`} value={`picket:${p.id}`}>
                          Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                        </option>
                      ))}
                      {confirmedCommitteeAttendances.map((c) => (
                        <option key={`c:${c.id}`} value={`committee:${c.id}`}>
                          Panitia Ujian: {c.teacher?.full_name || 'Panitia'} ({c.attendance_date})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!canAdminConfirm && isAdminOnlyTarget && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      Jam masuk &amp; jam pulang untuk <strong>{selectedAttendance?.attendance_type}</strong>{' '}
                      hanya dapat diisi manual oleh Admin.
                    </div>
                  )}

                  {isPicketDateMismatch && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      Tanggal Guru Piket (<strong>{selectedPicketActor?.attendance_date}</strong>)
                      berbeda dengan tanggal presensi target (
                      <strong>{selectedAttendance?.attendance_date}</strong>).
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="jam-manual-checkin"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Jam Masuk (WIB) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="jam-manual-checkin"
                        type="time"
                        required
                        value={manualTimeForm.check_in_hhmm}
                        onChange={(e) =>
                          setManualTimeForm({ ...manualTimeForm, check_in_hhmm: e.target.value })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="jam-manual-checkout"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Jam Pulang (WIB) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="jam-manual-checkout"
                        type="time"
                        required
                        value={manualTimeForm.check_out_hhmm}
                        onChange={(e) =>
                          setManualTimeForm({ ...manualTimeForm, check_out_hhmm: e.target.value })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !manualTimeForm.attendance_id ||
                      (!canAdminConfirm && isAdminOnlyTarget) ||
                      isPicketDateMismatch
                    }
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Jam Masuk &amp; Jam Pulang
                  </button>
                </form>

                {/* Daftar Presensi untuk Pilih Cepat */}
                <div className="lg:col-span-6 space-y-3 min-w-0">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'ALL', label: `Semua (${validAttendances.length})` },
                          { id: 'MISSING', label: `Belum Pulang (${missingCheckoutCount})` },
                          { id: 'FILLED', label: `Sudah Pulang (${filledCheckoutCount})` },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setManualTimeFilter(tab.id);
                            setManualTimePage(1);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                            manualTimeFilter === tab.id
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
                        value={manualTimeSearch}
                        onChange={(e) => {
                          setManualTimeSearch(e.target.value);
                          setManualTimePage(1);
                        }}
                        placeholder="Cari nama guru, tanggal, tipe..."
                        className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                      {manualTimeSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualTimeSearch('');
                            setManualTimePage(1);
                          }}
                          aria-label="Hapus pencarian presensi"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredAttendances.length === 0 ? (
                    <AkademikEmptyState
                      icon={<Clock className="w-6 h-6 text-slate-400" />}
                      message={
                        validAttendances.length === 0
                          ? 'Belum ada data presensi valid dalam radius geofencing.'
                          : 'Tidak ada data presensi yang cocok dengan filter atau pencarian Anda.'
                      }
                    />
                  ) : (
                    <>
                      <div className="space-y-2">
                        {paginatedAttendances.map((a) => {
                          const inHhmm = toWibHhmm(a.check_in_time);
                          const outHhmm = toWibHhmm(a.check_out_time);
                          const isSelected = manualTimeForm.attendance_id === a.id;

                          return (
                            <div
                              key={a.id}
                              className={`modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors ${
                                isSelected ? 'ring-2 ring-emerald-500 border-emerald-400' : ''
                              }`}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="font-bold text-slate-900 truncate">
                                    {a.teacher?.full_name || 'Guru'}
                                  </p>
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                    {a.attendance_type}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  {a.attendance_date} • Masuk: {inHhmm || '-'} • Pulang:{' '}
                                  {outHhmm || 'Belum diisi'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => selectAttendanceForManualTime(a.id)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-700 text-white'
                                    : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                {isSelected ? 'Dipilih' : 'Pilih'}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {totalManualPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                          <span>
                            Halaman <strong>{safeManualPage}</strong> dari{' '}
                            <strong>{totalManualPages}</strong> ({filteredAttendances.length} data)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeManualPage <= 1}
                              onClick={() => setManualTimePage((p) => Math.max(1, p - 1))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={safeManualPage >= totalManualPages}
                              onClick={() =>
                                setManualTimePage((p) => Math.min(totalManualPages, p + 1))
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
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Hanya Admin, Guru Piket Terkonfirmasi, atau Panitia Ujian Terkonfirmasi yang dapat
                menginput jam masuk &amp; jam pulang manual.
              </div>
            )}
          </div>
        );
      })()}

      {section === 'izin-keluar' && (() => {
        const SHORT_LEAVE_PAGE_SIZE = 6;
        const validAttendances = teacherAttendances.filter((a) => a.is_within_geofence);
        const totalDurationMinutes = shortLeaves.reduce(
          (sum, lv) => sum + (Number(lv.duration_minutes) || 0),
          0
        );
        const todayShortLeavesCount = shortLeaves.filter(
          (lv) => lv.leave_date === activeDate
        ).length;

        const selectedAttendance = validAttendances.find(
          (a) => a.id === shortLeaveForm.attendance_id
        );
        const [selectedActorKind, selectedActorId] = shortLeaveForm.actor_ref.split(':');
        const selectedPicketActor =
          selectedActorKind === 'picket'
            ? confirmedPicketAttendances.find((p) => p.id === selectedActorId)
            : null;
        const isPicketDateMismatch =
          Boolean(selectedAttendance) &&
          Boolean(selectedPicketActor) &&
          selectedPicketActor!.attendance_date !== selectedAttendance!.attendance_date;

        const computeDurationMinutes = (start: string, end: string): number | null => {
          if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
          const [sh, sm] = start.split(':').map(Number);
          const [eh, em] = end.split(':').map(Number);
          const diff = eh * 60 + em - (sh * 60 + sm);
          return diff > 0 ? diff : null;
        };
        const previewDuration = computeDurationMinutes(
          shortLeaveForm.leave_start_time,
          shortLeaveForm.leave_end_time
        );

        const query = shortLeaveSearch.trim().toLowerCase();
        const filteredLeaves = query
          ? shortLeaves.filter((lv) => {
              const haystack = [
                lv.leave_date,
                lv.teacher?.full_name,
                lv.reason,
                lv.recorded_by_role,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return haystack.includes(query);
            })
          : shortLeaves;

        const totalShortLeavePages = Math.max(
          1,
          Math.ceil(filteredLeaves.length / SHORT_LEAVE_PAGE_SIZE)
        );
        const safeShortLeavePage = Math.min(shortLeavePage, totalShortLeavePages);
        const paginatedLeaves = filteredLeaves.slice(
          (safeShortLeavePage - 1) * SHORT_LEAVE_PAGE_SIZE,
          safeShortLeavePage * SHORT_LEAVE_PAGE_SIZE
        );

        const canAccessForm =
          canAdminConfirm ||
          confirmedPicketAttendances.length > 0 ||
          confirmedCommitteeAttendances.length > 0;

        return (
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Izin Keluar Sebentar ({shortLeaves.length})</span>
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Diinput oleh <strong>Admin</strong>, <strong>Guru Piket/Pengganti</strong>, atau{' '}
                  <strong>Panitia Ujian/Pengganti</strong>. Durasi izin keluar sebentar otomatis
                  mengurangi persentase kehadiran untuk Tunjangan Transportasi.
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
                  {shortLeaves.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Izin Hari Ini</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {todayShortLeavesCount}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Total Durasi</p>
                <p className="text-xl font-bold text-rose-700 mt-0.5 tabular-nums">
                  {totalDurationMinutes} <span className="text-xs font-semibold">menit</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Presensi Valid</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                  {validAttendances.length}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {canAccessForm ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (submitting) return;
                    if (!shortLeaveForm.attendance_id) {
                      showToast('error', 'Pilih presensi guru / pengawas terlebih dahulu.');
                      return;
                    }
                    if (!canAdminConfirm && !shortLeaveForm.actor_ref) {
                      showToast(
                        'error',
                        'Pilih peran Anda (Guru Piket / Panitia Terkonfirmasi) terlebih dahulu.'
                      );
                      return;
                    }
                    if (isPicketDateMismatch) {
                      showToast(
                        'error',
                        'Tanggal presensi Guru Piket harus sama dengan tanggal presensi target.'
                      );
                      return;
                    }
                    if (
                      !/^\d{2}:\d{2}$/.test(shortLeaveForm.leave_start_time) ||
                      !/^\d{2}:\d{2}$/.test(shortLeaveForm.leave_end_time)
                    ) {
                      showToast('error', 'Format jam keluar dan jam kembali harus HH:MM.');
                      return;
                    }
                    if (shortLeaveForm.leave_end_time <= shortLeaveForm.leave_start_time) {
                      showToast('error', 'Jam kembali harus lebih besar dari jam keluar.');
                      return;
                    }
                    const [kind, refId] = shortLeaveForm.actor_ref.split(':');
                    setSubmitting(true);
                    try {
                      const res = await postPresensi({
                        action: 'CREATE_SHORT_LEAVE',
                        attendance_id: shortLeaveForm.attendance_id,
                        leave_start_time: shortLeaveForm.leave_start_time,
                        leave_end_time: shortLeaveForm.leave_end_time,
                        reason: shortLeaveForm.reason.trim() || null,
                        picket_attendance_id: kind === 'picket' ? refId : null,
                        committee_attendance_id: kind === 'committee' ? refId : null,
                      });
                      if (res) {
                        showToast('success', 'Izin keluar sebentar berhasil dicatat.');
                        setShortLeaveForm((prev) => ({
                          ...prev,
                          attendance_id: '',
                          reason: '',
                        }));
                        setShortLeavePage(1);
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="izin-keluar-att-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Presensi Guru / Pengawas Hadir <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="izin-keluar-att-select"
                      required
                      value={shortLeaveForm.attendance_id}
                      onChange={(e) =>
                        setShortLeaveForm({ ...shortLeaveForm, attendance_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    >
                      <option value="">-- Pilih Presensi Guru / Pengawas Hadir --</option>
                      {validAttendances.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.attendance_date} • {a.teacher?.full_name || 'Guru'} (
                          {a.attendance_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="izin-keluar-actor-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Peran Pencatat
                    </label>
                    <select
                      id="izin-keluar-actor-select"
                      value={shortLeaveForm.actor_ref}
                      onChange={(e) =>
                        setShortLeaveForm({ ...shortLeaveForm, actor_ref: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    >
                      <option value="">
                        {canAdminConfirm
                          ? '-- Catat sebagai Admin --'
                          : '-- Pilih Peran Anda (Guru Piket / Panitia Terkonfirmasi) --'}
                      </option>
                      {confirmedPicketAttendances.map((p) => (
                        <option key={`p:${p.id}`} value={`picket:${p.id}`}>
                          Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                        </option>
                      ))}
                      {confirmedCommitteeAttendances.map((c) => (
                        <option key={`c:${c.id}`} value={`committee:${c.id}`}>
                          Panitia Ujian: {c.teacher?.full_name || 'Panitia'} ({c.attendance_date})
                        </option>
                      ))}
                    </select>
                  </div>

                  {isPicketDateMismatch && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      Tanggal Guru Piket (<strong>{selectedPicketActor?.attendance_date}</strong>)
                      berbeda dengan tanggal presensi target (
                      <strong>{selectedAttendance?.attendance_date}</strong>).
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="izin-keluar-start"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Jam Keluar (WIB) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="izin-keluar-start"
                        type="time"
                        required
                        value={shortLeaveForm.leave_start_time}
                        onChange={(e) =>
                          setShortLeaveForm({ ...shortLeaveForm, leave_start_time: e.target.value })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="izin-keluar-end"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Jam Kembali (WIB) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="izin-keluar-end"
                        type="time"
                        required
                        value={shortLeaveForm.leave_end_time}
                        onChange={(e) =>
                          setShortLeaveForm({ ...shortLeaveForm, leave_end_time: e.target.value })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {previewDuration !== null ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      Estimasi durasi izin keluar: <strong>-{previewDuration} menit</strong>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      Jam kembali harus lebih besar dari jam keluar.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="izin-keluar-reason"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Alasan Izin Keluar Sebentar (Opsional)
                    </label>
                    <input
                      id="izin-keluar-reason"
                      placeholder="Contoh: Urusan keluarga / ke bank / dinas singkat"
                      value={shortLeaveForm.reason}
                      onChange={(e) =>
                        setShortLeaveForm({ ...shortLeaveForm, reason: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !shortLeaveForm.attendance_id ||
                      previewDuration === null ||
                      isPicketDateMismatch
                    }
                    className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Catat Izin Keluar Sebentar
                  </button>
                </form>
              ) : (
                <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 self-start">
                  Hanya Admin, Guru Piket Terkonfirmasi, atau Panitia Ujian Terkonfirmasi yang dapat
                  mencatat izin keluar sebentar.
                </div>
              )}

              <div className="lg:col-span-6 space-y-3 min-w-0">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={shortLeaveSearch}
                    onChange={(e) => {
                      setShortLeaveSearch(e.target.value);
                      setShortLeavePage(1);
                    }}
                    placeholder="Cari nama guru, tanggal, alasan..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                  {shortLeaveSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setShortLeaveSearch('');
                        setShortLeavePage(1);
                      }}
                      aria-label="Hapus pencarian izin keluar"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {filteredLeaves.length === 0 ? (
                  <AkademikEmptyState
                    icon={<Clock className="w-6 h-6 text-slate-400" />}
                    message={
                      shortLeaves.length === 0
                        ? 'Belum ada catatan izin keluar sebentar.'
                        : 'Tidak ada catatan izin keluar yang cocok dengan kata kunci pencarian Anda.'
                    }
                  />
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedLeaves.map((lv) => (
                        <div
                          key={lv.id}
                          className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-slate-900 truncate">
                                {lv.leave_date} • {lv.teacher?.full_name || 'Guru'}
                              </p>
                              {lv.recorded_by_role && (
                                <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800 text-[10px] font-semibold">
                                  {lv.recorded_by_role}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 break-words">
                              {(lv.leave_start_time || '').slice(0, 5)}–
                              {(lv.leave_end_time || '').slice(0, 5)}
                              {lv.reason ? ` • ${lv.reason}` : ''}
                            </p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold shrink-0 self-start sm:self-center">
                            -{lv.duration_minutes} menit
                          </span>
                        </div>
                      ))}
                    </div>

                    {totalShortLeavePages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                        <span>
                          Halaman <strong>{safeShortLeavePage}</strong> dari{' '}
                          <strong>{totalShortLeavePages}</strong> ({filteredLeaves.length} catatan)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={safeShortLeavePage <= 1}
                            onClick={() => setShortLeavePage((p) => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Sebelumnya
                          </button>
                          <button
                            type="button"
                            disabled={safeShortLeavePage >= totalShortLeavePages}
                            onClick={() =>
                              setShortLeavePage((p) => Math.min(totalShortLeavePages, p + 1))
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
      })()}

      {/* Modal Popup Di Luar Radius Geofencing (Req #2) */}
      <AkademikModal
        open={Boolean(outsideModal)}
        onClose={() => setOutsideModal(null)}
        title="Di Luar Radius Geofencing"
      >
        {outsideModal && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Absensi geofencing hanya bisa dilakukan di dalam radius yang diizinkan oleh lembaga.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span>Jarak Anda saat ini:</span>
                <strong>{outsideModal.distanceMeters} meter</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Radius maksimal diizinkan:</span>
                <strong>{outsideModal.radiusMeters} meter</strong>
              </div>
              <div className="text-[11px] text-rose-700 pt-1 border-t border-rose-200/70 font-mono break-all">
                Posisi Anda: {outsideModal.teacherLat}, {outsideModal.teacherLng}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Pastikan Anda berada di lingkungan madrasah/sekolah dan GPS perangkat aktif, lalu klik{' '}
              <strong>Ambil GPS Perangkat</strong> untuk memperbarui posisi Anda.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOutsideModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutsideModal(null);
                  captureBrowserGps(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Perbarui GPS Sekarang
              </button>
            </div>
          </>
        )}
      </AkademikModal>

      {/* Modal 1: Penyesuaian JTM saat Konfirmasi Kehadiran */}
      <AkademikModal
        open={Boolean(jtmAdjustModal)}
        onClose={() => {
          if (!submitting) setJtmAdjustModal(null);
        }}
        title="Konfirmasi Kehadiran & Penyesuaian JTM"
      >
        {jtmAdjustModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuaikan jumlah JTM yang akan diperoleh{' '}
              <strong className="text-slate-900">{jtmAdjustModal.teacherName}</strong> (
              {jtmAdjustModal.label}) setelah mengisi laporan / jurnal yang diwajibkan.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">JTM Jadwal Seharusnya:</span>
              <strong className="text-slate-900">{jtmAdjustModal.expectedJtm} JTM</strong>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jtm-adjust-approved-input"
                className="block text-xs font-semibold text-slate-700"
              >
                JTM yang Diperoleh (Disetujui)
              </label>
              <input
                id="jtm-adjust-approved-input"
                type="number"
                min={0}
                max={jtmAdjustModal.expectedJtm}
                step="0.5"
                value={jtmAdjustModal.approvedJtm}
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value);
                  const val = Number.isFinite(parsed)
                    ? Math.min(jtmAdjustModal.expectedJtm, Math.max(0, parsed))
                    : 0;
                  setJtmAdjustModal({
                    ...jtmAdjustModal,
                    approvedJtm: val,
                  });
                }}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setJtmAdjustModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const raw = Number(jtmAdjustModal.approvedJtm);
                  const clampedApproved = Number.isFinite(raw)
                    ? Math.min(jtmAdjustModal.expectedJtm, Math.max(0, raw))
                    : 0;
                  const diff = Number((jtmAdjustModal.expectedJtm - clampedApproved).toFixed(2));
                  const teacherId =
                    jtmAdjustModal.sessionItem?.teacher_id || jtmAdjustModal.att?.teacher_id || '';
                  if (diff > 0) {
                    setJtmDiffModal({
                      sessionItem: jtmAdjustModal.sessionItem,
                      att: jtmAdjustModal.att,
                      teacherId,
                      expectedJtm: jtmAdjustModal.expectedJtm,
                      approvedJtm: clampedApproved,
                      diffJtm: diff,
                      picketAttendanceId: jtmAdjustModal.picketAttendanceId,
                      recipientTeacherId: '',
                      reason: '',
                    });
                    setJtmAdjustModal(null);
                    return;
                  }
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    const res = jtmAdjustModal.sessionItem
                      ? await postPresensi({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'MENGAJAR',
                        session_date: jtmAdjustModal.sessionItem.session_date,
                        teacher_id: jtmAdjustModal.sessionItem.teacher_id,
                        schedule_id: jtmAdjustModal.sessionItem.schedule_id,
                        delegation_id: jtmAdjustModal.sessionItem.delegation_id,
                        picket_attendance_id: jtmAdjustModal.picketAttendanceId,
                        approved_jtm: clampedApproved,
                      })
                      : await postPresensi({
                        action: 'CONFIRM_ATTENDANCE',
                        attendance_id: jtmAdjustModal.att!.id,
                        picket_attendance_id: jtmAdjustModal.picketAttendanceId,
                        approved_jtm: clampedApproved,
                      });
                    if (res) {
                      showToast(
                        'success',
                        `Jadwal dikonfirmasi dengan ${clampedApproved} JTM.`
                      );
                      setJtmAdjustModal(null);
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {jtmAdjustModal.approvedJtm < jtmAdjustModal.expectedJtm
                  ? 'Lanjut Alokasi Selisih JTM →'
                  : 'Konfirmasi Hadir'}
              </button>
            </div>
          </div>
        )}
      </AkademikModal>

      {/* Modal 2: Alokasi Selisih JTM ke Guru / Pengawas Lain */}
      <AkademikModal
        open={Boolean(jtmDiffModal)}
        onClose={() => {
          if (!submitting) setJtmDiffModal(null);
        }}
        title="Alokasi Selisih JTM"
      >
        {jtmDiffModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Terdapat selisih <strong className="text-slate-900">{jtmDiffModal.diffJtm} JTM</strong>{' '}
              (dari {jtmDiffModal.expectedJtm} JTM menjadi {jtmDiffModal.approvedJtm} JTM). Pilih
              guru/pengawas yang menerima selisih JTM ini. Penerima wajib melakukan presensi,
              dikonfirmasi kehadirannya, dan mengisi Jurnal/BAP.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="jtm-diff-recipient-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Guru / Pengawas Penerima Selisih JTM <span className="text-rose-500">*</span>
              </label>
              <select
                id="jtm-diff-recipient-select"
                required
                value={jtmDiffModal.recipientTeacherId}
                onChange={(e) =>
                  setJtmDiffModal({ ...jtmDiffModal, recipientTeacherId: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">-- Pilih Guru / Pengawas Penerima Selisih JTM --</option>
                {teachers
                  .filter((t) => t.id !== jtmDiffModal.teacherId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jtm-diff-reason-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Keterangan / Alasan Penyesuaian JTM (Opsional)
              </label>
              <input
                id="jtm-diff-reason-input"
                placeholder="Contoh: Jam terakhir digantikan guru piket"
                value={jtmDiffModal.reason}
                onChange={(e) => setJtmDiffModal({ ...jtmDiffModal, reason: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setJtmDiffModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !jtmDiffModal.recipientTeacherId}
                onClick={async () => {
                  if (submitting || !jtmDiffModal.recipientTeacherId) return;
                  setSubmitting(true);
                  const trimmedReason = jtmDiffModal.reason.trim();
                  try {
                    const res = jtmDiffModal.sessionItem
                      ? await postPresensi({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'MENGAJAR',
                        session_date: jtmDiffModal.sessionItem.session_date,
                        teacher_id: jtmDiffModal.sessionItem.teacher_id,
                        schedule_id: jtmDiffModal.sessionItem.schedule_id,
                        delegation_id: jtmDiffModal.sessionItem.delegation_id,
                        picket_attendance_id: jtmDiffModal.picketAttendanceId,
                        approved_jtm: jtmDiffModal.approvedJtm,
                        diff_recipient_teacher_id: jtmDiffModal.recipientTeacherId,
                        diff_reason: trimmedReason || null,
                      })
                      : await postPresensi({
                        action: 'CONFIRM_ATTENDANCE',
                        attendance_id: jtmDiffModal.att!.id,
                        picket_attendance_id: jtmDiffModal.picketAttendanceId,
                        approved_jtm: jtmDiffModal.approvedJtm,
                        diff_recipient_teacher_id: jtmDiffModal.recipientTeacherId,
                        diff_reason: trimmedReason || null,
                      });
                    if (res) {
                      showToast(
                        'success',
                        `Kehadiran dikonfirmasi (${jtmDiffModal.approvedJtm} JTM) & selisih ${jtmDiffModal.diffJtm} JTM dialokasikan.`
                      );
                      setJtmDiffModal(null);
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Konfirmasi &amp; Alokasikan Selisih
              </button>
            </div>
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
