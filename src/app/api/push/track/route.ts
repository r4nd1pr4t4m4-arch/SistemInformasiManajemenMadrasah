import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { verifyDeliveryToken } from '@/lib/notifications/vapid';

const TrackSchema = z.object({
  deliveryId: z.string().uuid(),
  token: z.string().min(10).max(128),
  event: z.enum(['delivered', 'clicked']),
});

/**
 * Endpoint beacon ringan yang dipanggil Service Worker saat:
 * - push event berhasil ditampilkan ('delivered')
 * - notifikasi diklik pengguna ('clicked') -> sekaligus menandai in-app notification terbaca
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = TrackSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }

  const { deliveryId, token, event } = parsed.data;
  if (!verifyDeliveryToken(deliveryId, token)) {
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  const { data: delivery } = await db
    .from('push_deliveries')
    .select('id, campaign_id, in_app_notification_id, delivered_at, clicked_at')
    .eq('id', deliveryId)
    .maybeSingle();

  if (!delivery) {
    return NextResponse.json({ ok: true });
  }

  const nowIso = new Date().toISOString();

  if (event === 'delivered') {
    if (!delivery.delivered_at) {
      await db
        .from('push_deliveries')
        .update({
          status: 'DELIVERED',
          delivered_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', deliveryId);
      await db.rpc('recompute_push_campaign_stats', {
        p_campaign_id: delivery.campaign_id,
      });
    }
  } else if (event === 'clicked') {
    const updates: Record<string, unknown> = {
      status: 'DELIVERED',
      clicked_at: delivery.clicked_at || nowIso,
      delivered_at: delivery.delivered_at || nowIso,
      updated_at: nowIso,
    };
    await db.from('push_deliveries').update(updates).eq('id', deliveryId);

    if (delivery.in_app_notification_id) {
      await db
        .from('in_app_notifications')
        .update({ is_read: true, read_at: nowIso })
        .eq('id', delivery.in_app_notification_id)
        .eq('is_read', false);
    }

    await db.rpc('recompute_push_campaign_stats', {
      p_campaign_id: delivery.campaign_id,
    });
  }

  return NextResponse.json({ ok: true });
}
