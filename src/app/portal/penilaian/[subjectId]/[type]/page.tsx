'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { AssessmentWorkspace } from '@/components/portal/penilaian/assessment-workspace';
import { RaportWorkspace } from '@/components/portal/penilaian/raport-workspace';
import { AkademikLoading } from '@/components/portal/akademik/akademik-ui';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import type { AssessmentMenuType } from '@/lib/domain/penilaian';

const TYPE_MAP: Record<string, AssessmentMenuType> = {
  formatif: 'FORMATIF',
  sumatif: 'SUMATIF',
  sts: 'STS',
  sas: 'SAS',
  praktik: 'PRAKTIK',
  raport: 'RAPORT',
};

export default function PenilaianSubjectTypePage() {
  const params = useParams<{ subjectId: string; type: string }>();
  const searchParams = useSearchParams();
  const { user, loading } = usePortalSession();

  const subjectId = params?.subjectId || '';
  const typeKey = (params?.type || '').toLowerCase();
  const assessmentType = TYPE_MAP[typeKey];
  const chapterId = searchParams.get('chapterId');
  const classroomId = searchParams.get('classroomId');

  if (loading) {
    return <AkademikLoading label="Memuat sesi penilaian..." />;
  }

  if (!assessmentType || !subjectId) {
    return (
      <div className="max-w-4xl mx-auto glass-card rounded-3xl p-8 text-center text-sm text-rose-600">
        Halaman penilaian tidak ditemukan.
      </div>
    );
  }

  const taughtSubject = user?.teacherAssignments?.taughtSubjects?.find(
    (s) => s.subjectId === subjectId
  );

  const classrooms = taughtSubject?.classrooms || [];

  if (assessmentType === 'RAPORT') {
    return (
      <RaportWorkspace
        key={`${subjectId}-RAPORT`}
        subjectId={subjectId}
        classrooms={classrooms}
      />
    );
  }

  return (
    <AssessmentWorkspace
      key={`${subjectId}-${assessmentType}-${chapterId || ''}-${classroomId || ''}`}
      subjectId={subjectId}
      type={assessmentType}
      initialChapterId={chapterId}
      initialClassroomId={classroomId}
      classrooms={classrooms}
      onChaptersChanged={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('penilaian-chapters-updated'));
        }
      }}
    />
  );
}
