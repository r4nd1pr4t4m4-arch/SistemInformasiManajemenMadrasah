import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getRequestClientIp, verifyCaptchaToken } from '@/lib/security/captcha-server';
import {
  clearRateLimit,
  getRateLimitState,
  incrementRateLimit,
  type RateLimitState,
} from '@/lib/security/rate-limit';
import type { CaptchaPayload } from '@/lib/security/captcha-types';

const LOGIN_ATTEMPTS_COOKIE = 'simms_login_attempts';
const LOGIN_CAPTCHA_THRESHOLD = 3;
const LOGIN_WARNING_THRESHOLD = 3;
const LOGIN_LOCKOUT_THRESHOLD = 5;
const ATTEMPTS_TTL_SECONDS = 15 * 60; // 15 menit
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 menit

const LoginSchema = z.object({
  email: z.string().email('Masukkan alamat email yang valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
  captcha: z.custom<CaptchaPayload>().optional(),
});

interface AttemptState {
  count: number;
  lockedUntil: number | null;
}

function getAttemptSecret(): string {
  const secret =
    process.env.CAPTCHA_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') {
    return 'simms-dev-login-attempts-secret';
  }
  throw new Error('CAPTCHA_SIGNING_SECRET atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.');
}

function mergeAttemptStates(...states: RateLimitState[]): AttemptState {
  let maxCount = 0;
  let maxLocked: number | null = null;
  for (const s of states) {
    if (s.count > maxCount) maxCount = s.count;
    if (s.lockedUntil && (!maxLocked || s.lockedUntil > maxLocked)) {
      maxLocked = s.lockedUntil;
    }
  }
  return { count: maxCount, lockedUntil: maxLocked };
}

function readAttemptState(rawCookie: string | undefined): AttemptState {
  if (!rawCookie) return { count: 0, lockedUntil: null };
  const parts = rawCookie.split('.');
  if (parts.length !== 2) return { count: 0, lockedUntil: null };
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getAttemptSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { count: 0, lockedUntil: null };
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      count?: number;
      lockedUntil?: number | null;
      exp?: number;
    };
    if (!parsed.exp || Date.now() > parsed.exp) return { count: 0, lockedUntil: null };
    return {
      count: Number(parsed.count) || 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    };
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function signAttemptState(count: number, lockedUntil: number | null): string {
  const now = Date.now();
  const exp = lockedUntil && lockedUntil > now ? lockedUntil : now + ATTEMPTS_TTL_SECONDS * 1000;
  const payload = {
    count,
    lockedUntil,
    exp,
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

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const cookieState = readAttemptState(cookieStore.get(LOGIN_ATTEMPTS_COOKIE)?.value);
  const ip = getRequestClientIp(request);
  const ipState = ip ? await getRateLimitState(`login:ip:${ip}`) : { count: 0, lockedUntil: null };
  const state = mergeAttemptStates(cookieState, ipState);
  const now = Date.now();
  const isLocked = Boolean(state.lockedUntil && state.lockedUntil > now);
  const remainingLockSeconds = isLocked
    ? Math.max(1, Math.ceil((state.lockedUntil! - now) / 1000))
    : 0;

  return NextResponse.json(
    {
      failedAttempts: state.count,
      maxAttempts: LOGIN_LOCKOUT_THRESHOLD,
      remainingAttempts: Math.max(0, LOGIN_LOCKOUT_THRESHOLD - state.count),
      requireCaptcha: state.count >= LOGIN_CAPTCHA_THRESHOLD,
      isLocked,
      remainingLockSeconds,
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

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const clientIp = getRequestClientIp(request);
    const emailKey = `login:email:${normalizedEmail}`;
    const ipKey = clientIp ? `login:ip:${clientIp}` : null;

    const cookieStore = await cookies();
    const cookieState = readAttemptState(cookieStore.get(LOGIN_ATTEMPTS_COOKIE)?.value);
    const [emailState, ipState] = await Promise.all([
      getRateLimitState(emailKey),
      ipKey ? getRateLimitState(ipKey) : Promise.resolve({ count: 0, lockedUntil: null }),
    ]);
    const attemptState = mergeAttemptStates(cookieState, emailState, ipState);
    const now = Date.now();

    if (attemptState.lockedUntil && attemptState.lockedUntil > now) {
      const remainingLockSeconds = Math.max(
        1,
        Math.ceil((attemptState.lockedUntil - now) / 1000)
      );
      return NextResponse.json(
        {
          error:
            'Akses masuk dibekukan sementara selama 15 menit karena 5 kali percobaan gagal. Silakan tunggu atau reset kata sandi Anda.',
          isLocked: true,
          remainingLockSeconds,
          failedAttempts: attemptState.count,
          maxAttempts: LOGIN_LOCKOUT_THRESHOLD,
          remainingAttempts: 0,
          requireCaptcha: true,
        },
        { status: 429 }
      );
    }

    const failedAttempts = attemptState.count;
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
      const rawMessage = error?.message || 'Gagal masuk.';
      const isCredentialError = rawMessage.toLowerCase().includes('invalid login credentials');

      if (!isCredentialError) {
        return NextResponse.json(
          {
            error: mapSupabaseAuthError(rawMessage),
            requireCaptcha: failedAttempts >= LOGIN_CAPTCHA_THRESHOLD,
            failedAttempts,
            isCredentialError: false,
          },
          { status: 401 }
        );
      }

      const [nextEmailState, nextIpState] = await Promise.all([
        incrementRateLimit(emailKey, {
          ttlSeconds: ATTEMPTS_TTL_SECONDS,
          lockoutThreshold: LOGIN_LOCKOUT_THRESHOLD,
          lockoutDurationMs: LOCKOUT_DURATION_MS,
        }),
        ipKey
          ? incrementRateLimit(ipKey, {
              ttlSeconds: ATTEMPTS_TTL_SECONDS,
              lockoutThreshold: LOGIN_LOCKOUT_THRESHOLD,
              lockoutDurationMs: LOCKOUT_DURATION_MS,
            })
          : Promise.resolve({ count: 0, lockedUntil: null }),
      ]);
      const mergedNext = mergeAttemptStates(
        { count: failedAttempts + 1, lockedUntil: null },
        nextEmailState,
        nextIpState
      );
      const nextCount = mergedNext.count;
      const isLocked = nextCount >= LOGIN_LOCKOUT_THRESHOLD;
      const lockedUntil = isLocked
        ? mergedNext.lockedUntil || Date.now() + LOCKOUT_DURATION_MS
        : null;
      const remainingAttempts = Math.max(0, LOGIN_LOCKOUT_THRESHOLD - nextCount);
      const showLockWarningModal = nextCount === LOGIN_WARNING_THRESHOLD;

      let errorMessage = mapSupabaseAuthError(rawMessage);
      if (isLocked) {
        errorMessage =
          'Akses masuk dibekukan selama 15 menit karena 5 kali gagal login. Silakan tunggu atau reset kata sandi Anda.';
      } else if (remainingAttempts === 1) {
        errorMessage =
          'Email atau kata sandi salah. Tersisa 1 percobaan lagi sebelum akun dibekukan selama 15 menit.';
      }

      const res = NextResponse.json(
        {
          error: errorMessage,
          isCredentialError: true,
          requireCaptcha: nextCount >= LOGIN_CAPTCHA_THRESHOLD,
          failedAttempts: nextCount,
          maxAttempts: LOGIN_LOCKOUT_THRESHOLD,
          remainingAttempts,
          showLockWarningModal,
          isLocked,
          remainingLockSeconds: isLocked ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0,
        },
        { status: isLocked ? 429 : 401 }
      );
      res.cookies.set(LOGIN_ATTEMPTS_COOKIE, signAttemptState(nextCount, lockedUntil), {
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

    await Promise.all([
      clearRateLimit(emailKey),
      ipKey ? clearRateLimit(ipKey) : Promise.resolve(),
    ]);

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
