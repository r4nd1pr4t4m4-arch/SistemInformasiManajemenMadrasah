import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const DeactivateSchema = z.object({
  endpoint: z.string().url().max(2000).optional(),
  subscriptionId: z.string().uuid().optional(),
  reason: z.enum(['LOGOUT', 'USER_DISABLED']).default('USER_DISABLED'),
});

/**
 * Menonaktifkan langganan Web Push TANPA menghapus baris di database.
 * - Saat logout: endpoint perangkat saat ini dinonaktifkan (deactivated_reason = 'LOGOUT')
 * - Dari halaman preferensi: user dapat menonaktifkan perangkat mana pun miliknya ('USER_DISABLED')
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = DeactivateSchema.safeParse(rawBody);
  if (!parsed.success || (!parsed.data.endpoint && !parsed.data.subscriptionId)) {
    return NextResponse.json(
      { error: 'Parameter perangkat tidak valid.' },
      { status: 400 }
    );
  }

  const session = await getCurrentUserWithRoles();
  const db = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  if (parsed.data.subscriptionId) {
    if (!session) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
    }
    const { error } = await db
      .from('push_subscriptions')
      .update({
        is_active: false,
        deactivated_reason: parsed.data.reason,
        deactivated_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', parsed.data.subscriptionId)
      .eq('user_id', session.userId);

    if (error) {
      return NextResponse.json({ error: 'Gagal menonaktifkan perangkat.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Nonaktifkan berdasarkan endpoint perangkat saat ini
  let query = db
    .from('push_subscriptions')
    .update({
      is_active: false,
      deactivated_reason: parsed.data.reason,
      deactivated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('endpoint', parsed.data.endpoint!);

  if (session && parsed.data.reason !== 'LOGOUT') {
    query = query.or(`user_id.eq.${session.userId},user_id.is.null`);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Gagal menonaktifkan notifikasi perangkat.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
