import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';

const LOGIN_ATTEMPTS_COOKIE = 'simms_login_attempts';
const LOGIN_CAPTCHA_THRESHOLD = 3;
const ATTEMPTS_TTL_SECONDS = 15 * 60; // 15 menit

const LoginSchema = z.object({
  email: z.string().email('Masukkan alamat email yang valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
  captcha: z.custom<CaptchaPayload>().optional(),
});

function getAttemptSecret(): string {
  return (
    process.env.CAPTCHA_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'simms-dev-login-attempts-secret'
  );
}

function readFailedAttempts(rawCookie: string | undefined): number {
  if (!rawCookie) return 0;
  const parts = rawCookie.split('.');
  if (parts.length !== 2) return 0;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getAttemptSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      count?: number;
      exp?: number;
    };
    if (!parsed.exp || Date.now() > parsed.exp) return 0;
    return Number(parsed.count) || 0;
  } catch {
    return 0;
  }
}

function signFailedAttempts(count: number): string {
  const payload = {
    count,
    exp: Date.now() + ATTEMPTS_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAttemptSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function mapSupabaseAuthError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Email atau kata sandi salah. Silakan periksa kembali.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email akun Anda belum terkonfirmasi.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat lalu coba lagi.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda.';
  }
  return rawMessage;
}

export async function GET() {
  const cookieStore = await cookies();
  const count = readFailedAttempts(cookieStore.get(LOGIN_ATTEMPTS_COOKIE)?.value);
  return NextResponse.json(
    {
      failedAttempts: count,
      requireCaptcha: count >= LOGIN_CAPTCHA_THRESHOLD,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Layanan autentikasi sedang tidak tersedia.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data login tidak valid.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const failedAttempts = readFailedAttempts(cookieStore.get(LOGIN_ATTEMPTS_COOKIE)?.value);
    const captchaRequired = failedAttempts >= LOGIN_CAPTCHA_THRESHOLD;

    if (captchaRequired) {
      const captchaResult = await verifyCaptchaToken(parsed.data.captcha, request);
      if (!captchaResult.success) {
        return NextResponse.json(
          {
            error: captchaResult.error || 'Verifikasi keamanan gagal.',
            requireCaptcha: true,
            failedAttempts,
            turnstileUnavailable: Boolean(captchaResult.turnstileUnavailable),
          },
          { status: 403 }
        );
      }
    }

    const supabase = await createSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
    });

    if (error || !authData.user) {
      const nextCount = failedAttempts + 1;
      const res = NextResponse.json(
        {
          error: mapSupabaseAuthError(error?.message || 'Gagal masuk.'),
          requireCaptcha: nextCount >= LOGIN_CAPTCHA_THRESHOLD,
          failedAttempts: nextCount,
        },
        { status: 401 }
      );
      res.cookies.set(LOGIN_ATTEMPTS_COOKIE, signFailedAttempts(nextCount), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ATTEMPTS_TTL_SECONDS,
      });
      return res;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_active, account_status, rejection_reason')
      .eq('id', authData.user.id)
      .maybeSingle();

    const fallbackProfile = profileErr
      ? (
          await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', authData.user.id)
            .maybeSingle()
        ).data
      : profile;

    const rawAccountStatus = (profile as { account_status?: string } | null)?.account_status;
    const rawRejectionReason = (profile as { rejection_reason?: string | null } | null)
      ?.rejection_reason;
    const isPermanentRejected =
      rawAccountStatus === 'DITOLAK_PERMANEN' ||
      (rawAccountStatus === 'DITOLAK' &&
        Boolean(rawRejectionReason?.startsWith('[TOLAK_PERMANEN]')));
    const accountStatus = isPermanentRejected ? 'DITOLAK_PERMANEN' : rawAccountStatus;
    const rejectionReason = rawRejectionReason
      ? rawRejectionReason.replace(/^\[TOLAK_PERMANEN\]\s*/, '')
      : null;
    const isAllowed =
      Boolean(fallbackProfile?.is_active) && (!accountStatus || accountStatus === 'AKTIF');

    if (!isAllowed) {
      await supabase.auth.signOut();
      let errorMessage =
        'Akun Anda belum aktif dan sedang menunggu persetujuan Admin. Anda akan menerima email setelah akun disetujui.';
      if (accountStatus === 'DITOLAK_PERMANEN') {
        errorMessage = rejectionReason
          ? `Pendaftaran akun Anda ditolak secara permanen oleh Admin. Alasan: ${rejectionReason}. Alamat email ini tidak dapat digunakan untuk mendaftar ulang.`
          : 'Pendaftaran akun Anda ditolak secara permanen oleh Admin dan alamat email ini tidak dapat digunakan untuk mendaftar ulang.';
      } else if (accountStatus === 'DITOLAK') {
        errorMessage = rejectionReason
          ? `Pendaftaran akun Anda ditolak oleh Admin. Alasan: ${rejectionReason}. Anda dapat mendaftar ulang menggunakan email yang sama pada tab "Daftar Akun".`
          : 'Pendaftaran akun Anda ditolak oleh Admin. Anda dapat mendaftar ulang menggunakan email yang sama pada tab "Daftar Akun".';
      } else if (accountStatus === 'NONAKTIF') {
        errorMessage =
          'Akun Anda sedang dinonaktifkan oleh Admin. Silakan hubungi operator lembaga.';
      }

      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    const res = NextResponse.json({
      ok: true,
      user: { id: authData.user.id, email: authData.user.email },
    });
    res.cookies.delete(LOGIN_ATTEMPTS_COOKIE);
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server saat memproses login.' },
      { status: 500 }
    );
  }
}
