'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CloudUpload,
  FileText,
  Home,
  LayoutDashboard,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  flushOfflineQueue,
  getOfflineQueueItems,
  LAST_PATH_STORAGE_KEY,
  OFFLINE_QUEUE_EVENT,
  type OfflineQueueItem,
} from '@/lib/pwa/offline-sync';

/**
 * Fallback CSS kritis yang di-embed langsung di dalam HTML /offline.
 * Menjamin tampilan kartu, ikon SVG, tombol, animasi loading, dan tata letak tetap rapi
 * serta proporsional meskipun file stylesheet eksternal (/_next/static/css/*)
 * belum sempat ter-cache saat perangkat offline.
 */
const CRITICAL_OFFLINE_CSS = `
  @keyframes simmsOfflineSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .simms-offline-spin {
    animation: simmsOfflineSpin 1s linear infinite;
  }
  .simms-offline-shell {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: #f6f8fb;
    background-image:
      radial-gradient(at 10% 0%, rgba(16, 185, 129, 0.10) 0px, transparent 48%),
      radial-gradient(at 90% 10%, rgba(14, 165, 233, 0.08) 0px, transparent 45%),
      radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.06) 0px, transparent 50%);
    color: #0f172a;
    font-family: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
    overflow-x: hidden;
  }
  @media (min-width: 640px) {
    .simms-offline-shell {
      padding: 1.5rem;
    }
  }
  .simms-offline-shell *, .simms-offline-shell *::before, .simms-offline-shell *::after {
    box-sizing: border-box;
  }
  .simms-offline-shell svg {
    flex-shrink: 0;
  }
  .simms-offline-card {
    width: 100%;
    max-width: 32rem;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 1.5rem;
    padding: 1.5rem 1.25rem;
    text-align: center;
    box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.08);
    overflow-wrap: break-word;
    word-break: break-word;
  }
  @media (min-width: 640px) {
    .simms-offline-card {
      padding: 2.25rem 2rem;
    }
  }
  .simms-offline-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1.125rem;
    border-radius: 1.125rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .simms-offline-icon--offline {
    background-color: #fffbeb;
    border: 1px solid rgba(253, 230, 138, 0.95);
    color: #d97706;
  }
  .simms-offline-icon--online {
    background-color: #ecfdf5;
    border: 1px solid rgba(167, 243, 208, 0.95);
    color: #059669;
  }
  .simms-offline-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 0.625rem;
  }
  .simms-offline-badge--offline {
    background-color: #fffbeb;
    border: 1px solid #fde68a;
    color: #b45309;
  }
  .simms-offline-badge--online {
    background-color: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #047857;
  }
  .simms-offline-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 0.5rem;
    line-height: 1.35;
  }
  .simms-offline-desc {
    font-size: 0.8125rem;
    color: #475569;
    line-height: 1.6;
    margin: 0 0 1.125rem;
  }
  @media (min-width: 640px) {
    .simms-offline-desc {
      font-size: 0.875rem;
    }
  }
  .simms-offline-feedback {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    text-align: left;
    font-size: 0.75rem;
    line-height: 1.5;
    border-radius: 0.875rem;
    padding: 0.75rem 0.875rem;
    margin-bottom: 1rem;
  }
  .simms-offline-feedback--warn {
    background-color: #fff1f2;
    border: 1px solid #fecdd3;
    color: #9f1239;
  }
  .simms-offline-feedback--info {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }
  .simms-offline-tips {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 0.875rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.55;
    margin-bottom: 1.125rem;
  }
  .simms-offline-tips strong {
    color: #0f172a;
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 700;
  }
  .simms-offline-actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 480px) {
    .simms-offline-actions {
      flex-direction: row;
    }
  }
  .simms-offline-btn {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
  }
  .simms-offline-btn:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
  .simms-offline-btn--primary {
    background-color: #059669;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(5, 150, 105, 0.2);
  }
  .simms-offline-btn--primary:not(:disabled):hover {
    background-color: #047857;
  }
  .simms-offline-btn--secondary {
    background-color: #ffffff;
    color: #334155;
    border-color: #cbd5e1;
  }
  .simms-offline-btn--secondary:not(:disabled):hover {
    background-color: #f8fafc;
  }
  .simms-offline-divider {
    padding-top: 1rem;
    border-top: 1px solid rgba(226, 232, 240, 0.9);
  }
  .simms-offline-subtitle {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #64748b;
    margin: 0 0 0.625rem;
  }
  .simms-offline-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  @media (min-width: 360px) {
    .simms-offline-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .simms-offline-link {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.75rem;
    background-color: #f8fafc;
    border: 1px solid rgba(226, 232, 240, 0.95);
    color: #334155;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .simms-offline-link:hover {
    background-color: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }
`;

const IGNORED_SAVED_PATHS = ['/offline', '/login', '/reset-kata-sandi'];

function isValidInternalPath(path: string): boolean {
  return (
    Boolean(path) &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !IGNORED_SAVED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`))
  );
}

function formatCheckTime(date: Date): string {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [checkMessage, setCheckMessage] = useState<{
    type: 'warn' | 'info';
    text: string;
  } | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [requestedPath, setRequestedPath] = useState<string | null>(null);
  const [queuedItems, setQueuedItems] = useState<OfflineQueueItem[]>([]);

  const redirectTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  /**
   * Memverifikasi koneksi jaringan nyata ke server menggunakan endpoint yang berada
   * di dalam NEVER_CACHE_PREFIXES pada Service Worker (/manifest.webmanifest),
   * sehingga tidak terjadi false-positive dari cache Service Worker.
   */
  const verifyRealNetworkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch(`/manifest.webmanifest?ping=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const navigateOnRestored = useCallback(
    (fallbackPath: string | null) => {
      if (typeof window === 'undefined') return;
      clearRedirectTimer();
      redirectTimerRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        const currentPathname = window.location.pathname;
        // Jika SW menampilkan /offline sebagai fallback pada URL halaman lain, reload URL tersebut
        if (currentPathname && currentPathname !== '/offline') {
          window.location.reload();
          return;
        }
        // Jika berada langsung di rute /offline, arahkan ke halaman terakhir yang valid atau beranda
        const destination = fallbackPath && isValidInternalPath(fallbackPath) ? fallbackPath : '/';
        router.replace(destination);
      }, 750);
    },
    [clearRedirectTimer, router]
  );

  const loadOfflineQueue = useCallback(async () => {
    try {
      const items = await getOfflineQueueItems();
      if (isMountedRef.current) {
        setQueuedItems(items);
      }
    } catch {
      // Abaikan jika IndexedDB tidak dapat diakses
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    isMountedRef.current = true;

    let savedPathVal: string | null = null;
    try {
      const rawSaved = window.localStorage.getItem(LAST_PATH_STORAGE_KEY)?.trim() || '';
      if (isValidInternalPath(rawSaved)) {
        savedPathVal = rawSaved;
      }
    } catch {
      // Abaikan jika localStorage diblokir
    }

    const currentFull = `${window.location.pathname}${window.location.search}`;
    const initTimer = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      if (savedPathVal) {
        setLastSavedPath(savedPathVal);
      }
      if (window.location.pathname !== '/offline' && isValidInternalPath(currentFull)) {
        setRequestedPath(currentFull);
      }
      void loadOfflineQueue();

      // Jika browser melaporkan navigator.onLine = true saat halaman dibuka, verifikasi koneksi nyata
      if (navigator.onLine) {
        void (async () => {
          const reachable = await verifyRealNetworkConnection();
          if (!isMountedRef.current) return;
          setLastCheckedAt(formatCheckTime(new Date()));
          if (reachable) {
            setIsOnline(true);
            void flushOfflineQueue();
            navigateOnRestored(savedPathVal);
          } else {
            setIsOnline(false);
          }
        })();
      }
    }, 0);

    const handleOnline = () => {
      void (async () => {
        const reachable = await verifyRealNetworkConnection();
        if (!isMountedRef.current) return;
        setLastCheckedAt(formatCheckTime(new Date()));
        if (reachable) {
          setIsOnline(true);
          setCheckMessage({
            type: 'info',
            text: 'Koneksi internet telah pulih. Mengarahkan kembali ke halaman Anda...',
          });
          void flushOfflineQueue();
          navigateOnRestored(savedPathVal);
        } else {
          setIsOnline(false);
          setCheckMessage({
            type: 'warn',
            text: 'Perangkat terhubung ke jaringan lokal/Wi-Fi, namun akses ke server belum tersedia.',
          });
        }
      })();
    };

    const handleOffline = () => {
      clearRedirectTimer();
      setIsOnline(false);
      setCheckMessage(null);
    };

    const handleQueueChanged = () => {
      void loadOfflineQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(initTimer);
      clearRedirectTimer();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
    };
  }, [clearRedirectTimer, loadOfflineQueue, navigateOnRestored, verifyRealNetworkConnection]);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    setCheckMessage(null);
    try {
      const reachable = await verifyRealNetworkConnection();
      if (!isMountedRef.current) return;
      const nowLabel = formatCheckTime(new Date());
      setLastCheckedAt(nowLabel);

      if (reachable) {
        setIsOnline(true);
        setCheckMessage({
          type: 'info',
          text: `Koneksi berhasil diverifikasi (${nowLabel}). Memuat halaman...`,
        });
        if (queuedItems.length > 0) {
          await flushOfflineQueue();
          await loadOfflineQueue();
        }
        navigateOnRestored(requestedPath || lastSavedPath);
        return;
      }

      setIsOnline(false);
      setCheckMessage({
        type: 'warn',
        text: `Server masih belum dapat dijangkau (dicek pukul ${nowLabel}). Pastikan Wi-Fi atau data seluler aktif.`,
      });
    } finally {
      if (isMountedRef.current) {
        setChecking(false);
      }
    }
  };

  const handleSyncNow = async () => {
    if (syncingQueue || queuedItems.length === 0) return;
    setSyncingQueue(true);
    setCheckMessage(null);
    try {
      const reachable = await verifyRealNetworkConnection();
      if (!reachable) {
        setCheckMessage({
          type: 'warn',
          text: 'Tidak dapat menyinkronkan antrean karena perangkat masih offline. Data Anda tetap aman di perangkat.',
        });
        return;
      }
      const res = await flushOfflineQueue();
      await loadOfflineQueue();
      if (res.syncedCount > 0) {
        setCheckMessage({
          type: 'info',
          text: `${res.syncedCount} perubahan data offline berhasil disinkronkan ke server.`,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setSyncingQueue(false);
      }
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const hasSameOriginReferrer =
        Boolean(document.referrer) && document.referrer.startsWith(window.location.origin);
      if (window.history.length > 1 && hasSameOriginReferrer) {
        window.history.back();
        return;
      }
    }
    if (lastSavedPath && isValidInternalPath(lastSavedPath)) {
      router.push(lastSavedPath);
      return;
    }
    router.push('/');
  };

  const resumeTarget = requestedPath || lastSavedPath;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CRITICAL_OFFLINE_CSS }} />
      <main className="simms-offline-shell min-h-screen simms-ambient flex items-center justify-center p-4 sm:p-6">
        <div className="simms-offline-card max-w-lg w-full modular-card rounded-3xl p-5 sm:p-8 text-center">
          {/* Ikon Status Koneksi */}
          <div
            className={`simms-offline-icon ${
              isOnline ? 'simms-offline-icon--online' : 'simms-offline-icon--offline'
            } w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-sm`}
          >
            {isOnline ? (
              <Wifi className="w-8 h-8" width={32} height={32} />
            ) : (
              <WifiOff className="w-8 h-8" width={32} height={32} />
            )}
          </div>

          {/* Header & Deskripsi */}
          <div>
            <span
              role="status"
              aria-live="polite"
              className={`simms-offline-badge ${
                isOnline ? 'simms-offline-badge--online' : 'simms-offline-badge--offline'
              }`}
            >
              {isOnline ? (
                <CheckCircle2 className="w-3.5 h-3.5" width={14} height={14} />
              ) : (
                <WifiOff className="w-3.5 h-3.5" width={14} height={14} />
              )}
              <span>{isOnline ? 'Koneksi Kembali Aktif' : 'Mode Offline PWA'}</span>
            </span>

            <h1 className="simms-offline-title text-lg sm:text-xl font-bold text-slate-900">
              {isOnline ? 'Koneksi Internet Telah Pulih' : 'Koneksi Internet Terputus'}
            </h1>
            <p className="simms-offline-desc text-xs sm:text-sm text-slate-600 leading-relaxed">
              {isOnline
                ? 'Perangkat Anda kembali terhubung ke server SiM-M. Halaman sedang dimuat ulang secara otomatis.'
                : 'Halaman yang Anda buka belum tersimpan di cache perangkat Anda. Periksa koneksi Wi-Fi atau data seluler, atau buka halaman yang telah tersimpan sebelumnya.'}
            </p>
          </div>

          {/* Informasi Halaman Terakhir / Target */}
          {resumeTarget && (
            <div className="mb-3 rounded-xl bg-slate-50 border border-slate-200/90 px-3.5 py-2.5 text-left text-xs text-slate-700 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {requestedPath ? 'Halaman yang Diminta' : 'Halaman Terakhir Dikunjungi'}
                </p>
                <p className="font-mono font-semibold text-slate-800 truncate">{resumeTarget}</p>
              </div>
              <Link
                href={resumeTarget}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-emerald-700 text-[11px] font-semibold transition"
              >
                Buka
              </Link>
            </div>
          )}

          {/* Feedback Hasil Pengecekan Koneksi */}
          {checkMessage && (
            <div
              role="alert"
              className={`simms-offline-feedback ${
                checkMessage.type === 'warn'
                  ? 'simms-offline-feedback--warn'
                  : 'simms-offline-feedback--info'
              }`}
            >
              {checkMessage.type === 'warn' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" width={16} height={16} />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" width={16} height={16} />
              )}
              <div className="min-w-0 flex-1">{checkMessage.text}</div>
            </div>
          )}

          {/* Status Antrean Sinkronisasi Offline (Jika ada perubahan data tertunda di IndexedDB) */}
          {queuedItems.length > 0 && (
            <div className="mb-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 p-3.5 text-left text-xs text-amber-950 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-bold text-amber-900">
                  <CloudUpload className="w-4 h-4 text-amber-700 shrink-0" width={16} height={16} />
                  <span>{queuedItems.length} Perubahan Data Menunggu Sinkronisasi</span>
                </span>
                <button
                  type="button"
                  disabled={syncingQueue}
                  onClick={() => void handleSyncNow()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${syncingQueue ? 'simms-offline-spin animate-spin' : ''}`}
                    width={12}
                    height={12}
                  />
                  <span>{syncingQueue ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Data yang Anda simpan saat offline tersimpan aman di perangkat dan akan dikirim
                otomatis ke server begitu koneksi kembali aktif.
              </p>
            </div>
          )}

          {/* Panduan Mode Offline */}
          <div className="simms-offline-tips">
            <strong>Panduan Mode Offline SiM-M</strong>
            Halaman yang pernah Anda kunjungi saat online otomatis tersimpan di perangkat dan tetap
            dapat dibuka tanpa internet. Perubahan data di Portal juga akan masuk ke antrean
            sinkronisasi otomatis.
            {lastCheckedAt && (
              <span className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" width={12} height={12} />
                <span>Terakhir diperiksa pukul {lastCheckedAt}</span>
              </span>
            )}
          </div>

          {/* Tombol Aksi Utama */}
          <div className="simms-offline-actions">
            <button
              type="button"
              disabled={checking}
              aria-busy={checking || undefined}
              onClick={() => void handleRetry()}
              className="simms-offline-btn simms-offline-btn--primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${checking ? 'simms-offline-spin animate-spin' : ''}`}
                width={16}
                height={16}
              />
              <span>{checking ? 'Memeriksa Koneksi Server...' : 'Coba Muat Ulang'}</span>
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="simms-offline-btn simms-offline-btn--secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" width={16} height={16} />
              <span>Halaman Sebelumnya</span>
            </button>
          </div>

          {/* Pintasan Halaman Tersimpan */}
          <div className="simms-offline-divider pt-4 border-t border-slate-200/80">
            <p className="simms-offline-subtitle text-[11px] font-semibold text-slate-500 mb-2.5">
              Pintasan Halaman Tersimpan
            </p>
            <div className="simms-offline-grid grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Link
                href="/"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <Home className="w-3.5 h-3.5" width={14} height={14} />
                <span className="truncate">Beranda</span>
              </Link>
              <Link
                href="/portal"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" width={14} height={14} />
                <span className="truncate">Dashboard Portal</span>
              </Link>
              <Link
                href="/berita"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <Newspaper className="w-3.5 h-3.5" width={14} height={14} />
                <span className="truncate">Berita</span>
              </Link>
              <Link
                href="/verifikasi"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" width={14} height={14} />
                <span className="truncate">Verifikasi QR</span>
              </Link>
              <Link
                href="/portal/layanan/persuratan"
                className="simms-offline-link sm:col-span-2 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <FileText className="w-3.5 h-3.5" width={14} height={14} />
                <span className="truncate">Layanan E-Office Persuratan</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
