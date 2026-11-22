'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, ShieldCheck, Users } from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
} from '@/components/portal/akademik/akademik-ui';
import { AssessmentWorkspace } from '@/components/portal/penilaian/assessment-workspace';
import { RaportWorkspace } from '@/components/portal/penilaian/raport-workspace';
import type { AssessmentMenuType, TaughtClassroomSummary } from '@/lib/domain/penilaian';

interface SubjectItem {
  id: string;
  code: string;
  name: string;
}

interface ClassroomItem {
  id: string;
  name: string;
  grade_level: string;
}

interface SchedulePair {
  subject_id: string;
  classroom_id: string;
  teacher_name: string | null;
}

const ASSESSMENT_TYPES: Array<{ value: AssessmentMenuType; label: string }> = [
  { value: 'FORMATIF', label: 'Formatif (Lingkup BAB)' },
  { value: 'SUMATIF', label: 'Sumatif (Lingkup Materi)' },
  { value: 'STS', label: 'STS (Sumatif Tengah Semester)' },
  { value: 'SAS', label: 'SAS (Sumatif Akhir Semester)' },
  { value: 'PRAKTIK', label: 'Praktik' },
  { value: 'RAPORT', label: 'Raport' },
];

export function MonitoringPenilaianWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [schedulePairs, setSchedulePairs] = useState<SchedulePair[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedType, setSelectedType] = useState<AssessmentMenuType>('FORMATIF');
  const [onlyScheduledClasses, setOnlyScheduledClasses] = useState(true);

  const applyMonitoringData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as { name: string; semester: string } | null);
    setIsSuperadmin(Boolean(data.isSuperadmin));
    const subList = (data.subjects as SubjectItem[]) || [];
    setSubjects(subList);
    setClassrooms((data.classrooms as ClassroomItem[]) || []);
    setSchedulePairs((data.schedulePairs as SchedulePair[]) || []);
    if (subList.length > 0) {
      setSelectedSubjectId((prev) =>
        prev && subList.some((s) => s.id === prev) ? prev : subList[0].id
      );
    } else {
      setSelectedSubjectId('');
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/penilaian/monitoring');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data monitoring.');
      applyMonitoringData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [applyMonitoringData]);

  useEffect(() => {
    let active = true;
    fetch('/api/penilaian/monitoring')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data monitoring.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError(null);
        applyMonitoringData(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyMonitoringData]);

  const subjectSchedules = useMemo(
    () => schedulePairs.filter((p) => p.subject_id === selectedSubjectId),
    [schedulePairs, selectedSubjectId]
  );

  const scheduledClassroomIds = useMemo(
    () => new Set(subjectSchedules.map((p) => p.classroom_id)),
    [subjectSchedules]
  );

  const mappedClassrooms: TaughtClassroomSummary[] = useMemo(() => {
    const base =
      onlyScheduledClasses && scheduledClassroomIds.size > 0
        ? classrooms.filter((c) => scheduledClassroomIds.has(c.id))
        : classrooms;

    return base.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.grade_level,
    }));
  }, [classrooms, onlyScheduledClasses, scheduledClassroomIds]);

  const teacherNames = useMemo(
    () =>
      Array.from(
        new Set(
          subjectSchedules
            .map((p) => p.teacher_name)
            .filter((n): n is string => Boolean(n && n.trim()))
        )
      ),
    [subjectSchedules]
  );

  if (loading) return <AkademikLoading label="Memuat daftar mata pelajaran & kelas..." />;
  if (error) return <AkademikErrorBanner error={error} onRetry={loadData} />;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">
      {/* Header & Filter Card */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isSuperadmin
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-sky-700 bg-sky-50 border-sky-200'
                }`}
              >
                {isSuperadmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Superadmin — Kelola Penilaian</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Admin — Monitoring (Read-Only)</span>
                  </>
                )}
              </span>
              {academicYear && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                  TA {academicYear.name} ({academicYear.semester})
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Monitoring Penilaian Seluruh Mata Pelajaran
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pilih mata pelajaran dan jenis penilaian untuk memantau atau mengekspor rekap nilai per kelas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto lg:min-w-[420px]">
            <div className="space-y-1">
              <label
                htmlFor="monitoring-subject"
                className="block text-[11px] font-semibold text-slate-600"
              >
                Mata Pelajaran
              </label>
              <select
                id="monitoring-subject"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={subjects.length === 0}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
              >
                {subjects.length === 0 ? (
                  <option value="">Belum ada mata pelajaran</option>
                ) : (
                  subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="monitoring-type"
                className="block text-[11px] font-semibold text-slate-600"
              >
                Jenis Penilaian
              </label>
              <select
                id="monitoring-type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as AssessmentMenuType)}
                disabled={subjects.length === 0}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
              >
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Teacher & Schedule Filter Bar */}
        {selectedSubjectId && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 min-w-0">
              <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="break-words">
                Guru Pengampu:{' '}
                <strong className="text-slate-800">
                  {teacherNames.length > 0 ? teacherNames.join(', ') : 'Belum terjadwal'}
                </strong>
              </span>
            </div>

            {scheduledClassroomIds.size > 0 && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={onlyScheduledClasses}
                  onChange={(e) => setOnlyScheduledClasses(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Hanya kelas terjadwal ({scheduledClassroomIds.size})</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Empty States or Active Workspace */}
      {subjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500">
          Belum ada mata pelajaran terdaftar. Tambahkan mata pelajaran di menu Kelas &amp; Jadwal.
        </div>
      ) : classrooms.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500">
          Belum ada rombongan belajar pada tahun ajaran aktif.
        </div>
      ) : (
        selectedSubjectId &&
        (selectedType === 'RAPORT' ? (
          <RaportWorkspace
            key={`${selectedSubjectId}-RAPORT-${onlyScheduledClasses ? 'sched' : 'all'}`}
            subjectId={selectedSubjectId}
            classrooms={mappedClassrooms}
          />
        ) : (
          <AssessmentWorkspace
            key={`${selectedSubjectId}-${selectedType}-${onlyScheduledClasses ? 'sched' : 'all'}`}
            subjectId={selectedSubjectId}
            type={selectedType}
            classrooms={mappedClassrooms}
          />
        ))
      )}
    </div>
  );
}
