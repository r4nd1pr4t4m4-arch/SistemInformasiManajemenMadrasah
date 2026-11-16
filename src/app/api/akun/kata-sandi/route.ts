import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { OTP_COOKIE_NAME, verifySignedOtpToken } from '@/lib/auth/otp-token';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const ChangePasswordSchema = z.object({
  otpCode: z.string().min(4).max(10),
  newPassword: z.string().min(6),
});

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan autentikasi belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Kode OTP dan kata sandi baru (minimal 6 karakter) wajib diisi.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(OTP_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Kode OTP belum dikirim atau sudah kedaluwarsa. Klik Kirim Kode OTP terlebih dahulu.' },
        { status: 400 }
      );
    }

    const check = verifySignedOtpToken(token, session.userId, parsed.data.otpCode);
    if (!check.valid) {
      return NextResponse.json(
        { error: check.reason || 'Kode OTP tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(session.userId, {
      password: parsed.data.newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Kata sandi akun berhasil diperbarui.',
    });
    response.cookies.delete(OTP_COOKIE_NAME);
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Gagal memproses perubahan kata sandi.' },
      { status: 500 }
    );
  }
}
