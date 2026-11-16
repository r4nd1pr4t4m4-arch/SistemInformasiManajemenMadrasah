import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { verifySignedOtpToken } from '@/lib/auth/otp-token';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMAIL_CHANGE_OTP_COOKIE } from '../send-otp/route';

const ConfirmEmailChangeSchema = z.object({
  newEmail: z.string().email('Format alamat email baru tidak valid.'),
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
  otpCode: z.string().min(4, 'Kode OTP wajib diisi.').max(10),
  mfaCode: z.string().optional().default(''),
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
    const parsed = ConfirmEmailChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data permintaan tidak lengkap.' },
        { status: 400 }
      );
    }

    const normalizedNewEmail = parsed.data.newEmail.trim().toLowerCase();
    if (normalizedNewEmail === session.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'Alamat email baru harus berbeda dari email saat ini.' },
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
      return NextResponse.json({ error: 'Kata sandi saat ini salah.' }, { status: 400 });
    }

    // 2. Verifikasi MFA jika akun memiliki faktor TOTP aktif
    const admin = createSupabaseAdminClient();
    const { data: factorRes, error: factorErr } = await admin.auth.admin.mfa.listFactors({
      userId: session.userId,
    });
    if (factorErr) {
      return NextResponse.json({ error: factorErr.message }, { status: 500 });
    }

    const verifiedTotp = (factorRes?.factors || []).find(
      (f) => f.status === 'verified' && f.factor_type === 'totp'
    );
    if (verifiedTotp) {
      const mfaInput = parsed.data.mfaCode.trim();
      if (!/^\d{6}$/.test(mfaInput)) {
        return NextResponse.json(
          { error: 'Akun Anda mengaktifkan MFA. Masukkan kode authenticator 6 digit.' },
          { status: 400 }
        );
      }

      const { error: mfaVerifyErr } = await serverClient.auth.mfa.challengeAndVerify({
        factorId: verifiedTotp.id,
        code: mfaInput,
      });
      if (mfaVerifyErr) {
        return NextResponse.json(
          { error: 'Kode MFA tidak valid atau sudah kedaluwarsa.' },
          { status: 400 }
        );
      }
    }

    // 3. Verifikasi OTP yang dikirim ke alamat email baru
    const cookieStore = await cookies();
    const token = cookieStore.get(EMAIL_CHANGE_OTP_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        {
          error:
            'Kode OTP email baru belum dikirim atau sudah kedaluwarsa. Klik "Kirim OTP ke Email Baru".',
        },
        { status: 400 }
      );
    }

    const otpCheck = verifySignedOtpToken(
      token,
      `${session.userId}:${normalizedNewEmail}`,
      parsed.data.otpCode.trim()
    );
    if (!otpCheck.valid) {
      return NextResponse.json(
        { error: otpCheck.reason || 'Kode OTP email baru tidak valid.' },
        { status: 400 }
      );
    }

    // 4. Perbarui email di Supabase Auth dan tabel profiles
    const { error: updateAuthErr } = await admin.auth.admin.updateUserById(session.userId, {
      email: normalizedNewEmail,
      email_confirm: true,
    });
    if (updateAuthErr) {
      return NextResponse.json({ error: updateAuthErr.message }, { status: 400 });
    }

    await admin
      .from('profiles')
      .update({
        email: normalizedNewEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.userId);

    const response = NextResponse.json({
      ok: true,
      email: normalizedNewEmail,
      message: `Alamat email akun berhasil diubah menjadi ${normalizedNewEmail}.`,
    });
    response.cookies.delete(EMAIL_CHANGE_OTP_COOKIE);
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Gagal memproses pergantian alamat email.' },
      { status: 500 }
    );
  }
}
