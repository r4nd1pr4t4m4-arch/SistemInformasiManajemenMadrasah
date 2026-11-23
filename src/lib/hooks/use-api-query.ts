'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

export interface UseApiQueryOptions<T> {
  enabled?: boolean;
  staleTimeMs?: number;
  revalidateOnFocus?: boolean;
  initialData?: T | null;
  transform?: (raw: unknown) => T;
  onError?: (errorMessage: string) => void;
}

export interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  validating: boolean;
  error: string | null;
  mutate: (updater?: T | null | ((prev: T | null) => T | null), revalidate?: boolean) => Promise<void>;
  refetch: (silent?: boolean) => Promise<void>;
}

export function clearApiQueryCache(prefix?: string) {
  if (!prefix) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

export function useApiQuery<T = unknown>(
  url: string | null,
  options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
  const {
    enabled = true,
    staleTimeMs = 15_000,
    revalidateOnFocus = false,
    initialData = null,
    transform,
    onError,
  } = options;

  const cached = url ? (queryCache.get(url) as CacheEntry<T> | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached?.data ?? initialData);
  const [loading, setLoading] = useState<boolean>(Boolean(url && enabled && !cached));
  const [validating, setValidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const transformRef = useRef(transform);
  const onErrorRef = useRef(onError);
  const reqIdRef = useRef(0);

  useEffect(() => {
    transformRef.current = transform;
    onErrorRef.current = onError;
  }, [transform, onError]);

  const fetchQuery = useCallback(
    async (silent = false) => {
      if (!url || !enabled) return;
      const reqId = ++reqIdRef.current;

      const existingCache = queryCache.get(url) as CacheEntry<T> | undefined;
      if (!silent && !existingCache) {
        setLoading(true);
      } else {
        setValidating(true);
      }
      if (!silent) {
        setError(null);
      }

      try {
        let promise = inflightRequests.get(url) as Promise<T> | undefined;
        if (!promise) {
          promise = fetch(url, { cache: 'no-store' }).then(async (res) => {
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(
                (json as { error?: string })?.error || 'Gagal memuat data dari server.'
              );
            }
            return transformRef.current ? transformRef.current(json) : (json as T);
          });
          inflightRequests.set(url, promise);
        }

        const result = await promise;
        inflightRequests.delete(url);

        queryCache.set(url, { data: result, timestamp: Date.now() });
        if (reqId === reqIdRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        inflightRequests.delete(url);
        if (reqId === reqIdRef.current) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
          if (!silent) {
            setError(msg);
          }
          onErrorRef.current?.(msg);
        }
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setValidating(false);
        }
      }
    },
    [url, enabled]
  );

  useEffect(() => {
    if (!url || !enabled) return;
    const entry = queryCache.get(url) as CacheEntry<T> | undefined;
    const isFresh = Boolean(entry && Date.now() - entry.timestamp < staleTimeMs);
    const timer = window.setTimeout(() => {
      if (entry) {
        setData(entry.data);
        setLoading(false);
        if (!isFresh) {
          void fetchQuery(true);
        }
      } else {
        void fetchQuery(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [url, enabled, staleTimeMs, fetchQuery]);

  useEffect(() => {
    if (!revalidateOnFocus || !url || !enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchQuery(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [revalidateOnFocus, url, enabled, fetchQuery]);

  const mutate = useCallback(
    async (
      updater?: T | null | ((prev: T | null) => T | null),
      revalidate = false
    ) => {
      if (updater !== undefined) {
        setData((prev) => {
          const next =
            typeof updater === 'function'
              ? (updater as (p: T | null) => T | null)(prev)
              : updater;
          if (url && next !== null) {
            queryCache.set(url, { data: next, timestamp: Date.now() });
          }
          return next;
        });
      }
      if (revalidate) {
        await fetchQuery(true);
      }
    },
    [url, fetchQuery]
  );

  return {
    data,
    loading,
    validating,
    error,
    mutate,
    refetch: fetchQuery,
  };
}
