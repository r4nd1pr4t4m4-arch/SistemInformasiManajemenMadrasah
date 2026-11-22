import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { OTP_COOKIE_NAME, verifySignedOtpToken } from '@/lib/auth/otp-token';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildPasswordChangedEmail } from '@/lib/email/templates';

const ChangePasswordSchema = z.object({
  method: z.enum(['otp', 'mfa']).default('otp'),
  currentPassword: z.string().min(1),
  otpCode: z.string().optional().default(''),
  newPassword: z.string().min(8),
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
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Kata sandi saat ini dan kata sandi baru (minimal 8 karakter) wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Jika menggunakan MFA, pastikan sesi saat ini sudah AAL2 sebelum verifikasi password
    const serverClient = await createSupabaseServerClient();
    if (parsed.data.method === 'mfa') {
      const { data: aal } = await serverClient.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== 'aal2') {
        return NextResponse.json(
          { error: 'Verifikasi MFA (AAL2) diperlukan sebelum mengganti kata sandi.' },
          { status: 403 }
        );
      }
    }

    // 2. Validasi kata sandi saat ini menggunakan client stateless agar cookie sesi (termasuk AAL2) tidak tertimpa
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Layanan autentikasi belum siap.' }, { status: 503 });
    }
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: pwdErr } = await verifyClient.auth.signInWithPassword({
      email: session.email,
      password: parsed.data.currentPassword,
    });
    if (pwdErr) {
      return NextResponse.json(
        { error: 'Kata sandi saat ini salah.' },
        { status: 400 }
      );
    }

    // 3. Validasi kebijakan kekuatan kata sandi baru
    const strengthCheck = validatePasswordStrength(parsed.data.newPassword, session.fullName);
    if (!strengthCheck.isValid) {
      return NextResponse.json(
        { error: `Kata sandi baru belum memenuhi syarat: ${strengthCheck.errors[0]}` },
        { status: 400 }
      );
    }

    // 4. Verifikasi OTP jika method === 'otp'
    if (parsed.data.method === 'otp') {
      const cookieStore = await cookies();
      const token = cookieStore.get(OTP_COOKIE_NAME)?.value;

      if (!token) {
        return NextResponse.json(
          {
            error:
              'Kode OTP belum dikirim atau sudah kedaluwarsa. Klik Kirim Kode OTP terlebih dahulu.',
          },
          { status: 400 }
        );
      }

      const check = await verifySignedOtpToken(token, session.userId, parsed.data.otpCode);
      if (!check.valid) {
        return NextResponse.json(
          { error: check.reason || 'Kode OTP tidak valid.' },
          { status: 400 }
        );
      }
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(session.userId, {
      password: parsed.data.newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (isGmailSmtpConfigured()) {
      try {
        const school = await getInstitutionSettings();
        const notice = buildPasswordChangedEmail({
          institutionName: school.name,
          institutionAddress: school.address,
          institutionEmail: school.email,
          recipientName: session.fullName,
          recipientEmail: session.email,
          changedAtWib: formatWibDateTime(),
        });
        await sendInstitutionalEmail({
          senderLabel: school.short_name || school.name,
          to: session.email,
          ...notice,
        });
      } catch {
        // Non-blocking notification
      }
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Kata sandi akun berhasil diperbarui.',
    });
    if (parsed.data.method === 'otp') {
      response.cookies.delete(OTP_COOKIE_NAME);
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Gagal memproses perubahan kata sandi.' },
      { status: 500 }
    );
  }
}
