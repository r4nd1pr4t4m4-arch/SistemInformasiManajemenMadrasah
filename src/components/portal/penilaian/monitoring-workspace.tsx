'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
} from '@/components/portal/akademik/akademik-ui';
import { AssessmentWorkspace } from '@/components/portal/penilaian/assessment-workspace';
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

export function MonitoringPenilaianWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedType, setSelectedType] = useState<AssessmentMenuType>('FORMATIF');

  const applyMonitoringData = useCallback((data: Record<string, unknown>) => {
    setIsSuperadmin(Boolean(data.isSuperadmin));
    const subList = (data.subjects as SubjectItem[]) || [];
    setSubjects(subList);
    setClassrooms((data.classrooms as ClassroomItem[]) || []);
    if (subList.length > 0) {
      setSelectedSubjectId((prev) => prev || subList[0].id);
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

  if (loading) return <AkademikLoading label="Memuat daftar mata pelajaran & kelas..." />;
  if (error) return <AkademikErrorBanner error={error} onRetry={loadData} />;

  const mappedClassrooms: TaughtClassroomSummary[] = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    gradeLevel: c.grade_level,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            {isSuperadmin ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Superadmin — Kelola Penilaian Semua Mapel</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-sky-600" />
                <span className="text-sky-700">Admin — Monitoring Penilaian (Read-Only)</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Pilih mata pelajaran dan jenis penilaian untuk melihat atau mengekspor rekap nilai per kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AssessmentMenuType)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
          >
            <option value="FORMATIF">Formatif (Lingkup BAB)</option>
            <option value="SUMATIF">Sumatif (Lingkup Materi)</option>
            <option value="STS">STS (Sumatif Tengah Semester)</option>
            <option value="SAS">SAS (Sumatif Akhir Semester)</option>
            <option value="PRAKTIK">Praktik</option>
          </select>
        </div>
      </div>

      {selectedSubjectId && (
        <AssessmentWorkspace
          subjectId={selectedSubjectId}
          type={selectedType}
          classrooms={mappedClassrooms}
        />
      )}
    </div>
  );
}
