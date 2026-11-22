import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSignedOtpToken, verifySignedOtpToken } from '@/lib/auth/otp-token';
import { REGISTER_OTP_COOKIE } from '@/app/api/auth/register/send-otp/route';

export const REGISTER_VERIFIED_COOKIE = 'simms_register_verified';

const VerifyRegisterOtpSchema = z.object({
  email: z.string().email('Format alamat email tidak valid.'),
  otpCode: z.string().trim().length(6, 'Kode OTP harus 6 digit.'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = VerifyRegisterOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data verifikasi OTP tidak valid.' },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const cookieStore = await cookies();
    const otpCookie = cookieStore.get(REGISTER_OTP_COOKIE)?.value;

    if (!otpCookie) {
      return NextResponse.json(
        { error: 'Sesi OTP tidak ditemukan atau sudah kedaluwarsa. Silakan kirim ulang kode OTP.' },
        { status: 400 }
      );
    }

    const check = await verifySignedOtpToken(
      otpCookie,
      `register:${normalizedEmail}`,
      parsed.data.otpCode
    );
    if (!check.valid) {
      return NextResponse.json(
        { error: check.reason || 'Kode OTP tidak valid.' },
        { status: 400 }
      );
    }

    const verifiedToken = createSignedOtpToken(`verified:${normalizedEmail}`, 'VERIFIED');
    const response = NextResponse.json({
      ok: true,
      message: 'Alamat email berhasil diverifikasi. Silakan lanjutkan klik "Buat Akun".',
    });

    response.cookies.delete(REGISTER_OTP_COOKIE);
    response.cookies.set(REGISTER_VERIFIED_COOKIE, verifiedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memverifikasi OTP.' },
      { status: 500 }
    );
  }
}
