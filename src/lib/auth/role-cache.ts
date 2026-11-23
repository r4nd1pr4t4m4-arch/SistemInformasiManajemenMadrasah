import type { AppRole } from '@/types/database';
import type { PortalAccessContext } from '@/lib/auth/rbac';

export const ROLE_CACHE_COOKIE = 'simms_role_ctx';
export const ROLE_CACHE_TTL_SECONDS = 120; // 2 menit

export interface CachedRoleContext extends PortalAccessContext {
  uid: string;
  roles: AppRole[];
  exp: number;
}

function getRoleCacheSecret(): string | null {
  const secret =
    process.env.CAPTCHA_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (secret) return `simms-role-cache-v1:${secret}`;
  if (process.env.NODE_ENV !== 'production') {
    return 'simms-role-cache-v1:dev-secret';
  }
  return null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function computeHmacSignature(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toBase64Url(new Uint8Array(sigBuffer));
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signRoleCacheCookie(payload: Omit<CachedRoleContext, 'exp'>): Promise<string | null> {
  const secret = getRoleCacheSecret();
  if (!secret || typeof crypto === 'undefined' || !crypto.subtle) return null;

  const fullPayload: CachedRoleContext = {
    ...payload,
    exp: Date.now() + ROLE_CACHE_TTL_SECONDS * 1000,
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const sig = await computeHmacSignature(secret, encoded);
  return `${encoded}.${sig}`;
}

export async function verifyRoleCacheCookie(
  rawCookie: string | undefined,
  expectedUserId: string
): Promise<CachedRoleContext | null> {
  if (!rawCookie) return null;
  const secret = getRoleCacheSecret();
  if (!secret || typeof crypto === 'undefined' || !crypto.subtle) return null;

  const parts = rawCookie.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  try {
    const expectedSig = await computeHmacSignature(secret, encoded);
    if (!timingSafeEqualString(sig, expectedSig)) return null;

    const bytes = fromBase64Url(encoded);
    if (!bytes) return null;
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CachedRoleContext;
    if (
      !parsed ||
      parsed.uid !== expectedUserId ||
      !Array.isArray(parsed.roles) ||
      parsed.roles.length === 0 ||
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
