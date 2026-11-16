import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { OTP_COOKIE_NAME, verifySignedOtpToken } from '@/lib/auth/otp-token';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ResetMfaSchema = z.object({
  currentPassword: z.string().min(1),
  otpCode: z.string().min(4).max(10),
});

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session || !session.email) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan autentikasi belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ResetMfaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Kata sandi saat ini dan kode OTP wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Verifikasi kata sandi saat ini
    const serverClient = await createSupabaseServerClient();
    const { error: pwdErr } = await serverClient.auth.signInWithPassword({
      email: session.email,
      password: parsed.data.currentPassword,
    });
    if (pwdErr) {
      return NextResponse.json(
        { error: 'Kata sandi saat ini salah.' },
        { status: 400 }
      );
    }

    // 2. Verifikasi kode OTP email
    const cookieStore = await cookies();
    const token = cookieStore.get(OTP_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Kode OTP belum dikirim atau sudah kedaluwarsa. Klik Kirim Kode OTP.' },
        { status: 400 }
      );
    }

    const otpCheck = verifySignedOtpToken(token, session.userId, parsed.data.otpCode);
    if (!otpCheck.valid) {
      return NextResponse.json(
        { error: otpCheck.reason || 'Kode OTP tidak valid.' },
        { status: 400 }
      );
    }

    // 3. Hapus seluruh faktor MFA milik user
    const admin = createSupabaseAdminClient();
    const { data: factorList, error: listErr } = await admin.auth.admin.mfa.listFactors({
      userId: session.userId,
    });
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const factors = factorList?.factors || [];
    for (const factor of factors) {
      await admin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: session.userId,
      });
    }

    const response = NextResponse.json({
      ok: true,
      removedCount: factors.length,
      message:
        factors.length > 0
          ? `Berhasil mereset ${factors.length} perangkat MFA.`
          : 'Tidak ada perangkat MFA aktif yang perlu direset.',
    });
    response.cookies.delete(OTP_COOKIE_NAME);
    return response;
  } catch {
    return NextResponse.json({ error: 'Gagal mereset MFA.' }, { status: 500 });
  }
}
