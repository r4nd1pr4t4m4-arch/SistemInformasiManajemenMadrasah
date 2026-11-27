'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CloudUpload } from 'lucide-react';
import {
  NoInternetState,
  SessionExpiredModal,
  SlowNetworkBanner,
  SuccessState,
} from '@/components/ui/state-views';
import {
  OFFLINE_QUEUE_EVENT,
  clearServiceWorkerAuthCaches,
  enqueueOfflineMutation,
  flushOfflineQueue,
  getOfflineQueueCount,
  shouldQueueOfflineMutation,
} from '@/lib/pwa/offline-sync';

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

function AppStateMonitorInner() {
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
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncedNoticeCount, setSyncedNoticeCount] = useState(0);

  const pathnameRef = useRef(pathname);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      void flushOfflineQueue();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
    };

    const handleQueueChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        count?: number;
        syncedCount?: number;
        authRequired?: boolean;
      }>).detail;

      if (typeof detail?.count === 'number') {
        setPendingSyncCount(detail.count);
      } else {
        void getOfflineQueueCount().then(setPendingSyncCount);
      }

      if (detail?.syncedCount && detail.syncedCount > 0) {
        setSyncedNoticeCount(detail.syncedCount);
        if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current);
        syncNoticeTimerRef.current = setTimeout(() => {
          setSyncedNoticeCount(0);
        }, 5000);
      }

      if (detail?.authRequired && pathnameRef.current.startsWith('/portal')) {
        setSessionExpired(true);
      }
    };

    const syncInitial = window.setTimeout(() => {
      if (!navigator.onLine) {
        setIsOffline(true);
      }
      void getOfflineQueueCount().then(setPendingSyncCount);
    }, 0);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);

    return () => {
      window.clearTimeout(syncInitial);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current);
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

      const method = (
        init?.method ||
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const body = init?.body ?? null;

      try {
        const res = await originalFetch(input, init);

        if (
          isInternalApi &&
          res.status === 401 &&
          pathnameRef.current.startsWith('/portal') &&
          !SESSION_IGNORED_API_PREFIXES.some((prefix) => urlPath.startsWith(prefix))
        ) {
          void clearServiceWorkerAuthCaches();
          setSessionExpired(true);
        }

        return res;
      } catch (err) {
        // Offline-First Global Background Sync: antrekan mutasi JSON portal saat offline
        if (
          isInternalApi &&
          pathnameRef.current.startsWith('/portal') &&
          !navigator.onLine &&
          shouldQueueOfflineMutation(urlPath, method, body)
        ) {
          const serializedBody =
            typeof body === 'string'
              ? body
              : body instanceof URLSearchParams
                ? body.toString()
                : null;

          const queued = await enqueueOfflineMutation({
            url: rawUrl,
            method,
            headers: init?.headers,
            body: serializedBody,
          });

          if (queued) {
            return new Response(
              JSON.stringify({
                ok: true,
                queuedOffline: true,
                queueId: queued.id,
                message:
                  'Anda sedang offline. Perubahan disimpan ke antrean dan akan otomatis disinkronkan saat koneksi kembali.',
              }),
              {
                status: 202,
                statusText: 'Accepted (Queued Offline)',
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        }
        throw err;
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
      {/* Floating Network Status Stack (Offline / Sync Queue / Slow Network / Reconnected) */}
      {(isOffline ||
        justReconnected ||
        pendingSyncCount > 0 ||
        syncedNoticeCount > 0 ||
        (slowNetwork.active && !slowDismissed)) && (
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

          {pendingSyncCount > 0 && (
            <div className="pointer-events-auto rounded-2xl bg-sky-50/95 backdrop-blur border border-sky-200 px-4 py-2.5 shadow-lg flex items-center justify-between gap-3 text-xs text-sky-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <CloudUpload className="w-4 h-4 text-sky-600 shrink-0" />
                <p className="font-medium truncate">
                  {pendingSyncCount} perubahan menunggu sinkronisasi otomatis
                </p>
              </div>
              {!isOffline && (
                <button
                  type="button"
                  onClick={() => void flushOfflineQueue()}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold shrink-0 transition"
                >
                  Sinkronkan
                </button>
              )}
            </div>
          )}

          {!isOffline && syncedNoticeCount > 0 && (
            <div className="pointer-events-auto">
              <SuccessState
                variant="banner"
                title="Sinkronisasi Offline Selesai"
                description={`${syncedNoticeCount} perubahan yang tersimpan saat offline berhasil dikirim ke server.`}
                onDismiss={() => setSyncedNoticeCount(0)}
                className="shadow-lg"
              />
            </div>
          )}

          {!isOffline && justReconnected && syncedNoticeCount === 0 && (
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

export function AppStateMonitor() {
  return (
    <Suspense fallback={null}>
      <AppStateMonitorInner />
    </Suspense>
  );
}
