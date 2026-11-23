'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  LogOut,
  Monitor,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import type { PwaPlatform } from '@/components/providers/pwa-provider';

interface InstallPwaModalProps {
  open: boolean;
  mode: 'mandatory' | 'guide';
  platform: PwaPlatform;
  canInstallPrompt: boolean;
  institutionName?: string;
  onTriggerInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onClose?: () => void;
  onLogout?: () => void;
}

type GuideTab = 'android' | 'ios' | 'desktop';

function defaultTabForPlatform(platform: PwaPlatform, mode: 'mandatory' | 'guide'): GuideTab {
  if (platform === 'ios-safari') return 'ios';
  if (platform === 'android-chrome') return 'android';
  if (mode === 'guide') return 'desktop';
  return 'android';
}

export function InstallPwaModal({
  open,
  mode,
  platform,
  canInstallPrompt,
  institutionName,
  onTriggerInstall,
  onClose,
  onLogout,
}: InstallPwaModalProps) {
  const [installing, setInstalling] = useState(false);
  const [installDoneHint, setInstallDoneHint] = useState(false);
  const [selectedTab, setSelectedTab] = useState<GuideTab | null>(null);
  const activeTab = selectedTab ?? defaultTabForPlatform(platform, mode);

  // Untuk mode guide (desktop), izinkan tutup dengan Escape; untuk mode mandatory, blokir Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'guide' && onClose) {
          onClose();
        } else {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, mode, onClose]);

  if (!open) return null;

  const appLabel = institutionName?.trim() || 'SiM-M';
  const isMandatory = mode === 'mandatory';

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const outcome = await onTriggerInstall();
      if (outcome === 'accepted') {
        setInstallDoneHint(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-pwa-title"
      onClick={() => {
        if (!isMandatory && onClose) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
              {isMandatory ? (
                <Smartphone className="w-6 h-6" />
              ) : (
                <Monitor className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                {isMandatory ? 'Wajib Instal Aplikasi (PWA)' : 'Instal Aplikasi Desktop'}
              </p>
              <h2 id="install-pwa-title" className="text-base sm:text-lg font-bold text-slate-900">
                Pasang {appLabel} di Perangkat Anda
              </h2>
            </div>
          </div>

          {!isMandatory && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panduan instalasi"
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Deskripsi */}
        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-3.5 text-xs text-emerald-950 leading-relaxed space-y-1.5">
          {isMandatory ? (
            <>
              <p className="font-semibold">
                Untuk pengalaman terbaik, akses cepat, dan dukungan mode offline, akun Guru,
                Siswa, dan Orang Tua wajib menggunakan aplikasi {appLabel} yang terinstal di HP.
              </p>
              <p className="text-emerald-800">
                Jendela ini akan otomatis hilang setelah Anda menginstal dan membuka{' '}
                <strong>{appLabel}</strong> langsung dari ikon di layar utama (Home Screen) HP Anda.
              </p>
            </>
          ) : (
            <p>
              Instal <strong>{appLabel}</strong> sebagai aplikasi desktop agar dapat dibuka
              langsung dari Start Menu / Dock tanpa bilah alamat browser, lebih cepat, dan tetap
              mendukung mode offline.
            </p>
          )}
        </div>

        {/* Tombol 1-Klik Install jika beforeinstallprompt tersedia */}
        {canInstallPrompt && (
          <button
            type="button"
            disabled={installing}
            aria-busy={installing || undefined}
            onClick={() => void handleInstallClick()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>
              {installing ? 'Membuka Dialog Instalasi...' : `Instal ${appLabel} Sekarang`}
            </span>
          </button>
        )}

        {installDoneHint && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 flex items-start gap-2 text-xs text-teal-900">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p>
              Instalasi sedang diproses oleh perangkat Anda. Setelah ikon{' '}
              <strong>{appLabel}</strong> muncul di Home Screen, tutup browser ini lalu buka
              aplikasi melalui ikon tersebut.
            </p>
          </div>
        )}

        {/* Tab Panduan Lengkap */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedTab('android')}
              className={`flex-1 py-2 px-2.5 rounded-lg transition ${
                activeTab === 'android'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('ios')}
              className={`flex-1 py-2 px-2.5 rounded-lg transition ${
                activeTab === 'ios'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              iPhone / iPad (Safari)
            </button>
            {!isMandatory && (
              <button
                type="button"
                onClick={() => setSelectedTab('desktop')}
                className={`flex-1 py-2 px-2.5 rounded-lg transition ${
                  activeTab === 'desktop'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Desktop
              </button>
            )}
          </div>

          {activeTab === 'android' && (
            <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-relaxed">
                  Pastikan Anda membuka halaman ini menggunakan browser{' '}
                  <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-relaxed">
                  Ketuk tombol <strong>Instal {appLabel} Sekarang</strong> di atas, atau ketuk ikon
                  menu <MoreVertical className="w-3.5 h-3.5 inline-block text-slate-900" />{' '}
                  <strong>titik tiga</strong> di pojok kanan atas browser.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-relaxed">
                  Pilih menu <strong>&ldquo;Instal aplikasi&rdquo;</strong> atau{' '}
                  <strong>&ldquo;Tambahkan ke layar utama&rdquo;</strong>, lalu ketuk{' '}
                  <strong>Instal</strong>.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <p className="leading-relaxed">
                  Kembali ke layar utama (Home Screen) HP Anda, lalu buka ikon aplikasi{' '}
                  <strong>{appLabel}</strong> yang baru terpasang.
                </p>
              </li>
            </ol>
          )}

          {activeTab === 'ios' && (
            <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-relaxed">
                  Pastikan Anda membuka halaman ini menggunakan browser <strong>Safari</strong>{' '}
                  bawaan iPhone/iPad (bukan browser di dalam WhatsApp/Instagram).
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-relaxed">
                  Ketuk ikon <strong>Bagikan (Share)</strong>{' '}
                  <Share className="w-3.5 h-3.5 inline-block text-sky-600" /> pada bilah bawah
                  Safari.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-relaxed">
                  Gulir ke bawah lalu pilih{' '}
                  <strong>&ldquo;Tambahkan ke Layar Utama&rdquo; (Add to Home Screen)</strong>{' '}
                  <PlusSquare className="w-3.5 h-3.5 inline-block text-slate-800" />.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <p className="leading-relaxed">
                  Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas, kemudian buka aplikasi{' '}
                  <strong>{appLabel}</strong> melalui ikon baru di Home Screen iPhone/iPad Anda.
                </p>
              </li>
            </ol>
          )}

          {activeTab === 'desktop' && (
            <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-relaxed">
                  Gunakan <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> di
                  komputer/laptop Anda.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-relaxed">
                  Klik ikon <strong>Instal</strong>{' '}
                  <ExternalLink className="w-3.5 h-3.5 inline-block text-slate-800" /> di sisi kanan
                  bilah alamat (Address Bar), atau buka menu browser →{' '}
                  <strong>Simpan dan bagikan / Aplikasi</strong> →{' '}
                  <strong>Instal {appLabel}</strong>.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-relaxed">
                  Untuk <strong>Safari macOS</strong>, klik menu <strong>File</strong> →{' '}
                  <strong>Add to Dock</strong>.
                </p>
              </li>
            </ol>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
          {isMandatory ? (
            <>
              <p className="text-[11px] text-slate-500">
                Sudah terinstal? Buka langsung dari ikon di layar utama HP.
              </p>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shrink-0 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
