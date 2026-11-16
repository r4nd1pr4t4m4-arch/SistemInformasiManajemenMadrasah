import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSignedOtpToken, generateNumericOtp } from '@/lib/auth/otp-token';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildEmailChangeOtpEmail } from '@/lib/email/templates';

export const EMAIL_CHANGE_OTP_COOKIE = 'simms_email_change_otp';

const SendEmailOtpSchema = z.object({
  newEmail: z.string().email('Format alamat email baru tidak valid.'),
});

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  if (!isGmailSmtpConfigured()) {
    return NextResponse.json(
      {
        error:
          'GMAIL_SMTP_USER dan GMAIL_SMTP_APP_PASSWORD belum dikonfigurasi pada environment variables.',
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = SendEmailOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Alamat email baru tidak valid.' },
        { status: 400 }
      );
    }

    const normalizedNewEmail = parsed.data.newEmail.trim().toLowerCase();
    if (session.email && normalizedNewEmail === session.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'Alamat email baru harus berbeda dari alamat email saat ini.' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', normalizedNewEmail)
      .neq('id', session.userId)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Alamat email baru tersebut sudah terdaftar pada akun lain.' },
        { status: 400 }
      );
    }

    const [school, otp] = await Promise.all([
      getInstitutionSettings(),
      Promise.resolve(generateNumericOtp()),
    ]);

    // Ikat token OTP ke userId + alamat email baru
    const signedToken = createSignedOtpToken(`${session.userId}:${normalizedNewEmail}`, otp);
    const emailPayload = buildEmailChangeOtpEmail({
      institutionName: school.name,
      institutionAddress: school.address,
      institutionEmail: school.email,
      recipientName: session.fullName,
      newEmail: normalizedNewEmail,
      otpCode: otp,
      requestedAtWib: formatWibDateTime(),
    });

    await sendInstitutionalEmail({
      senderLabel: school.short_name || school.name,
      to: normalizedNewEmail,
      ...emailPayload,
    });

    const response = NextResponse.json({
      ok: true,
      message: `Kode OTP 6 digit telah dikirim ke alamat email baru (${normalizedNewEmail}).`,
    });

    response.cookies.set(EMAIL_CHANGE_OTP_COOKIE, signedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Email change OTP send error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Gagal mengirim email OTP: ${error.message}`
            : 'Gagal mengirim kode OTP ke alamat email baru.',
      },
      { status: 500 }
    );
  }
}
