import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  NOTIFICATION_DASHBOARD_ROLES,
  canEditNotificationPolicy,
  getAllowedNotificationCategoriesForRoles,
  isFullNotificationAdmin,
} from '@/lib/notifications/category-access';
import type { NotificationCategoryKey, NotificationCategoryRow } from '@/lib/notifications/types';

const UpdatePolicySchema = z.object({
  categoryKey: z.string().min(2).max(80),
  allowUserOptOut: z.boolean(),
  defaultEnabled: z.boolean().optional(),
  isPublicEligible: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(NOTIFICATION_DASHBOARD_ROLES);
  if (guard.errorResponse) return guard.errorResponse;
  const { session } = guard;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ categories: [] });
  }

  const allowedKeys = getAllowedNotificationCategoriesForRoles(session.roles);
  const fullAdmin = isFullNotificationAdmin(session.roles);
  const db = createSupabaseAdminClient();

  let query = db
    .from('notification_categories')
    .select('key, label, description, default_enabled, allow_user_opt_out, is_public_eligible, sort_order, updated_at')
    .order('sort_order', { ascending: true });

  if (!fullAdmin) {
    query = query.in('key', allowedKeys.length > 0 ? allowedKeys : ['__none__']);
  }

  const { data: rows } = await query;

  const categories = ((rows || []) as NotificationCategoryRow[]).map((c) => ({
    ...c,
    canEdit: canEditNotificationPolicy(session.roles, c.key),
  }));

  return NextResponse.json({
    isFullAdmin: fullAdmin,
    categories,
  });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(NOTIFICATION_DASHBOARD_ROLES);
  if (guard.errorResponse) return guard.errorResponse;
  const { session } = guard;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = UpdatePolicySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data kebijakan tidak valid.' }, { status: 400 });
  }

  const categoryKey = parsed.data.categoryKey as NotificationCategoryKey;
  if (!canEditNotificationPolicy(session.roles, categoryKey)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki izin mengubah kebijakan untuk kategori ini.' },
      { status: 403 }
    );
  }

  const db = createSupabaseAdminClient();
  const updates: Record<string, unknown> = {
    allow_user_opt_out: parsed.data.allowUserOptOut,
    updated_by: session.userId,
    updated_at: new Date().toISOString(),
  };

  if (typeof parsed.data.defaultEnabled === 'boolean') {
    updates.default_enabled = parsed.data.defaultEnabled;
  }
  if (typeof parsed.data.isPublicEligible === 'boolean' && isFullNotificationAdmin(session.roles)) {
    updates.is_public_eligible = parsed.data.isPublicEligible;
  }

  const { error } = await db
    .from('notification_categories')
    .update(updates)
    .eq('key', categoryKey);

  if (error) {
    return NextResponse.json(
      { error: 'Gagal memperbarui kebijakan kategori.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
