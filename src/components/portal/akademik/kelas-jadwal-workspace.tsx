'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';
import type {
  ClassroomRow,
  EnrollmentRow,
  KelasJadwalSection,
  ScheduleRow,
  StudentOpt,
  SubjectRow,
  TeacherOpt,
} from './kelas-jadwal/types';
import { RombelSection } from './kelas-jadwal/rombel-section';
import { MapelSection } from './kelas-jadwal/mapel-section';
import { JadwalSection } from './kelas-jadwal/jadwal-section';

export type { KelasJadwalSection } from './kelas-jadwal/types';

export function KelasJadwalWorkspace({ section }: { section: KelasJadwalSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.KELAS_JADWAL_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [homeroomTeacherCandidates, setHomeroomTeacherCandidates] = useState<TeacherOpt[]>([]);
  const [canManageScheduleApi, setCanManageScheduleApi] = useState(false);
  const [homeroomClassroomIds, setHomeroomClassroomIds] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [biRes, kjRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
        fetch('/api/akademik/kelas-jadwal', { cache: 'no-store' }),
      ]);
      const bi = await biRes.json();
      const kj = await kjRes.json();
      if (!biRes.ok) throw new Error(bi.error || 'Gagal memuat data GTK & siswa.');
      if (!kjRes.ok) throw new Error(kj.error || 'Gagal memuat data kelas & jadwal.');

      setLoadError(null);
      setTeachers(bi.teachers || []);
      setHomeroomTeacherCandidates(kj.homeroomTeacherCandidates || []);
      setCanManageScheduleApi(Boolean(kj.canManageSchedule));
      setHomeroomClassroomIds(
        Array.isArray(kj.homeroomClassroomIds) ? kj.homeroomClassroomIds : []
      );
      setStudents((bi.students || []).filter((s: StudentOpt) => !s.status || s.status === 'AKTIF'));
      setClassrooms(kj.classrooms || []);
      setEnrollments(kj.enrollments || []);
      setSubjects(kj.subjects || []);
      setSchedules(kj.schedules || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const postAction = useCallback(
    async (body: unknown, msg: string) => {
      if (submitting) return false;
      setSubmitting(true);
      try {
        const res = await fetch('/api/akademik/kelas-jadwal', {
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
    [loadData, showToast, submitting]
  );

  if (loading) {
    return <AkademikLoading label="Memuat kelas & jadwal pelajaran..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={handleRefresh} />

      {section === 'rombel' && (
        <RombelSection
          canManage={canManage}
          refreshing={refreshing}
          submitting={submitting}
          teachers={teachers}
          homeroomTeacherCandidates={homeroomTeacherCandidates}
          students={students}
          enrollments={enrollments}
          classrooms={classrooms}
          onRefresh={handleRefresh}
          postAction={postAction}
          showToast={showToast}
        />
      )}

      {section === 'mapel' && (
        <MapelSection
          canManage={canManage}
          refreshing={refreshing}
          submitting={submitting}
          subjects={subjects}
          schedules={schedules}
          onRefresh={handleRefresh}
          postAction={postAction}
          showToast={showToast}
        />
      )}

      {section === 'jadwal' && (
        <JadwalSection
          canManage={canManage}
          canManageScheduleApi={canManageScheduleApi}
          homeroomClassroomIds={homeroomClassroomIds}
          refreshing={refreshing}
          submitting={submitting}
          teachers={teachers}
          classrooms={classrooms}
          subjects={subjects}
          schedules={schedules}
          onRefresh={handleRefresh}
          postAction={postAction}
          showToast={showToast}
        />
      )}
    </div>
  );
}
