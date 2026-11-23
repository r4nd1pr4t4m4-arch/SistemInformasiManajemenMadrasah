import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { RESET_OTP_COOKIE_NAME, verifySignedOtpToken } from '@/lib/auth/otp-token';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildPasswordChangedEmail } from '@/lib/email/templates';
import { sanitizeApiError } from '@/lib/security/api-error';

const ConfirmResetSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().min(4).max(10),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan autentikasi belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ConfirmResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Email, kode OTP, dan kata sandi baru wajib diisi.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const supabase = createSupabaseAdminClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    const pwdCheck = validatePasswordStrength(parsed.data.newPassword, profile.full_name);
    if (!pwdCheck.isValid) {
      return NextResponse.json(
        { error: `Kata sandi belum memenuhi syarat: ${pwdCheck.errors[0]}` },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(RESET_OTP_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Kode OTP belum dikirim atau sudah kedaluwarsa.' },
        { status: 400 }
      );
    }

    const check = await verifySignedOtpToken(token, profile.id, parsed.data.otpCode);
    if (!check.valid) {
      return NextResponse.json(
        { error: check.reason || 'Kode OTP tidak valid.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.admin.updateUserById(profile.id, {
      password: parsed.data.newPassword,
    });

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    if (isGmailSmtpConfigured()) {
      try {
        const school = await getInstitutionSettings();
        const notice = buildPasswordChangedEmail({
          institutionName: school.name,
          institutionAddress: school.address,
          institutionEmail: school.email,
          recipientName: profile.full_name || email,
          recipientEmail: email,
          changedAtWib: formatWibDateTime(),
        });
        await sendInstitutionalEmail({
          senderLabel: school.short_name || school.name,
          to: email,
          ...notice,
        });
      } catch {
        // Non-blocking notification
      }
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Kata sandi berhasil direset. Silakan masuk dengan kata sandi baru.',
    });
    response.cookies.delete(RESET_OTP_COOKIE_NAME);
    return response;
  } catch {
    return NextResponse.json({ error: 'Gagal mereset kata sandi.' }, { status: 500 });
  }
}
