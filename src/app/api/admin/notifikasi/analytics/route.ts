import { NextResponse } from 'next/server';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  NOTIFICATION_DASHBOARD_ROLES,
  getAllowedNotificationCategoriesForRoles,
  isFullNotificationAdmin,
} from '@/lib/notifications/category-access';
import { isWebPushConfigured } from '@/lib/notifications/vapid';

export async function GET(request: Request) {
  const guard = await requireApiRoles(NOTIFICATION_DASHBOARD_ROLES);
  if (guard.errorResponse) return guard.errorResponse;
  const { session } = guard;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      vapidConfigured: isWebPushConfigured(),
      isFullAdmin: isFullNotificationAdmin(session.roles),
      summary: null,
    });
  }

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 30), 7), 90);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const allowedKeys = getAllowedNotificationCategoriesForRoles(session.roles);
  const fullAdmin = isFullNotificationAdmin(session.roles);
  const db = createSupabaseAdminClient();

  let campaignsQuery = db
    .from('push_campaigns')
    .select(
      'id, category_key, source_type, status, total_targets, sent_count, delivered_count, clicked_count, failed_count, expired_count, created_at'
    )
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!fullAdmin) {
    campaignsQuery = campaignsQuery.in(
      'category_key',
      allowedKeys.length > 0 ? allowedKeys : ['__none__']
    );
  }

  const [
    { data: campaigns },
    { data: subs },
    { data: categories },
    { count: pendingQueueCount },
  ] = await Promise.all([
    campaignsQuery,
    db
      .from('push_subscriptions')
      .select('id, audience_type, platform, is_active, deactivated_reason'),
    db
      .from('notification_categories')
      .select('key, label, allow_user_opt_out, is_public_eligible')
      .order('sort_order', { ascending: true }),
    db
      .from('push_deliveries')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING', 'PROCESSING']),
  ]);

  const catLabelMap = new Map<string, string>();
  for (const c of categories || []) {
    catLabelMap.set(c.key as string, c.label as string);
  }

  // Agregat Subscription
  let activeUserSubs = 0;
  let activePublicSubs = 0;
  let logoutInactiveSubs = 0;
  let expiredSubs = 0;
  let userDisabledSubs = 0;
  const platformCounts: Record<string, number> = {};

  for (const s of subs || []) {
    if (s.is_active) {
      if (s.audience_type === 'PUBLIC') activePublicSubs += 1;
      else activeUserSubs += 1;
      const plat = (s.platform as string) || 'other';
      platformCounts[plat] = (platformCounts[plat] || 0) + 1;
    } else if (s.deactivated_reason === 'EXPIRED_410') {
      expiredSubs += 1;
    } else if (s.deactivated_reason === 'LOGOUT') {
      logoutInactiveSubs += 1;
    } else {
      userDisabledSubs += 1;
    }
  }

  // Agregat Campaign & Funnel Delivery/Click
  let totalTargets = 0;
  let totalSent = 0;
  let totalDelivered = 0;
  let totalClicked = 0;
  let totalFailed = 0;
  let totalExpired = 0;

  const byCategoryMap = new Map<
    string,
    {
      categoryKey: string;
      label: string;
      campaigns: number;
      sent: number;
      delivered: number;
      clicked: number;
      failed: number;
      expired: number;
    }
  >();

  const dailyMap = new Map<
    string,
    { date: string; sent: number; delivered: number; clicked: number; failed: number }
  >();

  for (const c of campaigns || []) {
    const sent = Number(c.sent_count || 0);
    const delivered = Number(c.delivered_count || 0);
    const clicked = Number(c.clicked_count || 0);
    const failed = Number(c.failed_count || 0);
    const expired = Number(c.expired_count || 0);
    const targets = Number(c.total_targets || 0);

    totalTargets += targets;
    totalSent += sent;
    totalDelivered += delivered;
    totalClicked += clicked;
    totalFailed += failed;
    totalExpired += expired;

    const catKey = c.category_key as string;
    const catAgg = byCategoryMap.get(catKey) || {
      categoryKey: catKey,
      label: catLabelMap.get(catKey) || catKey,
      campaigns: 0,
      sent: 0,
      delivered: 0,
      clicked: 0,
      failed: 0,
      expired: 0,
    };
    catAgg.campaigns += 1;
    catAgg.sent += sent;
    catAgg.delivered += delivered;
    catAgg.clicked += clicked;
    catAgg.failed += failed;
    catAgg.expired += expired;
    byCategoryMap.set(catKey, catAgg);

    const dayKey = String(c.created_at || '').slice(0, 10);
    if (dayKey) {
      const dayAgg = dailyMap.get(dayKey) || {
        date: dayKey,
        sent: 0,
        delivered: 0,
        clicked: 0,
        failed: 0,
      };
      dayAgg.sent += sent;
      dayAgg.delivered += delivered;
      dayAgg.clicked += clicked;
      dayAgg.failed += failed;
      dailyMap.set(dayKey, dayAgg);
    }
  }

  const deliveryRate =
    totalSent > 0 ? Math.round((totalDelivered / totalSent) * 1000) / 10 : 0;
  const clickRate =
    totalDelivered > 0
      ? Math.round((totalClicked / totalDelivered) * 1000) / 10
      : totalSent > 0
        ? Math.round((totalClicked / totalSent) * 1000) / 10
        : 0;

  return NextResponse.json({
    vapidConfigured: isWebPushConfigured(),
    isFullAdmin: fullAdmin,
    allowedCategoryCount: allowedKeys.length,
    days,
    summary: {
      totalCampaigns: (campaigns || []).length,
      totalTargets,
      totalSent,
      totalDelivered,
      totalClicked,
      totalFailed,
      totalExpired,
      deliveryRate,
      clickRate,
      pendingQueueCount: pendingQueueCount ?? 0,
    },
    subscriptions: {
      activeTotal: activeUserSubs + activePublicSubs,
      activeUser: activeUserSubs,
      activePublic: activePublicSubs,
      logoutInactive: logoutInactiveSubs,
      userDisabled: userDisabledSubs,
      expired: expiredSubs,
      platforms: platformCounts,
    },
    byCategory: Array.from(byCategoryMap.values()).map((item) => ({
      ...item,
      deliveryRate:
        item.sent > 0 ? Math.round((item.delivered / item.sent) * 1000) / 10 : 0,
      clickRate:
        item.delivered > 0
          ? Math.round((item.clicked / item.delivered) * 1000) / 10
          : item.sent > 0
            ? Math.round((item.clicked / item.sent) * 1000) / 10
            : 0,
    })),
    dailyTrend: Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  });
}
