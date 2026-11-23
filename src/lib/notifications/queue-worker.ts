import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  ensureWebPushConfigured,
  signDeliveryToken,
  webpush,
} from '@/lib/notifications/vapid';
import type { NotificationCategoryKey, PushPayloadData } from '@/lib/notifications/types';

interface ClaimedDeliveryRow {
  delivery_id: string;
  campaign_id: string;
  subscription_id: string;
  user_id: string | null;
  in_app_notification_id: string | null;
  attempts: number;
  max_attempts: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  category_key: NotificationCategoryKey;
  title: string;
  body: string;
  url: string;
  icon_url: string | null;
}

export interface QueueBatchResult {
  configured: boolean;
  processed: number;
  sent: number;
  failed: number;
  expired: number;
  remaining: number;
  campaignsUpdated: string[];
}

const RETRY_DELAYS_MINUTES = [2, 10, 30];

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

/**
 * Memproses antrean push_deliveries dalam batch dengan concurrency terbatas
 * dan penjaga batas waktu (time-budget guard) agar aman pada Vercel Hobby.
 */
export async function processPushQueueBatch(options?: {
  batchSize?: number;
  maxBatches?: number;
  concurrency?: number;
  timeBudgetMs?: number;
  campaignId?: string;
}): Promise<QueueBatchResult> {
  if (!isSupabaseAdminConfigured() || !ensureWebPushConfigured()) {
    return {
      configured: false,
      processed: 0,
      sent: 0,
      failed: 0,
      expired: 0,
      remaining: 0,
      campaignsUpdated: [],
    };
  }

  const batchSize = Math.min(Math.max(options?.batchSize ?? 40, 1), 100);
  const maxBatches = Math.min(Math.max(options?.maxBatches ?? 2, 1), 5);
  const concurrency = Math.min(Math.max(options?.concurrency ?? 10, 1), 20);
  const timeBudgetMs = options?.timeBudgetMs ?? 6500;
  const startedAt = Date.now();

  const db = createSupabaseAdminClient();
  let totalProcessed = 0;
  let totalSent = 0;
  let totalFailed = 0;
  let totalExpired = 0;
  const touchedCampaigns = new Set<string>();

  for (let batchIdx = 0; batchIdx < maxBatches; batchIdx += 1) {
    if (Date.now() - startedAt > timeBudgetMs) break;

    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_pending_push_deliveries',
      {
        p_limit: batchSize,
        p_campaign_id: options?.campaignId ?? null,
      }
    );

    if (claimErr || !Array.isArray(claimed) || claimed.length === 0) {
      break;
    }

    const rows = claimed as ClaimedDeliveryRow[];

    await runWithConcurrency(rows, concurrency, async (row) => {
      touchedCampaigns.add(row.campaign_id);
      const nowIso = new Date().toISOString();

      const payload: PushPayloadData = {
        deliveryId: row.delivery_id,
        token: signDeliveryToken(row.delivery_id),
        campaignId: row.campaign_id,
        categoryKey: row.category_key,
        title: row.title,
        body: row.body,
        url: row.url || '/portal',
        icon: row.icon_url || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `simms-${row.category_key.toLowerCase()}-${row.campaign_id.slice(0, 8)}`,
        inAppNotificationId: row.in_app_notification_id,
      };

      try {
        const res = await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 24, // 24 jam
            urgency:
              row.category_key === 'PENGUMUMAN_BROADCAST' ||
              row.category_key === 'KEAMANAN_AKUN'
                ? 'high'
                : 'normal',
          }
        );

        totalSent += 1;
        await Promise.all([
          db
            .from('push_deliveries')
            .update({
              status: 'SENT',
              http_status: res.statusCode ?? 201,
              last_error: null,
              sent_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', row.delivery_id),
          db
            .from('push_subscriptions')
            .update({
              failure_count: 0,
              last_seen_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', row.subscription_id),
        ]);
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number; body?: string; message?: string };
        const statusCode = typeof pushErr?.statusCode === 'number' ? pushErr.statusCode : 0;
        const errMsg = String(pushErr?.body || pushErr?.message || 'Push send failed').slice(0, 400);

        if (statusCode === 404 || statusCode === 410) {
          // Subscription sudah tidak valid/kedaluwarsa -> soft-deactivate otomatis
          totalExpired += 1;
          await Promise.all([
            db
              .from('push_deliveries')
              .update({
                status: 'EXPIRED',
                http_status: statusCode,
                last_error: errMsg,
                updated_at: nowIso,
              })
              .eq('id', row.delivery_id),
            db
              .from('push_subscriptions')
              .update({
                is_active: false,
                deactivated_reason: 'EXPIRED_410',
                deactivated_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', row.subscription_id),
          ]);
        } else {
          totalFailed += 1;
          const retryIdx = Math.min(Math.max(row.attempts - 1, 0), RETRY_DELAYS_MINUTES.length - 1);
          const delayMs = RETRY_DELAYS_MINUTES[retryIdx] * 60 * 1000;
          const canRetry = row.attempts < row.max_attempts;
          const nextRetryAt = canRetry ? new Date(Date.now() + delayMs).toISOString() : null;

          await db
            .from('push_deliveries')
            .update({
              status: 'FAILED',
              http_status: statusCode || null,
              last_error: errMsg,
              next_retry_at: nextRetryAt,
              updated_at: nowIso,
            })
            .eq('id', row.delivery_id);
        }
      } finally {
        totalProcessed += 1;
      }
    });

    if (rows.length < batchSize) {
      break;
    }
  }

  // Recompute statistik campaign yang disentuh
  const campaignIds = Array.from(touchedCampaigns);
  await Promise.all(
    campaignIds.map((cid) => db.rpc('recompute_push_campaign_stats', { p_campaign_id: cid }))
  );

  // Hitung sisa antrean pending
  let remainingQuery = db
    .from('push_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING');

  if (options?.campaignId) {
    remainingQuery = remainingQuery.eq('campaign_id', options.campaignId);
  }
  const { count: remainingCount } = await remainingQuery;

  return {
    configured: true,
    processed: totalProcessed,
    sent: totalSent,
    failed: totalFailed,
    expired: totalExpired,
    remaining: remainingCount ?? 0,
    campaignsUpdated: campaignIds,
  };
}
