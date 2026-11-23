import { NextResponse } from 'next/server';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { processPushQueueBatch } from '@/lib/notifications/queue-worker';
import { dispatchNotification } from '@/lib/notifications/dispatcher';

async function runDailyNotificationJobs() {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: 'supabase_admin_not_configured' };
  }

  const db = createSupabaseAdminClient();
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const tomorrowWib = new Date(wibNow.getTime() + 24 * 60 * 60 * 1000);
  const todayStr = wibNow.toISOString().slice(0, 10);
  const tomorrowStr = tomorrowWib.toISOString().slice(0, 10);

  let calendarReminders = 0;

  // 1. Pengingat Agenda Kalender Akademik H-1
  const { data: tomorrowEvents } = await db
    .from('academic_calendar_events')
    .select('id, title, start_date')
    .eq('start_date', tomorrowStr)
    .limit(5);

  for (const ev of tomorrowEvents || []) {
    const res = await dispatchNotification({
      categoryKey: 'PENGINGAT_TERJADWAL',
      title: 'Pengingat Agenda Besok',
      body: `${ev.title} dijadwalkan besok (${tomorrowStr}).`,
      url: '/portal/akademik/kalender',
      sourceType: 'CRON',
      dedupeKey: `cal-h1-${ev.id}-${todayStr}`,
      dedupeWindowMinutes: 60 * 20,
      target: { includeAllUsers: true },
    });
    if (res.ok && res.inAppCount > 0) calendarReminders += 1;
  }

  // 2. Proses antrean push yang masih pending / retryable
  const queueResult = await processPushQueueBatch({
    batchSize: 50,
    maxBatches: 2,
    concurrency: 10,
    timeBudgetMs: 6500,
  });

  // 3. Cleanup log delivery & in-app read lebih dari 90 hari
  const cutoffIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    db
      .from('push_deliveries')
      .delete()
      .lt('created_at', cutoffIso)
      .in('status', ['SENT', 'DELIVERED', 'FAILED', 'EXPIRED']),
    db
      .from('in_app_notifications')
      .delete()
      .lt('created_at', cutoffIso)
      .eq('is_read', true),
  ]);

  return {
    ok: true,
    dateWib: todayStr,
    calendarReminders,
    queueResult,
  };
}

/**
 * Cron Harian (01:00 UTC / 08:00 WIB) — kompatibel dengan batas Vercel Hobby.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runDailyNotificationJobs();
  return NextResponse.json(result);
}

export async function POST() {
  const guard = await requireApiRoles(ROLE_GROUPS.ADMIN_CONFIRM);
  if (guard.errorResponse) return guard.errorResponse;
  const result = await runDailyNotificationJobs();
  return NextResponse.json(result);
}
