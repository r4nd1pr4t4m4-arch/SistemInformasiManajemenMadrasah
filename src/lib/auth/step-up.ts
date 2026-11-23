import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const STEP_UP_COOKIE = 'simms_step_up';
export const STEP_UP_TTL_SECONDS = 10 * 60; // 10 menit

export interface StepUpPayload {
  uid: string;
  method: 'password' | 'mfa';
  exp: number;
}

function getStepUpSecret(): string {
  const secret =
    process.env.CAPTCHA_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return `simms-step-up-v1:${secret}`;
  if (process.env.NODE_ENV !== 'production') {
    return 'simms-step-up-v1:dev-secret';
  }
  throw new Error('CAPTCHA_SIGNING_SECRET atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.');
}

export function signStepUpCookie(userId: string, method: 'password' | 'mfa'): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Date.now() + STEP_UP_TTL_SECONDS * 1000;
  const payload: StepUpPayload = { uid: userId, method, exp: expiresAt };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getStepUpSecret())
    .update(encoded)
    .digest('base64url');
  return { token: `${encoded}.${sig}`, expiresAt };
}

export function verifyStepUpCookie(
  rawCookie: string | undefined,
  expectedUserId: string
): StepUpPayload | null {
  if (!rawCookie) return null;
  const parts = rawCookie.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getStepUpSecret())
      .update(encoded)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as StepUpPayload;
    if (
      !parsed ||
      parsed.uid !== expectedUserId ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getActiveStepUp(userId: string): Promise<StepUpPayload | null> {
  const cookieStore = await cookies();
  return verifyStepUpCookie(cookieStore.get(STEP_UP_COOKIE)?.value, userId);
}
