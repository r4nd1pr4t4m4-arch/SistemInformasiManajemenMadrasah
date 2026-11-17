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
  attendance_type: 'HARIAN' | 'MENGAJAR' | 'PIKET' | 'PENGAWAS_UJIAN' | 'PANITIA_UJIAN';
  schedule_id: string | null;
  delegation_id: string | null;
  exam_supervisor_id: string | null;
  exam_committee_id: string | null;
  jtm_earned: number;
  distance_meters: number | null;
  is_within_geofence: boolean;
  admin_confirmed: boolean;
  teacher?: { full_name: string } | null;
  schedule?: {
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
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [examSupervisors, setExamSupervisors] = useState<ExamSupervisorOpt[]>([]);
  const [examCommittees, setExamCommittees] = useState<ExamCommitteeOpt[]>([]);
  const [teacherAttendances, setTeacherAttendances] = useState<TeacherAttendanceRow[]>([]);
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [canAdminConfirm, setCanAdminConfirm] = useState(false);
  const [geofenceConfig, setGeofenceConfig] = useState({
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
    attendance_id: '',
    topic: '',
    learning_activities: '',
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
      setSchedules(pr.schedules || []);
      setExamSupervisors(pr.examSupervisors || []);
      setExamCommittees(pr.examCommittees || []);
      setTeacherAttendances(pr.teacherAttendances || []);
      setDelegations(pr.delegations || []);
      setJournals(pr.journals || []);
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

  // Presensi MENGAJAR yang belum diisi jurnal pembelajarannya
  const journaledAttendanceIds = useMemo(
    () => new Set(journals.map((j) => j.attendance_id)),
    [journals]
  );

  const pendingJournalAttendances = useMemo(
    () =>
      teacherAttendances.filter(
        (a) =>
          a.attendance_type === 'MENGAJAR' &&
          a.is_within_geofence &&
          !journaledAttendanceIds.has(a.id)
      ),
    [teacherAttendances, journaledAttendanceIds]
  );

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

  const isLocationBlocked = locationStatus !== 'granted' || !gpsCaptured;

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
              <MapPin className="w-4 h-4 text-emerald-700" /> Presensi Guru (GPS Geofencing)
            </h1>
            <button
              type="button"
              onClick={() => captureBrowserGps(true)}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" /> Ambil GPS Perangkat
            </button>
          </div>

          {isLocationBlocked && (
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

          {gpsCaptured && liveDistanceInfo && (
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

              // Verifikasi radius di sisi klien terlebih dahulu (Req #2)
              if (liveDistanceInfo && !liveDistanceInfo.isWithinGeofence) {
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
                  latitude: teacherAttForm.latitude,
                  longitude: teacherAttForm.longitude,
                });
                if (res?.geofence) {
                  const typeMsg =
                    teacherAttForm.attendance_type === 'MENGAJAR'
                      ? 'Presensi Mengajar VALID. Silakan isi Jurnal Pembelajaran agar JTM dihitung.'
                      : teacherAttForm.attendance_type === 'PIKET'
                      ? 'Presensi Guru Piket VALID. Menunggu konfirmasi Admin sebelum menunjuk guru pengganti.'
                      : teacherAttForm.attendance_type === 'PENGAWAS_UJIAN'
                      ? 'Presensi Pengawas Ujian VALID. Silakan isi BAP di menu Ujian agar JTM dihitung.'
                      : teacherAttForm.attendance_type === 'PANITIA_UJIAN'
                      ? 'Presensi Panitia Ujian VALID. Menunggu konfirmasi Admin.'
                      : 'Presensi Harian VALID.';
                  showToast('success', `${typeMsg} (Jarak ${res.geofence.distanceMeters} m)`);
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

            <button
              type="submit"
              disabled={submitting || isLocationBlocked}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              {submitting ? 'Memproses...' : 'Catat Presensi GPS'}
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

          {isSundayDate(getWibTodayDateString()) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Hari Minggu tidak ada pengisian Jurnal Pembelajaran. Silakan input pada hari Senin atau
              hari aktif berikutnya.
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await postPresensi({ action: 'SUBMIT_JOURNAL', ...journalForm });
              if (res) {
                showToast(
                  'success',
                  `Jurnal pembelajaran disimpan (${res.percentage ?? 100}%). +${res.jtmCredited} JTM telah dihitung.`
                );
                setJournalForm({
                  attendance_id: '',
                  topic: '',
                  learning_activities: '',
                  jtm_fallback: 2,
                });
              }
            }}
            className="space-y-3"
          >
            <select
              required
              value={journalForm.attendance_id}
              onChange={(e) => setJournalForm({ ...journalForm, attendance_id: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">
                -- Pilih Sesi Presensi Mengajar ({pendingJournalAttendances.length} menunggu jurnal)
                --
              </option>
              {pendingJournalAttendances.map((a) => {
                const base = a.schedule?.jtm_count || 2;
                const preview = calculateLateJtm(base, a.attendance_date);
                return (
                  <option key={a.id} value={a.id}>
                    {a.attendance_date} • {a.teacher?.full_name || 'Guru'}{' '}
                    {a.delegation_id
                      ? '(Guru Pengganti)'
                      : a.schedule
                      ? `• ${a.schedule.classroom?.name || ''} ${a.schedule.subject?.name || ''}`
                      : ''}{' '}
                    [{preview.delayDays === 0 ? 'Hari Ini 100%' : `H+${preview.delayDays}: ${preview.percentage}%`}]
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

            <button
              type="submit"
              disabled={pendingJournalAttendances.length === 0 || isSundayDate(getWibTodayDateString())}
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
              <ShieldCheck className="w-4 h-4 text-emerald-700" /> Konfirmasi Kehadiran Piket &amp;
              Panitia Ujian (Admin)
            </h2>
            <p className="text-xs text-slate-600">
              Guru Piket dan Panitia Ujian wajib dikonfirmasi kehadirannya oleh Admin setelah
              presensi sebelum dapat menunjuk guru/pengawas pengganti.
            </p>
          </div>

          {unconfirmedAdminAttendances.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 text-center">
              Tidak ada presensi Guru Piket / Panitia Ujian yang menunggu konfirmasi Admin.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {unconfirmedAdminAttendances.map((a) => (
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
                    onClick={async () => {
                      const res = await postPresensi({
                        action: 'CONFIRM_ATTENDANCE',
                        attendance_id: a.id,
                      });
                      if (res) {
                        showToast(
                          'success',
                          a.attendance_type === 'PIKET'
                            ? `Kehadiran Guru Piket dikonfirmasi Admin (+${res.attendance?.jtm_earned ?? 2} JTM).`
                            : 'Kehadiran Panitia Ujian berhasil dikonfirmasi Admin.'
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold shrink-0 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                    Konfirmasi Hadir
                  </button>
                </div>
              ))}
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
    </div>
  );
}
