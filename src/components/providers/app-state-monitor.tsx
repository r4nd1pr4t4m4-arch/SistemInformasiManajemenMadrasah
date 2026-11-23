'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  NoInternetState,
  SessionExpiredModal,
  SlowNetworkBanner,
  SuccessState,
} from '@/components/ui/state-views';

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

function getNetworkConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

const SESSION_IGNORED_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/captcha',
  '/api/public/',
];

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

export function AppStateMonitor() {
  const pathname = usePathname() || '/';
  const [isOffline, setIsOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const [slowNetwork, setSlowNetwork] = useState<{
    active: boolean;
    effectiveType: string | null;
    rttMs: number | null;
  }>({ active: false, effectiveType: null, rttMs: null });
  const [slowDismissed, setSlowDismissed] = useState(false);

  const [sessionExpired, setSessionExpired] = useState(false);

  const pathnameRef = useRef(pathname);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 4. Deteksi No Internet (Online / Offline)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setReconnecting(false);
      setJustReconnected(true);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
    };

    const syncInitial = window.setTimeout(() => {
      if (!navigator.onLine) {
        setIsOffline(true);
      }
    }, 0);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearTimeout(syncInitial);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  // 5. Deteksi Slow Network via Network Information API
  useEffect(() => {
    const conn = getNetworkConnection();
    if (!conn) return;

    const evaluateConnection = () => {
      const type = conn.effectiveType || null;
      const rtt = typeof conn.rtt === 'number' ? conn.rtt : null;
      const downlink = typeof conn.downlink === 'number' ? conn.downlink : null;
      const isSlow =
        type === 'slow-2g' ||
        type === '2g' ||
        type === '3g' ||
        (rtt !== null && rtt >= 650) ||
        (downlink !== null && downlink > 0 && downlink < 1.2) ||
        Boolean(conn.saveData);

      setSlowNetwork((prev) => {
        if (isSlow && !prev.active) {
          setSlowDismissed(false);
        }
        return { active: isSlow, effectiveType: type, rttMs: rtt };
      });
    };

    evaluateConnection();
    conn.addEventListener('change', evaluateConnection);
    return () => {
      conn.removeEventListener('change', evaluateConnection);
    };
  }, []);

  // 5 & 8. Pantau fetch global untuk Slow Network (latensi > 4.5 dtk) & Session Expired (HTTP 401 di /portal)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

    const originalFetch = window.fetch.bind(window);
    let activeSlowTimers = 0;

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const rawUrl = getRequestUrl(input);
      let urlPath = rawUrl;
      try {
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
          const parsed = new URL(rawUrl);
          if (parsed.origin !== window.location.origin) {
            return originalFetch(input, init);
          }
          urlPath = parsed.pathname;
        }
      } catch {
        // biarkan urlPath apa adanya
      }

      const isInternalApi = urlPath.startsWith('/api/');
      const startedAt = Date.now();
      let slowTimer: ReturnType<typeof setTimeout> | null = null;
      let triggeredSlow = false;

      if (isInternalApi) {
        slowTimer = setTimeout(() => {
          triggeredSlow = true;
          activeSlowTimers += 1;
          setSlowNetwork((prev) => ({
            active: true,
            effectiveType: prev.effectiveType,
            rttMs: Math.max(prev.rttMs ?? 0, Date.now() - startedAt),
          }));
        }, 4500);
      }

      try {
        const res = await originalFetch(input, init);

        if (
          isInternalApi &&
          res.status === 401 &&
          pathnameRef.current.startsWith('/portal') &&
          !SESSION_IGNORED_API_PREFIXES.some((prefix) => urlPath.startsWith(prefix))
        ) {
          setSessionExpired(true);
        }

        return res;
      } finally {
        if (slowTimer) clearTimeout(slowTimer);
        if (triggeredSlow) {
          activeSlowTimers = Math.max(0, activeSlowTimers - 1);
          if (activeSlowTimers === 0) {
            // Kembalikan ke status NetworkInformation setelah request selesai
            const conn = getNetworkConnection();
            const type = conn?.effectiveType || null;
            const rtt = typeof conn?.rtt === 'number' ? conn.rtt : null;
            const stillSlow =
              type === 'slow-2g' ||
              type === '2g' ||
              type === '3g' ||
              (rtt !== null && rtt >= 650);
            if (!stillSlow) {
              setSlowNetwork({ active: false, effectiveType: type, rttMs: rtt });
            }
          }
        }
      }
    };

    window.fetch = wrappedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleCheckConnection = useCallback(async () => {
    setReconnecting(true);
    try {
      const res = await fetch('/api/public/faqs', {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok || navigator.onLine) {
        setIsOffline(false);
        setJustReconnected(true);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => setJustReconnected(false), 4000);
      }
    } catch {
      setIsOffline(true);
    } finally {
      setReconnecting(false);
    }
  }, []);

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const showSessionExpired =
    sessionExpired && !pathname.startsWith('/login') && !pathname.startsWith('/reset-kata-sandi');

  return (
    <>
      {/* Floating Network Status Stack (Offline / Slow Network / Reconnected) */}
      {(isOffline || justReconnected || (slowNetwork.active && !slowDismissed)) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl space-y-2 pointer-events-none">
          {isOffline && (
            <div className="pointer-events-auto">
              <NoInternetState
                compact
                retrying={reconnecting}
                onRetry={() => void handleCheckConnection()}
              />
            </div>
          )}

          {!isOffline && justReconnected && (
            <div className="pointer-events-auto">
              <SuccessState
                variant="banner"
                title="Koneksi Internet Kembali Terhubung"
                description="Anda kembali online. Semua fitur aplikasi dapat digunakan seperti biasa."
                onDismiss={() => setJustReconnected(false)}
                className="shadow-lg"
              />
            </div>
          )}

          {!isOffline && slowNetwork.active && !slowDismissed && (
            <div className="pointer-events-auto">
              <SlowNetworkBanner
                effectiveType={slowNetwork.effectiveType}
                rttMs={slowNetwork.rttMs}
                onDismiss={() => setSlowDismissed(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* Global Session Expired Modal */}
      <SessionExpiredModal
        open={showSessionExpired}
        loginHref={loginHref}
        onDismiss={() => setSessionExpired(false)}
      />
    </>
  );
}
