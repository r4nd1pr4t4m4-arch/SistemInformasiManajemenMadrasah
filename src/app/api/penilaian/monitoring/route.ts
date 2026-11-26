import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getActiveAcademicYear, sortClassroomsAsc } from '@/lib/domain/penilaian';

export async function GET() {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_ADMIN_READ);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const [
    { data: subjects },
    { data: classrooms },
    { data: schedules },
    { data: colRows },
    { data: examRows },
  ] = await Promise.all([
    db.from('subjects').select('id, code, name').order('name', { ascending: true }),
    db
      .from('classrooms')
      .select('id, name, grade_level')
      .eq('academic_year_id', activeYear.id)
      .order('name', { ascending: true }),
    db
      .from('schedules')
      .select('subject_id, classroom_id, teacher:teachers_staff(full_name)')
      .eq('academic_year_id', activeYear.id),
    db
      .from('assessment_columns')
      .select('subject_id, grade_level, category')
      .eq('academic_year_id', activeYear.id),
    db
      .from('assessment_exam_scores')
      .select('subject_id, classroom_id, exam_type')
      .eq('academic_year_id', activeYear.id),
  ]);

  const classGradeMap = new Map(
    (classrooms || []).map((c) => [c.id as string, String(c.grade_level || '')])
  );
  const subjectNameMap = new Map(
    (subjects || []).map((s) => [s.id as string, String(s.name || '')])
  );
  const classNameMap = new Map(
    (classrooms || []).map((c) => [c.id as string, String(c.name || '')])
  );

  const colKeySet = new Set(
    (colRows || []).map((c) => `${c.subject_id}::${c.grade_level}::${c.category}`)
  );
  const examKeySet = new Set(
    (examRows || []).map((e) => `${e.subject_id}::${e.classroom_id}::${e.exam_type}`)
  );

  const uniquePairMap = new Map<
    string,
    {
      subject_id: string;
      subject_name: string;
      classroom_id: string;
      classroom_name: string;
      teacher_name: string | null;
      hasFormatif: boolean;
      hasSumatif: boolean;
      hasSts: boolean;
      hasSas: boolean;
      completionPct: number;
    }
  >();

  for (const s of schedules || []) {
    const subId = s.subject_id as string;
    const clsId = s.classroom_id as string;
    const key = `${subId}::${clsId}`;
    if (uniquePairMap.has(key)) continue;
    const t = Array.isArray(s.teacher) ? s.teacher[0] : s.teacher;
    const grade = classGradeMap.get(clsId) || '';
    const hasFormatif = colKeySet.has(`${subId}::${grade}::FORMATIF`);
    const hasSumatif = colKeySet.has(`${subId}::${grade}::SUMATIF`);
    const hasSts = examKeySet.has(`${subId}::${clsId}::STS`);
    const hasSas = examKeySet.has(`${subId}::${clsId}::SAS`);
    const filled = Number(hasFormatif) + Number(hasSumatif) + Number(hasSts) + Number(hasSas);
    uniquePairMap.set(key, {
      subject_id: subId,
      subject_name: subjectNameMap.get(subId) || '-',
      classroom_id: clsId,
      classroom_name: classNameMap.get(clsId) || '-',
      teacher_name: t?.full_name ? String(t.full_name) : null,
      hasFormatif,
      hasSumatif,
      hasSts,
      hasSas,
      completionPct: Math.round((filled / 4) * 100),
    });
  }

  const teacherProgress = Array.from(uniquePairMap.values()).sort(
    (a, b) => a.completionPct - b.completionPct || a.classroom_name.localeCompare(b.classroom_name)
  );

  const schedulePairs = (schedules || []).map((s) => {
    const t = Array.isArray(s.teacher) ? s.teacher[0] : s.teacher;
    return {
      subject_id: s.subject_id as string,
      classroom_id: s.classroom_id as string,
      teacher_name: t?.full_name ? String(t.full_name) : null,
    };
  });

  const sortedClassrooms = sortClassroomsAsc(
    (classrooms || []).map((c) => ({
      id: c.id as string,
      name: String(c.name || ''),
      grade_level: String(c.grade_level || ''),
      gradeLevel: String(c.grade_level || ''),
    }))
  ).map(({ id, name, grade_level }) => ({ id, name, grade_level }));

  return NextResponse.json({
    academicYear: activeYear,
    isSuperadmin: session.roles.includes('SUPERADMIN'),
    subjects: subjects || [],
    classrooms: sortedClassrooms,
    schedulePairs,
    teacherProgress,
  });
}
