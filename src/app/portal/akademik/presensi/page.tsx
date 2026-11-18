'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { verifyGeofence } from '@/lib/domain/geofence';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';

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

export default function PresensiPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string; nis: string | null }[]>([]);
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

  const [delegationForm, setDelegationForm] = useState({
    picket_attendance_id: '',
    delegation_date: '',
    delegation_type: 'MENGAJAR' as 'MENGAJAR' | 'PIKET',
    original_teacher_id: '',
    substitute_teacher_id: '',
    schedule_id: '',
    jtm_transferred: 2,
    reason: '',
  });

  const [studentAttForm, setStudentAttForm] = useState({
    picket_attendance_id: '',
    classroom_id: '',
    student_id: '',
    status: 'HADIR' as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA',
    notes: '',
  });

  const [picketReportForm, setPicketReportForm] = useState({
    attendance_id: '',
    summary: '',
    late_students_notes: '',
    teacher_substitution_notes: '',
    incidents: '',
  });

  const [manualTimeForm, setManualTimeForm] = useState({
    attendance_id: '',
    check_in_hhmm: '07:30',
    check_out_hhmm: '12:30',
    actor_ref: '', // '' = Admin, 'picket:<id>', 'committee:<id>'
  });

  const [shortLeaveForm, setShortLeaveForm] = useState({
    attendance_id: '',
    leave_start_time: '09:30',
    leave_end_time: '10:30',
    reason: '',
    actor_ref: '',
  });

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [biRes, prRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/akademik/presensi'),
      ]);
      const bi = await biRes.json();
      const pr = await prRes.json();
      setTeachers(bi.teachers || []);
      setStudents(pr.students || []);
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
    } finally {
      setLoading(false);
    }
  }, []);

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
    setDelegationForm((prev) =>
      prev.delegation_date ? prev : { ...prev, delegation_date: new Date().toISOString().slice(0, 10) }
    );
    loadData();
    captureBrowserGps(false);
  }, [loadData, captureBrowserGps]);

  async function postPresensi(body: unknown) {
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
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data presensi, jurnal &amp; delegasi...
      </div>
    );
  }

  const isLocationBlocked =
    geofenceConfig.enabled && (locationStatus !== 'granted' || !gpsCaptured);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 1. Presensi Guru GPS Geofencing */}
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-700" /> Presensi Guru{' '}
              {geofenceConfig.enabled ? '(GPS Geofencing)' : '(Mode Tanpa Geofencing)'}
            </h1>
            {geofenceConfig.enabled && (
              <button
                type="button"
                onClick={() => captureBrowserGps(true)}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" /> Ambil GPS Perangkat
              </button>
            )}
          </div>

          {!geofenceConfig.enabled && (
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs">
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
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                liveDistanceInfo.isWithinGeofence
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/80 border-rose-200 text-rose-800'
              }`}
            >
              <span>
                Jarak dari titik lembaga: <strong>{liveDistanceInfo.distanceMeters} m</strong> (batas{' '}
                {liveDistanceInfo.radiusMeters} m)
              </span>
              <span className="font-bold">
                {liveDistanceInfo.isWithinGeofence ? 'Dalam Radius' : 'Di Luar Radius'}
              </span>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (isLocationBlocked) return;

              // Verifikasi radius di sisi klien terlebih dahulu jika geofencing aktif (Req #2)
              if (geofenceConfig.enabled && liveDistanceInfo && !liveDistanceInfo.isWithinGeofence) {
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
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-3"
          >
            <select
              required
              value={teacherAttForm.teacher_id}
              onChange={(e) =>
                setTeacherAttForm({ ...teacherAttForm, teacher_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Guru / GTK --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>

            <select
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="MENGAJAR">Mengajar (Wajib Jurnal untuk Hitung JTM)</option>
              <option value="PIKET">Guru Piket (Wajib Konfirmasi Admin)</option>
              <option value="PENGAWAS_UJIAN">Pengawas Ujian (Wajib BAP untuk Hitung JTM)</option>
              <option value="PANITIA_UJIAN">Panitia Ujian (Wajib Konfirmasi Admin)</option>
              <option value="HARIAN">Harian</option>
            </select>

            {teacherAttForm.attendance_type === 'MENGAJAR' && (
              <div className="grid sm:grid-cols-2 gap-2">
                <select
                  value={teacherAttForm.schedule_id}
                  onChange={(e) =>
                    setTeacherAttForm({
                      ...teacherAttForm,
                      schedule_id: e.target.value,
                      delegation_id: '',
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Jadwal Mengajar Reguler (Opsional) --</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)} •{' '}
                      {s.classroom?.name || 'Kelas'} • {s.subject?.name || 'Mapel'} ({s.jtm_count}{' '}
                      JTM)
                    </option>
                  ))}
                </select>
                <select
                  value={teacherAttForm.delegation_id}
                  onChange={(e) =>
                    setTeacherAttForm({
                      ...teacherAttForm,
                      delegation_id: e.target.value,
                      schedule_id: '',
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
            )}

            {teacherAttForm.attendance_type === 'PIKET' && (
              <select
                value={teacherAttForm.delegation_id}
                onChange={(e) =>
                  setTeacherAttForm({
                    ...teacherAttForm,
                    delegation_id: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Guru Piket Reguler (atau pilih Tugas Piket Pengganti) --</option>
                {delegations
                  .filter((d) => d.delegation_type === 'PIKET')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.delegation_date}: Piket Pengganti ({d.original?.full_name || 'Guru'} →{' '}
                      {d.substitute?.full_name || 'Pengganti'}, {d.jtm_transferred} JTM)
                    </option>
                  ))}
              </select>
            )}

            {teacherAttForm.attendance_type === 'PENGAWAS_UJIAN' && (
              <select
                required
                value={teacherAttForm.exam_supervisor_id}
                onChange={(e) =>
                  setTeacherAttForm({ ...teacherAttForm, exam_supervisor_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Jadwal Tugas Pengawas Ujian --</option>
                {examSupervisors.map((es) => (
                  <option key={es.id} value={es.id}>
                    {es.exam_date} • {es.session_name} • {es.room?.room_name || 'Ruang'} •{' '}
                    {es.teacher?.full_name} ({es.jtm_allocated} JTM)
                  </option>
                ))}
              </select>
            )}

            {teacherAttForm.attendance_type === 'PANITIA_UJIAN' && (
              <select
                required
                value={teacherAttForm.exam_committee_id}
                onChange={(e) =>
                  setTeacherAttForm({ ...teacherAttForm, exam_committee_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Penugasan Panitia Ujian --</option>
                {examCommittees.map((ec) => (
                  <option key={ec.id} value={ec.id}>
                    {ec.period?.name || 'Ujian'} • {ec.committee_role} • {ec.teacher?.full_name} (
                    {ec.jtm_allocated} JTM)
                  </option>
                ))}
              </select>
            )}

            {geofenceConfig.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  readOnly
                  value={gpsCaptured ? `Lat: ${teacherAttForm.latitude}` : 'Lat: Belum terbaca'}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600"
                />
                <input
                  type="text"
                  readOnly
                  value={gpsCaptured ? `Lng: ${teacherAttForm.longitude}` : 'Lng: Belum terbaca'}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || isLocationBlocked}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              {submitting
                ? 'Memproses...'
                : geofenceConfig.enabled
                ? 'Catat Presensi GPS'
                : 'Catat Presensi'}
            </button>
          </form>
        </div>

        {/* 2. Input Jurnal Pembelajaran (Req #4) */}
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700" /> Jurnal Pembelajaran (Wajib untuk
              Hitung JTM)
            </h2>
            <p className="text-xs text-slate-600">
              Setelah presensi mengajar (termasuk guru pengganti), isi Jurnal Pembelajaran agar JTM
              masuk ke hitungan honorarium. Keterlambatan input dihitung H+1 (80%), H+2 (60%), H+3
              (40%), H+4 (20%), H+5 (10%), Hari Minggu tidak dihitung.
            </p>
          </div>

          {pendingScheduleSessionsToday.length > 0 && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs">
              Ada <strong>{pendingScheduleSessionsToday.length}</strong> jadwal mengajar hari ini
              yang menunggu konfirmasi kehadiran per jadwal dari Admin atau Guru Piket/Piket
              Pengganti sebelum Jurnal Pembelajaran dapat diisi.
            </div>
          )}

          {isSundayDate(getWibTodayDateString()) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Hari Minggu tidak ada pengisian Jurnal Pembelajaran. Silakan input pada hari Senin atau
              hari aktif berikutnya.
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const sc = pendingJournalSessions.find(
                (item) => item.id === journalForm.session_confirmation_id
              );
              const classroomId = sc?.schedule?.classroom_id;
              if (sc?.schedule_id && classroomId && Object.keys(subjectStudentStatuses).length > 0) {
                const records = Object.entries(subjectStudentStatuses).map(([student_id, status]) => ({
                  student_id,
                  status,
                }));
                await postPresensi({
                  action: 'RECORD_SUBJECT_STUDENT_ATTENDANCE',
                  schedule_id: sc.schedule_id,
                  classroom_id: classroomId,
                  attendance_date: sc.session_date,
                  records,
                });
              }

              const res = await postPresensi({ action: 'SUBMIT_JOURNAL', ...journalForm });
              if (res) {
                showToast(
                  'success',
                  `Jurnal pembelajaran & absensi siswa mapel disimpan (${res.percentage ?? 100}%). +${res.jtmCredited} JTM telah dihitung.`
                );
                setSubjectStudentStatuses({});
                setJournalForm({
                  session_confirmation_id: '',
                  topic: '',
                  learning_activities: '',
                  present_students_count: 30,
                  absent_students_count: 0,
                  student_attendance_notes: '',
                  jtm_fallback: 2,
                });
              }
            }}
            className="space-y-3"
          >
            <select
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
                setSubjectStudentStatuses(nextStatuses);
                setJournalForm({
                  ...journalForm,
                  session_confirmation_id: nextId,
                  present_students_count:
                    classStudents.length > 0 ? classStudents.length : journalForm.present_students_count,
                  absent_students_count: classStudents.length > 0 ? 0 : journalForm.absent_students_count,
                  student_attendance_notes: '',
                });
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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

            <input
              required
              placeholder="Topik / Materi Pembelajaran"
              value={journalForm.topic}
              onChange={(e) => setJournalForm({ ...journalForm, topic: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <textarea
              rows={2}
              placeholder="Ringkasan kegiatan pembelajaran / catatan kelas (opsional)"
              value={journalForm.learning_activities}
              onChange={(e) =>
                setJournalForm({ ...journalForm, learning_activities: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-[11px] font-semibold text-slate-700">
                Absensi Siswa per Nama oleh Guru Mata Pelajaran (terhubung ke Jadwal)
              </p>
              {(() => {
                const sc = pendingJournalSessions.find(
                  (item) => item.id === journalForm.session_confirmation_id
                );
                const classroomId = sc?.schedule?.classroom_id;
                const classStudents = classroomId
                  ? enrollments
                      .filter((en) => en.classroom_id === classroomId && en.student)
                      .map((en) => en.student!)
                  : [];

                if (!sc) {
                  return (
                    <p className="text-[11px] text-slate-500">
                      Pilih jadwal mengajar di atas untuk memuat daftar siswa kelas.
                    </p>
                  );
                }

                if (classStudents.length === 0) {
                  return (
                    <p className="text-[11px] text-amber-700">
                      Belum ada siswa terdaftar di rombel kelas ini pada tahun ajaran aktif. Anda tetap
                      dapat mengisi jumlah kehadiran di bawah.
                    </p>
                  );
                }

                return (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {classStudents.map((st) => {
                      const current = subjectStudentStatuses[st.id] || 'HADIR';
                      return (
                        <div
                          key={st.id}
                          className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-slate-900">{st.full_name}</span>
                            {st.nis && <span className="text-slate-400 ml-1.5">({st.nis})</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {(['HADIR', 'SAKIT', 'IZIN', 'ALPA'] as const).map((statusOpt) => (
                              <button
                                key={statusOpt}
                                type="button"
                                onClick={() => {
                                  const next = { ...subjectStudentStatuses, [st.id]: statusOpt };
                                  setSubjectStudentStatuses(next);
                                  const entries = classStudents.map((item) => ({
                                    name: item.full_name,
                                    status: next[item.id] || 'HADIR',
                                  }));
                                  const presentCount = entries.filter(
                                    (x) => x.status === 'HADIR'
                                  ).length;
                                  const absentEntries = entries.filter(
                                    (x) => x.status !== 'HADIR'
                                  );
                                  setJournalForm((prev) => ({
                                    ...prev,
                                    present_students_count: presentCount,
                                    absent_students_count: absentEntries.length,
                                    student_attendance_notes: absentEntries
                                      .map((x) => `${x.name} (${x.status})`)
                                      .join(', '),
                                  }));
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  current === statusOpt
                                    ? statusOpt === 'HADIR'
                                      ? 'bg-emerald-600 text-white'
                                      : statusOpt === 'SAKIT'
                                      ? 'bg-amber-500 text-white'
                                      : statusOpt === 'IZIN'
                                      ? 'bg-sky-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {statusOpt[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="number"
                  min={0}
                  value={journalForm.present_students_count}
                  onChange={(e) =>
                    setJournalForm({
                      ...journalForm,
                      present_students_count: Number(e.target.value),
                    })
                  }
                  placeholder="Jumlah Siswa Hadir"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={journalForm.absent_students_count}
                  onChange={(e) =>
                    setJournalForm({
                      ...journalForm,
                      absent_students_count: Number(e.target.value),
                    })
                  }
                  placeholder="Jumlah Tidak Hadir"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <input
                placeholder="Nama siswa sakit/izin/alpa pada jadwal ini (opsional)"
                value={journalForm.student_attendance_notes}
                onChange={(e) =>
                  setJournalForm({ ...journalForm, student_attendance_notes: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={pendingJournalSessions.length === 0 || isSundayDate(getWibTodayDateString())}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan Jurnal &amp; Hitung JTM
            </button>
          </form>

          {journals.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pt-2 border-t border-slate-200/70">
              {journals.slice(0, 6).map((j) => (
                <div
                  key={j.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{j.topic}</p>
                    <p className="text-[11px] text-slate-500">
                      {j.journal_date} • {j.teacher?.full_name}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink-0">
                    +{j.jtm_credited} JTM
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Konfirmasi Admin (Guru Piket & Panitia Ujian) + Delegasi Guru Pengganti */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" /> Konfirmasi Kehadiran (Admin /
              Guru Piket)
            </h2>
            <p className="text-xs text-slate-600">
              Admin mengonfirmasi Guru Piket, Panitia Ujian, dan Guru Mengajar. Guru Piket/Piket
              Pengganti terkonfirmasi juga dapat mengonfirmasi kehadiran Guru Mengajar di hari
              piketnya agar guru dapat mengisi Jurnal Pembelajaran.
            </p>
          </div>

          {confirmedPicketAttendances.length > 0 && (
            <select
              value={confirmPicketId}
              onChange={(e) => setConfirmPicketId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">
                {canAdminConfirm
                  ? '-- Konfirmasi sebagai Admin (atau pilih Guru Piket untuk konfirmasi Guru Mengajar) --'
                  : '-- Pilih Presensi Guru Piket / Pengganti Anda untuk Konfirmasi Guru Mengajar --'}
              </option>
              {confirmedPicketAttendances.map((p) => (
                <option key={p.id} value={p.id}>
                  Guru Piket: {p.teacher?.full_name} ({p.attendance_date})
                </option>
              ))}
            </select>
          )}

          {unconfirmedAdminAttendances.length === 0 && pendingScheduleSessionsToday.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 text-center">
              Tidak ada presensi atau jadwal hari ini yang menunggu konfirmasi kehadiran.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {/* Konfirmasi per jadwal mengajar hari ini (guru sudah presensi geofencing 1x) */}
              {pendingScheduleSessionsToday.map((item) => {
                const canConfirmThis = canAdminConfirm || Boolean(confirmPicketId);
                return (
                  <div
                    key={item.key}
                    className="p-3 rounded-2xl bg-white border border-emerald-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{item.teacher_name}</p>
                      <p className="text-[11px] text-slate-600">
                        {item.session_date} • {item.label} ({item.expectedJtm} JTM)
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canConfirmThis}
                      onClick={() =>
                        setJtmAdjustModal({
                          sessionItem: item,
                          teacherName: item.teacher_name,
                          label: item.label,
                          expectedJtm: item.expectedJtm,
                          approvedJtm: item.expectedJtm,
                          picketAttendanceId: confirmPicketId || null,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold shrink-0 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                      Konfirmasi Jadwal
                    </button>
                  </div>
                );
              })}

              {/* Konfirmasi Admin untuk Guru Piket & Panitia Ujian */}
              {unconfirmedAdminAttendances.map((a) => {
                return (
                  <div
                    key={a.id}
                    className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{a.teacher?.full_name || 'Guru'}</p>
                      <p className="text-[11px] text-slate-500">
                        {a.attendance_date} •{' '}
                        <span className="font-semibold text-amber-700">{a.attendance_type}</span> •
                        Jarak {a.distance_meters ?? 0} m
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canAdminConfirm}
                      onClick={() => {
                        const comJtm = examCommittees.find(
                          (ec) => ec.id === a.exam_committee_id
                        )?.jtm_allocated;
                        const expectedJtm =
                          a.attendance_type === 'PANITIA_UJIAN'
                            ? comJtm || 4
                            : a.delegation?.jtm_transferred || 2;
                        setJtmAdjustModal({
                          att: a,
                          teacherName: a.teacher?.full_name || 'Guru',
                          label: a.attendance_type,
                          expectedJtm,
                          approvedJtm: expectedJtm,
                          picketAttendanceId: null,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold shrink-0 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                      Konfirmasi Hadir
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Penunjukkan Guru Pengganti oleh Guru Piket
            </h2>
            <p className="text-xs text-slate-600">
              Hanya Guru Piket yang sudah presensi &amp; dikonfirmasi Admin yang dapat menunjuk guru
              pengganti. Guru pengganti wajib presensi &amp; isi Jurnal agar JTM dihitung.
            </p>
          </div>

          {confirmedPicketAttendances.length === 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Belum ada presensi Guru Piket yang dikonfirmasi Admin. Konfirmasi kehadiran Guru Piket
              terlebih dahulu di panel sebelah kiri.
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await postPresensi({ action: 'CREATE_DELEGATION', ...delegationForm });
              if (res) {
                showToast(
                  'success',
                  'Guru pengganti berhasil ditunjuk. Guru pengganti wajib presensi & isi Jurnal Pembelajaran agar JTM dihitung.'
                );
              }
            }}
            className="space-y-3"
          >
            <select
              required
              value={delegationForm.picket_attendance_id}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, picket_attendance_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Guru Piket Terkonfirmasi Admin --</option>
              {confirmedPicketAttendances.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'} (Terkonfirmasi)
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={delegationForm.delegation_date}
                onChange={(e) =>
                  setDelegationForm({ ...delegationForm, delegation_date: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <select
                value={delegationForm.delegation_type}
                onChange={(e) =>
                  setDelegationForm({
                    ...delegationForm,
                    delegation_type: e.target.value as 'MENGAJAR' | 'PIKET',
                    schedule_id: '',
                  })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="MENGAJAR">Pengganti Mengajar</option>
                <option value="PIKET">Guru Piket Pengganti</option>
              </select>
              <select
                disabled={delegationForm.delegation_type === 'PIKET'}
                value={delegationForm.schedule_id}
                onChange={(e) => {
                  const sched = schedules.find((s) => s.id === e.target.value);
                  setDelegationForm({
                    ...delegationForm,
                    schedule_id: e.target.value,
                    original_teacher_id: sched?.teacher_id || delegationForm.original_teacher_id,
                    jtm_transferred: sched?.jtm_count || delegationForm.jtm_transferred,
                  });
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
              >
                <option value="">-- Jadwal Mengajar (Opsional) --</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)} • {s.classroom?.name} •{' '}
                    {s.subject?.name} ({s.jtm_count} JTM)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <select
                required
                value={delegationForm.original_teacher_id}
                onChange={(e) =>
                  setDelegationForm({ ...delegationForm, original_teacher_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Guru Berhalangan --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <select
                required
                value={delegationForm.substitute_teacher_id}
                onChange={(e) =>
                  setDelegationForm({ ...delegationForm, substitute_teacher_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Guru Pengganti --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={delegationForm.jtm_transferred}
                onChange={(e) =>
                  setDelegationForm({
                    ...delegationForm,
                    jtm_transferred: Number(e.target.value),
                  })
                }
                placeholder="JTM Jadwal"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <input
                placeholder="Alasan (Sakit/Dinas)"
                value={delegationForm.reason}
                onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={confirmedPicketAttendances.length === 0}
              className="w-full bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Tunjuk Guru Pengganti
            </button>
          </form>
        </div>
      </div>

      {/* 4. Absensi Siswa Reguler (Khusus Guru Piket / Guru Piket Pengganti Terkonfirmasi Admin) */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Absensi Siswa Reguler oleh Guru Piket ({studentAttendances.length})
          </h2>
          <p className="text-xs text-slate-600">
            Hanya dapat dilakukan oleh <strong>Guru Piket / Guru Piket Pengganti</strong> yang
            kehadirannya sudah dikonfirmasi Admin. (Guru pengajar/pengganti mencatat absensi siswa
            langsung di dalam <strong>Jurnal Pembelajaran</strong>).
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await postPresensi({
                action: 'STUDENT_ATTENDANCE',
                picket_attendance_id: studentAttForm.picket_attendance_id,
                classroom_id: studentAttForm.classroom_id,
                student_id: studentAttForm.student_id,
                status: studentAttForm.status,
                notes: studentAttForm.notes,
              });
              if (res) {
                showToast('success', 'Absensi siswa berhasil dicatat.');
                setStudentAttForm((prev) => ({ ...prev, student_id: '', notes: '' }));
              }
            }}
            className="lg:col-span-6 space-y-3"
          >
            <select
              required
              value={studentAttForm.picket_attendance_id}
              onChange={(e) =>
                setStudentAttForm({ ...studentAttForm, picket_attendance_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Guru Piket / Pengganti Terkonfirmasi Admin --</option>
              {confirmedPicketAttendances.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.attendance_date} • {p.teacher?.full_name} (Terkonfirmasi Admin)
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                required
                value={studentAttForm.classroom_id}
                onChange={(e) =>
                  setStudentAttForm({ ...studentAttForm, classroom_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Kelas --</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={studentAttForm.student_id}
                onChange={(e) =>
                  setStudentAttForm({ ...studentAttForm, student_id: e.target.value })
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={studentAttForm.status}
                onChange={(e) =>
                  setStudentAttForm({
                    ...studentAttForm,
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
              <input
                placeholder="Keterangan (opsional)"
                value={studentAttForm.notes}
                onChange={(e) => setStudentAttForm({ ...studentAttForm, notes: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={confirmedPicketAttendances.length === 0}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan Absensi Siswa
            </button>
          </form>

          <div className="lg:col-span-6 space-y-2 max-h-72 overflow-y-auto">
            {studentAttendances.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Belum ada catatan absensi siswa.
              </p>
            ) : (
              studentAttendances.slice(0, 20).map((sa) => (
                <div
                  key={sa.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{sa.student?.full_name || 'Siswa'}</p>
                    <p className="text-slate-500">
                      {sa.attendance_date} • {sa.classroom?.name || '-'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold ${
                      sa.status === 'HADIR'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {sa.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Laporan Harian Piket (Syarat Hitung JTM Guru Piket / Piket Pengganti) */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Laporan Harian Piket ({picketReports.length})
          </h2>
          <p className="text-xs text-slate-600">
            Setelah kehadiran dikonfirmasi Admin, <strong>Guru Piket / Guru Piket Pengganti</strong>{' '}
            wajib mengisi Laporan Harian Piket di bawah ini agar JTM piket dihitung untuk
            honorarium.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await postPresensi({
                action: 'SUBMIT_PICKET_REPORT',
                ...picketReportForm,
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
              }
            }}
            className="lg:col-span-6 space-y-2.5"
          >
            <select
              required
              value={picketReportForm.attendance_id}
              onChange={(e) =>
                setPicketReportForm({ ...picketReportForm, attendance_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">
                -- Pilih Presensi Guru Piket Terkonfirmasi ({pendingPicketReports.length} menunggu
                laporan) --
              </option>
              {pendingPicketReports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.attendance_date} • {p.teacher?.full_name} (
                  {p.approved_jtm != null ? p.approved_jtm : p.delegation?.jtm_transferred || 2} JTM)
                </option>
              ))}
            </select>

            <textarea
              required
              rows={2}
              placeholder="Ringkasan pelaksanaan tugas piket hari ini..."
              value={picketReportForm.summary}
              onChange={(e) =>
                setPicketReportForm({ ...picketReportForm, summary: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <input
              placeholder="Catatan siswa terlambat / izin / pulang awal (opsional)"
              value={picketReportForm.late_students_notes}
              onChange={(e) =>
                setPicketReportForm({ ...picketReportForm, late_students_notes: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <input
              placeholder="Catatan penggantian guru / kelas kosong (opsional)"
              value={picketReportForm.teacher_substitution_notes}
              onChange={(e) =>
                setPicketReportForm({
                  ...picketReportForm,
                  teacher_substitution_notes: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <input
              placeholder="Kejadian khusus / ketertiban lingkungan (opsional)"
              value={picketReportForm.incidents}
              onChange={(e) =>
                setPicketReportForm({ ...picketReportForm, incidents: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <button
              type="submit"
              disabled={pendingPicketReports.length === 0}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan Laporan Harian Piket &amp; Hitung JTM
            </button>
          </form>

          <div className="lg:col-span-6 space-y-2 max-h-72 overflow-y-auto">
            {picketReports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Belum ada Laporan Harian Piket yang dikirimkan.
              </p>
            ) : (
              picketReports.map((pr) => (
                <div
                  key={pr.id}
                  className="modular-card rounded-xl p-3 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">
                      {pr.report_date} • {pr.teacher?.full_name || 'Guru Piket'}
                    </p>
                    <p className="text-slate-600">{pr.summary}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold shrink-0">
                    +{pr.jtm_credited} JTM
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. Input Manual Jam Masuk & Pulang + Izin Keluar Sebentar */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Input Manual Jam Masuk &amp; Jam Pulang
            </h2>
            <p className="text-xs text-slate-600">
              Diisi manual oleh <strong>Admin</strong>, <strong>Guru Piket/Pengganti</strong>, atau{' '}
              <strong>Panitia Ujian/Pengganti</strong> (khusus jam masuk &amp; pulang Guru Piket
              dan Panitia Ujian wajib diisi manual oleh Admin).
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const [kind, refId] = manualTimeForm.actor_ref.split(':');
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
              }
            }}
            className="space-y-2.5"
          >
            <select
              required
              value={manualTimeForm.attendance_id}
              onChange={(e) =>
                setManualTimeForm({ ...manualTimeForm, attendance_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Presensi Guru / Pengawas / Piket / Panitia --</option>
              {teacherAttendances
                .filter((a) => a.is_within_geofence)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.attendance_date} • {a.teacher?.full_name} ({a.attendance_type})
                    {a.check_out_time ? ' [Sudah ada jam pulang]' : ' [Belum ada jam pulang]'}
                  </option>
                ))}
            </select>

            <select
              value={manualTimeForm.actor_ref}
              onChange={(e) =>
                setManualTimeForm({ ...manualTimeForm, actor_ref: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">
                {canAdminConfirm
                  ? '-- Input sebagai Admin --'
                  : '-- Pilih Peran Anda (Guru Piket / Panitia Terkonfirmasi) --'}
              </option>
              {confirmedPicketAttendances.map((p) => (
                <option key={`p:${p.id}`} value={`picket:${p.id}`}>
                  Guru Piket: {p.teacher?.full_name} ({p.attendance_date})
                </option>
              ))}
              {confirmedCommitteeAttendances.map((c) => (
                <option key={`c:${c.id}`} value={`committee:${c.id}`}>
                  Panitia Ujian: {c.teacher?.full_name} ({c.attendance_date})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Jam Masuk (WIB)</label>
                <input
                  type="time"
                  required
                  value={manualTimeForm.check_in_hhmm}
                  onChange={(e) =>
                    setManualTimeForm({ ...manualTimeForm, check_in_hhmm: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Jam Pulang (WIB)</label>
                <input
                  type="time"
                  required
                  value={manualTimeForm.check_out_hhmm}
                  onChange={(e) =>
                    setManualTimeForm({ ...manualTimeForm, check_out_hhmm: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan Jam Masuk &amp; Jam Pulang
            </button>
          </form>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Izin Keluar Sebentar ({shortLeaves.length})
            </h2>
            <p className="text-xs text-slate-600">
              Diinput oleh <strong>Admin</strong>, <strong>Guru Piket/Pengganti</strong>, atau{' '}
              <strong>Panitia Ujian/Pengganti</strong>. Durasi izin keluar sebentar otomatis
              mengurangi persentase kehadiran untuk Tunjangan Transportasi.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const [kind, refId] = shortLeaveForm.actor_ref.split(':');
              const res = await postPresensi({
                action: 'CREATE_SHORT_LEAVE',
                attendance_id: shortLeaveForm.attendance_id,
                leave_start_time: shortLeaveForm.leave_start_time,
                leave_end_time: shortLeaveForm.leave_end_time,
                reason: shortLeaveForm.reason,
                picket_attendance_id: kind === 'picket' ? refId : null,
                committee_attendance_id: kind === 'committee' ? refId : null,
              });
              if (res) {
                showToast('success', 'Izin keluar sebentar berhasil dicatat.');
                setShortLeaveForm((prev) => ({ ...prev, reason: '' }));
              }
            }}
            className="space-y-2.5"
          >
            <select
              required
              value={shortLeaveForm.attendance_id}
              onChange={(e) =>
                setShortLeaveForm({ ...shortLeaveForm, attendance_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Presensi Guru / Pengawas Hadir Hari Ini --</option>
              {teacherAttendances
                .filter((a) => a.is_within_geofence)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.attendance_date} • {a.teacher?.full_name} ({a.attendance_type})
                  </option>
                ))}
            </select>

            <select
              value={shortLeaveForm.actor_ref}
              onChange={(e) =>
                setShortLeaveForm({ ...shortLeaveForm, actor_ref: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">
                {canAdminConfirm
                  ? '-- Catat sebagai Admin --'
                  : '-- Pilih Peran Anda (Guru Piket / Panitia Terkonfirmasi) --'}
              </option>
              {confirmedPicketAttendances.map((p) => (
                <option key={`p:${p.id}`} value={`picket:${p.id}`}>
                  Guru Piket: {p.teacher?.full_name} ({p.attendance_date})
                </option>
              ))}
              {confirmedCommitteeAttendances.map((c) => (
                <option key={`c:${c.id}`} value={`committee:${c.id}`}>
                  Panitia Ujian: {c.teacher?.full_name} ({c.attendance_date})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Jam Keluar</label>
                <input
                  type="time"
                  required
                  value={shortLeaveForm.leave_start_time}
                  onChange={(e) =>
                    setShortLeaveForm({ ...shortLeaveForm, leave_start_time: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Jam Kembali</label>
                <input
                  type="time"
                  required
                  value={shortLeaveForm.leave_end_time}
                  onChange={(e) =>
                    setShortLeaveForm({ ...shortLeaveForm, leave_end_time: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <input
              placeholder="Alasan izin keluar sebentar (mis. Urusan keluarga / ke bank)"
              value={shortLeaveForm.reason}
              onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, reason: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Catat Izin Keluar Sebentar
            </button>
          </form>

          {shortLeaves.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pt-2 border-t border-slate-200/70">
              {shortLeaves.slice(0, 10).map((lv) => (
                <div
                  key={lv.id}
                  className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {lv.leave_date} • {lv.teacher?.full_name}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {lv.leave_start_time.slice(0, 5)}–{lv.leave_end_time.slice(0, 5)}
                      {lv.reason ? ` • ${lv.reason}` : ''}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold shrink-0">
                    -{lv.duration_minutes} menit
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Popup Di Luar Radius Geofencing (Req #2) */}
      {outsideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Di Luar Radius Geofencing
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Absensi geofencing hanya bisa dilakukan di dalam radius yang diizinkan oleh
                  lembaga.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <div className="flex justify-between">
                <span>Jarak Anda saat ini:</span>
                <strong>{outsideModal.distanceMeters} meter</strong>
              </div>
              <div className="flex justify-between">
                <span>Radius maksimal diizinkan:</span>
                <strong>{outsideModal.radiusMeters} meter</strong>
              </div>
              <div className="text-[11px] text-rose-700 pt-1 border-t border-rose-200/70 font-mono">
                Posisi Anda: {outsideModal.teacherLat}, {outsideModal.teacherLng}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Pastikan Anda berada di lingkungan madrasah/sekolah dan GPS perangkat aktif, lalu klik{' '}
              <strong>Ambil GPS Perangkat</strong> untuk memperbarui posisi Anda.
            </p>

            <div className="flex justify-end gap-2">
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
          </div>
        </div>
      )}

      {/* Modal 1: Penyesuaian JTM saat Konfirmasi Kehadiran */}
      {jtmAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Konfirmasi Kehadiran &amp; Penyesuaian JTM
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuaikan jumlah JTM yang akan diperoleh{' '}
              <strong>{jtmAdjustModal.teacherName}</strong> ({jtmAdjustModal.label}) setelah
              mengisi laporan / jurnal yang diwajibkan.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex justify-between">
              <span>JTM Jadwal Seharusnya:</span>
              <strong>{jtmAdjustModal.expectedJtm} JTM</strong>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                JTM yang Diperoleh (Disetujui)
              </label>
              <input
                type="number"
                min={0}
                max={jtmAdjustModal.expectedJtm}
                step="0.5"
                value={jtmAdjustModal.approvedJtm}
                onChange={(e) =>
                  setJtmAdjustModal({
                    ...jtmAdjustModal,
                    approvedJtm: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setJtmAdjustModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const diff = Number(
                    (jtmAdjustModal.expectedJtm - jtmAdjustModal.approvedJtm).toFixed(2)
                  );
                  const teacherId =
                    jtmAdjustModal.sessionItem?.teacher_id || jtmAdjustModal.att?.teacher_id || '';
                  if (diff > 0) {
                    setJtmDiffModal({
                      sessionItem: jtmAdjustModal.sessionItem,
                      att: jtmAdjustModal.att,
                      teacherId,
                      expectedJtm: jtmAdjustModal.expectedJtm,
                      approvedJtm: jtmAdjustModal.approvedJtm,
                      diffJtm: diff,
                      picketAttendanceId: jtmAdjustModal.picketAttendanceId,
                      recipientTeacherId: '',
                      reason: '',
                    });
                    setJtmAdjustModal(null);
                    return;
                  }
                  const res = jtmAdjustModal.sessionItem
                    ? await postPresensi({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'MENGAJAR',
                        session_date: jtmAdjustModal.sessionItem.session_date,
                        teacher_id: jtmAdjustModal.sessionItem.teacher_id,
                        schedule_id: jtmAdjustModal.sessionItem.schedule_id,
                        delegation_id: jtmAdjustModal.sessionItem.delegation_id,
                        picket_attendance_id: jtmAdjustModal.picketAttendanceId,
                        approved_jtm: jtmAdjustModal.approvedJtm,
                      })
                    : await postPresensi({
                        action: 'CONFIRM_ATTENDANCE',
                        attendance_id: jtmAdjustModal.att!.id,
                        picket_attendance_id: jtmAdjustModal.picketAttendanceId,
                        approved_jtm: jtmAdjustModal.approvedJtm,
                      });
                  if (res) {
                    showToast(
                      'success',
                      `Jadwal dikonfirmasi dengan ${jtmAdjustModal.approvedJtm} JTM.`
                    );
                    setJtmAdjustModal(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
              >
                {jtmAdjustModal.approvedJtm < jtmAdjustModal.expectedJtm
                  ? 'Lanjut Alokasi Selisih JTM →'
                  : 'Konfirmasi Hadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Alokasi Selisih JTM ke Guru / Pengawas Lain */}
      {jtmDiffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Alokasi Selisih JTM</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Terdapat selisih <strong>{jtmDiffModal.diffJtm} JTM</strong> (dari{' '}
              {jtmDiffModal.expectedJtm} JTM menjadi {jtmDiffModal.approvedJtm} JTM). Pilih guru/pengawas
              yang menerima selisih JTM ini. Penerima wajib melakukan presensi, dikonfirmasi
              kehadirannya, dan mengisi Jurnal/BAP.
            </p>
            <select
              required
              value={jtmDiffModal.recipientTeacherId}
              onChange={(e) =>
                setJtmDiffModal({ ...jtmDiffModal, recipientTeacherId: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
            <input
              placeholder="Keterangan / alasan penyesuaian JTM (opsional)"
              value={jtmDiffModal.reason}
              onChange={(e) => setJtmDiffModal({ ...jtmDiffModal, reason: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setJtmDiffModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!jtmDiffModal.recipientTeacherId}
                onClick={async () => {
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
                        diff_reason: jtmDiffModal.reason,
                      })
                    : await postPresensi({
                        action: 'CONFIRM_ATTENDANCE',
                        attendance_id: jtmDiffModal.att!.id,
                        picket_attendance_id: jtmDiffModal.picketAttendanceId,
                        approved_jtm: jtmDiffModal.approvedJtm,
                        diff_recipient_teacher_id: jtmDiffModal.recipientTeacherId,
                        diff_reason: jtmDiffModal.reason,
                      });
                  if (res) {
                    showToast(
                      'success',
                      `Kehadiran dikonfirmasi (${jtmDiffModal.approvedJtm} JTM) & selisih ${jtmDiffModal.diffJtm} JTM dialokasikan.`
                    );
                    setJtmDiffModal(null);
                  }
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
