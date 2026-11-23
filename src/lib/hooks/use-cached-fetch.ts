'use client';

import { useCallback, useEffect, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

function notifyKey(key: string) {
  const subs = listeners.get(key);
  if (!subs) return;
  for (const fn of subs) fn();
}

export function invalidateCachedFetch(keyOrPrefix: string, exact = false) {
  for (const key of Array.from(responseCache.keys())) {
    if (exact ? key === keyOrPrefix : key.startsWith(keyOrPrefix)) {
      responseCache.delete(key);
      notifyKey(key);
    }
  }
}

export interface UseCachedFetchOptions {
  staleTimeMs?: number;
  enabled?: boolean;
}

/**
 * Lightweight Stale-While-Revalidate (SWR) & request-deduplication hook
 * dengan dukungan Optimistic UI (`mutate`) tanpa dependensi eksternal tambahan.
 */
export function useCachedFetch<T>(
  url: string | null,
  options: UseCachedFetchOptions = {}
) {
  const { staleTimeMs = 30_000, enabled = true } = options;
  const cacheKey = enabled && url ? url : null;

  const getCached = useCallback((): T | null => {
    if (!cacheKey) return null;
    const entry = responseCache.get(cacheKey);
    return entry ? (entry.data as T) : null;
  }, [cacheKey]);

  const [data, setData] = useState<T | null>(() => getCached());
  const [loading, setLoading] = useState<boolean>(() => Boolean(cacheKey && !getCached()));
  const [validating, setValidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (force = false) => {
      if (!cacheKey) return;

      const existing = responseCache.get(cacheKey);
      if (!force && existing && Date.now() - existing.updatedAt < staleTimeMs) {
        setData(existing.data as T);
        setLoading(false);
        setError(null);
        return;
      }

      if (!existing) {
        setLoading(true);
      } else {
        setValidating(true);
      }
      setError(null);

      try {
        let promise = inflightRequests.get(cacheKey) as Promise<T> | undefined;
        if (!promise) {
          promise = fetch(cacheKey, { cache: 'no-store' }).then(async (res) => {
            const json = await res.json().catch(() => null);
            if (!res.ok) {
              throw new Error(
                (json as { error?: string } | null)?.error || 'Gagal memuat data dari server.'
              );
            }
            return json as T;
          });
          inflightRequests.set(cacheKey, promise);
        }

        const result = await promise;
        responseCache.set(cacheKey, { data: result, updatedAt: Date.now() });
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data.');
      } finally {
        inflightRequests.delete(cacheKey);
        setLoading(false);
        setValidating(false);
      }
    },
    [cacheKey, staleTimeMs]
  );

  useEffect(() => {
    if (!cacheKey) return;
    let subs = listeners.get(cacheKey);
    if (!subs) {
      subs = new Set();
      listeners.set(cacheKey, subs);
    }
    const onInvalidate = () => {
      void fetchData(true);
    };
    subs.add(onInvalidate);

    const timer = window.setTimeout(() => {
      void fetchData(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      subs?.delete(onInvalidate);
      if (subs && subs.size === 0) {
        listeners.delete(cacheKey);
      }
    };
  }, [cacheKey, fetchData]);

  // Optimistic local update helper
  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T), revalidate = false) => {
      if (!cacheKey) return;
      setData((prev) => {
        const next =
          typeof updater === 'function' ? (updater as (p: T | null) => T)(prev) : updater;
        responseCache.set(cacheKey, { data: next, updatedAt: Date.now() });
        return next;
      });
      if (revalidate) {
        void fetchData(true);
      }
    },
    [cacheKey, fetchData]
  );

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, validating, error, refetch, mutate };
}
