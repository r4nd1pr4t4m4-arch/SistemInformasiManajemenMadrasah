import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import {
  computeAverageScore,
  computeExamEffectiveScore,
  computeRaportScore,
  getActiveAcademicYear,
  resolveEffectiveKkm,
  sortClassroomsAsc,
  type RaportWeights,
} from '@/lib/domain/penilaian';
import { sanitizeApiError } from '@/lib/security/api-error';

const SaveReportCardSchema = z.object({
  student_id: z.string().uuid(),
  classroom_id: z.string().uuid().optional().nullable(),
  attitude_spiritual: z.string().optional().nullable(),
  attitude_social: z.string().optional().nullable(),
  p5_summary: z.string().optional().nullable(),
  extracurricular_notes: z
    .array(
      z.object({
        name: z.string().min(1),
        grade: z.string().min(1),
        notes: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
  achievements_notes: z.string().optional().nullable(),
  homeroom_notes: z.string().optional().nullable(),
  promotion_status: z
    .enum(['MENUNGGU', 'NAIK_KELAS', 'TINGGAL_KELAS', 'LULUS', 'TIDAK_LULUS'])
    .default('MENUNGGU'),
  next_grade_label: z.string().optional().nullable(),
  is_published: z.boolean().default(false),
});

export async function GET(request: Request) {
  const { session, errorResponse } = await requireApiRoles([
    ...PERMISSIONS.PENILAIAN_ADMIN_READ,
    'WALI_KELAS',
  ]);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const isGlobalReader = hasAnyRole(session, PERMISSIONS.PENILAIAN_ADMIN_READ);
  const homeroomIds = session.teacherAssignments?.homeroomClassroomIds || [];

  const { data: allClassrooms } = await db
    .from('classrooms')
    .select('id, name, grade_level, homeroom_teacher:teachers_staff(full_name)')
    .eq('academic_year_id', activeYear.id);

  const scopedClassrooms = sortClassroomsAsc(
    (allClassrooms || [])
      .filter((c) => isGlobalReader || homeroomIds.includes(c.id as string))
      .map((c) => {
        const ht = Array.isArray(c.homeroom_teacher) ? c.homeroom_teacher[0] : c.homeroom_teacher;
        return {
          id: c.id as string,
          name: String(c.name || ''),
          grade_level: String(c.grade_level || ''),
          gradeLevel: String(c.grade_level || ''),
          homeroom_teacher_name: ht?.full_name ? String(ht.full_name) : null,
        };
      })
  );

  const { searchParams } = new URL(request.url);
  const requestedClassId = searchParams.get('classroomId') || scopedClassrooms[0]?.id || '';
  const selectedClass = scopedClassrooms.find((c) => c.id === requestedClassId) || null;

  if (!selectedClass) {
    return NextResponse.json({
      academicYear: activeYear,
      classrooms: scopedClassrooms,
      selectedClassroom: null,
      subjects: [],
      rows: [],
      canEdit: false,
    });
  }

  const canEdit =
    hasAnyRole(session, ['SUPERADMIN', 'OPERATOR', 'WAKA_KURIKULUM', 'KEPALA_TU']) ||
    homeroomIds.includes(selectedClass.id);

  const [
    { data: enrollments },
    { data: classSchedules },
    { data: allColumns },
    { data: allExamScores },
    { data: allWeights },
    { data: reportCardRows },
    { data: attendanceRows },
  ] = await Promise.all([
    db
      .from('student_enrollments')
      .select('student:students(id, nis, nisn, full_name)')
      .eq('classroom_id', selectedClass.id)
      .eq('academic_year_id', activeYear.id),
    db
      .from('schedules')
      .select('subject:subjects(id, code, name)')
      .eq('academic_year_id', activeYear.id)
      .eq('classroom_id', selectedClass.id),
    db
      .from('assessment_columns')
      .select('id, subject_id, category')
      .eq('academic_year_id', activeYear.id)
      .eq('grade_level', selectedClass.grade_level),
    db
      .from('assessment_exam_scores')
      .select('subject_id, student_id, exam_type, score, remedial_score, enrichment_score')
      .eq('academic_year_id', activeYear.id)
      .eq('classroom_id', selectedClass.id),
    db
      .from('assessment_raport_weights')
      .select('subject_id, weight_formatif, weight_sumatif, weight_sts, weight_sas, weight_praktik')
      .eq('academic_year_id', activeYear.id)
      .eq('grade_level', selectedClass.grade_level),
    db
      .from('student_report_cards')
      .select('*')
      .eq('academic_year_id', activeYear.id)
      .eq('classroom_id', selectedClass.id),
    db
      .from('student_attendances')
      .select('student_id, status')
      .eq('classroom_id', selectedClass.id)
      .is('schedule_id', null),
  ]);

  // Deduplikasi mata pelajaran rombel
  const subjectMap = new Map<string, { id: string; code: string; name: string }>();
  for (const row of classSchedules || []) {
    const sub = Array.isArray(row.subject) ? row.subject[0] : row.subject;
    if (sub?.id && !subjectMap.has(sub.id)) {
      subjectMap.set(sub.id, {
        id: sub.id,
        code: String(sub.code || ''),
        name: String(sub.name || ''),
      });
    }
  }
  const subjectsList = Array.from(subjectMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'id')
  );

  // Resolve KKM per mapel
  const subjectWithKkm = await Promise.all(
    subjectsList.map(async (s) => {
      const kkm = await resolveEffectiveKkm(db, activeYear.id, selectedClass.grade_level, s.id);
      return { ...s, kkm: kkm.minScore };
    })
  );

  const colIds = (allColumns || []).map((c) => c.id as string);
  const { data: colScoreRows } =
    colIds.length > 0
      ? await db
          .from('assessment_column_scores')
          .select('column_id, student_id, score')
          .eq('classroom_id', selectedClass.id)
          .in('column_id', colIds)
      : { data: [] };

  const colMetaMap = new Map(
    (allColumns || []).map((c) => [
      c.id as string,
      { subjectId: c.subject_id as string, category: c.category as string },
    ])
  );

  const scoresBucket = new Map<
    string,
    { FORMATIF: number[]; SUMATIF: number[]; PRAKTIK: number[] }
  >();
  const subjectHasPraktik = new Set<string>();

  for (const row of colScoreRows || []) {
    if (row.score === null || row.score === undefined) continue;
    const meta = colMetaMap.get(row.column_id as string);
    if (!meta) continue;
    const num = Number(row.score);
    if (meta.category === 'PRAKTIK') subjectHasPraktik.add(meta.subjectId);
    const key = `${row.student_id}::${meta.subjectId}`;
    let entry = scoresBucket.get(key);
    if (!entry) {
      entry = { FORMATIF: [], SUMATIF: [], PRAKTIK: [] };
      scoresBucket.set(key, entry);
    }
    if (meta.category === 'FORMATIF') entry.FORMATIF.push(num);
    if (meta.category === 'SUMATIF') entry.SUMATIF.push(num);
    if (meta.category === 'PRAKTIK') entry.PRAKTIK.push(num);
  }

  const weightBySubject = new Map(
    (allWeights || []).map((w) => [w.subject_id as string, w])
  );
  const reportCardByStudent = new Map(
    (reportCardRows || []).map((rc) => [rc.student_id as string, rc])
  );

  const attByStudent = new Map<string, { sakit: number; izin: number; alpa: number }>();
  for (const a of attendanceRows || []) {
    const sid = a.student_id as string;
    const cur = attByStudent.get(sid) || { sakit: 0, izin: 0, alpa: 0 };
    if (a.status === 'SAKIT') cur.sakit++;
    else if (a.status === 'IZIN') cur.izin++;
    else if (a.status === 'ALPA') cur.alpa++;
    attByStudent.set(sid, cur);
  }

  const students = (enrollments || [])
    .map((e) => (Array.isArray(e.student) ? e.student[0] : e.student))
    .filter((s): s is { id: string; nis: string | null; nisn: string | null; full_name: string } =>
      Boolean(s?.id)
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));

  const rawRows = students.map((st) => {
    const subjectScores: Record<string, number | null> = {};
    const validScores: number[] = [];

    for (const sub of subjectWithKkm) {
      const hasPraktik = subjectHasPraktik.has(sub.id);
      const wRow = weightBySubject.get(sub.id);
      const weights: RaportWeights = wRow
        ? {
            weight_formatif: Number(wRow.weight_formatif),
            weight_sumatif: Number(wRow.weight_sumatif),
            weight_sts: Number(wRow.weight_sts),
            weight_sas: Number(wRow.weight_sas),
            weight_praktik: hasPraktik ? Number(wRow.weight_praktik) : 0,
          }
        : hasPraktik
        ? { weight_formatif: 20, weight_sumatif: 20, weight_sts: 20, weight_sas: 20, weight_praktik: 20 }
        : { weight_formatif: 25, weight_sumatif: 25, weight_sts: 25, weight_sas: 25, weight_praktik: 0 };

      const bucket = scoresBucket.get(`${st.id}::${sub.id}`);
      const formatifAvg = computeAverageScore(bucket?.FORMATIF || []);
      const sumatifAvg = computeAverageScore(bucket?.SUMATIF || []);
      const praktikAvg = hasPraktik ? computeAverageScore(bucket?.PRAKTIK || []) : null;

      const stsRow = (allExamScores || []).find(
        (e) => e.student_id === st.id && e.subject_id === sub.id && e.exam_type === 'STS'
      );
      const sasRow = (allExamScores || []).find(
        (e) => e.student_id === st.id && e.subject_id === sub.id && e.exam_type === 'SAS'
      );
      const stsEffective = stsRow
        ? computeExamEffectiveScore(
            stsRow.score !== null ? Number(stsRow.score) : null,
            stsRow.remedial_score !== null ? Number(stsRow.remedial_score) : null,
            stsRow.enrichment_score !== null ? Number(stsRow.enrichment_score) : null
          )
        : null;
      const sasEffective = sasRow
        ? computeExamEffectiveScore(
            sasRow.score !== null ? Number(sasRow.score) : null,
            sasRow.remedial_score !== null ? Number(sasRow.remedial_score) : null,
            sasRow.enrichment_score !== null ? Number(sasRow.enrichment_score) : null
          )
        : null;

      const raportScore = computeRaportScore(
        { formatifAvg, sumatifAvg, stsEffective, sasEffective, praktikAvg },
        weights,
        hasPraktik
      );
      subjectScores[sub.id] = raportScore;
      if (raportScore !== null) validScores.push(raportScore);
    }

    const average = computeAverageScore(validScores);
    const rc = reportCardByStudent.get(st.id) || null;
    const attendance = attByStudent.get(st.id) || { sakit: 0, izin: 0, alpa: 0 };

    return {
      student_id: st.id,
      nis: st.nis,
      nisn: st.nisn,
      full_name: st.full_name,
      subjectScores,
      average,
      attendance,
      reportCard: rc,
    };
  });

  // Hitung ranking berdasarkan rata-rata nilai
  const sortedForRank = [...rawRows]
    .filter((r) => r.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  const rankMap = new Map<string, number>();
  sortedForRank.forEach((r, idx) => rankMap.set(r.student_id, idx + 1));

  const rows = rawRows.map((r) => ({
    ...r,
    rank: rankMap.get(r.student_id) ?? rawRows.length,
  }));

  return NextResponse.json({
    academicYear: activeYear,
    classrooms: scopedClassrooms,
    selectedClassroom: selectedClass,
    subjects: subjectWithKkm,
    rows,
    canEdit,
  });
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiRoles([
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
    'WALI_KELAS',
  ]);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const parsed = SaveReportCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data E-Raport tidak valid.' }, { status: 400 });
    }

    const db = createSupabaseAdminClient();
    const activeYear = await getActiveAcademicYear(db);
    if (!activeYear) {
      return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
    }

    const isGlobalEditor = hasAnyRole(session, [
      'SUPERADMIN',
      'OPERATOR',
      'WAKA_KURIKULUM',
      'KEPALA_TU',
    ]);
    const homeroomIds = session.teacherAssignments?.homeroomClassroomIds || [];
    if (
      !isGlobalEditor &&
      (!parsed.data.classroom_id || !homeroomIds.includes(parsed.data.classroom_id))
    ) {
      return NextResponse.json(
        { error: 'Wali Kelas hanya dapat mengisi catatan E-Raport kelas perwaliannya.' },
        { status: 403 }
      );
    }

    const { data, error } = await db
      .from('student_report_cards')
      .upsert(
        {
          academic_year_id: activeYear.id,
          student_id: parsed.data.student_id,
          classroom_id: parsed.data.classroom_id || null,
          attitude_spiritual: parsed.data.attitude_spiritual || null,
          attitude_social: parsed.data.attitude_social || null,
          p5_summary: parsed.data.p5_summary || null,
          extracurricular_notes: parsed.data.extracurricular_notes,
          achievements_notes: parsed.data.achievements_notes || null,
          homeroom_notes: parsed.data.homeroom_notes || null,
          promotion_status: parsed.data.promotion_status,
          next_grade_label: parsed.data.next_grade_label || null,
          is_published: parsed.data.is_published,
          updated_by: session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'academic_year_id,student_id' }
      )
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ reportCard: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan data E-Raport.' }, { status: 500 });
  }
}
