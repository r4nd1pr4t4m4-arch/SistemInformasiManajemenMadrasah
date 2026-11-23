import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { sanitizeApiError } from '@/lib/security/api-error';

const AVATAR_COOLDOWN_DAYS = 45;
const AVATAR_COOLDOWN_MS = AVATAR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const SubmitAvatarSchema = z.object({
  avatar_url: z
    .string()
    .min(10, 'Foto profil tidak valid.')
    .max(3_000_000, 'Ukuran foto terlalu besar.')
    .refine(isSafeAvatarUrl, 'Format foto profil harus berupa gambar JPEG/PNG/WebP atau URL HTTPS yang valid.'),
});

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  try {
    const parsed = SubmitAvatarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data foto profil tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // 1. Cek apakah masih ada pengajuan MENUNGGU
    const { data: pendingReq } = await supabase
      .from('profile_avatar_change_requests')
      .select('id')
      .eq('profile_id', session.userId)
      .eq('status', 'MENUNGGU')
      .maybeSingle();

    if (pendingReq) {
      return NextResponse.json(
        {
          error:
            'Pengajuan foto profil Anda masih menunggu persetujuan Admin. Anda tidak dapat mengunggah foto kembali sebelum pengajuan ini disetujui atau ditolak.',
        },
        { status: 400 }
      );
    }

    // 2. Cek cooldown 45 hari sejak persetujuan foto terakhir
    const { data: authUserRes } = await supabase.auth.admin.getUserById(session.userId);
    const existingAvatarUpdatedAt =
      (authUserRes?.user?.user_metadata?.avatar_updated_at as string | undefined) || null;

    if (existingAvatarUpdatedAt) {
      const lastMs = new Date(existingAvatarUpdatedAt).getTime();
      if (!Number.isNaN(lastMs)) {
        const elapsed = Date.now() - lastMs;
        if (elapsed < AVATAR_COOLDOWN_MS) {
          const remainingDays = Math.ceil((AVATAR_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
          return NextResponse.json(
            {
              error: `Foto profil hanya dapat diganti 1 kali setiap ${AVATAR_COOLDOWN_DAYS} hari. Silakan coba lagi dalam ${remainingDays} hari.`,
            },
            { status: 429 }
          );
        }
      }
    }

    // 3. Ambil avatar lama & simpan pengajuan baru
    const { data: prof } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', session.userId)
      .maybeSingle();

    const { data: created, error: insErr } = await supabase
      .from('profile_avatar_change_requests')
      .insert({
        profile_id: session.userId,
        old_avatar_url: prof?.avatar_url || null,
        new_avatar_url: parsed.data.avatar_url,
        status: 'MENUNGGU',
      })
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json({ error: sanitizeApiError(insErr) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      request: created,
      message: 'Foto profil berhasil diunggah dan menunggu persetujuan Admin.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal mengajukan perubahan foto profil.' },
      { status: 500 }
    );
  }
}
