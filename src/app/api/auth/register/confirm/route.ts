import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySignedOtpToken } from '@/lib/auth/otp-token';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { REGISTER_VERIFIED_COOKIE } from '@/app/api/auth/register/verify-otp/route';
import { sanitizeApiError } from '@/lib/security/api-error';

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

    const check = await verifySignedOtpToken(
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

    // Cek apakah email ini sudah ada di profiles (misal: akun yang sebelumnya DITOLAK biasa dan sedang daftar ulang)
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, account_status, is_active, rejection_reason')
      .ilike('email', normalizedEmail.replace(/[\\%_]/g, '\\$&'))
      .maybeSingle();

    if (existingProfile) {
      const rawStatus =
        existingProfile.account_status || (existingProfile.is_active ? 'AKTIF' : 'NONAKTIF');
      const isPermanentRejected =
        rawStatus === 'DITOLAK_PERMANEN' ||
        (rawStatus === 'DITOLAK' &&
          Boolean(existingProfile.rejection_reason?.startsWith('[TOLAK_PERMANEN]')));

      if (isPermanentRejected) {
        return NextResponse.json(
          {
            error:
              'Pendaftaran dengan alamat email ini telah ditolak secara permanen oleh Admin dan tidak dapat didaftarkan kembali.',
          },
          { status: 403 }
        );
      }

      if (rawStatus !== 'DITOLAK') {
        return NextResponse.json(
          { error: 'Alamat email tersebut sudah terdaftar pada akun lain.' },
          { status: 409 }
        );
      }

      // Pengguna berstatus DITOLAK (biasa) mendaftar ulang: perbarui password & nama di Auth, lalu kembalikan ke PENDING
      const { error: updateAuthErr } = await admin.auth.admin.updateUserById(existingProfile.id, {
        email: normalizedEmail,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (updateAuthErr) {
        return NextResponse.json(
          { error: sanitizeApiError(updateAuthErr, 'Gagal memperbarui kredensial pendaftaran ulang.') },
          { status: 400 }
        );
      }

      await admin
        .from('profiles')
        .update({
          full_name: fullName,
          is_active: false,
          account_status: 'PENDING',
          rejection_reason: null,
          reviewed_at: null,
          reviewed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id);

      const reRegResponse = NextResponse.json({
        ok: true,
        message:
          'Pendaftaran ulang berhasil! Data akun Anda telah diperbarui dan statusnya kembali menjadi Menunggu Persetujuan Admin.',
      });
      reRegResponse.cookies.delete(REGISTER_VERIFIED_COOKIE);
      return reRegResponse;
    }

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
      { error: sanitizeApiError(err, 'Gagal menyelesaikan pendaftaran akun.') },
      { status: 500 }
    );
  }
}
