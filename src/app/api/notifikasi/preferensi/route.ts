import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isWebPushConfigured } from '@/lib/notifications/vapid';
import type { NotificationCategoryRow } from '@/lib/notifications/types';

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const UpdatePreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        categoryKey: z.string().min(2).max(80),
        pushEnabled: z.boolean(),
        inAppEnabled: z.boolean(),
      })
    )
    .optional(),
  quietHours: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(HH_MM_RE, 'Format jam mulai harus HH:MM'),
      end: z.string().regex(HH_MM_RE, 'Format jam selesai harus HH:MM'),
    })
    .optional(),
});

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      categories: [],
      quietHours: { enabled: false, start: '22:00', end: '05:00' },
      devices: [],
      vapidConfigured: isWebPushConfigured(),
    });
  }

  const db = createSupabaseAdminClient();

  const [
    { data: categories },
    { data: userPrefs },
    { data: userSettings },
    { data: devices },
  ] = await Promise.all([
    db
      .from('notification_categories')
      .select('key, label, description, default_enabled, allow_user_opt_out, is_public_eligible, sort_order')
      .order('sort_order', { ascending: true }),
    db
      .from('user_notification_preferences')
      .select('category_key, push_enabled, in_app_enabled')
      .eq('user_id', session.userId),
    db
      .from('user_notification_settings')
      .select('quiet_hours_enabled, quiet_start, quiet_end')
      .eq('user_id', session.userId)
      .maybeSingle(),
    db
      .from('push_subscriptions')
      .select('id, endpoint, platform, device_label, is_active, deactivated_reason, deactivated_at, last_seen_at, created_at')
      .eq('user_id', session.userId)
      .order('last_seen_at', { ascending: false }),
  ]);

  const prefMap = new Map<string, { push_enabled: boolean; in_app_enabled: boolean }>();
  for (const p of userPrefs || []) {
    prefMap.set(p.category_key as string, {
      push_enabled: Boolean(p.push_enabled),
      in_app_enabled: Boolean(p.in_app_enabled),
    });
  }

  const mergedCategories = ((categories || []) as NotificationCategoryRow[]).map((cat) => {
    const pref = prefMap.get(cat.key);
    const locked = !cat.allow_user_opt_out;
    return {
      key: cat.key,
      label: cat.label,
      description: cat.description,
      allowUserOptOut: cat.allow_user_opt_out,
      lockedByAdmin: locked,
      pushEnabled: locked ? true : (pref ? pref.push_enabled : cat.default_enabled),
      inAppEnabled: locked ? true : (pref ? pref.in_app_enabled : cat.default_enabled),
    };
  });

  return NextResponse.json({
    categories: mergedCategories,
    quietHours: {
      enabled: Boolean(userSettings?.quiet_hours_enabled),
      start: (userSettings?.quiet_start as string) || '22:00',
      end: (userSettings?.quiet_end as string) || '05:00',
    },
    devices: devices || [],
    vapidConfigured: isWebPushConfigured(),
  });
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = UpdatePreferencesSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Format preferensi tidak valid.' },
      { status: 400 }
    );
  }

  const db = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  if (parsed.data.preferences && parsed.data.preferences.length > 0) {
    const { data: categories } = await db
      .from('notification_categories')
      .select('key, allow_user_opt_out');

    const catMap = new Map<string, boolean>();
    for (const c of categories || []) {
      catMap.set(c.key as string, Boolean(c.allow_user_opt_out));
    }

    const upsertRows: Array<{
      user_id: string;
      category_key: string;
      push_enabled: boolean;
      in_app_enabled: boolean;
      updated_at: string;
    }> = [];

    for (const item of parsed.data.preferences) {
      if (!catMap.has(item.categoryKey)) continue;
      const allowOptOut = catMap.get(item.categoryKey) ?? true;
      if (!allowOptOut && (!item.pushEnabled || !item.inAppEnabled)) {
        return NextResponse.json(
          {
            error: `Kategori "${item.categoryKey}" dikunci oleh Admin dan tidak dapat dinonaktifkan.`,
          },
          { status: 403 }
        );
      }
      upsertRows.push({
        user_id: session.userId,
        category_key: item.categoryKey,
        push_enabled: allowOptOut ? item.pushEnabled : true,
        in_app_enabled: allowOptOut ? item.inAppEnabled : true,
        updated_at: nowIso,
      });
    }

    if (upsertRows.length > 0) {
      const { error } = await db
        .from('user_notification_preferences')
        .upsert(upsertRows, { onConflict: 'user_id,category_key' });
      if (error) {
        return NextResponse.json(
          { error: 'Gagal menyimpan preferensi notifikasi.' },
          { status: 500 }
        );
      }
    }
  }

  if (parsed.data.quietHours) {
    const { error } = await db
      .from('user_notification_settings')
      .upsert(
        {
          user_id: session.userId,
          quiet_hours_enabled: parsed.data.quietHours.enabled,
          quiet_start: parsed.data.quietHours.start,
          quiet_end: parsed.data.quietHours.end,
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      return NextResponse.json(
        { error: 'Gagal menyimpan pengaturan jam tenang.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
