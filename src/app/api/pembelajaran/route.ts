import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      isTeacher: false,
      studentId: null,
      materials: [],
      assignments: [],
      submissions: [],
      quizzes: [],
      attempts: [],
      subjects: [],
      classrooms: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const isTeacher = hasAnyRole(session, PERMISSIONS.PENILAIAN_TEACHER);

  let myStudentId: string | null = null;
  let myClassroomId: string | null = null;

  if (session.roles.includes('SISWA')) {
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

  const [matRes, asgRes, subRes, qzRes, attRes, subjRes, clsRes] = await Promise.all([
    supabase
      .from('lms_materials')
      .select('*, subject:subjects(id, name), classroom:classrooms(id, name), teacher:teachers_staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('lms_assignments')
      .select('*, subject:subjects(id, name), classroom:classrooms(id, name), teacher:teachers_staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('lms_submissions')
      .select('*, student:students(id, full_name, nis)')
      .order('submitted_at', { ascending: false })
      .limit(300),
    supabase
      .from('lms_quizzes')
      .select('*, subject:subjects(id, name), classroom:classrooms(id, name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('lms_quiz_attempts')
      .select('*, student:students(id, full_name, nis)')
      .order('submitted_at', { ascending: false })
      .limit(300),
    supabase.from('subjects').select('id, name, code').order('name'),
    supabase.from('classrooms').select('id, name, grade_level').order('name'),
  ]);

  let materials = matRes.error ? [] : matRes.data || [];
  let assignments = asgRes.error ? [] : asgRes.data || [];
  let submissions = subRes.error ? [] : subRes.data || [];
  let quizzes = qzRes.error ? [] : qzRes.data || [];
  let attempts = attRes.error ? [] : attRes.data || [];

  if (!isTeacher && myStudentId) {
    if (myClassroomId) {
      materials = materials.filter((m) => !m.classroom_id || m.classroom_id === myClassroomId);
      assignments = assignments.filter((a) => a.classroom_id === myClassroomId);
      quizzes = quizzes.filter((q) => q.is_published && q.classroom_id === myClassroomId);
    }
    submissions = submissions.filter((s) => s.student_id === myStudentId);
    attempts = attempts.filter((a) => a.student_id === myStudentId);
  }

  return NextResponse.json({
    isTeacher,
    studentId: myStudentId,
    materials,
    assignments,
    submissions,
    quizzes,
    attempts,
    subjects: subjRes.data || [],
    classrooms: clsRes.data || [],
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const isTeacher = hasAnyRole(session, PERMISSIONS.PENILAIAN_TEACHER);
  const teacherId = session.teacherAssignments?.teacherId || null;
  const supabase = createSupabaseAdminClient();

  try {
    const body = await request.json();

    if (body.action === 'CREATE_MATERIAL') {
      if (!isTeacher) return NextResponse.json({ error: 'Hanya guru/admin yang dapat menambah materi.' }, { status: 403 });
      const p = z
        .object({
          subject_id: z.string().uuid(),
          classroom_id: z.string().uuid().optional().nullable(),
          title: z.string().trim().min(3),
          chapter_label: z.string().optional().nullable(),
          material_type: z.enum(['MODUL_PDF', 'VIDEO', 'LINK', 'CATATAN']).default('MODUL_PDF'),
          file_url: z.string().optional().nullable(),
          content: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data materi tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('lms_materials')
        .insert({
          ...p.data,
          classroom_id: p.data.classroom_id || null,
          teacher_id: teacherId,
          created_by: session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ material: data });
    }

    if (body.action === 'CREATE_ASSIGNMENT') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z
        .object({
          subject_id: z.string().uuid(),
          classroom_id: z.string().uuid(),
          title: z.string().trim().min(3),
          description: z.string().optional().nullable(),
          due_at: z.string().optional().nullable(),
          max_score: z.number().min(1).max(100).default(100),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data tugas tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('lms_assignments')
        .insert({
          ...p.data,
          due_at: p.data.due_at || null,
          teacher_id: teacherId,
          created_by: session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ assignment: data });
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
          score: z.number().min(0).max(100),
          teacher_feedback: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Nilai tidak valid.' }, { status: 400 });

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

    if (body.action === 'CREATE_QUIZ') {
      if (!isTeacher) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      const p = z
        .object({
          subject_id: z.string().uuid(),
          classroom_id: z.string().uuid(),
          title: z.string().trim().min(3),
          duration_minutes: z.number().int().min(5).max(180).default(30),
          questions: z
            .array(
              z.object({
                question: z.string().min(2),
                options: z.array(z.string().min(1)).min(2).max(5),
                correctIndex: z.number().int().min(0).max(4),
              })
            )
            .min(1, 'Minimal 1 soal wajib diisi.'),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data kuis CBT tidak valid.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('lms_quizzes')
        .insert({
          ...p.data,
          teacher_id: teacherId,
          is_published: true,
          created_by: session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ quiz: data });
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
