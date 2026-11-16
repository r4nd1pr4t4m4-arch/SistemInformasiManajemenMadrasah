import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const AVATAR_COOLDOWN_DAYS = 45;
const AVATAR_COOLDOWN_MS = AVATAR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
  avatar_url: z.string().max(3_000_000).optional().nullable(),
});

function computeAvatarCooldown(avatarUpdatedAt: string | null | undefined) {
  if (!avatarUpdatedAt) {
    return {
      canChangeAvatar: true,
      avatarUpdatedAt: null as string | null,
      nextAvatarChangeAt: null as string | null,
      remainingDays: 0,
    };
  }
  const lastMs = new Date(avatarUpdatedAt).getTime();
  if (Number.isNaN(lastMs)) {
    return {
      canChangeAvatar: true,
      avatarUpdatedAt: null as string | null,
      nextAvatarChangeAt: null as string | null,
      remainingDays: 0,
    };
  }
  const elapsed = Date.now() - lastMs;
  if (elapsed >= AVATAR_COOLDOWN_MS) {
    return {
      canChangeAvatar: true,
      avatarUpdatedAt,
      nextAvatarChangeAt: null as string | null,
      remainingDays: 0,
    };
  }
  const nextMs = lastMs + AVATAR_COOLDOWN_MS;
  const remainingDays = Math.ceil((AVATAR_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
  return {
    canChangeAvatar: false,
    avatarUpdatedAt,
    nextAvatarChangeAt: new Date(nextMs).toISOString(),
    remainingDays,
  };
}

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ profile: session });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data }, { data: authUserRes }, { data: factorRes }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, primary_role, created_at')
      .eq('id', session.userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(session.userId),
    supabase.auth.admin.mfa.listFactors({ userId: session.userId }),
  ]);

  const avatarUpdatedAt =
    (authUserRes?.user?.user_metadata?.avatar_updated_at as string | undefined) || null;
  const cooldown = computeAvatarCooldown(avatarUpdatedAt);
  const mfaEnabled = (factorRes?.factors || []).some((f) => f.status === 'verified');

  return NextResponse.json({
    profile: {
      ...(data || {}),
      email: authUserRes?.user?.email ?? data?.email ?? session.email,
      roles: session.roles,
      mfaEnabled,
      ...cooldown,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data profil tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authUserRes } = await supabase.auth.admin.getUserById(session.userId);
    const currentMeta = (authUserRes?.user?.user_metadata || {}) as Record<string, unknown>;
    const existingAvatarUpdatedAt =
      (currentMeta.avatar_updated_at as string | undefined) || null;

    const updatePayload: Record<string, unknown> = {
      full_name: parsed.data.full_name.trim(),
      phone: parsed.data.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let nextCooldown = computeAvatarCooldown(existingAvatarUpdatedAt);

    if (parsed.data.avatar_url) {
      if (!nextCooldown.canChangeAvatar) {
        return NextResponse.json(
          {
            error: `Foto profil hanya dapat diganti setiap ${AVATAR_COOLDOWN_DAYS} hari sekali. Silakan coba lagi dalam ${nextCooldown.remainingDays} hari.`,
          },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      updatePayload.avatar_url = parsed.data.avatar_url;

      await supabase.auth.admin.updateUserById(session.userId, {
        user_metadata: {
          ...currentMeta,
          avatar_updated_at: nowIso,
        },
      });

      // Sinkronkan juga ke Direktori GTK (teachers_staff) jika akun terkait GTK
      await supabase
        .from('teachers_staff')
        .update({ photo_url: parsed.data.avatar_url })
        .eq('user_id', session.userId);

      nextCooldown = computeAvatarCooldown(nowIso);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', session.userId)
      .select('id, full_name, email, phone, avatar_url, primary_role')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      profile: {
        ...data,
        roles: session.roles,
        ...nextCooldown,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui profil akun.' }, { status: 500 });
  }
}
