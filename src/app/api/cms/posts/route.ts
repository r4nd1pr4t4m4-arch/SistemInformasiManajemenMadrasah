import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyCmsPostPublished } from '@/lib/notifications/event-hooks';

const CreatePostSchema = z.object({
  title: z.string().min(4),
  category: z.enum(['BERITA', 'ARTIKEL', 'PENGUMUMAN', 'KARYA_GURU', 'KARYA_SISWA']),
  excerpt: z.string().optional().default(''),
  content: z.string().min(10),
  cover_image_url: z.string().optional().nullable(),
  author_display_name: z.string().optional().default('Admin CMS'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
});

const UpdatePostSchema = CreatePostSchema.extend({
  id: z.string().uuid(),
});

function toSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${base}-${Date.now().toString().slice(-5)}`;
}

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ posts: [] });
  }

  const session = await getCurrentUserWithRoles();
  const canViewAll = hasAnyRole(session, PERMISSIONS.CMS_VIEW);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!canViewAll) {
    query = query.eq('status', 'PUBLISHED');
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ posts: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data artikel tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('posts')
      .insert({
        ...parsed.data,
        slug: toSlug(parsed.data.title),
        published_at:
          parsed.data.status === 'PUBLISHED' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    if (data && data.status === 'PUBLISHED') {
      await notifyCmsPostPublished({
        postId: data.id,
        title: data.title,
        slug: data.slug,
        category: data.category,
        createdBy: guard.session.userId,
      });
    }
    return NextResponse.json({ post: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan artikel.' }, { status: 500 });
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
    const parsed = UpdatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data pembaruan artikel tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...fields } = parsed.data;
    const supabase = createSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('posts')
      .select('status, published_at')
      .eq('id', id)
      .maybeSingle();

    const becomingPublished =
      fields.status === 'PUBLISHED' && (!existing || existing.status !== 'PUBLISHED');

    const { data, error } = await supabase
      .from('posts')
      .update({
        ...fields,
        published_at:
          fields.status === 'PUBLISHED'
            ? existing?.published_at || new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    if (data && becomingPublished) {
      await notifyCmsPostPublished({
        postId: data.id,
        title: data.title,
        slug: data.slug,
        category: data.category,
        createdBy: guard.session.userId,
      });
    }
    return NextResponse.json({ post: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui artikel.' }, { status: 500 });
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
  if (!id) {
    return NextResponse.json({ error: 'ID artikel wajib diisi.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
