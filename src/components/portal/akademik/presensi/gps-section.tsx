'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import type { GeofenceCheckResult } from '@/lib/domain/geofence';
import {
  DAY_NAMES,
  type DelegationRow,
  type ExamCommitteeOpt,
  type ExamSupervisorOpt,
  type GeofenceConfig,
  type GeofenceModalState,
  type PostPresensiFn,
  type ScheduleRow,
  type ShowToastFn,
  type TeacherAttendanceRow,
  type TeacherAttFormState,
  type TeacherOpt,
} from './types';

interface GpsSectionProps {
  activeDate: string;
  geofenceConfig: GeofenceConfig;
  refreshing: boolean;
  handleRefresh: () => void;
  locationStatus: 'checking' | 'granted' | 'denied' | 'unsupported';
  locationError: string | null;
  gpsCaptured: boolean;
  isLocationBlocked: boolean;
  liveDistanceInfo: GeofenceCheckResult | null;
  captureBrowserGps: (notify?: boolean) => void;
  selectedTeacherDailyCheckIn: TeacherAttendanceRow | null;
  canSubmitPresensi: boolean;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  setOutsideModal: Dispatch<SetStateAction<GeofenceModalState | null>>;
  teacherAttForm: TeacherAttFormState;
  setTeacherAttForm: Dispatch<SetStateAction<TeacherAttFormState>>;
  teachers: TeacherOpt[];
  schedules: ScheduleRow[];
  delegations: DelegationRow[];
  examSupervisors: ExamSupervisorOpt[];
  examCommittees: ExamCommitteeOpt[];
  todayAttendances: TeacherAttendanceRow[];
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function GpsSection({
  activeDate,
  geofenceConfig,
  refreshing,
  handleRefresh,
  locationStatus,
  locationError,
  gpsCaptured,
  isLocationBlocked,
  liveDistanceInfo,
  captureBrowserGps,
  selectedTeacherDailyCheckIn,
  canSubmitPresensi,
  submitting,
  setSubmitting,
  setOutsideModal,
  teacherAttForm,
  setTeacherAttForm,
  teachers,
  schedules,
  delegations,
  examSupervisors,
  examCommittees,
  todayAttendances,
  postPresensi,
  showToast,
}: GpsSectionProps) {
  return (
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
            className={`p-3 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              liveDistanceInfo.isWithinGeofence
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      att.admin_confirmed
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
  );
}
