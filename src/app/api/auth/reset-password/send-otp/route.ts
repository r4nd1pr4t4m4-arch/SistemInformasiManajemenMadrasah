import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createSignedOtpToken, generateNumericOtp, RESET_OTP_COOKIE_NAME } from '@/lib/auth/otp-token';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildPasswordOtpEmail } from '@/lib/email/templates';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';

const SendResetOtpSchema = z.object({
  email: z.string().email(),
  captcha: z.custom<CaptchaPayload>().optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured() || !isGmailSmtpConfigured()) {
    return NextResponse.json(
      { error: 'Layanan pengiriman OTP belum tersedia.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = SendResetOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Alamat email tidak valid.' }, { status: 400 });
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

    const email = parsed.data.email.trim().toLowerCase();
    const supabase = createSupabaseAdminClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('email', email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: 'Email tersebut tidak terdaftar pada sistem.' },
        { status: 404 }
      );
    }

    const [school, otp] = await Promise.all([
      getInstitutionSettings(),
      Promise.resolve(generateNumericOtp()),
    ]);

    const signedToken = createSignedOtpToken(profile.id, otp);
    const emailPayload = buildPasswordOtpEmail({
      institutionName: school.name,
      institutionAddress: school.address,
      institutionEmail: school.email,
      recipientName: profile.full_name || email,
      recipientEmail: email,
      otpCode: otp,
      requestedAtWib: formatWibDateTime(),
    });

    await sendInstitutionalEmail({
      senderLabel: school.short_name || school.name,
      to: email,
      ...emailPayload,
    });

    const response = NextResponse.json({
      ok: true,
      message: `Kode OTP 6 digit telah dikirim ke ${email}.`,
    });

    response.cookies.set(RESET_OTP_COOKIE_NAME, signedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? `Gagal mengirim OTP: ${error.message}` : 'Gagal mengirim OTP.',
      },
      { status: 500 }
    );
  }
}
