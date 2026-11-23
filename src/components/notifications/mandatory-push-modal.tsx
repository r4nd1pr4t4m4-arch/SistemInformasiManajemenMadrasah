'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  LogOut,
  PlusSquare,
  RefreshCw,
  Share,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { usePwa } from '@/components/providers/pwa-provider';
import {
  PUSH_STATE_CHANGED_EVENT,
  getClientVapidPublicKey,
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
  resyncPushSubscriptionOnPortalLoad,
  subscribeCurrentDevice,
} from '@/lib/pwa/push-client';

interface MandatoryPushModalProps {
  audienceType: 'USER' | 'PUBLIC';
  institutionName?: string;
  onLogout?: () => void;
}

type UnblockTab = 'chrome' | 'safari' | 'firefox';

export function MandatoryPushModal({
  audienceType,
  institutionName,
  onLogout,
}: MandatoryPushModalProps) {
  const pwa = usePwa();
  const [checking, setChecking] = useState(true);
  const [isPushActive, setIsPushActive] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribing, setSubscribing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [unblockTab, setUnblockTab] = useState<UnblockTab>('chrome');

  const appLabel = institutionName?.trim() || 'SIMMS';
  const vapidConfigured = Boolean(getClientVapidPublicKey());
  const isIosNonStandalone = pwa.platform === 'ios-safari' && !pwa.isStandalone;

  const verifyPushStatus = useCallback(async () => {
    if (!pwa.ready) return;

    // Jika VAPID key belum dikonfigurasi di environment server, jangan mengunci aplikasi
    if (!getClientVapidPublicKey()) {
      setIsPushActive(true);
      setChecking(false);
      return;
    }

    if (pwa.platform === 'ios-safari' && !pwa.isStandalone) {
      setPermission('unsupported');
      setIsPushActive(false);
      setChecking(false);
      return;
    }

    if (!isPushSupported()) {
      setPermission('unsupported');
      setIsPushActive(false);
      setChecking(false);
      return;
    }

    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    if (currentPerm !== 'granted') {
      setIsPushActive(false);
      setChecking(false);
      return;
    }

    const existingSub = await getExistingPushSubscription();
    if (existingSub) {
      // Sinkronkan & pastikan aktif di server
      if (audienceType === 'USER') {
        await resyncPushSubscriptionOnPortalLoad(pwa.platform);
      }
      setIsPushActive(true);
      setChecking(false);
      return;
    }

    // Izin sudah granted di browser, tetapi belum ada subscription PushManager -> daftarkan otomatis
    const autoSub = await subscribeCurrentDevice({
      audienceType,
      platform: pwa.platform,
    });
    setIsPushActive(autoSub.ok);
    setChecking(false);
  }, [pwa.ready, pwa.platform, pwa.isStandalone, audienceType]);

  useEffect(() => {
    void verifyPushStatus();
  }, [verifyPushStatus]);

  // Pantau perubahan status push, izin notifikasi browser, dan saat tab kembali aktif
  useEffect(() => {
    const handleStateChanged = (e: Event) => {
      const custom = e as CustomEvent<{ active?: boolean }>;
      if (custom.detail?.active) {
        setIsPushActive(true);
        setErrorText(null);
      } else {
        void verifyPushStatus();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void verifyPushStatus();
      }
    };

    window.addEventListener(PUSH_STATE_CHANGED_EVENT, handleStateChanged);
    document.addEventListener('visibilitychange', handleVisibility);

    let permStatus: PermissionStatus | null = null;
    const onPermChange = () => {
      void verifyPushStatus();
    };

    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permStatus = status;
          status.addEventListener('change', onPermChange);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener(PUSH_STATE_CHANGED_EVENT, handleStateChanged);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (permStatus) {
        permStatus.removeEventListener('change', onPermChange);
      }
    };
  }, [verifyPushStatus]);

  // Blokir tombol Escape dan kunci scroll halaman selama modal wajib terbuka
  const modalOpen = pwa.ready && !checking && vapidConfigured && !isPushActive;

  useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [modalOpen]);

  async function handleActivateClick() {
    setSubscribing(true);
    setErrorText(null);
    try {
      const res = await subscribeCurrentDevice({
        audienceType,
        platform: pwa.platform,
      });
      if (res.ok) {
        setIsPushActive(true);
      } else {
        if (res.permission) setPermission(res.permission);
        setErrorText(
          res.error ||
            'Gagal mengaktifkan Web Push Notification. Pastikan Anda menekan tombol "Allow / Izinkan".'
        );
      }
    } finally {
      setSubscribing(false);
    }
  }

  if (!modalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mandatory-push-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <BellRing className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                <span>Wajib Diaktifkan</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                Kebijakan Sistem
              </span>
            </div>
            <h2
              id="mandatory-push-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 mt-1"
            >
              Aktifkan Web Push Notification {appLabel}
            </h2>
          </div>
        </div>

        {/* Penjelasan Mengapa Wajib */}
        <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-4 text-xs text-emerald-950 space-y-2 leading-relaxed">
          <p className="font-bold text-emerald-900">
            Fitur notifikasi wajib diaktifkan untuk dapat terus beraktivitas pada aplikasi ini.
          </p>
          <p className="text-emerald-800">
            Dengan mengaktifkan Web Push Notification, perangkat Anda akan menerima pemberitahuan penting secara instan meskipun aplikasi sedang tidak dibuka:
          </p>
          <ul className="space-y-1 text-emerald-900 pt-0.5">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Pengumuman resmi, berita terbaru, &amp; informasi darurat lembaga</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Presensi kehadiran siswa, catatan Guru Wali/hafalan, &amp; layanan BK</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Tagihan SPP, konfirmasi pembayaran, mutasi tabungan, &amp; keamanan akun</span>
            </li>
          </ul>
        </div>

        {/* KONDISI 1: iOS Safari belum di-install ke Home Screen */}
        {isIosNonStandalone ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Pada <strong>iPhone / iPad (iOS Safari)</strong>, Apple mewajibkan aplikasi ditambahkan ke{' '}
                <strong>Layar Utama (Home Screen)</strong> terlebih dahulu agar Web Push Notification dapat diaktifkan.
              </p>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-relaxed">
                  Ketuk ikon <strong>Bagikan (Share)</strong>{' '}
                  <Share className="w-3.5 h-3.5 inline-block text-sky-600" /> di bilah bawah browser Safari.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-relaxed">
                  Pilih menu <strong>&ldquo;Tambahkan ke Layar Utama&rdquo; (Add to Home Screen)</strong>{' '}
                  <PlusSquare className="w-3.5 h-3.5 inline-block text-slate-800" /> lalu ketuk{' '}
                  <strong>Tambah (Add)</strong>.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-relaxed">
                  Buka aplikasi <strong>{appLabel}</strong> dari ikon baru di Home Screen Anda, lalu ketuk tombol{' '}
                  <strong>Aktifkan Notifikasi</strong>.
                </p>
              </li>
            </ol>
          </div>
        ) : permission === 'denied' ? (
          /* KONDISI 2: Izin Notifikasi Diblokir (Denied) di Browser */
          <div className="space-y-3">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-950 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-900">
                  Izin Notifikasi Sedang Diblokir di Browser Anda
                </p>
                <p className="text-rose-800 leading-relaxed">
                  Karena sebelumnya izin notifikasi ditolak/diblokir, Anda perlu mengizinkannya melalui pengaturan bilah alamat browser agar dapat melanjutkan aktivitas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setUnblockTab('chrome')}
                className={`flex-1 py-2 px-2.5 rounded-lg transition ${
                  unblockTab === 'chrome'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chrome / Edge
              </button>
              <button
                type="button"
                onClick={() => setUnblockTab('safari')}
                className={`flex-1 py-2 px-2.5 rounded-lg transition ${
                  unblockTab === 'safari'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Safari
              </button>
              <button
                type="button"
                onClick={() => setUnblockTab('firefox')}
                className={`flex-1 py-2 px-2.5 rounded-lg transition ${
                  unblockTab === 'firefox'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Firefox
              </button>
            </div>

            {unblockTab === 'chrome' && (
              <ol className="space-y-2 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Klik ikon <strong>Pengaturan Situs / Gembok</strong>{' '}
                    <SlidersHorizontal className="w-3.5 h-3.5 inline-block text-slate-800" /> di sebelah kiri alamat URL browser (di bagian atas layar).
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="leading-relaxed">
                    Pada menu <strong>Notifications (Notifikasi)</strong>, ubah dari <em>Block</em> menjadi{' '}
                    <strong>Allow (Izinkan)</strong>.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="leading-relaxed">
                    Klik tombol <strong>&ldquo;Saya Sudah Mengizinkan, Aktifkan Sekarang&rdquo;</strong> di bawah ini.
                  </p>
                </li>
              </ol>
            )}

            {unblockTab === 'safari' && (
              <ol className="space-y-2 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Di iPhone/iPad: Buka aplikasi <strong>Settings (Pengaturan) → Notifications</strong> → pilih aplikasi <strong>{appLabel}</strong> → aktifkan <strong>Allow Notifications</strong>.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="leading-relaxed">
                    Di macOS: Buka menu <strong>Safari → Settings → Websites → Notifications</strong> → ubah situs ini menjadi <strong>Allow</strong>.
                  </p>
                </li>
              </ol>
            )}

            {unblockTab === 'firefox' && (
              <ol className="space-y-2 text-xs text-slate-700 bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Klik ikon <strong>Gembok / Perisai</strong> di sebelah kiri alamat URL Firefox.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="leading-relaxed">
                    Hapus tanda silang (X) pada <strong>Receive Notifications (Blocked)</strong>, lalu klik tombol aktifkan di bawah.
                  </p>
                </li>
              </ol>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleActivateClick}
                disabled={subscribing}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
              >
                {subscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BellRing className="w-4 h-4" />
                )}
                <span>Saya Sudah Mengizinkan, Aktifkan Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>
            </div>
          </div>
        ) : permission === 'unsupported' ? (
          /* KONDISI 3: Mode Incognito / Browser Tidak Mendukung Web Push */
          <div className="space-y-3">
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Browser atau Mode Jendela Saat Ini Tidak Mendukung Web Push</span>
              </p>
              <p className="text-amber-800 leading-relaxed">
                Pastikan Anda <strong>tidak menggunakan Mode Penyamaran (Incognito / Private Window)</strong> atau browser bawaan di dalam aplikasi sosial media (seperti in-app browser WhatsApp/Instagram). Buka aplikasi menggunakan <strong>Google Chrome, Microsoft Edge, Mozilla Firefox, atau Safari PWA</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void verifyPushStatus()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Periksa Ulang Dukungan Browser</span>
            </button>
          </div>
        ) : (
          /* KONDISI 4: Normal (Siap Diaktifkan 1-Klik) */
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-700 leading-relaxed">
              Klik tombol di bawah ini, kemudian pilih <strong>&ldquo;Allow&rdquo;</strong> atau{' '}
              <strong>&ldquo;Izinkan&rdquo;</strong> saat dialog perizinan notifikasi muncul di browser Anda.
            </div>

            {errorText && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorText}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleActivateClick}
              disabled={subscribing}
              aria-busy={subscribing || undefined}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition disabled:opacity-60"
            >
              {subscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BellRing className="w-4 h-4" />
              )}
              <span>
                {subscribing
                  ? 'Mengaktifkan Notifikasi Perangkat...'
                  : 'Aktifkan Notifikasi & Lanjutkan Aktivitas'}
              </span>
            </button>
          </div>
        )}

        {/* Footer Info & Logout */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200/80">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Terenkripsi standar Web Push VAPID • Multi-Perangkat</span>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shrink-0 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
