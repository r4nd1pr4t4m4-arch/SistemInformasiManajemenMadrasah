'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { verifyGeofence } from '@/lib/domain/geofence';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';
import {
  type ClassroomOpt,
  type DelegationRow,
  type EnrollmentRow,
  type ExamCommitteeOpt,
  type ExamSupervisorOpt,
  type GeofenceModalState,
  type JournalRow,
  type JtmAdjustModalState,
  type JtmDiffModalState,
  type PendingScheduleSessionItem,
  type PicketReportRow,
  type PostPresensiResponse,
  type PresensiSection,
  type ScheduleRow,
  type SessionConfirmationRow,
  type ShortLeaveRow,
  type StudentAttendanceRow,
  type TeacherAttendanceRow,
  type TeacherAttFormState,
  type TeacherOpt,
} from './presensi/types';
import { GpsSection } from './presensi/gps-section';
import { JurnalSection } from './presensi/jurnal-section';
import { KonfirmasiSection, PenggantiSection } from './presensi/konfirmasi-and-pengganti-sections';
import { AbsensiSiswaSection, LaporanPiketSection } from './presensi/absensi-and-piket-sections';
import { IzinKeluarSection, JamManualSection } from './presensi/jam-manual-and-izin-sections';
import { PresensiModals } from './presensi/presensi-modals';

export type { PresensiSection };

export function PresensiWorkspace({ section }: { section: PresensiSection }) {
  const { hasPermission } = usePortalSession();
  const canSubmitPresensi = hasPermission(PERMISSIONS.PRESENSI_SUBMIT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOpt[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [studentAttendances, setStudentAttendances] = useState<StudentAttendanceRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [examSupervisors, setExamSupervisors] = useState<ExamSupervisorOpt[]>([]);
  const [examCommittees, setExamCommittees] = useState<ExamCommitteeOpt[]>([]);
  const [teacherAttendances, setTeacherAttendances] = useState<TeacherAttendanceRow[]>([]);
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [picketReports, setPicketReports] = useState<PicketReportRow[]>([]);
  const [shortLeaves, setShortLeaves] = useState<ShortLeaveRow[]>([]);
  const [sessionConfirmations, setSessionConfirmations] = useState<SessionConfirmationRow[]>([]);
  const [todayDate, setTodayDate] = useState('');
  const [canAdminConfirm, setCanAdminConfirm] = useState(false);
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
  const [jtmAdjustModal, setJtmAdjustModal] = useState<JtmAdjustModalState | null>(null);

  // Modal 2: Alokasi selisih JTM jika approvedJtm < expectedJtm
  const [jtmDiffModal, setJtmDiffModal] = useState<JtmDiffModalState | null>(null);

  const [teacherAttForm, setTeacherAttForm] = useState<TeacherAttFormState>({
    teacher_id: '',
    attendance_type: 'MENGAJAR',
    schedule_id: '',
    delegation_id: '',
    exam_supervisor_id: '',
    exam_committee_id: '',
    notes: '',
    latitude: 0,
    longitude: 0,
  });

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

  const captureBrowserGps = useCallback(
    (notify = false) => {
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
    },
    [showToast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
      captureBrowserGps(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, captureBrowserGps]);

  const postPresensi = useCallback(
    async (body: unknown): Promise<PostPresensiResponse | null> => {
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
    },
    [loadData, showToast]
  );

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

      {section === 'gps' && (
        <GpsSection
          activeDate={activeDate}
          geofenceConfig={geofenceConfig}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          locationStatus={locationStatus}
          locationError={locationError}
          gpsCaptured={gpsCaptured}
          isLocationBlocked={isLocationBlocked}
          liveDistanceInfo={liveDistanceInfo}
          captureBrowserGps={captureBrowserGps}
          selectedTeacherDailyCheckIn={selectedTeacherDailyCheckIn}
          canSubmitPresensi={canSubmitPresensi}
          submitting={submitting}
          setSubmitting={setSubmitting}
          setOutsideModal={setOutsideModal}
          teacherAttForm={teacherAttForm}
          setTeacherAttForm={setTeacherAttForm}
          teachers={teachers}
          schedules={schedules}
          delegations={delegations}
          examSupervisors={examSupervisors}
          examCommittees={examCommittees}
          todayAttendances={todayAttendances}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      {section === 'jurnal' && (
        <JurnalSection
          journals={journals}
          pendingJournalSessions={pendingJournalSessions}
          pendingScheduleSessionsToday={pendingScheduleSessionsToday}
          classrooms={classrooms}
          enrollments={enrollments}
          canSubmitPresensi={canSubmitPresensi}
          submitting={submitting}
          setSubmitting={setSubmitting}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      {section === 'konfirmasi' && (
        <KonfirmasiSection
          activeDate={activeDate}
          canAdminConfirm={canAdminConfirm}
          confirmedPicketAttendances={confirmedPicketAttendances}
          pendingScheduleSessionsToday={pendingScheduleSessionsToday}
          unconfirmedAdminAttendances={unconfirmedAdminAttendances}
          examCommittees={examCommittees}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          setJtmAdjustModal={setJtmAdjustModal}
        />
      )}

      {section === 'pengganti' && (
        <PenggantiSection
          delegations={delegations}
          confirmedPicketAttendances={confirmedPicketAttendances}
          schedules={schedules}
          teachers={teachers}
          submitting={submitting}
          setSubmitting={setSubmitting}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      {section === 'absensi-siswa' && (
        <AbsensiSiswaSection
          studentAttendances={studentAttendances}
          confirmedPicketAttendances={confirmedPicketAttendances}
          classrooms={classrooms}
          enrollments={enrollments}
          canAdminConfirm={canAdminConfirm}
          submitting={submitting}
          setSubmitting={setSubmitting}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      {section === 'laporan-piket' && (
        <LaporanPiketSection
          picketReports={picketReports}
          pendingPicketReports={pendingPicketReports}
          confirmedPicketAttendances={confirmedPicketAttendances}
          canSubmitPresensi={canSubmitPresensi}
          canAdminConfirm={canAdminConfirm}
          submitting={submitting}
          setSubmitting={setSubmitting}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      {section === 'jam-manual' && (
        <JamManualSection
          teacherAttendances={teacherAttendances}
          confirmedPicketAttendances={confirmedPicketAttendances}
          confirmedCommitteeAttendances={confirmedCommitteeAttendances}
          canAdminConfirm={canAdminConfirm}
          submitting={submitting}
          setSubmitting={setSubmitting}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      {section === 'izin-keluar' && (
        <IzinKeluarSection
          activeDate={activeDate}
          shortLeaves={shortLeaves}
          teacherAttendances={teacherAttendances}
          confirmedPicketAttendances={confirmedPicketAttendances}
          confirmedCommitteeAttendances={confirmedCommitteeAttendances}
          canAdminConfirm={canAdminConfirm}
          submitting={submitting}
          setSubmitting={setSubmitting}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          postPresensi={postPresensi}
          showToast={showToast}
        />
      )}

      <PresensiModals
        outsideModal={outsideModal}
        setOutsideModal={setOutsideModal}
        captureBrowserGps={captureBrowserGps}
        jtmAdjustModal={jtmAdjustModal}
        setJtmAdjustModal={setJtmAdjustModal}
        jtmDiffModal={jtmDiffModal}
        setJtmDiffModal={setJtmDiffModal}
        teachers={teachers}
        submitting={submitting}
        setSubmitting={setSubmitting}
        postPresensi={postPresensi}
        showToast={showToast}
      />
    </div>
  );
}
