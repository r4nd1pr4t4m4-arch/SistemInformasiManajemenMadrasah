import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  formatAutoColumnLabel,
  getActiveAcademicYear,
  type AssessmentCategory,
} from '@/lib/domain/penilaian';

const CreateColumnSchema = z.object({
  subject_id: z.string().uuid(),
  grade_level: z.string().min(1),
  category: z.enum(['FORMATIF', 'SUMATIF', 'PRAKTIK']),
  chapter_id: z.string().uuid().nullable().optional(),
  naming_mode: z.enum(['AUTO', 'CUSTOM']).default('AUTO'),
  label: z.string().max(80).optional(),
});

const UpdateColumnSchema = z.object({
  id: z.string().uuid(),
  naming_mode: z.enum(['AUTO', 'CUSTOM']),
  label: z.string().min(1).max(80).optional(),
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

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateColumnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data kolom penilaian tidak valid.' }, { status: 400 });
  }

  if (parsed.data.category === 'FORMATIF' && !parsed.data.chapter_id) {
    return NextResponse.json(
      { error: 'Kolom Formatif harus terikat ke suatu BAB.' },
      { status: 400 }
    );
  }

  if (!canManageSubjectGrade(session, parsed.data.subject_id, parsed.data.grade_level)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  let existingQuery = db
    .from('assessment_columns')
    .select('id, sort_order')
    .eq('academic_year_id', activeYear.id)
    .eq('subject_id', parsed.data.subject_id)
    .eq('grade_level', parsed.data.grade_level)
    .eq('category', parsed.data.category);

  existingQuery = parsed.data.chapter_id
    ? existingQuery.eq('chapter_id', parsed.data.chapter_id)
    : existingQuery.is('chapter_id', null);

  const { data: existingCols } = await existingQuery.order('sort_order', { ascending: true });
  const nextOrder = (existingCols?.length || 0) + 1;

  const resolvedLabel =
    parsed.data.naming_mode === 'CUSTOM' && parsed.data.label?.trim()
      ? parsed.data.label.trim()
      : formatAutoColumnLabel(parsed.data.category as AssessmentCategory, nextOrder);

  const { data: created, error } = await db
    .from('assessment_columns')
    .insert({
      academic_year_id: activeYear.id,
      subject_id: parsed.data.subject_id,
      grade_level: parsed.data.grade_level,
      category: parsed.data.category,
      chapter_id: parsed.data.category === 'FORMATIF' ? parsed.data.chapter_id : null,
      naming_mode: parsed.data.naming_mode,
      label: resolvedLabel,
      sort_order: nextOrder,
      created_by: session.userId,
    })
    .select('id, category, chapter_id, naming_mode, label, sort_order')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Gagal menambahkan kolom penilaian.' }, { status: 500 });
  }

  return NextResponse.json({ column: created });
}

export async function PATCH(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = UpdateColumnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data pembaruan kolom tidak valid.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: col } = await db
    .from('assessment_columns')
    .select('id, subject_id, grade_level, category, sort_order')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!col) {
    return NextResponse.json({ error: 'Kolom tidak ditemukan.' }, { status: 404 });
  }

  if (!canManageSubjectGrade(session, col.subject_id, col.grade_level)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  const nextLabel =
    parsed.data.naming_mode === 'AUTO'
      ? formatAutoColumnLabel(col.category as AssessmentCategory, Number(col.sort_order))
      : parsed.data.label?.trim() ||
        formatAutoColumnLabel(col.category as AssessmentCategory, Number(col.sort_order));

  const { data: updated, error } = await db
    .from('assessment_columns')
    .update({
      naming_mode: parsed.data.naming_mode,
      label: nextLabel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .select('id, category, chapter_id, naming_mode, label, sort_order')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Gagal memperbarui kolom.' }, { status: 500 });
  }

  return NextResponse.json({ column: updated });
}

export async function DELETE(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_TEACHER);
  if (errorResponse || !session) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID kolom wajib diisi.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: col } = await db
    .from('assessment_columns')
    .select('id, academic_year_id, subject_id, grade_level, category, chapter_id')
    .eq('id', id)
    .maybeSingle();

  if (!col) {
    return NextResponse.json({ error: 'Kolom tidak ditemukan.' }, { status: 404 });
  }

  if (!canManageSubjectGrade(session, col.subject_id, col.grade_level)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  const { error } = await db.from('assessment_columns').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Gagal menghapus kolom.' }, { status: 500 });
  }

  // Re-sequence remaining columns and update AUTO labels
  let remQuery = db
    .from('assessment_columns')
    .select('id, naming_mode, sort_order')
    .eq('academic_year_id', col.academic_year_id)
    .eq('subject_id', col.subject_id)
    .eq('grade_level', col.grade_level)
    .eq('category', col.category);

  remQuery = col.chapter_id ? remQuery.eq('chapter_id', col.chapter_id) : remQuery.is('chapter_id', null);

  const { data: remaining } = await remQuery.order('sort_order', { ascending: true });
  for (let i = 0; i < (remaining || []).length; i++) {
    const item = remaining![i];
    const newOrder = i + 1;
    const updateData: Record<string, unknown> = { sort_order: newOrder };
    if (item.naming_mode === 'AUTO') {
      updateData.label = formatAutoColumnLabel(col.category as AssessmentCategory, newOrder);
    }
    await db.from('assessment_columns').update(updateData).eq('id', item.id);
  }

  return NextResponse.json({ success: true });
}
