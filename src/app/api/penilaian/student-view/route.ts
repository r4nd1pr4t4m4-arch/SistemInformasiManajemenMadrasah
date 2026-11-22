import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles } from '@/lib/auth/api-guard';
import {
  computeAverageScore,
  formatChapterLabel,
  getActiveAcademicYear,
  resolveEffectiveKkm,
} from '@/lib/domain/penilaian';

export async function GET(request: Request) {
  const { session, errorResponse } = await requireApiRoles(['SISWA', 'ORANG_TUA', 'SUPERADMIN']);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const requestedStudentId = searchParams.get('studentId');
  const db = createSupabaseAdminClient();

  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  let linkedStudents: Array<{ id: string; full_name: string; nis: string | null }> = [];

  if (session.roles.includes('SISWA')) {
    const { data: studentRow } = await db
      .from('students')
      .select('id, full_name, nis')
      .eq('profile_id', session.userId)
      .maybeSingle();
    if (studentRow) linkedStudents = [studentRow];
  } else if (session.roles.includes('ORANG_TUA')) {
    const { data: guardianRows } = await db
      .from('student_guardians')
      .select('student:students(id, full_name, nis)')
      .eq('profile_id', session.userId)
      .eq('is_active', true);

    const map = new Map<string, { id: string; full_name: string; nis: string | null }>();
    for (const g of guardianRows || []) {
      const st = Array.isArray(g.student) ? g.student[0] : g.student;
      if (st?.id) map.set(st.id as string, st);
    }
    linkedStudents = Array.from(map.values());
  }

  if (linkedStudents.length === 0) {
    return NextResponse.json({
      academicYear: activeYear,
      students: [],
      selectedStudent: null,
      classroom: null,
      subjects: [],
    });
  }

  const selectedStudent =
    (requestedStudentId && linkedStudents.find((s) => s.id === requestedStudentId)) ||
    linkedStudents[0];

  const { data: enrollment } = await db
    .from('student_enrollments')
    .select('classroom:classrooms(id, name, grade_level)')
    .eq('student_id', selectedStudent.id)
    .eq('academic_year_id', activeYear.id)
    .maybeSingle();

  const classroom = enrollment
    ? Array.isArray(enrollment.classroom)
      ? enrollment.classroom[0]
      : enrollment.classroom
    : null;

  if (!classroom) {
    return NextResponse.json({
      academicYear: activeYear,
      students: linkedStudents,
      selectedStudent,
      classroom: null,
      subjects: [],
    });
  }

  const gradeLevel = String(classroom.grade_level);

  const [{ data: scheduleRows }, { data: chapters }, { data: columns }, { data: colScores }, { data: examScores }] =
    await Promise.all([
      db
        .from('schedules')
        .select('subject:subjects(id, code, name)')
        .eq('academic_year_id', activeYear.id)
        .eq('classroom_id', classroom.id),
      db
        .from('assessment_chapters')
        .select('id, subject_id, chapter_number, title, sort_order')
        .eq('academic_year_id', activeYear.id)
        .eq('grade_level', gradeLevel)
        .order('sort_order', { ascending: true }),
      db
        .from('assessment_columns')
        .select('id, subject_id, category, chapter_id, label, sort_order')
        .eq('academic_year_id', activeYear.id)
        .eq('grade_level', gradeLevel)
        .order('sort_order', { ascending: true }),
      db
        .from('assessment_column_scores')
        .select('column_id, score')
        .eq('student_id', selectedStudent.id)
        .eq('classroom_id', classroom.id),
      db
        .from('assessment_exam_scores')
        .select('subject_id, exam_type, score, remedial_score, enrichment_score, notes')
        .eq('academic_year_id', activeYear.id)
        .eq('classroom_id', classroom.id)
        .eq('student_id', selectedStudent.id),
    ]);

  const subjectMap = new Map<string, { id: string; code: string; name: string }>();
  for (const row of scheduleRows || []) {
    const sub = Array.isArray(row.subject) ? row.subject[0] : row.subject;
    if (sub?.id) subjectMap.set(sub.id as string, sub);
  }

  const colScoreMap = new Map<string, number | null>();
  for (const s of colScores || []) {
    colScoreMap.set(
      s.column_id as string,
      s.score !== null && s.score !== undefined ? Number(s.score) : null
    );
  }

  const subjectsPayload = [];
  for (const sub of Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name))) {
    const kkm = await resolveEffectiveKkm(db, activeYear.id, gradeLevel, sub.id);
    const subChapters = (chapters || []).filter((c) => c.subject_id === sub.id);
    const subCols = (columns || []).filter((c) => c.subject_id === sub.id);

    const formatif = subChapters.map((ch) => {
      const chCols = subCols
        .filter((c) => c.category === 'FORMATIF' && c.chapter_id === ch.id)
        .map((c) => ({
          label: c.label,
          score: colScoreMap.get(c.id) ?? null,
        }));
      return {
        chapterLabel: formatChapterLabel(Number(ch.chapter_number), ch.title),
        items: chCols,
        average: computeAverageScore(chCols.map((i) => i.score)),
      };
    });

    const sumatifItems = subCols
      .filter((c) => c.category === 'SUMATIF')
      .map((c) => ({ label: c.label, score: colScoreMap.get(c.id) ?? null }));

    const praktikItems = subCols
      .filter((c) => c.category === 'PRAKTIK')
      .map((c) => ({ label: c.label, score: colScoreMap.get(c.id) ?? null }));

    const stsRow = (examScores || []).find(
      (e) => e.subject_id === sub.id && e.exam_type === 'STS'
    );
    const sasRow = (examScores || []).find(
      (e) => e.subject_id === sub.id && e.exam_type === 'SAS'
    );

    subjectsPayload.push({
      subjectId: sub.id,
      subjectCode: sub.code,
      subjectName: sub.name,
      kkm: kkm.minScore,
      formatif,
      sumatif: {
        items: sumatifItems,
        average: computeAverageScore(sumatifItems.map((i) => i.score)),
      },
      praktik: {
        items: praktikItems,
        average: computeAverageScore(praktikItems.map((i) => i.score)),
      },
      sts: stsRow
        ? {
            score: stsRow.score !== null ? Number(stsRow.score) : null,
            remedial_score: stsRow.remedial_score !== null ? Number(stsRow.remedial_score) : null,
            enrichment_score:
              stsRow.enrichment_score !== null ? Number(stsRow.enrichment_score) : null,
            notes: stsRow.notes ?? null,
          }
        : null,
      sas: sasRow
        ? {
            score: sasRow.score !== null ? Number(sasRow.score) : null,
            remedial_score: sasRow.remedial_score !== null ? Number(sasRow.remedial_score) : null,
            enrichment_score:
              sasRow.enrichment_score !== null ? Number(sasRow.enrichment_score) : null,
            notes: sasRow.notes ?? null,
          }
        : null,
    });
  }

  return NextResponse.json({
    academicYear: activeYear,
    students: linkedStudents,
    selectedStudent,
    classroom,
    subjects: subjectsPayload,
  });
}
