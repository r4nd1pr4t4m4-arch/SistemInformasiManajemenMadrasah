import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getActiveAcademicYear } from '@/lib/domain/penilaian';

const CreateChapterSchema = z.object({
  subject_id: z.string().uuid(),
  grade_level: z.string().min(1),
  chapter_number: z.number().int().min(1).optional(),
  title: z.string().max(120).nullable().optional(),
});

const UpdateChapterSchema = z.object({
  id: z.string().uuid(),
  chapter_number: z.number().int().min(1).optional(),
  title: z.string().max(120).nullable().optional(),
});

function canManageSubjectGrade(
  session: NonNullable<Awaited<ReturnType<typeof requireApiRoles>>['session']>,
  subjectId: string,
  gradeLevel: string
): boolean {
  if (session.roles.includes('SUPERADMIN')) return true;
  const taught = session.teacherAssignments?.taughtSubjects || [];
  const match = taught.find((s) => s.subjectId === subjectId);
  if (!match) return false;
  return match.classrooms.some((c) => c.gradeLevel === gradeLevel);
}

export async function GET(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const gradeLevel = searchParams.get('gradeLevel');
  if (!subjectId || !gradeLevel) {
    return NextResponse.json({ error: 'subjectId dan gradeLevel wajib diisi.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const { data: chapters, error } = await db
    .from('assessment_chapters')
    .select('id, chapter_number, title, sort_order')
    .eq('academic_year_id', activeYear.id)
    .eq('subject_id', subjectId)
    .eq('grade_level', gradeLevel)
    .order('sort_order', { ascending: true })
    .order('chapter_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat daftar BAB.' }, { status: 500 });
  }

  return NextResponse.json({ chapters: chapters || [] });
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateChapterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data BAB tidak valid.' }, { status: 400 });
  }

  if (!canManageSubjectGrade(session, parsed.data.subject_id, parsed.data.grade_level)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki izin mengelola BAB untuk mata pelajaran & tingkat kelas ini.' },
      { status: 403 }
    );
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const { data: existing } = await db
    .from('assessment_chapters')
    .select('chapter_number, sort_order')
    .eq('academic_year_id', activeYear.id)
    .eq('subject_id', parsed.data.subject_id)
    .eq('grade_level', parsed.data.grade_level)
    .order('chapter_number', { ascending: false })
    .limit(1);

  const nextNum =
    parsed.data.chapter_number ??
    ((existing && existing[0] ? Number(existing[0].chapter_number) : 0) + 1);

  const { data: created, error } = await db
    .from('assessment_chapters')
    .insert({
      academic_year_id: activeYear.id,
      subject_id: parsed.data.subject_id,
      grade_level: parsed.data.grade_level,
      chapter_number: nextNum,
      title: parsed.data.title?.trim() || null,
      sort_order: nextNum,
      created_by: session.userId,
    })
    .select('id, chapter_number, title, sort_order')
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? `BAB ${nextNum} sudah ada.` : 'Gagal menambah BAB.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ chapter: created });
}

export async function PATCH(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = UpdateChapterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data pembaruan BAB tidak valid.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: chapter } = await db
    .from('assessment_chapters')
    .select('id, subject_id, grade_level')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!chapter) {
    return NextResponse.json({ error: 'BAB tidak ditemukan.' }, { status: 404 });
  }

  if (!canManageSubjectGrade(session, chapter.subject_id, chapter.grade_level)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.title !== undefined) {
    updatePayload.title = parsed.data.title?.trim() || null;
  }
  if (parsed.data.chapter_number !== undefined) {
    updatePayload.chapter_number = parsed.data.chapter_number;
    updatePayload.sort_order = parsed.data.chapter_number;
  }

  const { data: updated, error } = await db
    .from('assessment_chapters')
    .update(updatePayload)
    .eq('id', parsed.data.id)
    .select('id, chapter_number, title, sort_order')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Gagal memperbarui BAB.' }, { status: 400 });
  }

  return NextResponse.json({ chapter: updated });
}

export async function DELETE(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID BAB wajib diisi.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: chapter } = await db
    .from('assessment_chapters')
    .select('id, subject_id, grade_level')
    .eq('id', id)
    .maybeSingle();

  if (!chapter) {
    return NextResponse.json({ error: 'BAB tidak ditemukan.' }, { status: 404 });
  }

  if (!canManageSubjectGrade(session, chapter.subject_id, chapter.grade_level)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  const { error } = await db.from('assessment_chapters').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Gagal menghapus BAB.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
