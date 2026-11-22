import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  computeAverageScore,
  computeExamEffectiveScore,
  computeRaportScore,
  getActiveAcademicYear,
  resolveEffectiveKkm,
  validateRaportWeights,
  type RaportWeights,
} from '@/lib/domain/penilaian';

const SaveWeightsSchema = z.object({
  subject_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  weight_formatif: z.number().min(0).max(100),
  weight_sumatif: z.number().min(0).max(100),
  weight_sts: z.number().min(0).max(100),
  weight_sas: z.number().min(0).max(100),
  weight_praktik: z.number().min(0).max(100).default(0),
});

function hasEditPermission(
  session: NonNullable<Awaited<ReturnType<typeof requireApiRoles>>['session']>,
  subjectId: string,
  classroomId: string
): boolean {
  if (session.roles.includes('SUPERADMIN')) return true;
  const taught = session.teacherAssignments?.taughtSubjects || [];
  const sub = taught.find((s) => s.subjectId === subjectId);
  if (!sub) return false;
  return sub.classrooms.some((c) => c.id === classroomId);
}

function hasReadPermission(
  session: NonNullable<Awaited<ReturnType<typeof requireApiRoles>>['session']>,
  subjectId: string,
  classroomId: string
): boolean {
  if (hasEditPermission(session, subjectId, classroomId)) return true;
  return session.roles.some((r) => PERMISSIONS.PENILAIAN_ADMIN_READ.includes(r));
}

export async function GET(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const classroomId = searchParams.get('classroomId');
  if (!subjectId || !classroomId) {
    return NextResponse.json(
      { error: 'Parameter subjectId dan classroomId wajib diisi.' },
      { status: 400 }
    );
  }

  if (!hasReadPermission(session, subjectId, classroomId)) {
    return NextResponse.json({ error: 'Akses penilaian ditolak.' }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const [{ data: subject }, { data: classroom }] = await Promise.all([
    db.from('subjects').select('id, code, name').eq('id', subjectId).maybeSingle(),
    db.from('classrooms').select('id, name, grade_level').eq('id', classroomId).maybeSingle(),
  ]);

  if (!subject || !classroom) {
    return NextResponse.json(
      { error: 'Mata pelajaran atau kelas tidak ditemukan.' },
      { status: 404 }
    );
  }

  const gradeLevel = String(classroom.grade_level);
  const kkm = await resolveEffectiveKkm(db, activeYear.id, gradeLevel, subjectId);

  const [
    { data: enrollmentRows },
    { data: columnRows },
    { data: examRows },
    { data: weightRow },
  ] = await Promise.all([
    db
      .from('student_enrollments')
      .select('student:students(id, nis, nisn, full_name)')
      .eq('classroom_id', classroomId)
      .eq('academic_year_id', activeYear.id),
    db
      .from('assessment_columns')
      .select('id, category')
      .eq('academic_year_id', activeYear.id)
      .eq('subject_id', subjectId)
      .eq('grade_level', gradeLevel),
    db
      .from('assessment_exam_scores')
      .select('student_id, exam_type, score, remedial_score, enrichment_score')
      .eq('academic_year_id', activeYear.id)
      .eq('subject_id', subjectId)
      .eq('classroom_id', classroomId),
    db
      .from('assessment_raport_weights')
      .select('weight_formatif, weight_sumatif, weight_sts, weight_sas, weight_praktik')
      .eq('academic_year_id', activeYear.id)
      .eq('subject_id', subjectId)
      .eq('grade_level', gradeLevel)
      .maybeSingle(),
  ]);

  const students = (enrollmentRows || [])
    .map((e) => (Array.isArray(e.student) ? e.student[0] : e.student))
    .filter((s): s is { id: string; nis: string | null; nisn: string | null; full_name: string } =>
      Boolean(s?.id)
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const colIds = (columnRows || []).map((c) => c.id as string);
  const { data: colScoreRows } =
    colIds.length > 0
      ? await db
          .from('assessment_column_scores')
          .select('column_id, student_id, score')
          .eq('classroom_id', classroomId)
          .in('column_id', colIds)
      : { data: [] };

  const colCategoryMap = new Map(
    (columnRows || []).map((c) => [c.id as string, c.category as string])
  );

  let hasPraktik = false;
  const studentColScores = new Map<
    string,
    { FORMATIF: number[]; SUMATIF: number[]; PRAKTIK: number[] }
  >();

  for (const row of colScoreRows || []) {
    if (row.score === null || row.score === undefined) continue;
    const cat = colCategoryMap.get(row.column_id as string);
    if (!cat) continue;
    const num = Number(row.score);
    if (cat === 'PRAKTIK') hasPraktik = true;
    const sid = row.student_id as string;
    let entry = studentColScores.get(sid);
    if (!entry) {
      entry = { FORMATIF: [], SUMATIF: [], PRAKTIK: [] };
      studentColScores.set(sid, entry);
    }
    if (cat === 'FORMATIF') entry.FORMATIF.push(num);
    if (cat === 'SUMATIF') entry.SUMATIF.push(num);
    if (cat === 'PRAKTIK') entry.PRAKTIK.push(num);
  }

  const defaultWeights: RaportWeights = hasPraktik
    ? {
        weight_formatif: 20,
        weight_sumatif: 20,
        weight_sts: 20,
        weight_sas: 20,
        weight_praktik: 20,
      }
    : {
        weight_formatif: 25,
        weight_sumatif: 25,
        weight_sts: 25,
        weight_sas: 25,
        weight_praktik: 0,
      };

  const weights: RaportWeights = weightRow
    ? {
        weight_formatif: Number(weightRow.weight_formatif),
        weight_sumatif: Number(weightRow.weight_sumatif),
        weight_sts: Number(weightRow.weight_sts),
        weight_sas: Number(weightRow.weight_sas),
        weight_praktik: hasPraktik ? Number(weightRow.weight_praktik) : 0,
      }
    : defaultWeights;

  const rows = students.map((st) => {
    const colBucket = studentColScores.get(st.id);
    const formatifAvg = computeAverageScore(colBucket?.FORMATIF || []);
    const sumatifAvg = computeAverageScore(colBucket?.SUMATIF || []);
    const praktikAvg = hasPraktik ? computeAverageScore(colBucket?.PRAKTIK || []) : null;

    const stsRow = (examRows || []).find(
      (e) => e.student_id === st.id && e.exam_type === 'STS'
    );
    const sasRow = (examRows || []).find(
      (e) => e.student_id === st.id && e.exam_type === 'SAS'
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

    return {
      student_id: st.id,
      nis: st.nis,
      full_name: st.full_name,
      formatifAvg,
      sumatifAvg,
      stsEffective,
      sasEffective,
      praktikAvg,
      raportScore,
    };
  });

  return NextResponse.json({
    academicYear: activeYear,
    subject,
    classroom,
    kkm,
    canEdit: hasEditPermission(session, subjectId, classroomId),
    hasPraktik,
    weights,
    weightsValid: validateRaportWeights(weights, hasPraktik) === null,
    rows,
  });
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SaveWeightsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data bobot raport tidak valid.' }, { status: 400 });
  }

  if (!hasEditPermission(session, parsed.data.subject_id, parsed.data.classroom_id)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki izin mengatur bobot raport untuk kelas/mapel ini.' },
      { status: 403 }
    );
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const { data: classroom } = await db
    .from('classrooms')
    .select('id, grade_level')
    .eq('id', parsed.data.classroom_id)
    .maybeSingle();

  if (!classroom) {
    return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
  }

  const gradeLevel = String(classroom.grade_level);

  // Check if Praktik scores exist in this classroom
  const { data: praktikCols } = await db
    .from('assessment_columns')
    .select('id')
    .eq('academic_year_id', activeYear.id)
    .eq('subject_id', parsed.data.subject_id)
    .eq('grade_level', gradeLevel)
    .eq('category', 'PRAKTIK');

  const praktikColIds = (praktikCols || []).map((c) => c.id as string);
  let hasPraktik = false;
  if (praktikColIds.length > 0) {
    const { data: praktikScoreSample } = await db
      .from('assessment_column_scores')
      .select('id')
      .eq('classroom_id', parsed.data.classroom_id)
      .in('column_id', praktikColIds)
      .not('score', 'is', null)
      .limit(1);
    hasPraktik = (praktikScoreSample || []).length > 0;
  }

  const weights: RaportWeights = {
    weight_formatif: parsed.data.weight_formatif,
    weight_sumatif: parsed.data.weight_sumatif,
    weight_sts: parsed.data.weight_sts,
    weight_sas: parsed.data.weight_sas,
    weight_praktik: hasPraktik ? parsed.data.weight_praktik : 0,
  };

  const validationError = validateRaportWeights(weights, hasPraktik);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { error } = await db.from('assessment_raport_weights').upsert(
    {
      academic_year_id: activeYear.id,
      subject_id: parsed.data.subject_id,
      grade_level: gradeLevel,
      ...weights,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'academic_year_id,subject_id,grade_level' }
  );

  if (error) {
    return NextResponse.json({ error: 'Gagal menyimpan bobot raport.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, weights });
}
