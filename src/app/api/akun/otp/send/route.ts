import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import {
  createSignedOtpToken,
  generateNumericOtp,
  OTP_COOKIE_NAME,
} from '@/lib/auth/otp-token';

export async function POST() {
  const session = await getCurrentUserWithRoles();
  if (!session || !session.email) {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu dengan akun yang memiliki email.' },
      { status: 401 }
    );
  }

  const smtpUser = process.env.GMAIL_SMTP_USER;
  const smtpPass = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s+/g, '');

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      {
        error:
          'GMAIL_SMTP_USER dan GMAIL_SMTP_APP_PASSWORD belum dikonfigurasi pada environment variables.',
      },
      { status: 503 }
    );
  }

  try {
    const otp = generateNumericOtp();
    const signedToken = createSignedOtpToken(session.userId, otp);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"SIMMS Portal" <${smtpUser}>`,
      to: session.email,
      subject: 'Kode OTP Verifikasi Ganti Kata Sandi SIMMS',
      text: `Kode OTP Anda adalah: ${otp}. Berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #0f172a; margin-top: 0;">Kode Verifikasi OTP SIMMS</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Halo <strong>${session.fullName}</strong>, gunakan kode OTP 6 digit berikut untuk memverifikasi perubahan kata sandi akun Anda:
          </p>
          <div style="margin: 20px 0; padding: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; text-align: center;">
            <span style="font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #047857;">
              ${otp}
            </span>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Kode ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.
          </p>
        </div>
      `,
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
