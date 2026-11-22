import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  getActiveAcademicYear,
  resolveEffectiveKkm,
  validateColumnScoreAgainstKkm,
  validateExamScoreAgainstKkm,
  type AssessmentCategory,
  type AssessmentExamType,
} from '@/lib/domain/penilaian';

const SaveColumnScoresSchema = z.object({
  action: z.literal('SAVE_COLUMN_SCORES'),
  subject_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  category: z.enum(['FORMATIF', 'SUMATIF', 'PRAKTIK']),
  scores: z.array(
    z.object({
      column_id: z.string().uuid(),
      student_id: z.string().uuid(),
      score: z.number().min(0).max(100).nullable(),
    })
  ),
});

const SaveExamScoresSchema = z.object({
  action: z.literal('SAVE_EXAM_SCORES'),
  subject_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  exam_type: z.enum(['STS', 'SAS']),
  config: z
    .object({
      enable_remedial: z.boolean(),
      enable_enrichment: z.boolean(),
      enable_notes: z.boolean(),
    })
    .optional(),
  scores: z.array(
    z.object({
      student_id: z.string().uuid(),
      score: z.number().min(0).max(100).nullable(),
      remedial_score: z.number().min(0).max(100).nullable(),
      enrichment_score: z.number().min(0).max(100).nullable(),
      notes: z.string().max(500).nullable(),
    })
  ),
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
  const type = searchParams.get('type') as AssessmentCategory | AssessmentExamType | null;
  const chapterId = searchParams.get('chapterId');

  const VALID_TYPES = new Set(['FORMATIF', 'SUMATIF', 'PRAKTIK', 'STS', 'SAS']);
  if (!subjectId || !classroomId || !type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: 'Parameter subjectId, classroomId, dan type (FORMATIF/SUMATIF/PRAKTIK/STS/SAS) wajib valid.' },
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
    return NextResponse.json({ error: 'Mata pelajaran atau kelas tidak ditemukan.' }, { status: 404 });
  }

  const kkm = await resolveEffectiveKkm(
    db,
    activeYear.id,
    String(classroom.grade_level),
    subjectId
  );

  // Fetch enrolled students in this classroom for the active academic year
  const { data: enrollmentRows } = await db
    .from('student_enrollments')
    .select('student:students(id, nis, nisn, full_name, gender)')
    .eq('classroom_id', classroomId)
    .eq('academic_year_id', activeYear.id);

  const students = (enrollmentRows || [])
    .map((e) => (Array.isArray(e.student) ? e.student[0] : e.student))
    .filter((s): s is { id: string; nis: string | null; nisn: string | null; full_name: string; gender: string | null } => Boolean(s?.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const canEdit = hasEditPermission(session, subjectId, classroomId);

  if (type === 'STS' || type === 'SAS') {
    const [{ data: configRow }, { data: examScores }] = await Promise.all([
      db
        .from('assessment_exam_configs')
        .select('enable_remedial, enable_enrichment, enable_notes')
        .eq('academic_year_id', activeYear.id)
        .eq('subject_id', subjectId)
        .eq('grade_level', classroom.grade_level)
        .eq('exam_type', type)
        .maybeSingle(),
      db
        .from('assessment_exam_scores')
        .select('student_id, score, remedial_score, enrichment_score, notes')
        .eq('academic_year_id', activeYear.id)
        .eq('subject_id', subjectId)
        .eq('classroom_id', classroomId)
        .eq('exam_type', type),
    ]);

    return NextResponse.json({
      academicYear: activeYear,
      subject,
      classroom,
      kkm,
      canEdit,
      type,
      students,
      examConfig: {
        enable_remedial: Boolean(configRow?.enable_remedial),
        enable_enrichment: Boolean(configRow?.enable_enrichment),
        enable_notes: Boolean(configRow?.enable_notes),
      },
      examScores: (examScores || []).map((s) => ({
        student_id: s.student_id,
        score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
        remedial_score:
          s.remedial_score !== null && s.remedial_score !== undefined
            ? Number(s.remedial_score)
            : null,
        enrichment_score:
          s.enrichment_score !== null && s.enrichment_score !== undefined
            ? Number(s.enrichment_score)
            : null,
        notes: s.notes ?? null,
      })),
    });
  }

  // FORMATIF, SUMATIF, PRAKTIK
  let chapters: Array<{ id: string; chapter_number: number; title: string | null; sort_order: number }> = [];
  if (type === 'FORMATIF') {
    const { data: chapterRows } = await db
      .from('assessment_chapters')
      .select('id, chapter_number, title, sort_order')
      .eq('academic_year_id', activeYear.id)
      .eq('subject_id', subjectId)
      .eq('grade_level', classroom.grade_level)
      .order('sort_order', { ascending: true })
      .order('chapter_number', { ascending: true });
    chapters = chapterRows || [];
  }

  const activeChapterId =
    type === 'FORMATIF'
      ? chapterId && chapters.some((c) => c.id === chapterId)
        ? chapterId
        : chapters[0]?.id ?? null
      : null;

  let columns: Array<{
    id: string;
    category: string;
    chapter_id: string | null;
    naming_mode: string;
    label: string;
    sort_order: number;
  }> = [];

  if (type !== 'FORMATIF' || activeChapterId) {
    let colQuery = db
      .from('assessment_columns')
      .select('id, category, chapter_id, naming_mode, label, sort_order')
      .eq('academic_year_id', activeYear.id)
      .eq('subject_id', subjectId)
      .eq('grade_level', classroom.grade_level)
      .eq('category', type);

    colQuery =
      type === 'FORMATIF' && activeChapterId
        ? colQuery.eq('chapter_id', activeChapterId)
        : colQuery.is('chapter_id', null);

    const { data: colRows } = await colQuery.order('sort_order', { ascending: true });
    columns = colRows || [];
  }

  let columnScores: Array<{ column_id: string; student_id: string; score: number | null }> = [];
  if (columns.length > 0) {
    const colIds = columns.map((c) => c.id);
    const { data: scoreRows } = await db
      .from('assessment_column_scores')
      .select('column_id, student_id, score')
      .eq('classroom_id', classroomId)
      .in('column_id', colIds);

    columnScores = (scoreRows || []).map((r) => ({
      column_id: r.column_id as string,
      student_id: r.student_id as string,
      score: r.score !== null && r.score !== undefined ? Number(r.score) : null,
    }));
  }

  return NextResponse.json({
    academicYear: activeYear,
    subject,
    classroom,
    kkm,
    canEdit,
    type,
    chapters,
    activeChapterId,
    columns,
    students,
    columnScores,
  });
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  if (body?.action === 'SAVE_COLUMN_SCORES') {
    const parsed = SaveColumnScoresSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data nilai tidak valid.' }, { status: 400 });
    }

    if (!hasEditPermission(session, parsed.data.subject_id, parsed.data.classroom_id)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki izin mengubah nilai pada kelas/mapel ini.' },
        { status: 403 }
      );
    }

    const { data: classroom } = await db
      .from('classrooms')
      .select('id, grade_level')
      .eq('id', parsed.data.classroom_id)
      .maybeSingle();

    if (!classroom) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
    }

    const kkm = await resolveEffectiveKkm(
      db,
      activeYear.id,
      String(classroom.grade_level),
      parsed.data.subject_id
    );

    const columnIds = Array.from(new Set(parsed.data.scores.map((s) => s.column_id)));
    if (columnIds.length > 0) {
      const { data: validCols } = await db
        .from('assessment_columns')
        .select('id')
        .eq('academic_year_id', activeYear.id)
        .eq('subject_id', parsed.data.subject_id)
        .eq('grade_level', classroom.grade_level)
        .eq('category', parsed.data.category)
        .in('id', columnIds);

      const validColSet = new Set((validCols || []).map((c) => c.id as string));
      if (columnIds.some((id) => !validColSet.has(id))) {
        return NextResponse.json(
          { error: 'Terdapat kolom penilaian yang tidak sesuai dengan mata pelajaran/tingkat kelas ini.' },
          { status: 400 }
        );
      }
    }

    const studentIds = Array.from(new Set(parsed.data.scores.map((s) => s.student_id)));
    if (studentIds.length > 0) {
      const { data: enrolledRows } = await db
        .from('student_enrollments')
        .select('student_id')
        .eq('classroom_id', parsed.data.classroom_id)
        .eq('academic_year_id', activeYear.id)
        .in('student_id', studentIds);
      const enrolledSet = new Set((enrolledRows || []).map((r) => r.student_id as string));
      if (studentIds.some((id) => !enrolledSet.has(id))) {
        return NextResponse.json(
          { error: 'Terdapat siswa yang tidak terdaftar di kelas ini pada tahun ajaran aktif.' },
          { status: 403 }
        );
      }
    }
    const { data: studentRows } =
      studentIds.length > 0
        ? await db.from('students').select('id, full_name').in('id', studentIds)
        : { data: [] };
    const nameMap = new Map((studentRows || []).map((s) => [s.id as string, String(s.full_name)]));

    for (const item of parsed.data.scores) {
      const errMsg = validateColumnScoreAgainstKkm(
        parsed.data.category,
        item.score,
        kkm.minScore,
        nameMap.get(item.student_id) || 'Siswa'
      );
      if (errMsg) {
        return NextResponse.json({ error: errMsg }, { status: 400 });
      }
    }

    const upserts = parsed.data.scores.map((s) => ({
      column_id: s.column_id,
      student_id: s.student_id,
      classroom_id: parsed.data.classroom_id,
      score: s.score,
      recorded_by: session.userId,
      updated_at: new Date().toISOString(),
    }));

    if (upserts.length > 0) {
      const { error } = await db
        .from('assessment_column_scores')
        .upsert(upserts, { onConflict: 'column_id,student_id' });
      if (error) {
        return NextResponse.json({ error: 'Gagal menyimpan nilai.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  }

  if (body?.action === 'SAVE_EXAM_SCORES') {
    const parsed = SaveExamScoresSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data nilai ujian tidak valid.' }, { status: 400 });
    }

    if (!hasEditPermission(session, parsed.data.subject_id, parsed.data.classroom_id)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki izin mengubah nilai pada kelas/mapel ini.' },
        { status: 403 }
      );
    }

    const { data: classroom } = await db
      .from('classrooms')
      .select('id, grade_level')
      .eq('id', parsed.data.classroom_id)
      .maybeSingle();

    if (!classroom) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
    }

    const kkm = await resolveEffectiveKkm(
      db,
      activeYear.id,
      String(classroom.grade_level),
      parsed.data.subject_id
    );

    const studentIds = Array.from(new Set(parsed.data.scores.map((s) => s.student_id)));
    if (studentIds.length > 0) {
      const { data: enrolledRows } = await db
        .from('student_enrollments')
        .select('student_id')
        .eq('classroom_id', parsed.data.classroom_id)
        .eq('academic_year_id', activeYear.id)
        .in('student_id', studentIds);
      const enrolledSet = new Set((enrolledRows || []).map((r) => r.student_id as string));
      if (studentIds.some((id) => !enrolledSet.has(id))) {
        return NextResponse.json(
          { error: 'Terdapat siswa yang tidak terdaftar di kelas ini pada tahun ajaran aktif.' },
          { status: 403 }
        );
      }
    }
    const { data: studentRows } =
      studentIds.length > 0
        ? await db.from('students').select('id, full_name').in('id', studentIds)
        : { data: [] };
    const nameMap = new Map((studentRows || []).map((s) => [s.id as string, String(s.full_name)]));

    for (const item of parsed.data.scores) {
      const errMsg = validateExamScoreAgainstKkm(
        item.score,
        item.remedial_score,
        item.enrichment_score,
        kkm.minScore,
        nameMap.get(item.student_id) || 'Siswa'
      );
      if (errMsg) {
        return NextResponse.json({ error: errMsg }, { status: 400 });
      }
    }

    if (parsed.data.config) {
      const { error: cfgErr } = await db.from('assessment_exam_configs').upsert(
        {
          academic_year_id: activeYear.id,
          subject_id: parsed.data.subject_id,
          grade_level: classroom.grade_level,
          exam_type: parsed.data.exam_type,
          enable_remedial: parsed.data.config.enable_remedial,
          enable_enrichment: parsed.data.config.enable_enrichment,
          enable_notes: parsed.data.config.enable_notes,
          updated_by: session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'academic_year_id,subject_id,grade_level,exam_type' }
      );
      if (cfgErr) {
        return NextResponse.json({ error: 'Gagal menyimpan pengaturan ujian.' }, { status: 500 });
      }
    }

    const upserts = parsed.data.scores.map((s) => ({
      academic_year_id: activeYear.id,
      subject_id: parsed.data.subject_id,
      classroom_id: parsed.data.classroom_id,
      student_id: s.student_id,
      exam_type: parsed.data.exam_type,
      score: s.score,
      remedial_score: s.remedial_score,
      enrichment_score: s.enrichment_score,
      notes: s.notes?.trim() || null,
      recorded_by: session.userId,
      updated_at: new Date().toISOString(),
    }));

    if (upserts.length > 0) {
      const { error } = await db
        .from('assessment_exam_scores')
        .upsert(upserts, { onConflict: 'academic_year_id,subject_id,classroom_id,student_id,exam_type' });
      if (error) {
        return NextResponse.json({ error: 'Gagal menyimpan nilai ujian.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
}
