import crypto from 'node:crypto';
import type { CaptchaPayload } from './captcha-types';

const LOCAL_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 menit
const LOCAL_POW_DIFFICULTY = 3; // 3 nol hex di awal SHA-256 (~4096 iterasi, <20ms di browser)
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// In-memory replay guard untuk nonce lokal yang sudah dipakai
const usedNonces = new Map<string, number>();

function pruneUsedNonces(now: number) {
  if (usedNonces.size < 200) return;
  for (const [nonce, exp] of usedNonces.entries()) {
    if (exp <= now) usedNonces.delete(nonce);
  }
}

function getCaptchaSigningSecret(): string {
  const secret =
    process.env.CAPTCHA_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') {
    return 'simms-dev-local-captcha-secret';
  }
  throw new Error('CAPTCHA_SIGNING_SECRET atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.');
}

function isLocalhostRequest(request?: Request): boolean {
  if (!request) return false;
  const host = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    ''
  ).toLowerCase();
  const hostname = host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function isCaptchaBypassed(request?: Request): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_CAPTCHA === 'true') {
    return false;
  }
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  return isLocalhostRequest(request);
}

export function getRequestClientIp(request: Request): string | undefined {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return undefined;
}

export interface LocalCaptchaChallenge {
  challengeToken: string;
  nonce: string;
  difficulty: number;
  expiresAt: number;
}

export function createLocalCaptchaChallenge(): LocalCaptchaChallenge {
  const now = Date.now();
  const expiresAt = now + LOCAL_CHALLENGE_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = {
    nonce,
    difficulty: LOCAL_POW_DIFFICULTY,
    iat: now,
    exp: expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getCaptchaSigningSecret())
    .update(encoded)
    .digest('base64url');

  return {
    challengeToken: `${encoded}.${sig}`,
    nonce,
    difficulty: LOCAL_POW_DIFFICULTY,
    expiresAt,
  };
}

export function verifyLocalCaptchaChallenge(
  challengeToken: string,
  solution: string,
  honeypot?: string
): { valid: boolean; reason?: string } {
  if (honeypot && honeypot.trim().length > 0) {
    return { valid: false, reason: 'Permintaan terdeteksi sebagai bot.' };
  }

  const parts = challengeToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Token tantangan CAPTCHA lokal tidak valid.' };
  }

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getCaptchaSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedSigBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedSigBuf)
  ) {
    return { valid: false, reason: 'Tanda tangan tantangan CAPTCHA lokal tidak valid.' };
  }

  let parsed: { nonce: string; difficulty: number; iat: number; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'Format tantangan CAPTCHA lokal rusak.' };
  }

  const now = Date.now();
  pruneUsedNonces(now);

  if (!parsed.nonce || !parsed.exp || now > parsed.exp) {
    return { valid: false, reason: 'Tantangan CAPTCHA lokal telah kedaluwarsa. Silakan coba lagi.' };
  }

  if (usedNonces.has(parsed.nonce)) {
    return { valid: false, reason: 'Token CAPTCHA sudah digunakan. Silakan kirim ulang.' };
  }

  const trimmedSolution = String(solution || '').trim();
  if (!trimmedSolution || trimmedSolution.length > 64) {
    return { valid: false, reason: 'Solusi CAPTCHA lokal tidak valid.' };
  }

  const digest = crypto
    .createHash('sha256')
    .update(`${parsed.nonce}:${trimmedSolution}`)
    .digest('hex');

  const prefix = '0'.repeat(Math.max(1, Math.min(6, Number(parsed.difficulty) || LOCAL_POW_DIFFICULTY)));
  if (!digest.startsWith(prefix)) {
    return { valid: false, reason: 'Verifikasi CAPTCHA lokal gagal. Silakan coba lagi.' };
  }

  usedNonces.set(parsed.nonce, parsed.exp);
  return { valid: true };
}

export interface CaptchaVerificationResult {
  success: boolean;
  bypassed?: boolean;
  provider?: 'turnstile' | 'local' | 'bypass';
  turnstileUnavailable?: boolean;
  error?: string;
}

export async function verifyCaptchaToken(
  payload: CaptchaPayload | null | undefined,
  request?: Request
): Promise<CaptchaVerificationResult> {
  if (isCaptchaBypassed(request)) {
    return { success: true, bypassed: true, provider: 'bypass' };
  }

  if (!payload || !payload.provider) {
    return {
      success: false,
      error: 'Verifikasi keamanan (CAPTCHA) diperlukan. Silakan coba lagi.',
    };
  }

  if (payload.provider === 'local') {
    const localRes = verifyLocalCaptchaChallenge(
      payload.challengeToken,
      payload.solution,
      payload.honeypot
    );
    return localRes.valid
      ? { success: true, provider: 'local' }
      : { success: false, provider: 'local', error: localRes.reason };
  }

  if (payload.provider === 'turnstile') {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      return {
        success: false,
        provider: 'turnstile',
        turnstileUnavailable: true,
        error: 'Layanan Turnstile belum dikonfigurasi di server.',
      };
    }

    if (!payload.token || typeof payload.token !== 'string') {
      return {
        success: false,
        provider: 'turnstile',
        error: 'Token CAPTCHA Turnstile tidak ditemukan.',
      };
    }

    try {
      const formData = new URLSearchParams();
      formData.set('secret', secretKey);
      formData.set('response', payload.token);
      if (request) {
        const ip = getRequestClientIp(request);
        if (ip) formData.set('remoteip', ip);
      }

      const res = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) {
        return {
          success: false,
          provider: 'turnstile',
          turnstileUnavailable: true,
          error: 'Layanan verifikasi Turnstile sedang gangguan.',
        };
      }

      const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
      if (data.success) {
        return { success: true, provider: 'turnstile' };
      }

      const codes = data['error-codes'] || [];
      const isInfraError = codes.some((c) => c === 'internal-error');
      return {
        success: false,
        provider: 'turnstile',
        turnstileUnavailable: isInfraError,
        error: 'Verifikasi CAPTCHA gagal atau kedaluwarsa. Silakan coba lagi.',
      };
    } catch {
      return {
        success: false,
        provider: 'turnstile',
        turnstileUnavailable: true,
        error: 'Gagal menghubungi server verifikasi Turnstile.',
      };
    }
  }

  return {
    success: false,
    error: 'Provider CAPTCHA tidak dikenali.',
  };
}

export function parseCaptchaHeader(request: Request): CaptchaPayload | null {
  const raw = request.headers.get('x-captcha-payload');
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as CaptchaPayload;
  } catch {
    try {
      return JSON.parse(raw) as CaptchaPayload;
    } catch {
      return null;
    }
  }
}
