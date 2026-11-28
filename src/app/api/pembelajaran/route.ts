import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { decimalNumber } from '@/lib/validation/decimal-schema';
import { getCurrentUserWithRoles, hasAnyRole, type AuthenticatedSession } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';

interface ScopedOption {
  id: string;
  name: string;
}

interface TeacherLmsScope {
  teacherId: string | null;
  pairKeys: Set<string>;
  subjects: ScopedOption[];
  classrooms: ScopedOption[];
  classroomsBySubject: Record<string, ScopedOption[]>;
}

const FORBIDDEN_SCOPE_MSG =
  'Anda hanya dapat melihat dan mengelola mata pelajaran serta rombel yang Anda ajar sesuai jadwal mengajar.';

function makePairKey(subjectId: string | null | undefined, classroomId: string | null | undefined): string {
  return `${subjectId || ''}:${classroomId || ''}`;
}

function isAllowedPair(
  scope: TeacherLmsScope,
  subjectId: string | null | undefined,
  classroomId: string | null | undefined
): boolean {
  if (!subjectId || !classroomId) return false;
  return scope.pairKeys.has(makePairKey(subjectId, classroomId));
}

async function getTeacherLmsScope(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  session: AuthenticatedSession
): Promise<TeacherLmsScope> {
  const teacherId = session.teacherAssignments?.teacherId || null;
  const pairKeys = new Set<string>();
  const subjectMap = new Map<string, string>();
  const classroomMap = new Map<string, string>();
  const classroomsBySubjectMap = new Map<string, Map<string, string>>();

  const addPair = (
    subjectId: string | null | undefined,
    subjectName: string | null | undefined,
    classroomId: string | null | undefined,
    classroomName: string | null | undefined
  ) => {
    if (!subjectId || !classroomId) return;
    pairKeys.add(makePairKey(subjectId, classroomId));
    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, subjectName || 'Mapel');
    }
    if (!classroomMap.has(classroomId)) {
      classroomMap.set(classroomId, classroomName || 'Rombel');
    }
    let subjClassrooms = classroomsBySubjectMap.get(subjectId);
    if (!subjClassrooms) {
      subjClassrooms = new Map<string, string>();
      classroomsBySubjectMap.set(subjectId, subjClassrooms);
    }
    if (!subjClassrooms.has(classroomId)) {
      subjClassrooms.set(classroomId, classroomName || 'Rombel');
    }
  };

  // Fast path: gunakan taughtSubjects yang sudah di-load oleh session
  const sessionTaught = session.teacherAssignments?.taughtSubjects || [];
  if (sessionTaught.length > 0) {
    for (const subj of sessionTaught) {
      for (const cls of subj.classrooms || []) {
        addPair(subj.subjectId, subj.subjectName, cls.id, cls.name);
      }
    }
  } else if (teacherId) {
    // Fallback jika tahun ajaran aktif belum disetel pada session
    const { data: activeYearRow } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    let schedulesQuery = supabase
      .from('schedules')
      .select('subject_id, classroom_id, subject:subjects(id, name), classroom:classrooms(id, name)')
      .eq('teacher_id', teacherId);

    if (activeYearRow?.id) {
      schedulesQuery = schedulesQuery.eq('academic_year_id', activeYearRow.id);
    }

    const { data: scheduleRows } = await schedulesQuery;
    for (const row of scheduleRows || []) {
      const sub = Array.isArray(row.subject) ? row.subject[0] : row.subject;
      const cls = Array.isArray(row.classroom) ? row.classroom[0] : row.classroom;
      addPair(
        (sub?.id as string | undefined) || (row.subject_id as string | undefined),
        (sub?.name as string | undefined) || 'Mapel',
        (cls?.id as string | undefined) || (row.classroom_id as string | undefined),
        (cls?.name as string | undefined) || 'Rombel'
      );
    }
  }

  const sortByName = (a: ScopedOption, b: ScopedOption) => a.name.localeCompare(b.name, 'id');
  const subjects = Array.from(subjectMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort(sortByName);
  const classrooms = Array.from(classroomMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort(sortByName);

  const classroomsBySubject: Record<string, ScopedOption[]> = {};
  for (const [subjId, clsMap] of classroomsBySubjectMap.entries()) {
    classroomsBySubject[subjId] = Array.from(clsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort(sortByName);
  }

  return {
    teacherId,
    pairKeys,
    subjects,
    classrooms,
    classroomsBySubject,
  };
}

const materialPayloadSchema = z.object({
  subject_id: z.string().uuid('Mata pelajaran wajib dipilih.'),
  classroom_id: z.string().uuid('Rombel wajib dipilih.'),
  title: z.string().trim().min(3, 'Judul materi minimal 3 karakter.'),
  chapter_label: z.string().optional().nullable(),
  material_type: z.enum(['MODUL_PDF', 'VIDEO', 'LINK', 'CATATAN']).default('MODUL_PDF'),
  file_url: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val || !val.trim()) return true;
        const trimmed = val.trim();
        return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
      },
      { message: 'URL file/tautan harus diawali http://, https://, atau /.' }
    ),
  content: z.string().optional().nullable(),
});

const assignmentPayloadSchema = z.object({
  subject_id: z.string().uuid('Mata pelajaran wajib dipilih.'),
  classroom_id: z.string().uuid('Rombel wajib dipilih.'),
  title: z.string().trim().min(3, 'Judul tugas minimal 3 karakter.'),
  description: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
  max_score: decimalNumber({ min: 1, max: 100, maxDecimals: 2, label: 'Nilai maksimal' }).default(100),
});

const quizPayloadSchema = z.object({
  subject_id: z.string().uuid('Mata pelajaran wajib dipilih.'),
  classroom_id: z.string().uuid('Rombel wajib dipilih.'),
  title: z.string().trim().min(3, 'Judul kuis CBT minimal 3 karakter.'),
  duration_minutes: z.number().int().min(5).max(180).default(30),
  questions: z
    .array(
      z
        .object({
          question: z.string().trim().min(2, 'Teks pertanyaan minimal 2 karakter.'),
          options: z.array(z.string().trim().min(1)).min(2, 'Minimal 2 pilihan jawaban.').max(5),
          correctIndex: z.number().int().min(0).max(4),
        })
        .refine((q) => q.correctIndex < q.options.length, {
          message: 'Kunci jawaban harus sesuai dengan pilihan yang tersedia.',
        })
    )
    .min(1, 'Minimal 1 soal wajib diisi.'),
});

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      isTeacher: false,
      hasTeachingSchedule: false,
      studentId: null,
      materials: [],
      assignments: [],
      submissions: [],
      quizzes: [],
      attempts: [],
      subjects: [],
      classrooms: [],
      classroomsBySubject: {},
    });
  }

  const supabase = createSupabaseAdminClient();
  const isTeacher = hasAnyRole(session, PERMISSIONS.PENILAIAN_TEACHER);

  let myStudentId: string | null = null;
  let myClassroomId: string | null = null;

  if (!isTeacher && session.roles.includes('SISWA')) {
    const { data: st } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', session.userId)
      .maybeSingle();
    if (st?.id) {
      myStudentId = st.id;
      const { data: enr } = await supabase
        .from('student_enrollments')
        .select('classroom_id')
        .eq('student_id', st.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      myClassroomId = enr?.classroom_id || null;
    }
  }

  const [matRes, asgRes, subRes, qzRes, attRes, subjRes, clsRes, teacherScope] = await Promise.all([
    supabase
      .from('lms_materials')
      .select('*, subject:subjects(id, name), classroom:classrooms(id, name), teacher:teachers_staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('lms_assignments')
      .select('*, subject:subjects(id, name), classroom:classrooms(id, name), teacher:teachers_staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('lms_submissions')
      .select('*, student:students(id, full_name, nis)')
      .order('submitted_at', { ascending: false })
      .limit(400),
    supabase
      .from('lms_quizzes')
      .select('*, subject:subjects(id, name), classroom:classrooms(id, name)')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('lms_quiz_attempts')
      .select('*, student:students(id, full_name, nis)')
      .order('submitted_at', { ascending: false })
      .limit(400),
    isTeacher
      ? Promise.resolve({ data: [] as ScopedOption[] })
      : supabase.from('subjects').select('id, name, code').order('name'),
    isTeacher
      ? Promise.resolve({ data: [] as ScopedOption[] })
      : supabase.from('classrooms').select('id, name, grade_level').order('name'),
    isTeacher ? getTeacherLmsScope(supabase, session) : Promise.resolve(null),
  ]);

  let materials = matRes.error ? [] : matRes.data || [];
  let assignments = asgRes.error ? [] : asgRes.data || [];
  let submissions = subRes.error ? [] : subRes.data || [];
  let quizzes = qzRes.error ? [] : qzRes.data || [];
  let attempts = attRes.error ? [] : attRes.data || [];

  if (isTeacher && teacherScope) {
    // Setiap guru (termasuk guru dengan tugas tambahan admin) hanya boleh melihat
    // materi, tugas, dan kuis CBT untuk pasangan (mata pelajaran, rombel) yang ia ajar saja.
    materials = materials.filter((m) => isAllowedPair(teacherScope, m.subject_id, m.classroom_id));
    assignments = assignments.filter((a) => isAllowedPair(teacherScope, a.subject_id, a.classroom_id));
    quizzes = quizzes.filter((q) => isAllowedPair(teacherScope, q.subject_id, q.classroom_id));

    const allowedAssignmentIds = new Set(assignments.map((a) => a.id as string));
    const allowedQuizIds = new Set(quizzes.map((q) => q.id as string));
    submissions = submissions.filter((s) => allowedAssignmentIds.has(s.assignment_id as string));
    attempts = attempts.filter((a) => allowedQuizIds.has(a.quiz_id as string));
  } else if (!isTeacher && myStudentId) {
    if (myClassroomId) {
      materials = materials.filter((m) => !m.classroom_id || m.classroom_id === myClassroomId);
      assignments = assignments.filter((a) => a.classroom_id === myClassroomId);
      quizzes = quizzes.filter((q) => q.is_published && q.classroom_id === myClassroomId);
    }
    submissions = submissions.filter((s) => s.student_id === myStudentId);
    attempts = attempts.filter((a) => a.student_id === myStudentId);
  }

  // Keamanan CBT: jangan kirim kunci jawaban (correctIndex) ke akun non-guru/siswa
  if (!isTeacher) {
    quizzes = quizzes.map((q) => ({
      ...q,
      questions: Array.isArray(q.questions)
        ? q.questions.map((item: Record<string, unknown>) => ({
            question: item?.question ?? '',
            options: Array.isArray(item?.options) ? item.options : [],
          }))
        : [],
    }));
  }

  return NextResponse.json({
    isTeacher,
    hasTeachingSchedule: Boolean(teacherScope && teacherScope.pairKeys.size > 0),
    studentId: myStudentId,
    materials,
    assignments,
    submissions,
    quizzes,
    attempts,
    subjects: isTeacher && teacherScope ? teacherScope.subjects : subjRes.data || [],
    classrooms: isTeacher && teacherScope ? teacherScope.classrooms : clsRes.data || [],
    classroomsBySubject: isTeacher && teacherScope ? teacherScope.classroomsBySubject : {},
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const isTeacher = hasAnyRole(session, PERMISSIONS.PENILAIAN_TEACHER);
  const supabase = createSupabaseAdminClient();

  try {
    const body = await request.json();

    // ==================== MATERI ====================
    if (body.action === 'CREATE_MATERIAL') {
      if (!isTeacher) return NextResponse.json({ error: 'Hanya guru yang dapat menambah materi.' }, { status: 403 });
      const p = materialPayloadSchema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data materi tidak valid.' },
          { status: 400 }
        );
      }

      const teacherScope = await getTeacherLmsScope(supabase, session);
      if (!isAllowedPair(teacherScope, p.data.subject_id, p.data.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('lms_materials')
        .insert({
          ...p.data,
          file_url: p.data.file_url?.trim() || null,
          content: p.data.content?.trim() || null,
          chapter_label: p.data.chapter_label?.trim() || null,
          teacher_id: teacherScope.teacherId,
          created_by: session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ material: data });
    }

    if (body.action === 'UPDATE_MATERIAL') {
      if (!isTeacher) return NextResponse.json({ error: 'Hanya guru yang dapat memperbarui materi.' }, { status: 403 });
      const p = materialPayloadSchema.extend({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan materi tidak valid.' },
          { status: 400 }
        );
      }

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existing } = await supabase
        .from('lms_materials')
        .select('id, subject_id, classroom_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 });

      if (
        !isAllowedPair(teacherScope, existing.subject_id, existing.classroom_id) ||
        !isAllowedPair(teacherScope, p.data.subject_id, p.data.classroom_id)
      ) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { id, ...rest } = p.data;
      const { data, error } = await supabase
        .from('lms_materials')
        .update({
          ...rest,
          file_url: rest.file_url?.trim() || null,
          content: rest.content?.trim() || null,
          chapter_label: rest.chapter_label?.trim() || null,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ material: data });
    }

    if (body.action === 'DELETE_MATERIAL') {
      if (!isTeacher) return NextResponse.json({ error: 'Hanya guru yang dapat menghapus materi.' }, { status: 403 });
      const p = z.object({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'ID materi tidak valid.' }, { status: 400 });

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existing } = await supabase
        .from('lms_materials')
        .select('id, subject_id, classroom_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 });

      if (!isAllowedPair(teacherScope, existing.subject_id, existing.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { error } = await supabase.from('lms_materials').delete().eq('id', p.data.id);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ deleted: true, id: p.data.id });
    }

    // ==================== TUGAS ====================
    if (body.action === 'CREATE_ASSIGNMENT') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = assignmentPayloadSchema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data tugas tidak valid.' },
          { status: 400 }
        );
      }

      const teacherScope = await getTeacherLmsScope(supabase, session);
      if (!isAllowedPair(teacherScope, p.data.subject_id, p.data.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('lms_assignments')
        .insert({
          ...p.data,
          description: p.data.description?.trim() || null,
          due_at: p.data.due_at || null,
          teacher_id: teacherScope.teacherId,
          created_by: session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ assignment: data });
    }

    if (body.action === 'UPDATE_ASSIGNMENT') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = assignmentPayloadSchema.extend({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan tugas tidak valid.' },
          { status: 400 }
        );
      }

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existing } = await supabase
        .from('lms_assignments')
        .select('id, subject_id, classroom_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });

      if (
        !isAllowedPair(teacherScope, existing.subject_id, existing.classroom_id) ||
        !isAllowedPair(teacherScope, p.data.subject_id, p.data.classroom_id)
      ) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { id, ...rest } = p.data;
      const { data, error } = await supabase
        .from('lms_assignments')
        .update({
          ...rest,
          description: rest.description?.trim() || null,
          due_at: rest.due_at || null,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ assignment: data });
    }

    if (body.action === 'DELETE_ASSIGNMENT') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z.object({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'ID tugas tidak valid.' }, { status: 400 });

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existing } = await supabase
        .from('lms_assignments')
        .select('id, subject_id, classroom_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });

      if (!isAllowedPair(teacherScope, existing.subject_id, existing.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { error } = await supabase.from('lms_assignments').delete().eq('id', p.data.id);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ deleted: true, id: p.data.id });
    }

    if (body.action === 'SUBMIT_ASSIGNMENT') {
      const p = z
        .object({
          assignment_id: z.string().uuid(),
          submission_text: z.string().optional().nullable(),
          attachment_url: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data pengumpulan tugas tidak valid.' }, { status: 400 });

      const { data: st } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', session.userId)
        .maybeSingle();
      if (!st?.id) return NextResponse.json({ error: 'Profil siswa tidak ditemukan.' }, { status: 400 });

      const { data, error } = await supabase
        .from('lms_submissions')
        .upsert(
          {
            assignment_id: p.data.assignment_id,
            student_id: st.id,
            submission_text: p.data.submission_text || null,
            attachment_url: p.data.attachment_url || null,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'assignment_id,student_id' }
        )
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ submission: data });
    }

    if (body.action === 'GRADE_SUBMISSION') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z
        .object({
          submission_id: z.string().uuid(),
          score: decimalNumber({ min: 0, max: 100, maxDecimals: 2, label: 'Nilai tugas' }),
          teacher_feedback: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Nilai tidak valid.' }, { status: 400 });

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existingSub } = await supabase
        .from('lms_submissions')
        .select('id, assignment:lms_assignments(subject_id, classroom_id)')
        .eq('id', p.data.submission_id)
        .maybeSingle();
      if (!existingSub) return NextResponse.json({ error: 'Pengumpulan tugas tidak ditemukan.' }, { status: 404 });

      const parentAsg = Array.isArray(existingSub.assignment)
        ? existingSub.assignment[0]
        : existingSub.assignment;
      if (!isAllowedPair(teacherScope, parentAsg?.subject_id, parentAsg?.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('lms_submissions')
        .update({
          score: p.data.score,
          teacher_feedback: p.data.teacher_feedback || null,
          graded_at: new Date().toISOString(),
          graded_by: session.userId,
        })
        .eq('id', p.data.submission_id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ submission: data });
    }

    // ==================== KUIS CBT ====================
    if (body.action === 'CREATE_QUIZ') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = quizPayloadSchema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data kuis CBT tidak valid.' },
          { status: 400 }
        );
      }

      const teacherScope = await getTeacherLmsScope(supabase, session);
      if (!isAllowedPair(teacherScope, p.data.subject_id, p.data.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('lms_quizzes')
        .insert({
          ...p.data,
          teacher_id: teacherScope.teacherId,
          is_published: true,
          created_by: session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ quiz: data });
    }

    if (body.action === 'UPDATE_QUIZ') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = quizPayloadSchema.extend({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan kuis CBT tidak valid.' },
          { status: 400 }
        );
      }

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existing } = await supabase
        .from('lms_quizzes')
        .select('id, subject_id, classroom_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Kuis CBT tidak ditemukan.' }, { status: 404 });

      if (
        !isAllowedPair(teacherScope, existing.subject_id, existing.classroom_id) ||
        !isAllowedPair(teacherScope, p.data.subject_id, p.data.classroom_id)
      ) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { id, ...rest } = p.data;
      const { data, error } = await supabase
        .from('lms_quizzes')
        .update({
          ...rest,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ quiz: data });
    }

    if (body.action === 'DELETE_QUIZ') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z.object({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'ID kuis CBT tidak valid.' }, { status: 400 });

      const teacherScope = await getTeacherLmsScope(supabase, session);
      const { data: existing } = await supabase
        .from('lms_quizzes')
        .select('id, subject_id, classroom_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Kuis CBT tidak ditemukan.' }, { status: 404 });

      if (!isAllowedPair(teacherScope, existing.subject_id, existing.classroom_id)) {
        return NextResponse.json({ error: FORBIDDEN_SCOPE_MSG }, { status: 403 });
      }

      const { error } = await supabase.from('lms_quizzes').delete().eq('id', p.data.id);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ deleted: true, id: p.data.id });
    }

    if (body.action === 'SUBMIT_QUIZ_ATTEMPT') {
      const p = z
        .object({
          quiz_id: z.string().uuid(),
          answers: z.record(z.string(), z.number().int().min(0).max(4)),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Jawaban kuis tidak valid.' }, { status: 400 });

      const { data: st } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', session.userId)
        .maybeSingle();
      if (!st?.id) return NextResponse.json({ error: 'Hanya akun siswa yang dapat mengerjakan CBT.' }, { status: 400 });

      const { data: quiz } = await supabase
        .from('lms_quizzes')
        .select('id, questions')
        .eq('id', p.data.quiz_id)
        .single();
      if (!quiz) return NextResponse.json({ error: 'Kuis tidak ditemukan.' }, { status: 404 });

      const questions = Array.isArray(quiz.questions)
        ? (quiz.questions as Array<{ correctIndex: number }>)
        : [];
      let correctCount = 0;
      questions.forEach((q, idx) => {
        if (p.data.answers[String(idx)] === q.correctIndex) correctCount += 1;
      });
      const total = questions.length;
      const score = total > 0 ? Math.round((correctCount / total) * 1000) / 10 : 0;

      const { data, error } = await supabase
        .from('lms_quiz_attempts')
        .upsert(
          {
            quiz_id: quiz.id,
            student_id: st.id,
            answers: p.data.answers,
            correct_count: correctCount,
            total_questions: total,
            score,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'quiz_id,student_id' }
        )
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ attempt: data });
    }

    return NextResponse.json({ error: 'Aksi LMS tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan LMS.' }, { status: 500 });
  }
}
