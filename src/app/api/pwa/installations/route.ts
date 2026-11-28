import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { sanitizeApiError } from '@/lib/security/api-error';

const PwaInstallPayloadSchema = z.object({
  device_id: z.string().trim().min(8).max(120),
  platform: z.enum([
    'android-chrome',
    'ios-safari',
    'desktop-chromium',
    'desktop-safari',
    'other',
  ]),
  device_label: z.string().trim().max(120).optional().default(''),
  install_source: z
    .enum(['APPINSTALLED_EVENT', 'STANDALONE_LAUNCH', 'DEFERRED_LINK'])
    .optional()
    .default('STANDALONE_LAUNCH'),
  display_mode: z.string().trim().max(40).optional().default('standalone'),
  app_version: z.string().trim().max(40).optional().nullable(),
  installed_at: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: false, skipped: true });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = PwaInstallPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Payload instalasi PWA tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 300) || null;
    const {
      device_id,
      platform,
      device_label,
      install_source,
      display_mode,
      app_version,
      installed_at,
    } = parsed.data;

    const { data: existing } = await supabase
      .from('pwa_installations')
      .select('id, launch_count')
      .eq('user_id', session.userId)
      .eq('device_id', device_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('pwa_installations')
        .update({
          platform,
          device_label: device_label || undefined,
          user_agent: userAgent,
          display_mode,
          app_version: app_version ?? null,
          launch_count: Number(existing.launch_count || 0) + 1,
          last_seen_at: now,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id, launch_count')
        .single();

      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id, launchCount: data.launch_count });
    }

    const { data, error } = await supabase
      .from('pwa_installations')
      .insert({
        user_id: session.userId,
        device_id,
        platform,
        device_label,
        user_agent: userAgent,
        install_source,
        display_mode,
        app_version: app_version ?? null,
        launch_count: 1,
        installed_at: installed_at || now,
        last_seen_at: now,
        created_at: now,
        updated_at: now,
      })
      .select('id, launch_count')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, launchCount: data.launch_count }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeApiError(err, 'Gagal mencatat instalasi PWA.') },
      { status: 500 }
    );
  }
}
