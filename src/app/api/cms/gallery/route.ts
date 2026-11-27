import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';
import { toPublicMediaProxyUrl } from '@/lib/storage/r2-url-helper';

const GalleryCreateSchema = z.object({
  title: z.string().trim().min(2, 'Judul media minimal 2 karakter.'),
  media_type: z.enum(['FOTO', 'VIDEO_PROFIL', 'YOUTUBE']).default('FOTO'),
  media_url: z.string().trim().min(4, 'URL media wajib diisi.'),
  thumbnail_url: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  event_date: z.string().trim().optional().nullable(),
});

const GalleryUpdateSchema = GalleryCreateSchema.extend({
  id: z.string().uuid(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.CMS_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ items: [] });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('media_gallery')
    .select('*')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  const items = (data || []).map((item) => ({
    ...item,
    media_url: item.media_url ? toPublicMediaProxyUrl(item.media_url) : item.media_url,
    thumbnail_url: item.thumbnail_url ? toPublicMediaProxyUrl(item.thumbnail_url) : null,
  }));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = GalleryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data galeri tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('media_gallery')
      .insert({
        title: parsed.data.title,
        media_type: parsed.data.media_type,
        media_url: parsed.data.media_url,
        thumbnail_url: parsed.data.thumbnail_url || null,
        description: parsed.data.description || null,
        event_date: parsed.data.event_date || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menambahkan item galeri.' }, { status: 500 });
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
    const parsed = GalleryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pembaruan galeri tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('media_gallery')
      .update({
        title: parsed.data.title,
        media_type: parsed.data.media_type,
        media_url: parsed.data.media_url,
        thumbnail_url: parsed.data.thumbnail_url || null,
        description: parsed.data.description || null,
        event_date: parsed.data.event_date || null,
      })
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui item galeri.' }, { status: 500 });
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
  if (!id) return NextResponse.json({ error: 'ID galeri wajib diisi.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('media_gallery').delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
