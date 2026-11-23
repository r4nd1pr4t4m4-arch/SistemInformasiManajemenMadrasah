'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  Loader2,
  Send,
  SlidersHorizontal,
  Smartphone,
  X,
} from 'lucide-react';
import { usePwa } from '@/components/providers/pwa-provider';
import { useToast } from '@/components/providers/toast-provider';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import {
  NOTIF_BROADCAST_CHANNEL_NAME,
  NOTIF_READ_SYNC_EVENT,
  PUSH_RECEIVED_EVENT,
  PUSH_STATE_CHANGED_EVENT,
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
  notifyNotificationReadSync,
  subscribeCurrentDevice,
} from '@/lib/pwa/push-client';
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
import type { InAppNotificationItem } from '@/lib/notifications/types';
import {
  NOTIF_PAGE_SIZE,
  UserNotificationsDevicesTab,
  UserNotificationsInboxTab,
  UserNotificationsPreferencesTab,
  type CategoryPreferenceItem,
  type DeviceItem,
  type QuietHoursState,
} from '@/components/notifications/user-notification-tabs';

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function UserNotificationsPage() {
  const router = useRouter();
  const pwa = usePwa();
  const toast = useToast();
  const { user: sessionUser } = usePortalSession();

  const [activeTab, setActiveTab] = useState<'inbox' | 'preferences' | 'devices'>('inbox');

  // Inbox state
  const [notifications, setNotifications] = useState<InAppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingItemId, setMarkingItemId] = useState<string | null>(null);
  const inboxReqIdRef = useRef(0);

  // Preferences & Devices state
  const [categories, setCategories] = useState<CategoryPreferenceItem[]>([]);
  const [initialCategories, setInitialCategories] = useState<CategoryPreferenceItem[]>([]);
  const [quietHours, setQuietHours] = useState<QuietHoursState>({
    enabled: false,
    start: '22:00',
    end: '05:00',
  });
  const [initialQuietHours, setInitialQuietHours] = useState<QuietHoursState>({
    enabled: false,
    start: '22:00',
    end: '05:00',
  });
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [vapidConfigured, setVapidConfigured] = useState(true);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Current & multi-device state
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default');
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [togglingCurrentDevice, setTogglingCurrentDevice] = useState(false);
  const [confirmDeactivateDevice, setConfirmDeactivateDevice] = useState<DeviceItem | null>(
    null
  );
  const [deactivatingDeviceId, setDeactivatingDeviceId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const loadInbox = useCallback(
    async (silent = false) => {
      const reqId = ++inboxReqIdRef.current;
      if (!silent) {
        setLoadingInbox(true);
        setInboxError(null);
      }
      try {
        const qs = new URLSearchParams({ limit: '100' });
        if (filterUnread) qs.set('unread', '1');
        if (filterCategory) qs.set('category', filterCategory);

        const res = await fetch(`/api/notifikasi?${qs.toString()}`, {
          cache: 'no-store',
        });
        if (reqId !== inboxReqIdRef.current) return;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (!silent) {
            setInboxError(errData.error || 'Gagal memuat riwayat notifikasi.');
          }
          return;
        }

        const data = await res.json();
        if (reqId !== inboxReqIdRef.current) return;

        setNotifications(Array.isArray(data.items) ? data.items : []);
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
        setInboxError(null);
      } catch {
        if (reqId === inboxReqIdRef.current && !silent) {
          setInboxError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
        }
      } finally {
        if (reqId === inboxReqIdRef.current && !silent) {
          setLoadingInbox(false);
        }
      }
    },
    [filterUnread, filterCategory]
  );

  const loadPreferences = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingPrefs(true);
      setPrefsError(null);
    }
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (!silent) {
          setPrefsError(errData.error || 'Gagal memuat preferensi & daftar perangkat.');
        }
        return;
      }

      const data = await res.json();
      const loadedCats: CategoryPreferenceItem[] = Array.isArray(data.categories)
        ? data.categories
        : [];
      const loadedQuiet: QuietHoursState = data.quietHours
        ? {
            enabled: Boolean(data.quietHours.enabled),
            start: String(data.quietHours.start || '22:00'),
            end: String(data.quietHours.end || '05:00'),
          }
        : { enabled: false, start: '22:00', end: '05:00' };

      setCategories(loadedCats);
      setInitialCategories(loadedCats);
      setQuietHours(loadedQuiet);
      setInitialQuietHours(loadedQuiet);
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setVapidConfigured(Boolean(data.vapidConfigured));
      setPrefsError(null);
    } catch {
      if (!silent) {
        setPrefsError('Gagal memuat data preferensi. Periksa koneksi internet Anda.');
      }
    } finally {
      if (!silent) {
        setLoadingPrefs(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInbox(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadInbox]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPreferences(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPreferences]);

  useEffect(() => {
    const onPushOrReadSync = () => {
      void loadInbox(true);
    };
    const onPushStateChanged = () => {
      void loadPreferences(true);
    };

    window.addEventListener(PUSH_RECEIVED_EVENT, onPushOrReadSync);
    window.addEventListener(NOTIF_READ_SYNC_EVENT, onPushOrReadSync);
    window.addEventListener(PUSH_STATE_CHANGED_EVENT, onPushStateChanged);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(NOTIF_BROADCAST_CHANNEL_NAME);
        bc.onmessage = (ev) => {
          if (
            ev.data?.type === NOTIF_READ_SYNC_EVENT ||
            ev.data?.type === PUSH_RECEIVED_EVENT
          ) {
            void loadInbox(true);
          } else if (ev.data?.type === PUSH_STATE_CHANGED_EVENT) {
            void loadPreferences(true);
          }
        };
      } catch {
        // abaikan
      }
    }

    return () => {
      window.removeEventListener(PUSH_RECEIVED_EVENT, onPushOrReadSync);
      window.removeEventListener(NOTIF_READ_SYNC_EVENT, onPushOrReadSync);
      window.removeEventListener(PUSH_STATE_CHANGED_EVENT, onPushStateChanged);
      if (bc) bc.close();
    };
  }, [loadInbox, loadPreferences]);

  useEffect(() => {
    const uid = sessionUser?.userId;
    if (!uid || !isSupabaseConfigured()) return;

    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`user-notif-inbox-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void loadInbox(true);
        }
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [sessionUser?.userId, loadInbox]);

  useEffect(() => {
    if (!confirmDeactivateDevice) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deactivatingDeviceId) {
        setConfirmDeactivateDevice(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeactivateDevice, deactivatingDeviceId]);

  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.key, c.label);
    }
    return map;
  }, [categories]);

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((item) => {
      const catLabel = (
        categoryLabelMap.get(item.category_key) || item.category_key
      ).toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        catLabel.includes(q)
      );
    });
  }, [notifications, searchQuery, categoryLabelMap]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / NOTIF_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedNotifications = useMemo(() => {
    const start = (safePage - 1) * NOTIF_PAGE_SIZE;
    return filteredNotifications.slice(start, start + NOTIF_PAGE_SIZE);
  }, [filteredNotifications, safePage]);

  const hasUnsavedPreferences = useMemo(() => {
    if (
      quietHours.enabled !== initialQuietHours.enabled ||
      quietHours.start !== initialQuietHours.start ||
      quietHours.end !== initialQuietHours.end
    ) {
      return true;
    }
    if (categories.length !== initialCategories.length) return false;
    for (let i = 0; i < categories.length; i += 1) {
      const curr = categories[i];
      const init = initialCategories[i];
      if (!init) continue;
      if (curr.pushEnabled !== init.pushEnabled || curr.inAppEnabled !== init.inAppEnabled) {
        return true;
      }
    }
    return false;
  }, [categories, initialCategories, quietHours, initialQuietHours]);

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
        setNotifications((prev) =>
          filterUnread ? [] : prev.map((n) => ({ ...n, is_read: true }))
        );
        notifyNotificationReadSync();
        toast.success('Seluruh notifikasi berhasil ditandai sebagai sudah dibaca.');
      } else {
        toast.error('Gagal menandai semua notifikasi sebagai dibaca.');
      }
    } catch {
      toast.error('Terjadi gangguan jaringan saat memperbarui status baca.');
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkSingleRead(e: React.MouseEvent, item: InAppNotificationItem) {
    e.stopPropagation();
    if (item.is_read || markingItemId === item.id) return;
    setMarkingItemId(item.id);
    try {
      const res = await fetch('/api/notifikasi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) {
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          filterUnread
            ? prev.filter((n) => n.id !== item.id)
            : prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        notifyNotificationReadSync();
      } else {
        toast.error('Gagal memperbarui status baca notifikasi.');
      }
    } catch {
      toast.error('Gagal terhubung ke server.');
    } finally {
      setMarkingItemId(null);
    }
  }

  function handleNotificationClick(item: InAppNotificationItem) {
    if (!item.is_read) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        filterUnread
          ? prev.filter((n) => n.id !== item.id)
          : prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      void fetch('/api/notifikasi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      }).then((res) => {
        if (res.ok) notifyNotificationReadSync();
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

  function handleResetPreferences() {
    setCategories(initialCategories);
    setQuietHours(initialQuietHours);
  }

  async function handleSavePreferences() {
    if (quietHours.enabled) {
      if (!HH_MM_RE.test(quietHours.start) || !HH_MM_RE.test(quietHours.end)) {
        toast.error('Format waktu Jam Tenang harus HH:MM (contoh: 22:00 - 05:00).');
        return;
      }
      if (quietHours.start === quietHours.end) {
        toast.error('Jam mulai dan jam selesai Jam Tenang tidak boleh sama.');
        return;
      }
    }

    setSavingPrefs(true);
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
        setInitialCategories(categories);
        setInitialQuietHours(quietHours);
        toast.success('Preferensi kategori & pengaturan Jam Tenang berhasil disimpan.');
      } else {
        toast.error(data.error || 'Gagal menyimpan preferensi notifikasi.');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat menyimpan preferensi.');
    } finally {
      setSavingPrefs(false);
    }
  }

  const currentDeviceRow = currentEndpoint
    ? devices.find((d) => d.endpoint === currentEndpoint) ?? null
    : null;
  const isCurrentDeviceActive = Boolean(currentDeviceRow?.is_active);
  const activeDeviceCount = useMemo(
    () => devices.filter((d) => d.is_active).length,
    [devices]
  );

  async function handleEnableCurrentDevice() {
    setTogglingCurrentDevice(true);
    try {
      const res = await subscribeCurrentDevice({
        audienceType: 'USER',
        platform: pwa.platform,
      });
      if (res.ok) {
        toast.success('Langganan Web Push perangkat ini berhasil disinkronkan.');
        await loadPreferences(true);
      } else {
        toast.error(res.error || 'Gagal mengaktifkan Web Push di perangkat ini.');
      }
    } finally {
      setTogglingCurrentDevice(false);
    }
  }

  async function handleConfirmDeactivateOtherDevice() {
    if (!confirmDeactivateDevice || deactivatingDeviceId) return;
    const target = confirmDeactivateDevice;
    setDeactivatingDeviceId(target.id);
    try {
      const res = await fetch('/api/push/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: target.id, reason: 'USER_DISABLED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Perangkat "${target.device_label}" berhasil dinonaktifkan.`);
        setConfirmDeactivateDevice(null);
        await loadPreferences(true);
      } else {
        toast.error(data.error || 'Gagal menonaktifkan perangkat.');
      }
    } catch {
      toast.error('Gagal terhubung ke server saat menonaktifkan perangkat.');
    } finally {
      setDeactivatingDeviceId(null);
    }
  }

  async function handleSendTestPush() {
    setSendingTest(true);
    try {
      const res = await fetch('/api/notifikasi/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.warning ||
            data.message ||
            'Notifikasi uji coba berhasil dikirim ke perangkat aktif Anda.'
        );
        await loadInbox(true);
      } else {
        toast.error(data.error || 'Gagal mengirim notifikasi uji coba.');
      }
    } catch {
      toast.error('Terjadi gangguan jaringan saat mengirim uji coba notifikasi.');
    } finally {
      setSendingTest(false);
    }
  }

  const isIosNonStandalone = pwa.platform === 'ios-safari' && !pwa.isStandalone;

  return (
    <div className="max-w-5xl mx-auto w-full min-w-0 space-y-5 sm:space-y-6 pb-4">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white p-5 sm:p-6 shadow-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold leading-snug break-words">
                Pusat Notifikasi &amp; Preferensi Web Push
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5 leading-relaxed">
                Kelola riwayat pemberitahuan, kategori notifikasi, jam tenang, dan perangkat aktif
                Anda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleSendTestPush()}
              disabled={sendingTest}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white transition disabled:opacity-60"
            >
              {sendingTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Send className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Uji Coba Notifikasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Navigasi Pusat Notifikasi"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-200 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inbox'}
          onClick={() => setActiveTab('inbox')}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
            activeTab === 'inbox'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Bell className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Kotak Masuk</span>
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                activeTab === 'inbox'
                  ? 'bg-white text-emerald-800'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preferences'}
          onClick={() => setActiveTab('preferences')}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
            activeTab === 'preferences'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Preferensi &amp; Jam Tenang</span>
          {hasUnsavedPreferences && (
            <span
              title="Ada perubahan belum disimpan"
              className={`w-2 h-2 rounded-full shrink-0 ${
                activeTab === 'preferences' ? 'bg-amber-300' : 'bg-amber-500'
              }`}
            />
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'devices'}
          onClick={() => setActiveTab('devices')}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
            activeTab === 'devices'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Perangkat Saya ({activeDeviceCount} Aktif)</span>
        </button>
      </div>

      {activeTab === 'inbox' && (
        <UserNotificationsInboxTab
          unreadCount={unreadCount}
          filterUnread={filterUnread}
          setFilterUnread={setFilterUnread}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setCurrentPage={setCurrentPage}
          categories={categories}
          categoryLabelMap={categoryLabelMap}
          loadingInbox={loadingInbox}
          inboxError={inboxError}
          filteredNotifications={filteredNotifications}
          paginatedNotifications={paginatedNotifications}
          safePage={safePage}
          totalPages={totalPages}
          markingAll={markingAll}
          markingItemId={markingItemId}
          onMarkAllRead={() => void handleMarkAllRead()}
          onMarkSingleRead={(e, item) => void handleMarkSingleRead(e, item)}
          onNotificationClick={handleNotificationClick}
          onReload={() => void loadInbox(false)}
        />
      )}

      {activeTab === 'preferences' && (
        <UserNotificationsPreferencesTab
          prefsError={prefsError}
          loadingPrefs={loadingPrefs}
          categories={categories}
          quietHours={quietHours}
          setQuietHours={setQuietHours}
          hasUnsavedPreferences={hasUnsavedPreferences}
          savingPrefs={savingPrefs}
          onToggleCategory={handleToggleCategory}
          onResetPreferences={handleResetPreferences}
          onSavePreferences={() => void handleSavePreferences()}
          onReload={() => void loadPreferences(false)}
        />
      )}

      {activeTab === 'devices' && (
        <UserNotificationsDevicesTab
          isCurrentDeviceActive={isCurrentDeviceActive}
          browserPermission={browserPermission}
          platform={pwa.platform}
          vapidConfigured={vapidConfigured}
          isIosNonStandalone={isIosNonStandalone}
          togglingCurrentDevice={togglingCurrentDevice}
          loadingPrefs={loadingPrefs}
          devices={devices}
          currentEndpoint={currentEndpoint}
          onEnableCurrentDevice={() => void handleEnableCurrentDevice()}
          onReload={() => void loadPreferences(false)}
          onConfirmDeactivateDevice={(dev) => setConfirmDeactivateDevice(dev)}
        />
      )}

      {/* Modal Konfirmasi Nonaktifkan Perangkat Lain */}
      {confirmDeactivateDevice && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-device-title"
          onClick={() => {
            if (!deactivatingDeviceId) setConfirmDeactivateDevice(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <BellOff className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="deactivate-device-title"
                    className="text-sm sm:text-base font-bold text-slate-900"
                  >
                    Nonaktifkan Perangkat Ini?
                  </h3>
                  <p className="text-xs text-slate-500">
                    {confirmDeactivateDevice.device_label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(deactivatingDeviceId)}
                onClick={() => setConfirmDeactivateDevice(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Perangkat <strong>{confirmDeactivateDevice.device_label}</strong> tidak akan menerima
              Web Push Notification sampai Anda membuka dan masuk kembali ke akun SIMMS pada
              perangkat tersebut.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deactivatingDeviceId)}
                onClick={() => setConfirmDeactivateDevice(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deactivatingDeviceId)}
                onClick={() => void handleConfirmDeactivateOtherDevice()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-60"
              >
                {deactivatingDeviceId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Nonaktifkan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
