'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';
import type {
  BapRow,
  ClassroomOpt,
  CommitteeAttRow,
  CommitteeDailyReportRow,
  CommitteeRow,
  DailyGeofenceAttRow,
  EnrollmentRow,
  ExamPeriodRow,
  ExamRoomRow,
  ExamRoomStudentRow,
  ExamStudentAttendanceRow,
  RemoveRoomMemberModalState,
  StudentOpt,
  SupAdjustModalState,
  SupDiffModalState,
  SupervisorAttRow,
  SupervisorRow,
  SupervisorSessionConfirmationRow,
  TeacherOpt,
  UjianSection,
} from './ujian/types';
import { PeriodeSection } from './ujian/periode-section';
import {
  PanitiaSection,
  PengawasSection,
} from './ujian/pengawas-and-panitia-sections';
import {
  BapSection,
  KonfirmasiPengawasSection,
} from './ujian/konfirmasi-and-bap-sections';
import { PenggantiSection } from './ujian/pengganti-section';
import {
  AbsensiSiswaSection,
  LpjPanitiaSection,
} from './ujian/absensi-and-lpj-sections';
import { UjianModals } from './ujian/ujian-modals';

export type { UjianSection };

export function UjianWorkspace({ section }: { section: UjianSection }) {
  const { hasPermission } = usePortalSession();
  const canManageUjian = hasPermission(PERMISSIONS.UJIAN_MANAGE);
  const canSubmitUjian = hasPermission(PERMISSIONS.PRESENSI_SUBMIT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeRoomMemberModal, setRemoveRoomMemberModal] =
    useState<RemoveRoomMemberModalState | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [examPeriods, setExamPeriods] = useState<ExamPeriodRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [bapReports, setBapReports] = useState<BapRow[]>([]);
  const [committeeDailyReports, setCommitteeDailyReports] = useState<
    CommitteeDailyReportRow[]
  >([]);
  const [supervisorAttendances, setSupervisorAttendances] = useState<SupervisorAttRow[]>([]);
  const [committeeAttendances, setCommitteeAttendances] = useState<CommitteeAttRow[]>([]);
  const [dailyGeofenceAttendances, setDailyGeofenceAttendances] = useState<
    DailyGeofenceAttRow[]
  >([]);
  const [supervisorSessionConfirmations, setSupervisorSessionConfirmations] = useState<
    SupervisorSessionConfirmationRow[]
  >([]);
  const [classrooms, setClassrooms] = useState<ClassroomOpt[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [canManageCommittees, setCanManageCommittees] = useState(false);
  const [geofenceEnabled, setGeofenceEnabled] = useState(true);
  const [confirmCommitteeId, setConfirmCommitteeId] = useState('');
  const [supAdjustModal, setSupAdjustModal] = useState<SupAdjustModalState | null>(null);
  const [supDiffModal, setSupDiffModal] = useState<SupDiffModalState | null>(null);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [rooms, setRooms] = useState<ExamRoomRow[]>([]);
  const [examRoomStudents, setExamRoomStudents] = useState<ExamRoomStudentRow[]>([]);
  const [roomForm, setRoomForm] = useState({
    exam_period_id: '',
    room_name: '',
    capacity: 30,
  });
  const [selectedExamPeriodId, setSelectedExamPeriodId] = useState('');
  const [selectedExamRoomId, setSelectedExamRoomId] = useState('');
  const [examStudentAttendances, setExamStudentAttendances] = useState<
    ExamStudentAttendanceRow[]
  >([]);

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
      const loadedRooms: ExamRoomRow[] = uj.rooms || [];
      setRooms(loadedRooms);
      setExamRoomStudents(uj.examRoomStudents || []);

      const fallbackPeriodId = loadedPeriods[0]?.id || '';
      setSelectedExamPeriodId((prevPeriodId) =>
        prevPeriodId && loadedPeriods.some((p) => p.id === prevPeriodId)
          ? prevPeriodId
          : fallbackPeriodId
      );
      setRoomForm((prev) =>
        prev.exam_period_id ? prev : { ...prev, exam_period_id: fallbackPeriodId }
      );
      setSelectedExamRoomId((prevRoomId) => {
        if (prevRoomId && loadedRooms.some((r) => r.id === prevRoomId)) {
          return prevRoomId;
        }
        const periodRooms = loadedRooms.filter((r) => r.exam_period_id === fallbackPeriodId);
        return periodRooms[0]?.id || loadedRooms[0]?.id || '';
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

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, loadData]);

  const postUjian = useCallback(
    async (body: unknown, msg: string) => {
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
    },
    [submitting, showToast, loadData]
  );

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
        <PeriodeSection
          canManageUjian={canManageUjian}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          examPeriods={examPeriods}
          rooms={rooms}
          examRoomStudents={examRoomStudents}
          students={students}
          classrooms={classrooms}
          enrollments={enrollments}
          selectedExamPeriodId={selectedExamPeriodId}
          setSelectedExamPeriodId={setSelectedExamPeriodId}
          selectedExamRoomId={selectedExamRoomId}
          setSelectedExamRoomId={setSelectedExamRoomId}
          roomForm={roomForm}
          setRoomForm={setRoomForm}
          setRemoveRoomMemberModal={setRemoveRoomMemberModal}
        />
      )}

      {section === 'pengawas' && (
        <PengawasSection
          canManageUjian={canManageUjian}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          teachers={teachers}
          examPeriods={examPeriods}
          rooms={rooms}
          supervisors={supervisors}
          attendedSupervisorIds={attendedSupervisorIds}
          dailyCheckedInKeys={dailyCheckedInKeys}
          confirmedSupervisorIds={confirmedSupervisorIds}
          bapSupervisorIds={bapSupervisorIds}
        />
      )}

      {section === 'panitia' && (
        <PanitiaSection
          canManageUjian={canManageUjian}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          teachers={teachers}
          examPeriods={examPeriods}
          committees={committees}
          confirmedCommitteeIds={confirmedCommitteeIds}
          reportedCommitteeIds={reportedCommitteeIds}
        />
      )}

      {section === 'konfirmasi-pengawas' && (
        <KonfirmasiPengawasSection
          canManageCommittees={canManageCommittees}
          geofenceEnabled={geofenceEnabled}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          committees={committees}
          pendingSupervisorSessions={pendingSupervisorSessions}
          confirmedSupervisorIds={confirmedSupervisorIds}
          confirmedCommitteeAtts={confirmedCommitteeAtts}
          dailyCheckedInKeys={dailyCheckedInKeys}
          confirmCommitteeId={confirmCommitteeId}
          setConfirmCommitteeId={setConfirmCommitteeId}
          setSupAdjustModal={setSupAdjustModal}
        />
      )}

      {section === 'bap' && (
        <BapSection
          geofenceEnabled={geofenceEnabled}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          supervisors={supervisors}
          bapReports={bapReports}
          confirmedSupervisorIds={confirmedSupervisorIds}
          bapSupervisorIds={bapSupervisorIds}
          classrooms={classrooms}
          enrollments={enrollments}
        />
      )}

      {section === 'pengganti' && (
        <PenggantiSection
          canManageCommittees={canManageCommittees}
          geofenceEnabled={geofenceEnabled}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          teachers={teachers}
          supervisors={supervisors}
          committees={committees}
          bapSupervisorIds={bapSupervisorIds}
          confirmedCommitteeAtts={confirmedCommitteeAtts}
        />
      )}

      {section === 'absensi-siswa' && (
        <AbsensiSiswaSection
          canManageCommittees={canManageCommittees}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          examPeriods={examPeriods}
          rooms={rooms}
          examRoomStudents={examRoomStudents}
          students={students}
          examStudentAttendances={examStudentAttendances}
          confirmedCommitteeAtts={confirmedCommitteeAtts}
        />
      )}

      {section === 'lpj-panitia' && (
        <LpjPanitiaSection
          canSubmitUjian={canSubmitUjian}
          submitting={submitting}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          postUjian={postUjian}
          showToast={showToast}
          committees={committees}
          committeeDailyReports={committeeDailyReports}
          confirmedCommitteeAtts={confirmedCommitteeAtts}
          pendingCommitteeReports={pendingCommitteeReports}
        />
      )}

      <UjianModals
        submitting={submitting}
        setSubmitting={setSubmitting}
        loadData={loadData}
        postUjian={postUjian}
        showToast={showToast}
        teachers={teachers}
        confirmCommitteeId={confirmCommitteeId}
        supAdjustModal={supAdjustModal}
        setSupAdjustModal={setSupAdjustModal}
        supDiffModal={supDiffModal}
        setSupDiffModal={setSupDiffModal}
        removeRoomMemberModal={removeRoomMemberModal}
        setRemoveRoomMemberModal={setRemoveRoomMemberModal}
      />
    </div>
  );
}
