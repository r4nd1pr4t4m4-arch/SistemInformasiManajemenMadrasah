'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, CheckCircle2, Info, Loader2, Share, ShieldAlert, X } from 'lucide-react';
import { usePwa } from '@/components/providers/pwa-provider';
import {
  PUSH_OPT_IN_DISMISSED_KEY,
  getClientVapidPublicKey,
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
  resyncPushSubscriptionOnPortalLoad,
  subscribeCurrentDevice,
} from '@/lib/pwa/push-client';

export function PushOptInBanner({
  audienceType = 'USER',
  compact = false,
}: {
  audienceType?: 'USER' | 'PUBLIC';
  compact?: boolean;
}) {
  const pwa = usePwa();
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribing, setSubscribing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!pwa.ready) return;
    if (!getClientVapidPublicKey()) return;

    let mounted = true;

    async function checkState() {
      // Pada iOS Safari non-standalone, Web Push hanya tersedia jika PWA ditambahkan ke Home Screen
      if (pwa.platform === 'ios-safari' && !pwa.isStandalone) {
        const dismissed = window.localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY);
        if (!dismissed && mounted) {
          setVisible(true);
        }
        return;
      }

      if (!isPushSupported()) return;
      const currentPerm = getNotificationPermission();
      if (mounted) setPermission(currentPerm);

      if (currentPerm === 'granted') {
        const existingSub = await getExistingPushSubscription();
        if (existingSub) {
          // Resync otomatis di belakang layar (termasuk reaktivasi setelah login ulang)
          if (audienceType === 'USER') {
            void resyncPushSubscriptionOnPortalLoad(pwa.platform);
          }
          return;
        }
      }

      const dismissedAt = Number(
        window.localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY) || 0
      );
      // Jika sudah di-dismiss dalam 7 hari terakhir, jangan tampilkan lagi
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        return;
      }

      if (mounted) {
        setVisible(true);
      }
    }

    void checkState();

    return () => {
      mounted = false;
    };
  }, [pwa.ready, pwa.platform, pwa.isStandalone, audienceType]);

  function handleDismiss() {
    try {
      window.localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, String(Date.now()));
    } catch {
      // abaikan
    }
    setVisible(false);
  }

  async function handleEnablePush() {
    setSubscribing(true);
    setFeedback(null);
    try {
      const res = await subscribeCurrentDevice({
        audienceType,
        platform: pwa.platform,
      });
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: 'Notifikasi Web Push berhasil diaktifkan di perangkat ini!',
        });
        window.setTimeout(() => {
          setVisible(false);
        }, 2000);
      } else {
        if (res.permission) setPermission(res.permission);
        setFeedback({
          type: 'error',
          text: res.error || 'Gagal mengaktifkan notifikasi.',
        });
      }
    } finally {
      setSubscribing(false);
    }
  }

  if (!visible) return null;

  const isIosNonStandalone = pwa.platform === 'ios-safari' && !pwa.isStandalone;

  return (
    <div
      className={`${
        compact ? 'mx-auto max-w-7xl my-3 px-4' : 'mb-4'
      }`}
    >
      <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/80 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-slate-900">
              {audienceType === 'PUBLIC'
                ? 'Aktifkan Notifikasi Berita & Pengumuman Resmi'
                : 'Aktifkan Notifikasi Instan SIMMS di Perangkat Ini'}
            </p>
            {isIosNonStandalone ? (
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Pengguna <strong>iPhone/iPad (iOS Safari)</strong>: Ketuk tombol{' '}
                <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-800">
                  <Share className="w-3 h-3 inline" /> Bagikan (Share)
                </span>{' '}
                lalu pilih <strong>&quot;Tambahkan ke Layar Utama (Add to Home Screen)&quot;</strong>{' '}
                agar fitur Web Push Notification aktif.
              </p>
            ) : permission === 'denied' ? (
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>
                  Izin notifikasi diblokir di browser Anda. Klik ikon gembok di bilah alamat browser
                  lalu ubah <strong>Notifications → Allow (Izinkan)</strong>.
                </span>
              </p>
            ) : (
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {audienceType === 'PUBLIC'
                  ? 'Dapatkan pemberitahuan langsung saat pengumuman, PPDB, atau berita terbaru diterbitkan.'
                  : 'Terima info pengumuman, presensi siswa, tagihan SPP, nilai, dan layanan akademik secara real-time.'}
              </p>
            )}

            {feedback && (
              <p
                className={`mt-1.5 text-xs font-medium flex items-center gap-1.5 ${
                  feedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Info className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {!isIosNonStandalone && permission !== 'denied' && (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={subscribing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60"
            >
              {subscribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <BellRing className="w-3.5 h-3.5" />
              )}
              <span>Aktifkan Sekarang</span>
            </button>
          )}
          {audienceType === 'USER' && (
            <Link
              href="/portal/akun/notifikasi"
              className="px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              Atur Preferensi
            </Link>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup banner notifikasi"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
