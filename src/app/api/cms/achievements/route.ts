import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const AchievementCreateSchema = z.object({
  title: z.string().trim().min(3, 'Judul prestasi minimal 3 karakter.'),
  level: z.enum(['SEKOLAH', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL']),
  rank: z.string().trim().optional().nullable(),
  participant_name: z.string().trim().min(2, 'Nama peserta / tim wajib diisi.'),
  achieved_at: z.string().trim().min(4, 'Tanggal prestasi wajib diisi.'),
  organizer: z.string().trim().optional().nullable(),
  image_url: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

const AchievementUpdateSchema = AchievementCreateSchema.extend({
  id: z.string().uuid(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.CMS_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ achievements: [] });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('achieved_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ achievements: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = AchievementCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data prestasi tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('achievements')
      .insert({
        title: parsed.data.title,
        level: parsed.data.level,
        rank: parsed.data.rank || null,
        participant_name: parsed.data.participant_name,
        achieved_at: parsed.data.achieved_at,
        organizer: parsed.data.organizer || null,
        image_url: parsed.data.image_url || null,
        description: parsed.data.description || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ achievement: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menambahkan data prestasi.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = AchievementUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pembaruan prestasi tidak valid.' },
        { status: 400 }
      );
    }

    const { id, ...fields } = parsed.data;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('achievements')
      .update({
        title: fields.title,
        level: fields.level,
        rank: fields.rank || null,
        participant_name: fields.participant_name,
        achieved_at: fields.achieved_at,
        organizer: fields.organizer || null,
        image_url: fields.image_url || null,
        description: fields.description || null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ achievement: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui data prestasi.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID prestasi wajib diisi.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('achievements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
