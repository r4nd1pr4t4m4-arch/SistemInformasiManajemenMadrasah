import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(10).max(500),
  auth: z.string().min(6).max(300),
  audienceType: z.enum(['USER', 'PUBLIC']).optional(),
  platform: z.string().max(60).optional(),
  deviceLabel: z.string().max(120).optional(),
  resyncOnly: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Konfigurasi database server belum tersedia.' },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = SubscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data langganan push tidak valid.' },
      { status: 400 }
    );
  }

  const session = await getCurrentUserWithRoles();
  const { endpoint, p256dh, auth, platform, deviceLabel, resyncOnly } = parsed.data;
  const audienceType: 'USER' | 'PUBLIC' = session ? 'USER' : 'PUBLIC';
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 300);
  const nowIso = new Date().toISOString();

  const db = createSupabaseAdminClient();

  const { data: existing } = await db
    .from('push_subscriptions')
    .select('id, user_id, is_active, deactivated_reason')
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (existing) {
    // Jika resync otomatis saat buka portal, hormati pilihan user jika sebelumnya sengaja mematikan perangkat ini
    if (
      resyncOnly &&
      session &&
      existing.user_id === session.userId &&
      !existing.is_active &&
      existing.deactivated_reason === 'USER_DISABLED'
    ) {
      return NextResponse.json({
        ok: true,
        id: existing.id,
        isActive: false,
        respectedUserDisabled: true,
      });
    }

    const { error: updateErr } = await db
      .from('push_subscriptions')
      .update({
        user_id: session ? session.userId : null,
        audience_type: audienceType,
        p256dh,
        auth,
        platform: platform || 'other',
        device_label: deviceLabel || 'Perangkat Web',
        user_agent: userAgent,
        is_active: true,
        deactivated_reason: null,
        deactivated_at: null,
        failure_count: 0,
        last_seen_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', existing.id);

    if (updateErr) {
      return NextResponse.json(
        { error: 'Gagal memperbarui langganan notifikasi.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: existing.id,
      isActive: true,
      audienceType,
      reactivated: !existing.is_active,
    });
  }

  const { data: inserted, error: insertErr } = await db
    .from('push_subscriptions')
    .insert({
      user_id: session ? session.userId : null,
      audience_type: audienceType,
      endpoint,
      p256dh,
      auth,
      platform: platform || 'other',
      device_label: deviceLabel || 'Perangkat Web',
      user_agent: userAgent,
      is_active: true,
      last_seen_at: nowIso,
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: 'Gagal menyimpan langganan notifikasi baru.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    isActive: true,
    audienceType,
  });
}
