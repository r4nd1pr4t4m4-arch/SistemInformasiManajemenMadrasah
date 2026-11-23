import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  NOTIFICATION_DASHBOARD_ROLES,
  canManageNotificationCategory,
  getAllowedNotificationCategoriesForRoles,
  isFullNotificationAdmin,
} from '@/lib/notifications/category-access';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import type { AppRole } from '@/types/database';
import type { NotificationCategoryKey } from '@/lib/notifications/types';

const BroadcastSchema = z.object({
  categoryKey: z.string().min(2).max(80),
  title: z.string().min(3, 'Judul minimal 3 karakter.').max(140),
  body: z.string().min(5, 'Isi pesan minimal 5 karakter.').max(320),
  url: z.string().max(300).optional(),
  targetMode: z.enum(['ALL_AND_PUBLIC', 'ALL_USERS', 'PUBLIC_ONLY', 'ROLES', 'CLASSROOMS', 'USERS']),
  roles: z.array(z.string()).optional(),
  classroomIds: z.array(z.string().uuid()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(NOTIFICATION_DASHBOARD_ROLES);
  if (guard.errorResponse) return guard.errorResponse;
  const { session } = guard;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      allowedCategories: [],
      isFullAdmin: isFullNotificationAdmin(session.roles),
      campaigns: [],
      classrooms: [],
    });
  }

  const allowedKeys = getAllowedNotificationCategoriesForRoles(session.roles);
  const fullAdmin = isFullNotificationAdmin(session.roles);
  const db = createSupabaseAdminClient();

  let campaignsQuery = db
    .from('push_campaigns')
    .select(
      'id, source_type, category_key, title, body, url, target_summary, status, scheduled_at, total_targets, sent_count, delivered_count, clicked_count, failed_count, expired_count, created_at, completed_at'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (!fullAdmin) {
    if (allowedKeys.length === 0) {
      return NextResponse.json({
        allowedCategories: [],
        isFullAdmin: false,
        campaigns: [],
        classrooms: [],
      });
    }
    campaignsQuery = campaignsQuery.in('category_key', allowedKeys);
  }

  const [{ data: categories }, { data: campaigns }, { data: classrooms }] = await Promise.all([
    db
      .from('notification_categories')
      .select('key, label, description, allow_user_opt_out, is_public_eligible, sort_order')
      .in('key', allowedKeys.length > 0 ? allowedKeys : ['__none__'])
      .order('sort_order', { ascending: true }),
    campaignsQuery,
    db
      .from('classrooms')
      .select('id, name, grade_level')
      .order('grade_level', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  return NextResponse.json({
    allowedCategories: categories || [],
    isFullAdmin: fullAdmin,
    campaigns: campaigns || [],
    classrooms: classrooms || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(NOTIFICATION_DASHBOARD_ROLES);
  if (guard.errorResponse) return guard.errorResponse;
  const { session } = guard;

  const rawBody = await request.json().catch(() => null);
  const parsed = BroadcastSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data broadcast tidak valid.' },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const categoryKey = data.categoryKey as NotificationCategoryKey;

  if (!canManageNotificationCategory(session.roles, categoryKey)) {
    return NextResponse.json(
      {
        error:
          'Peran/tugas tambahan Anda tidak memiliki izin untuk mengirim notifikasi pada kategori ini.',
      },
      { status: 403 }
    );
  }

  const safeUrl =
    data.url && data.url.trim().startsWith('/') ? data.url.trim() : '/portal';

  const target: {
    userIds?: string[];
    roles?: AppRole[];
    classroomIds?: string[];
    includeAllUsers?: boolean;
    includePublicSubscribers?: boolean;
  } = {};

  switch (data.targetMode) {
    case 'ALL_AND_PUBLIC':
      target.includeAllUsers = true;
      target.includePublicSubscribers = true;
      break;
    case 'ALL_USERS':
      target.includeAllUsers = true;
      break;
    case 'PUBLIC_ONLY':
      target.includePublicSubscribers = true;
      break;
    case 'ROLES':
      if (!data.roles || data.roles.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu peran target.' }, { status: 400 });
      }
      target.roles = data.roles as AppRole[];
      break;
    case 'CLASSROOMS':
      if (!data.classroomIds || data.classroomIds.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu kelas target.' }, { status: 400 });
      }
      target.classroomIds = data.classroomIds;
      break;
    case 'USERS':
      if (!data.userIds || data.userIds.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu pengguna target.' }, { status: 400 });
      }
      target.userIds = data.userIds;
      break;
  }

  const result = await dispatchNotification({
    categoryKey,
    title: data.title,
    body: data.body,
    url: safeUrl,
    sourceType: 'BROADCAST',
    createdBy: session.userId,
    scheduledAt: data.scheduledAt ?? null,
    target,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.skippedReason || 'Gagal membuat broadcast notifikasi.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...result,
    ok: true,
  });
}
