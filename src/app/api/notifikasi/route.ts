import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const MarkReadSchema = z.object({
  id: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100);
  const onlyUnread = url.searchParams.get('unread') === '1';
  const categoryKey = url.searchParams.get('category') || '';

  const db = createSupabaseAdminClient();

  let listQuery = db
    .from('in_app_notifications')
    .select('id, user_id, category_key, campaign_id, title, body, url, is_read, read_at, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (onlyUnread) {
    listQuery = listQuery.eq('is_read', false);
  }
  if (categoryKey) {
    listQuery = listQuery.eq('category_key', categoryKey);
  }

  const [{ data: items, error }, { count: unreadCount }] = await Promise.all([
    listQuery,
    db
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('is_read', false),
  ]);

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat notifikasi.' }, { status: 500 });
  }

  return NextResponse.json({
    items: items || [],
    unreadCount: unreadCount ?? 0,
  });
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = MarkReadSchema.safeParse(rawBody);
  if (!parsed.success || (!parsed.data.id && !parsed.data.markAll)) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  if (parsed.data.markAll) {
    await db
      .from('in_app_notifications')
      .update({ is_read: true, read_at: nowIso })
      .eq('user_id', session.userId)
      .eq('is_read', false);
  } else if (parsed.data.id) {
    await db
      .from('in_app_notifications')
      .update({ is_read: true, read_at: nowIso })
      .eq('id', parsed.data.id)
      .eq('user_id', session.userId);
  }

  return NextResponse.json({ ok: true });
}
