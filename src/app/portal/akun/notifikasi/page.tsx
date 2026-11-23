'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  Laptop,
  Loader2,
  Lock,
  Moon,
  Send,
  Share,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import { usePwa } from '@/components/providers/pwa-provider';
import {
  PUSH_RECEIVED_EVENT,
  deactivateCurrentDevicePush,
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeCurrentDevice,
} from '@/lib/pwa/push-client';
import type { InAppNotificationItem } from '@/lib/notifications/types';

interface CategoryPreferenceItem {
  key: string;
  label: string;
  description: string;
  allowUserOptOut: boolean;
  lockedByAdmin: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

interface DeviceItem {
  id: string;
  endpoint: string;
  platform: string;
  device_label: string;
  is_active: boolean;
  deactivated_reason: string | null;
  deactivated_at: string | null;
  last_seen_at: string;
  created_at: string;
}

export default function UserNotificationsPage() {
  const router = useRouter();
  const pwa = usePwa();

  const [activeTab, setActiveTab] = useState<'inbox' | 'preferences' | 'devices'>('inbox');

  // Inbox state
  const [notifications, setNotifications] = useState<InAppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // Preferences & Devices state
  const [categories, setCategories] = useState<CategoryPreferenceItem[]>([]);
  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: '22:00',
    end: '05:00',
  });
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [vapidConfigured, setVapidConfigured] = useState(true);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Current device browser state
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default');
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [togglingCurrentDevice, setTogglingCurrentDevice] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const qs = new URLSearchParams({ limit: '60' });
      if (filterUnread) qs.set('unread', '1');
      if (filterCategory) qs.set('category', filterCategory);
      const res = await fetch(`/api/notifikasi?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } finally {
      setLoadingInbox(false);
    }
  }, [filterUnread, filterCategory]);

  const loadPreferences = useCallback(async () => {
    setLoadingPrefs(true);
    try {
      const [res, sub] = await Promise.all([
        fetch('/api/notifikasi/preferensi', { cache: 'no-store' }),
        getExistingPushSubscription(),
      ]);
      if (isPushSupported()) {
        setBrowserPermission(getNotificationPermission());
      } else {
        setBrowserPermission('unsupported');
      }
      setCurrentEndpoint(sub?.endpoint ?? null);

      if (!res.ok) return;
      const data = await res.json();
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      if (data.quietHours) setQuietHours(data.quietHours);
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setVapidConfigured(Boolean(data.vapidConfigured));
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    const onPushReceived = () => {
      void loadInbox();
    };
    window.addEventListener(PUSH_RECEIVED_EVENT, onPushReceived);
    return () => window.removeEventListener(PUSH_RECEIVED_EVENT, onPushReceived);
  }, [loadInbox]);

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/notifikasi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleNotificationClick(item: InAppNotificationItem) {
    if (!item.is_read) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      void fetch('/api/notifikasi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
    }
    router.push(item.url || '/portal');
  }

  function handleToggleCategory(
    key: string,
    field: 'pushEnabled' | 'inAppEnabled',
    value: boolean
  ) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== key || c.lockedByAdmin) return c;
        return { ...c, [field]: value };
      })
    );
  }

  async function handleSavePreferences() {
    setSavingPrefs(true);
    setToast(null);
    try {
      const res = await fetch('/api/notifikasi/preferensi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: categories.map((c) => ({
            categoryKey: c.key,
            pushEnabled: c.lockedByAdmin ? true : c.pushEnabled,
            inAppEnabled: c.lockedByAdmin ? true : c.inAppEnabled,
          })),
          quietHours,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast({
          type: 'success',
          text: 'Preferensi notifikasi & jam tenang berhasil disimpan.',
        });
      } else {
        setToast({
          type: 'error',
          text: data.error || 'Gagal menyimpan preferensi notifikasi.',
        });
      }
    } finally {
      setSavingPrefs(false);
    }
  }

  const currentDeviceRow = currentEndpoint
    ? devices.find((d) => d.endpoint === currentEndpoint) ?? null
    : null;
  const isCurrentDeviceActive = Boolean(currentDeviceRow?.is_active);

  async function handleEnableCurrentDevice() {
    setTogglingCurrentDevice(true);
    setToast(null);
    try {
      const res = await subscribeCurrentDevice({
        audienceType: 'USER',
        platform: pwa.platform,
      });
      if (res.ok) {
        setToast({
          type: 'success',
          text: 'Web Push berhasil diaktifkan untuk perangkat ini.',
        });
        await loadPreferences();
      } else {
        setToast({
          type: 'error',
          text: res.error || 'Gagal mengaktifkan Web Push di perangkat ini.',
        });
      }
    } finally {
      setTogglingCurrentDevice(false);
    }
  }

  async function handleDisableCurrentDevice() {
    setTogglingCurrentDevice(true);
    setToast(null);
    try {
      const ok = await deactivateCurrentDevicePush('USER_DISABLED');
      if (ok) {
        setToast({
          type: 'success',
          text: 'Notifikasi Web Push pada perangkat ini telah dinonaktifkan.',
        });
        await loadPreferences();
      } else {
        setToast({
          type: 'error',
          text: 'Gagal menonaktifkan perangkat.',
        });
      }
    } finally {
      setTogglingCurrentDevice(false);
    }
  }

  async function handleDeactivateOtherDevice(subscriptionId: string) {
    setToast(null);
    const res = await fetch('/api/push/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, reason: 'USER_DISABLED' }),
    });
    if (res.ok) {
      setToast({
        type: 'success',
        text: 'Perangkat berhasil dinonaktifkan.',
      });
      await loadPreferences();
    }
  }

  async function handleSendTestPush() {
    setSendingTest(true);
    setToast(null);
    try {
      const res = await fetch('/api/notifikasi/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast({
          type: 'success',
          text:
            data.warning ||
            data.message ||
            'Notifikasi uji coba berhasil dikirim ke perangkat Anda.',
        });
        await loadInbox();
      } else {
        setToast({
          type: 'error',
          text: data.error || 'Gagal mengirim notifikasi uji coba.',
        });
      }
    } finally {
      setSendingTest(false);
    }
  }

  const isIosNonStandalone = pwa.platform === 'ios-safari' && !pwa.isStandalone;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">
                Pusat Notifikasi &amp; Preferensi Web Push
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                Kelola riwayat pemberitahuan, kategori notifikasi, jam tenang, dan perangkat aktif Anda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={sendingTest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white transition disabled:opacity-60"
            >
              {sendingTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Uji Coba Notifikasi</span>
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-2xl p-4 border text-xs font-medium flex items-center gap-2.5 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'inbox'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Kotak Masuk</span>
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'inbox'
                  ? 'bg-white text-emerald-800'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'preferences'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Preferensi Kategori &amp; Jam Tenang</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('devices')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'devices'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Perangkat Saya ({devices.filter((d) => d.is_active).length} Aktif)</span>
        </button>
      </div>

      {/* TAB 1: KOTAK MASUK */}
      {activeTab === 'inbox' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterUnread(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  !filterUnread
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterUnread(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  filterUnread
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label="Filter kategori notifikasi"
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5" />
                )}
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {loadingInbox ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs">Memuat riwayat notifikasi...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <p className="text-sm font-bold text-slate-700">
                  Tidak ada notifikasi untuk ditampilkan
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Semua pemberitahuan akademik, keuangan, dan pengumuman akan tersimpan di sini.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const catLabel =
                  categories.find((c) => c.key === item.category_key)?.label ||
                  item.category_key;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left p-4 sm:p-5 hover:bg-slate-50 transition flex items-start gap-3.5 ${
                      !item.is_read ? 'bg-emerald-50/35' : ''
                    }`}
                  >
                    <div
                      className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                        !item.is_read ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {catLabel}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <p
                        className={`text-sm ${
                          !item.is_read
                            ? 'font-bold text-slate-900'
                            : 'font-semibold text-slate-700'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PREFERENSI KATEGORI & JAM TENANG */}
      {activeTab === 'preferences' && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Preferensi Kategori Notifikasi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih kategori pemberitahuan yang ingin Anda terima. Kategori bertanda{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                    <Lock className="w-3 h-3 inline" /> Wajib oleh Admin
                  </span>{' '}
                  tidak dapat dinonaktifkan.
                </p>
              </div>
            </div>

            {loadingPrefs ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {categories.map((cat) => (
                  <div
                    key={cat.key}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900">
                          {cat.label}
                        </p>
                        {cat.lockedByAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                            <Lock className="w-3 h-3" />
                            <span>Wajib (Dikunci Admin)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                            Dapat Diatur
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cat.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cat.lockedByAdmin ? true : cat.pushEnabled}
                          disabled={cat.lockedByAdmin}
                          onChange={(e) =>
                            handleToggleCategory(cat.key, 'pushEnabled', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                        />
                        <span>Web Push</span>
                      </label>

                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cat.lockedByAdmin ? true : cat.inAppEnabled}
                          disabled={cat.lockedByAdmin}
                          onChange={(e) =>
                            handleToggleCategory(cat.key, 'inAppEnabled', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                        />
                        <span>Lonceng Portal</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jam Tenang (Quiet Hours) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Jam Tenang (Quiet Hours — WIB)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tahan bunyi Web Push non-wajib selama jam istirahat. Notifikasi tetap masuk ke Lonceng Portal dan kategori Wajib Admin tetap dikirim.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quietHours.enabled}
                  onChange={(e) =>
                    setQuietHours((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Aktifkan</span>
              </label>
            </div>

            {quietHours.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mulai Jam Tenang (WIB)
                  </label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) =>
                      setQuietHours((prev) => ({ ...prev, start: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selesai Jam Tenang (WIB)
                  </label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) =>
                      setQuietHours((prev) => ({ ...prev, end: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
              >
                {savingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Preferensi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERANGKAT SAYA (MULTI-DEVICE) */}
      {activeTab === 'devices' && (
        <div className="space-y-5">
          {/* Status Perangkat Saat Ini */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isCurrentDeviceActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCurrentDeviceActive ? (
                    <BellRing className="w-5 h-5" />
                  ) : (
                    <BellOff className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Status Perangkat Ini
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCurrentDeviceActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isCurrentDeviceActive ? 'Aktif Terhubung' : 'Belum Aktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Izin Browser: <strong>{browserPermission}</strong> • Platform:{' '}
                    <strong>{pwa.platform}</strong>
                  </p>
                  {!vapidConfigured && (
                    <p className="text-xs text-amber-700 mt-1">
                      Kunci VAPID server belum dikonfigurasi. Jalankan{' '}
                      <code>npm run push:vapid</code> terlebih dahulu.
                    </p>
                  )}
                </div>
              </div>

              {isIosNonStandalone ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 max-w-sm">
                  Ketuk <Share className="w-3.5 h-3.5 inline" />{' '}
                  <strong>Share → Add to Home Screen</strong> di Safari iOS untuk mengaktifkan Web Push.
                </div>
              ) : isCurrentDeviceActive ? (
                <button
                  type="button"
                  onClick={handleDisableCurrentDevice}
                  disabled={togglingCurrentDevice}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition disabled:opacity-60"
                >
                  {togglingCurrentDevice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BellOff className="w-3.5 h-3.5" />
                  )}
                  <span>Nonaktifkan di Perangkat Ini</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableCurrentDevice}
                  disabled={togglingCurrentDevice}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
                >
                  {togglingCurrentDevice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5" />
                  )}
                  <span>Aktifkan di Perangkat Ini</span>
                </button>
              )}
            </div>
          </div>

          {/* Daftar Multi-Device */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200/80">
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Semua Perangkat Terdaftar pada Akun Anda
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mendukung multi-device. Saat Anda keluar (logout), perangkat otomatis dinonaktifkan sementara (tidak dihapus) agar notifikasi tidak terkirim ke pengguna lain.
              </p>
            </div>

            {devices.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Belum ada perangkat yang terdaftar pada akun Anda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {devices.map((dev) => {
                  const isCurrent = Boolean(
                    currentEndpoint && dev.endpoint === currentEndpoint
                  );
                  return (
                    <div
                      key={dev.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          {dev.platform.includes('desktop') ? (
                            <Laptop className="w-4 h-4" />
                          ) : (
                            <Smartphone className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs sm:text-sm font-bold text-slate-900">
                              {dev.device_label}
                            </p>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                                Perangkat Ini
                              </span>
                            )}
                            {dev.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Aktif</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                Nonaktif ({dev.deactivated_reason || 'NONAKTIF'})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span>
                              Terakhir aktif:{' '}
                              {new Date(dev.last_seen_at).toLocaleString('id-ID', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </p>
                        </div>
                      </div>

                      {dev.is_active && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleDeactivateOtherDevice(dev.id)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition self-end sm:self-center"
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
