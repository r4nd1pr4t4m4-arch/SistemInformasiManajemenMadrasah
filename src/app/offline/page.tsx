'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Home,
  LayoutDashboard,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { LAST_PATH_STORAGE_KEY } from '@/lib/pwa/offline-sync';

/**
 * Fallback CSS kritis yang di-embed langsung di dalam HTML /offline.
 * Menjamin tampilan kartu, ikon SVG, tombol, dan tata letak tetap rapi serta proporsional
 * meskipun file stylesheet eksternal (/_next/static/css/*) belum sempat ter-cache saat offline.
 */
const CRITICAL_OFFLINE_CSS = `
  .simms-offline-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    background-color: #f6f8fb;
    background-image:
      radial-gradient(at 10% 0%, rgba(16, 185, 129, 0.10) 0px, transparent 48%),
      radial-gradient(at 90% 10%, rgba(14, 165, 233, 0.08) 0px, transparent 45%),
      radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.06) 0px, transparent 50%);
    color: #0f172a;
    font-family: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  }
  .simms-offline-shell *, .simms-offline-shell *::before, .simms-offline-shell *::after {
    box-sizing: border-box;
  }
  .simms-offline-shell svg {
    flex-shrink: 0;
  }
  .simms-offline-card {
    width: 100%;
    max-width: 29rem;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 1.5rem;
    padding: 1.75rem 1.5rem;
    text-align: center;
    box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.08);
  }
  @media (min-width: 640px) {
    .simms-offline-card {
      padding: 2.25rem 2rem;
    }
  }
  .simms-offline-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1.25rem;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .simms-offline-icon--offline {
    background-color: #fffbeb;
    border: 1px solid rgba(253, 230, 138, 0.9);
    color: #d97706;
  }
  .simms-offline-icon--online {
    background-color: #ecfdf5;
    border: 1px solid rgba(167, 243, 208, 0.9);
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
    font-size: 0.875rem;
    color: #475569;
    line-height: 1.6;
    margin: 0 0 1.25rem;
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
    margin-bottom: 1.25rem;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6875rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .simms-offline-btn--primary {
    background-color: #059669;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(5, 150, 105, 0.2);
  }
  .simms-offline-btn--primary:hover {
    background-color: #047857;
  }
  .simms-offline-btn--secondary {
    background-color: #ffffff;
    color: #334155;
    border-color: #cbd5e1;
  }
  .simms-offline-btn--secondary:hover {
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .simms-offline-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.55rem 0.75rem;
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

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncTimer = window.setTimeout(() => {
      setIsOnline(navigator.onLine);
      try {
        const saved = window.localStorage.getItem(LAST_PATH_STORAGE_KEY)?.trim() || '';
        if (saved && saved.startsWith('/') && saved !== '/offline') {
          setLastSavedPath(saved);
        }
      } catch {
        // Abaikan jika localStorage tidak dapat diakses
      }
    }, 0);

    const handleOnline = () => {
      setIsOnline(true);
      // Otomatis muat ulang halaman saat koneksi kembali pulih
      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/public/faqs', {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok || navigator.onLine) {
        setIsOnline(true);
        if (lastSavedPath && window.location.pathname === '/offline') {
          router.push(lastSavedPath);
        } else {
          window.location.reload();
        }
        return;
      }
    } catch {
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    if (lastSavedPath) {
      router.push(lastSavedPath);
      return;
    }
    router.push('/');
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CRITICAL_OFFLINE_CSS }} />
      <main className="simms-offline-shell min-h-screen simms-ambient flex items-center justify-center p-4 sm:p-6">
        <div className="simms-offline-card max-w-md w-full modular-card rounded-3xl p-6 sm:p-8 text-center">
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

          <div>
            <span
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

            <h1 className="simms-offline-title text-xl font-bold text-slate-900">
              {isOnline ? 'Koneksi Internet Telah Pulih' : 'Koneksi Internet Terputus'}
            </h1>
            <p className="simms-offline-desc text-sm text-slate-600 leading-relaxed">
              {isOnline
                ? 'Perangkat Anda kembali terhubung ke internet. Halaman sedang dimuat ulang secara otomatis.'
                : 'Halaman yang Anda buka belum tersimpan di cache perangkat Anda. Periksa koneksi Wi-Fi atau data seluler, atau buka halaman yang telah tersimpan sebelumnya.'}
            </p>
          </div>

          <div className="simms-offline-tips">
            <strong>Panduan Mode Offline SiM-M</strong>
            Halaman yang pernah Anda kunjungi saat online otomatis tersimpan di perangkat dan
            tetap dapat dibuka tanpa internet. Perubahan data di Portal juga akan masuk ke antrean
            sinkronisasi otomatis.
          </div>

          <div className="simms-offline-actions">
            <button
              type="button"
              disabled={checking}
              aria-busy={checking || undefined}
              onClick={() => void handleRetry()}
              className="simms-offline-btn simms-offline-btn--primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`}
                width={16}
                height={16}
              />
              <span>{checking ? 'Memeriksa Koneksi...' : 'Coba Muat Ulang'}</span>
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

          <div className="simms-offline-divider pt-4 border-t border-slate-200/80">
            <p className="simms-offline-subtitle text-[11px] font-semibold text-slate-500 mb-2.5">
              Pintasan Halaman Tersimpan
            </p>
            <div className="simms-offline-grid grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <Home className="w-3.5 h-3.5" width={14} height={14} />
                <span>Beranda</span>
              </Link>
              <Link
                href="/portal"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" width={14} height={14} />
                <span>Dashboard Portal</span>
              </Link>
              <Link
                href="/berita"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <Newspaper className="w-3.5 h-3.5" width={14} height={14} />
                <span>Berita</span>
              </Link>
              <Link
                href="/verifikasi"
                className="simms-offline-link flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" width={14} height={14} />
                <span>Verifikasi QR</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
