import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  getActiveAcademicYear,
  DEFAULT_KKM_SCORE,
  sortGradeLevelsAsc,
} from '@/lib/domain/penilaian';

const UpdateModeSchema = z.object({
  action: z.literal('UPDATE_MODE'),
  active_mode: z.enum(['PER_GRADE', 'PER_SUBJECT_GRADE']),
});

const UpsertRulesSchema = z.object({
  action: z.literal('UPSERT_RULES'),
  rules: z
    .array(
      z.object({
        grade_level: z.string().min(1),
        subject_id: z.string().uuid().nullable().optional(),
        min_score: z.number().min(0).max(100),
      })
    )
    .min(1),
});

export async function GET() {
  const { errorResponse } = await requireApiRoles(PERMISSIONS.KKM_VIEW);
  if (errorResponse) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const [{ data: setting }, { data: rules }, { data: classrooms }, { data: subjects }] =
    await Promise.all([
      db
        .from('kkm_settings')
        .select('active_mode')
        .eq('academic_year_id', activeYear.id)
        .maybeSingle(),
      db
        .from('kkm_rules')
        .select('id, grade_level, subject_id, min_score')
        .eq('academic_year_id', activeYear.id),
      db
        .from('classrooms')
        .select('grade_level')
        .eq('academic_year_id', activeYear.id),
      db.from('subjects').select('id, code, name, subject_group').order('name', { ascending: true }),
    ]);

  const gradeLevels = sortGradeLevelsAsc(
    Array.from(
      new Set((classrooms || []).map((c) => String(c.grade_level || '').trim()).filter(Boolean))
    )
  );

  return NextResponse.json({
    academicYear: activeYear,
    activeMode: setting?.active_mode === 'PER_SUBJECT_GRADE' ? 'PER_SUBJECT_GRADE' : 'PER_GRADE',
    defaultScore: DEFAULT_KKM_SCORE,
    gradeLevels,
    subjects: subjects || [],
    rules: (rules || []).map((r) => ({
      id: r.id,
      grade_level: r.grade_level,
      subject_id: r.subject_id,
      min_score: Number(r.min_score),
    })),
  });
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.KKM_MANAGE);
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

  if (body?.action === 'UPDATE_MODE') {
    const parsed = UpdateModeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Mode KKM tidak valid.' }, { status: 400 });
    }

    const { error } = await db.from('kkm_settings').upsert(
      {
        academic_year_id: activeYear.id,
        active_mode: parsed.data.active_mode,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'academic_year_id' }
    );

    if (error) {
      return NextResponse.json({ error: 'Gagal menyimpan mode KKM.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, activeMode: parsed.data.active_mode });
  }

  if (body?.action === 'UPSERT_RULES') {
    const parsed = UpsertRulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data aturan KKM tidak valid.' }, { status: 400 });
    }

    for (const rule of parsed.data.rules) {
      const subjectId = rule.subject_id ?? null;
      let existingQuery = db
        .from('kkm_rules')
        .select('id')
        .eq('academic_year_id', activeYear.id)
        .eq('grade_level', rule.grade_level);

      existingQuery = subjectId
        ? existingQuery.eq('subject_id', subjectId)
        : existingQuery.is('subject_id', null);

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        const { error } = await db
          .from('kkm_rules')
          .update({
            min_score: rule.min_score,
            updated_by: session.userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) {
          return NextResponse.json({ error: 'Gagal memperbarui aturan KKM.' }, { status: 500 });
        }
      } else {
        const { error } = await db.from('kkm_rules').insert({
          academic_year_id: activeYear.id,
          grade_level: rule.grade_level,
          subject_id: subjectId,
          min_score: rule.min_score,
          updated_by: session.userId,
        });
        if (error) {
          return NextResponse.json({ error: 'Gagal menyimpan aturan KKM.' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
}
