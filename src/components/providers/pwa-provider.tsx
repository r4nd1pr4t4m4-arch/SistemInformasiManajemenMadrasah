'use client';

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SwUpdateModal } from '@/components/pwa/sw-update-modal';
import {
  LAST_PATH_STORAGE_KEY,
  flushOfflineQueue,
  OFFLINE_QUEUE_EVENT,
} from '@/lib/pwa/offline-sync';
import { PUSH_RECEIVED_EVENT } from '@/lib/pwa/push-client';

export type PwaPlatform =
  | 'android-chrome'
  | 'ios-safari'
  | 'desktop-chromium'
  | 'desktop-safari'
  | 'other';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextValue {
  ready: boolean;
  isStandalone: boolean;
  isMobileViewport: boolean;
  isMobileDevice: boolean;
  platform: PwaPlatform;
  canInstallPrompt: boolean;
  updateAvailable: boolean;
  triggerInstallPrompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  applySwUpdate: () => void;
}

const PwaContext = createContext<PwaContextValue>({
  ready: false,
  isStandalone: false,
  isMobileViewport: false,
  isMobileDevice: false,
  platform: 'other',
  canInstallPrompt: false,
  updateAvailable: false,
  triggerInstallPrompt: async () => 'unavailable',
  applySwUpdate: () => { },
});

const LAUNCH_HANDLED_SESSION_KEY = 'simms_pwa_launch_handled';
const SW_RELOAD_GUARD_KEY = 'simms_sw_last_reload_ts';
const IGNORED_LAST_PATHS = ['/offline', '/login', '/reset-kata-sandi'];

function detectPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios-safari';
  if (/Android/i.test(ua)) return 'android-chrome';
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return 'desktop-safari';
  if (/Chrome|Chromium|Edg/i.test(ua)) return 'desktop-chromium';
  return 'other';
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaMatch =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches);
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone
  );
  return mediaMatch || iosStandalone;
}

function detectMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isSmallViewport =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 1023px)').matches;
  const ua = navigator.userAgent || '';
  const isMobileUa =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Mencegah bypass dengan mode "Desktop site" di browser HP/tablet
  const isCoarseTouch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    navigator.maxTouchPoints > 0;
  return isSmallViewport || isMobileUa || isCoarseTouch;
}

function PwaRouteTracker() {
  const pathname = usePathname() || '/';
  const router = useRouter();

  // 4. Smart Launch Resume:
  //    Simpan halaman terakhir yang dikunjungi, dan saat PWA dibuka dari Home Screen (/?source=pwa),
  //    validasi sesi/akun jika halaman terakhir berada di /portal; jika tidak valid, tetap di beranda (/).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentParams = new URLSearchParams(window.location.search);
    const isPwaLaunch =
      pathname === '/' &&
      (currentParams.get('source') === 'pwa' || detectStandalone());

    if (isPwaLaunch && !window.sessionStorage.getItem(LAUNCH_HANDLED_SESSION_KEY)) {
      window.sessionStorage.setItem(LAUNCH_HANDLED_SESSION_KEY, '1');

      const savedPath = window.localStorage.getItem(LAST_PATH_STORAGE_KEY)?.trim() || '';
      if (
        savedPath &&
        savedPath !== '/' &&
        savedPath.startsWith('/') &&
        !savedPath.startsWith('//') &&
        !IGNORED_LAST_PATHS.some((prefix) => savedPath.startsWith(prefix))
      ) {
        if (savedPath.startsWith('/portal')) {
          let cancelled = false;
          fetch('/api/auth/me', { cache: 'no-store' })
            .then(async (res) => {
              if (cancelled) return;
              if (!res.ok) {
                window.localStorage.removeItem(LAST_PATH_STORAGE_KEY);
                return;
              }
              const data = await res.json().catch(() => null);
              if (data?.user) {
                router.replace(savedPath);
              } else {
                window.localStorage.removeItem(LAST_PATH_STORAGE_KEY);
              }
            })
            .catch(() => {
              // Saat offline, jika tidak bisa memvalidasi sesi, biarkan tetap di beranda publik
            });

          return () => {
            cancelled = true;
          };
        }

        // Halaman publik terakhir (misalnya /berita, /verifikasi, /profil)
        router.replace(savedPath);
        return;
      }
    }
  }, [pathname, router]);

  // Catat halaman terakhir yang dibuka pengguna
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (IGNORED_LAST_PATHS.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }

    const saveCurrentPath = () => {
      const cleanedParams = new URLSearchParams(window.location.search);
      // Jangan menimpa halaman terakhir saat baru saja membuka /?source=pwa sebelum cek selesai
      if (pathname === '/' && cleanedParams.get('source') === 'pwa') {
        return;
      }
      cleanedParams.delete('source');
      const cleanQs = cleanedParams.toString();
      const fullPath = cleanQs ? `${pathname}?${cleanQs}` : pathname;

      try {
        window.localStorage.setItem(LAST_PATH_STORAGE_KEY, fullPath);
      } catch {
        // abaikan jika storage penuh/diblokir
      }
    };

    saveCurrentPath();
    window.addEventListener('popstate', saveCurrentPath);
    return () => {
      window.removeEventListener('popstate', saveCurrentPath);
    };
  }, [pathname]);

  return null;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [ready, setReady] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>('other');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updatingSw, setUpdatingSw] = useState(false);
  const reloadingRef = useRef(false);
  const userRequestedUpdateRef = useRef(false);

  // 1. Deteksi mode standalone, platform, viewport mobile (< 1024px), dan perangkat mobile (anti-bypass Desktop Site)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncDeviceState = () => {
      setIsStandalone(detectStandalone());
      setPlatform(detectPlatform());
      setIsMobileViewport(window.matchMedia('(max-width: 1023px)').matches);
      setIsMobileDevice(detectMobileDevice());
      setReady(true);
    };

    syncDeviceState();

    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    const mqMobile = window.matchMedia('(max-width: 1023px)');
    const mqCoarse = window.matchMedia('(pointer: coarse)');

    mqStandalone.addEventListener('change', syncDeviceState);
    mqMobile.addEventListener('change', syncDeviceState);
    mqCoarse.addEventListener('change', syncDeviceState);
    window.addEventListener('appinstalled', syncDeviceState);

    return () => {
      mqStandalone.removeEventListener('change', syncDeviceState);
      mqMobile.removeEventListener('change', syncDeviceState);
      mqCoarse.removeEventListener('change', syncDeviceState);
      window.removeEventListener('appinstalled', syncDeviceState);
    };
  }, []);

  // 2. Tangkap event beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(detectStandalone());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 3. Registrasi Service Worker + Deteksi Pembaruan Wajib + Pesan Background Sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registrationRef: ServiceWorkerRegistration | null = null;
    let isMounted = true;

    const handleControllerChange = () => {
      // Hanya muat ulang halaman jika pengguna secara eksplisit menekan tombol pembaruan SW
      // (mencegah reload loop otomatis saat klaim SW pertama kali atau dev HMR).
      if (!userRequestedUpdateRef.current || reloadingRef.current) return;
      try {
        const lastReload = Number(window.sessionStorage.getItem(SW_RELOAD_GUARD_KEY) || '0');
        if (Date.now() - lastReload < 10_000) return;
        window.sessionStorage.setItem(SW_RELOAD_GUARD_KEY, String(Date.now()));
      } catch {
        // abaikan jika sessionStorage diblokir
      }
      reloadingRef.current = true;
      window.location.reload();
    };

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'SYNC_COMPLETED') {
        window.dispatchEvent(
          new CustomEvent(OFFLINE_QUEUE_EVENT, {
            detail: {
              count: data.remainingCount ?? 0,
              syncedCount: data.syncedCount ?? 0,
            },
          })
        );
      } else if (data.type === 'SYNC_AUTH_REQUIRED') {
        window.dispatchEvent(
          new CustomEvent(OFFLINE_QUEUE_EVENT, {
            detail: {
              count: data.remainingCount ?? 0,
              authRequired: true,
            },
          })
        );
      } else if (data.type === 'PUSH_RECEIVED') {
        window.dispatchEvent(
          new CustomEvent(PUSH_RECEIVED_EVENT, {
            detail: data,
          })
        );
      } else if (data.type === 'PUSH_NAVIGATE' && typeof data.url === 'string') {
        routerRef.current.push(data.url);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    const registerSw = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (!isMounted) return;
        registrationRef = reg;

        // Warm-cache seluruh aset CSS & JS yang sedang dimuat di DOM agar selalu siap saat tiba-tiba offline
        const warmLoadedStaticAssets = () => {
          const activeWorker = reg.active || navigator.serviceWorker.controller;
          if (!activeWorker) return;
          const urls = new Set<string>(['/offline']);
          document
            .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')
            .forEach((el) => {
              if (el.href) urls.add(el.href);
            });
          document
            .querySelectorAll<HTMLScriptElement>('script[src]')
            .forEach((el) => {
              if (el.src) urls.add(el.src);
            });
          activeWorker.postMessage({
            type: 'WARM_STATIC_ASSETS',
            urls: Array.from(urls),
          });
        };

        if (reg.active) {
          warmLoadedStaticAssets();
        } else {
          navigator.serviceWorker.ready
            .then(() => {
              if (isMounted) warmLoadedStaticAssets();
            })
            .catch(() => { });
        }

        // Jika sudah ada SW baru menunggu saat halaman dimuat
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller &&
              isMounted
            ) {
              setWaitingWorker(installing);
            }
          });
        });
      } catch {
        // SW gagal registrasi (misalnya non-HTTPS di luar localhost)
      }
    };

    void registerSw();

    // Cek pembaruan SW & sinkronkan antrean offline saat aplikasi kembali ke foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registrationRef?.update().catch(() => { });
        if (navigator.onLine) {
          void flushOfflineQueue();
        }
      }
    };

    const handleOnline = () => {
      void flushOfflineQueue();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return choice.outcome;
    } catch {
      return 'unavailable' as const;
    }
  }, [deferredPrompt]);

  const applySwUpdate = useCallback(() => {
    userRequestedUpdateRef.current = true;
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    setUpdatingSw(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    // Fallback jika controllerchange tidak terpanggil dalam 3 detik
    window.setTimeout(() => {
      if (!reloadingRef.current) {
        reloadingRef.current = true;
        window.location.reload();
      }
    }, 3000);
  }, [waitingWorker]);

  const contextValue = useMemo<PwaContextValue>(
    () => ({
      ready,
      isStandalone,
      isMobileViewport,
      isMobileDevice,
      platform,
      canInstallPrompt: Boolean(deferredPrompt),
      updateAvailable: Boolean(waitingWorker),
      triggerInstallPrompt,
      applySwUpdate,
    }),
    [
      ready,
      isStandalone,
      isMobileViewport,
      isMobileDevice,
      platform,
      deferredPrompt,
      waitingWorker,
      triggerInstallPrompt,
      applySwUpdate,
    ]
  );

  return (
    <PwaContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <PwaRouteTracker />
      </Suspense>
      {children}
      <SwUpdateModal
        open={Boolean(waitingWorker)}
        updating={updatingSw}
        onReload={applySwUpdate}
      />
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return useContext(PwaContext);
}
