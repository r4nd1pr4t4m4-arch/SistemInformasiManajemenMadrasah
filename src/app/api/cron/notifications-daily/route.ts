import { NextResponse } from 'next/server';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { processPushQueueBatch } from '@/lib/notifications/queue-worker';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

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
  let sppReminders = 0;

  // 1. Pengingat Agenda Kalender Akademik H-1
  const { data: tomorrowEvents } = await db
    .from('academic_calendar_events')
    .select('id, title, event_date')
    .eq('event_date', tomorrowStr)
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

  // 1b. Auto-Reminder Tunggakan & Jatuh Tempo SPP (H-3 atau lewat jatuh tempo)
  const in3DaysWib = new Date(wibNow.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: dueBills } = await db
    .from('student_bills')
    .select('id, student_id, amount, paid_amount, due_date, fee_type:fee_types(name)')
    .neq('status', 'LUNAS')
    .lte('due_date', in3DaysWib)
    .limit(50);

  for (const bill of dueBills || []) {
    const remaining = Math.max(0, Number(bill.amount || 0) - Number(bill.paid_amount || 0));
    if (remaining <= 0 || !bill.student_id) continue;
    const feeObj = Array.isArray(bill.fee_type) ? bill.fee_type[0] : bill.fee_type;
    const isOverdue = Boolean(bill.due_date && bill.due_date < todayStr);
    await notifyStudentFamilyEvent({
      studentId: bill.student_id as string,
      categoryKey: 'KEUANGAN_SPP',
      title: isOverdue ? 'Pengingat Tunggakan SPP / Komite' : 'Pengingat Jatuh Tempo SPP',
      body: `Tagihan ${feeObj?.name || 'SPP'} tersisa Rp${remaining.toLocaleString('id-ID')} (jatuh tempo ${bill.due_date || '-'}).`,
      url: '/portal/orang-tua/spp',
    });
    sppReminders += 1;
  }

  // 1c. Pengingat SLA Disposisi Surat Masuk yang Melewati Tenggat
  let dispositionReminders = 0;
  const { data: overdueDisps } = await db
    .from('letter_dispositions')
    .select('id, due_date, assignee_user_id, instruction')
    .neq('status', 'SELESAI')
    .lte('due_date', todayStr)
    .limit(30);

  for (const disp of overdueDisps || []) {
    if (!disp.assignee_user_id) continue;
    await dispatchNotification({
      categoryKey: 'PENGINGAT_TERJADWAL',
      title: 'Pengingat SLA Disposisi Surat',
      body: `Disposisi surat "${(disp.instruction || 'Tindak lanjut').slice(0, 60)}" melewati tenggat (${disp.due_date}).`,
      url: '/portal/gtk/persuratan',
      sourceType: 'CRON',
      dedupeKey: `disp-sla-${disp.id}-${todayStr}`,
      dedupeWindowMinutes: 60 * 20,
      target: { userIds: [disp.assignee_user_id as string] },
    });
    dispositionReminders += 1;
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
    sppReminders,
    dispositionReminders,
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
