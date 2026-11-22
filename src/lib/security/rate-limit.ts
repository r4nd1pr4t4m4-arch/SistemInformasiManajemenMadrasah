import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export interface RateLimitState {
  count: number;
  lockedUntil: number | null;
}

const memoryRateLimits = new Map<string, { count: number; lockedUntil: number | null; expiresAt: number }>();
const memoryNonces = new Map<string, number>();

function pruneMemoryStores(now: number) {
  if (memoryRateLimits.size > 500) {
    for (const [k, v] of memoryRateLimits.entries()) {
      if (v.expiresAt <= now) memoryRateLimits.delete(k);
    }
  }
  if (memoryNonces.size > 500) {
    for (const [k, exp] of memoryNonces.entries()) {
      if (exp <= now) memoryNonces.delete(k);
    }
  }
}

export async function getRateLimitState(key: string): Promise<RateLimitState> {
  const now = Date.now();
  pruneMemoryStores(now);

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from('security_rate_limits')
        .select('count, locked_until, expires_at')
        .eq('key', key)
        .maybeSingle();

      if (!error) {
        if (!data) return { count: 0, lockedUntil: null };
        const expMs = new Date(data.expires_at).getTime();
        if (Number.isNaN(expMs) || expMs <= now) {
          await supabase.from('security_rate_limits').delete().eq('key', key);
          return { count: 0, lockedUntil: null };
        }
        const lockedMs = data.locked_until ? new Date(data.locked_until).getTime() : null;
        return {
          count: Number(data.count) || 0,
          lockedUntil: lockedMs && !Number.isNaN(lockedMs) ? lockedMs : null,
        };
      }
    } catch {
      // Fallback ke memory store jika tabel belum dimigrasi
    }
  }

  const mem = memoryRateLimits.get(key);
  if (!mem || mem.expiresAt <= now) {
    memoryRateLimits.delete(key);
    return { count: 0, lockedUntil: null };
  }
  return { count: mem.count, lockedUntil: mem.lockedUntil };
}

export async function incrementRateLimit(
  key: string,
  opts: {
    ttlSeconds: number;
    lockoutThreshold?: number;
    lockoutDurationMs?: number;
  }
): Promise<RateLimitState> {
  const now = Date.now();
  const current = await getRateLimitState(key);
  const nextCount = current.count + 1;
  const shouldLock =
    opts.lockoutThreshold != null &&
    opts.lockoutDurationMs != null &&
    nextCount >= opts.lockoutThreshold;
  const lockedUntil = shouldLock
    ? now + (opts.lockoutDurationMs || 0)
    : current.lockedUntil && current.lockedUntil > now
      ? current.lockedUntil
      : null;

  const expiresAtMs = Math.max(
    now + opts.ttlSeconds * 1000,
    lockedUntil || 0
  );

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from('security_rate_limits').upsert(
        {
          key,
          count: nextCount,
          locked_until: lockedUntil ? new Date(lockedUntil).toISOString() : null,
          expires_at: new Date(expiresAtMs).toISOString(),
          updated_at: new Date(now).toISOString(),
        },
        { onConflict: 'key' }
      );
      if (!error) {
        return { count: nextCount, lockedUntil };
      }
    } catch {
      // Fallback ke memory store
    }
  }

  memoryRateLimits.set(key, {
    count: nextCount,
    lockedUntil,
    expiresAt: expiresAtMs,
  });
  return { count: nextCount, lockedUntil };
}

export async function clearRateLimit(key: string): Promise<void> {
  memoryRateLimits.delete(key);
  if (!isSupabaseAdminConfigured()) return;
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('security_rate_limits').delete().eq('key', key);
  } catch {
    // Non-blocking
  }
}

export async function consumeSingleUseNonce(
  nonceKey: string,
  expiresAtMs: number
): Promise<boolean> {
  const now = Date.now();
  pruneMemoryStores(now);

  if (memoryNonces.has(nonceKey)) {
    return false;
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from('security_used_nonces').insert({
        nonce: nonceKey,
        expires_at: new Date(expiresAtMs).toISOString(),
      });

      if (!error) {
        memoryNonces.set(nonceKey, expiresAtMs);
        return true;
      }

      // 23505 = unique_violation -> nonce sudah pernah dipakai
      if (error.code === '23505') {
        return false;
      }
    } catch {
      // Fallback ke memory store
    }
  }

  memoryNonces.set(nonceKey, expiresAtMs);
  return true;
}
