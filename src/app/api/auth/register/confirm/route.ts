import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySignedOtpToken } from '@/lib/auth/otp-token';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { REGISTER_VERIFIED_COOKIE } from '@/app/api/auth/register/verify-otp/route';

const ConfirmRegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.'),
  email: z.string().email('Format alamat email tidak valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
});

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ConfirmRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pendaftaran tidak valid.' },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const fullName = parsed.data.fullName.trim();

    const policy = validatePasswordStrength(parsed.data.password, fullName);
    if (!policy.isValid) {
      return NextResponse.json(
        { error: `Kata sandi belum memenuhi syarat: ${policy.errors[0]}` },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const verifiedCookie = cookieStore.get(REGISTER_VERIFIED_COOKIE)?.value;
    if (!verifiedCookie) {
      return NextResponse.json(
        { error: 'Alamat email belum diverifikasi dengan kode OTP.' },
        { status: 400 }
      );
    }

    const check = verifySignedOtpToken(
      verifiedCookie,
      `verified:${normalizedEmail}`,
      'VERIFIED'
    );
    if (!check.valid) {
      return NextResponse.json(
        { error: 'Verifikasi email tidak valid atau sudah kedaluwarsa. Silakan ulangi OTP.' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created.user) {
      return NextResponse.json(
        { error: createErr?.message || 'Gagal membuat akun pengguna.' },
        { status: 400 }
      );
    }

    // Pastikan status awal akun belum aktif (PENDING) menunggu persetujuan Admin
    await admin
      .from('profiles')
      .update({
        full_name: fullName,
        is_active: false,
        account_status: 'PENDING',
      })
      .eq('id', created.user.id);

    const response = NextResponse.json({
      ok: true,
      message:
        'Pendaftaran akun berhasil! Email Anda telah terverifikasi. Akun saat ini berstatus menunggu persetujuan Admin dan Anda akan menerima email notifikasi setelah disetujui atau ditolak.',
    });

    response.cookies.delete(REGISTER_VERIFIED_COOKIE);
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menyelesaikan pendaftaran akun.' },
      { status: 500 }
    );
  }
}
