import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSignedOtpToken, generateNumericOtp } from '@/lib/auth/otp-token';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildRegistrationOtpEmail } from '@/lib/email/templates';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';

export const REGISTER_OTP_COOKIE = 'simms_register_otp';

const SendRegisterOtpSchema = z.object({
  email: z.string().email('Format alamat email tidak valid.'),
  fullName: z.string().optional(),
  captcha: z.custom<CaptchaPayload>().optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  if (!isGmailSmtpConfigured()) {
    return NextResponse.json(
      {
        error:
          'Layanan pengiriman email OTP (GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD) belum dikonfigurasi.',
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = SendRegisterOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Alamat email tidak valid.' },
        { status: 400 }
      );
    }

    const captchaResult = await verifyCaptchaToken(parsed.data.captcha, request);
    if (!captchaResult.success) {
      return NextResponse.json(
        {
          error: captchaResult.error || 'Verifikasi keamanan (CAPTCHA) gagal.',
          turnstileUnavailable: Boolean(captchaResult.turnstileUnavailable),
        },
        { status: 403 }
      );
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const admin = createSupabaseAdminClient();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, account_status, is_active, rejection_reason')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      const rawStatus =
        existingProfile.account_status || (existingProfile.is_active ? 'AKTIF' : 'NONAKTIF');
      const isPermanentRejected =
        rawStatus === 'DITOLAK_PERMANEN' ||
        (rawStatus === 'DITOLAK' &&
          Boolean(existingProfile.rejection_reason?.startsWith('[TOLAK_PERMANEN]')));
      const status = isPermanentRejected ? 'DITOLAK_PERMANEN' : rawStatus;

      // Jika statusnya DITOLAK biasa (bukan DITOLAK_PERMANEN), izinkan kirim OTP untuk daftar ulang
      if (status !== 'DITOLAK') {
        return NextResponse.json(
          {
            code: 'EMAIL_ALREADY_REGISTERED',
            accountStatus: status,
            email: normalizedEmail,
            error:
              status === 'DITOLAK_PERMANEN'
                ? 'Pendaftaran dengan alamat email ini telah ditolak secara permanen oleh Admin dan tidak dapat digunakan kembali.'
                : 'Alamat email tersebut sudah terdaftar pada akun lain.',
          },
          { status: 409 }
        );
      }
    }

    const [school, otp] = await Promise.all([
      getInstitutionSettings(),
      Promise.resolve(generateNumericOtp()),
    ]);

    const signedToken = createSignedOtpToken(`register:${normalizedEmail}`, otp);
    const emailPayload = buildRegistrationOtpEmail({
      institutionName: school.name,
      institutionAddress: school.address,
      institutionEmail: school.email,
      recipientName: parsed.data.fullName?.trim() || 'Calon Pengguna',
      recipientEmail: normalizedEmail,
      otpCode: otp,
      requestedAtWib: formatWibDateTime(),
    });

    await sendInstitutionalEmail({
      senderLabel: school.short_name || school.name,
      to: normalizedEmail,
      ...emailPayload,
    });

    const response = NextResponse.json({
      ok: true,
      message: `Kode OTP 6 digit telah dikirim ke ${normalizedEmail}.`,
    });

    response.cookies.set(REGISTER_OTP_COOKIE, signedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengirim kode OTP.' },
      { status: 500 }
    );
  }
}
