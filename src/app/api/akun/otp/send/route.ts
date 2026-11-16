import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import {
  createSignedOtpToken,
  generateNumericOtp,
  OTP_COOKIE_NAME,
} from '@/lib/auth/otp-token';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildPasswordOtpEmail } from '@/lib/email/templates';

export async function POST() {
  const session = await getCurrentUserWithRoles();
  if (!session || !session.email) {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu dengan akun yang memiliki email.' },
      { status: 401 }
    );
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
    const [school, otp] = await Promise.all([
      getInstitutionSettings(),
      Promise.resolve(generateNumericOtp()),
    ]);

    const signedToken = createSignedOtpToken(session.userId, otp);
    const emailPayload = buildPasswordOtpEmail({
      institutionName: school.name,
      institutionAddress: school.address,
      institutionEmail: school.email,
      recipientName: session.fullName,
      recipientEmail: session.email,
      otpCode: otp,
      requestedAtWib: formatWibDateTime(),
    });

    await sendInstitutionalEmail({
      senderLabel: school.short_name || school.name,
      to: session.email,
      ...emailPayload,
    });

    const response = NextResponse.json({
      ok: true,
      message: `Kode OTP 6 digit telah dikirim ke ${session.email}.`,
    });

    response.cookies.set(OTP_COOKIE_NAME, signedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Nodemailer OTP send error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Gagal mengirim email OTP: ${error.message}`
            : 'Gagal mengirim email OTP melalui Gmail SMTP.',
      },
      { status: 500 }
    );
  }
}
