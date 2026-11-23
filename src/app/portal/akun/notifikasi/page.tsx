'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Laptop,
  Loader2,
  Lock,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  X,
} from 'lucide-react';
import { usePwa } from '@/components/providers/pwa-provider';
import {
  NOTIF_READ_SYNC_EVENT,
  PUSH_RECEIVED_EVENT,
  PUSH_STATE_CHANGED_EVENT,
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
  notifyNotificationReadSync,
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

interface QuietHoursState {
  enabled: boolean;
  start: string;
  end: string;
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

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PAGE_SIZE = 10;

function formatDeactivatedReason(reason: string | null): string {
  switch (reason) {
    case 'LOGOUT':
      return 'Nonaktif saat Keluar (Logout)';
    case 'USER_DISABLED':
      return 'Dinonaktifkan Pengguna';
    case 'EXPIRED_410':
      return 'Sesi Push Kedaluwarsa';
    case 'ADMIN_REVOKED':
      return 'Dicabut Admin';
    default:
      return 'Nonaktif';
  }
}

function formatPlatformLabel(platform: string): string {
  switch (platform) {
    case 'android-chrome':
      return 'Android (Chrome / PWA)';
    case 'ios-safari':
      return 'iOS / iPadOS (Safari PWA)';
    case 'desktop-chromium':
      return 'Desktop (Chrome / Edge)';
    case 'desktop-safari':
      return 'macOS (Safari)';
    default:
      return platform || 'Browser Web';
  }
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

  // Toast feedback with auto-dismiss
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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

  // Sinkronisasi real-time saat push masuk, izin berubah, atau status baca berubah dari Header Bell
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

    return () => {
      window.removeEventListener(PUSH_RECEIVED_EVENT, onPushOrReadSync);
      window.removeEventListener(NOTIF_READ_SYNC_EVENT, onPushOrReadSync);
      window.removeEventListener(PUSH_STATE_CHANGED_EVENT, onPushStateChanged);
    };
  }, [loadInbox, loadPreferences]);

  // Tutup modal konfirmasi nonaktifkan perangkat dengan tombol Escape
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
      const catLabel = (categoryLabelMap.get(item.category_key) || item.category_key).toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        catLabel.includes(q)
      );
    });
  }, [notifications, searchQuery, categoryLabelMap]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedNotifications = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredNotifications.slice(start, start + PAGE_SIZE);
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
        showToast('success', 'Seluruh notifikasi berhasil ditandai sebagai sudah dibaca.');
      } else {
        showToast('error', 'Gagal menandai semua notifikasi sebagai dibaca.');
      }
    } catch {
      showToast('error', 'Terjadi gangguan jaringan saat memperbarui status baca.');
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
        showToast('error', 'Gagal memperbarui status baca notifikasi.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
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
        showToast('error', 'Format waktu Jam Tenang harus HH:MM (contoh: 22:00 - 05:00).');
        return;
      }
      if (quietHours.start === quietHours.end) {
        showToast('error', 'Jam mulai dan jam selesai Jam Tenang tidak boleh sama.');
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
        showToast('success', 'Preferensi kategori & pengaturan Jam Tenang berhasil disimpan.');
      } else {
        showToast('error', data.error || 'Gagal menyimpan preferensi notifikasi.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan saat menyimpan preferensi.');
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
        showToast('success', 'Langganan Web Push perangkat ini berhasil disinkronkan.');
        await loadPreferences(true);
      } else {
        showToast('error', res.error || 'Gagal mengaktifkan Web Push di perangkat ini.');
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
        showToast('success', `Perangkat "${target.device_label}" berhasil dinonaktifkan.`);
        setConfirmDeactivateDevice(null);
        await loadPreferences(true);
      } else {
        showToast('error', data.error || 'Gagal menonaktifkan perangkat.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server saat menonaktifkan perangkat.');
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
        showToast(
          'success',
          data.warning ||
            data.message ||
            'Notifikasi uji coba berhasil dikirim ke perangkat aktif Anda.'
        );
        await loadInbox(true);
      } else {
        showToast('error', data.error || 'Gagal mengirim notifikasi uji coba.');
      }
    } catch {
      showToast('error', 'Terjadi gangguan jaringan saat mengirim uji coba notifikasi.');
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
                Kelola riwayat pemberitahuan, kategori notifikasi, jam tenang, dan perangkat aktif Anda.
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

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-2xl p-3.5 sm:p-4 border text-xs font-medium flex items-start justify-between gap-3 shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <span className="leading-relaxed break-words">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup pesan"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 shrink-0 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

      {/* TAB 1: KOTAK MASUK */}
      {activeTab === 'inbox' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Toolbar Filter & Pencarian */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterUnread(false);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    !filterUnread
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterUnread(true);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    filterUnread
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    disabled={markingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition disabled:opacity-50"
                  >
                    {markingAll ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Tandai Semua Dibaca</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadInbox(false)}
                  disabled={loadingInbox}
                  title="Muat ulang daftar notifikasi"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 shrink-0 ${loadingInbox ? 'animate-spin' : ''}`}
                  />
                  <span className="hidden sm:inline">Muat Ulang</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="relative sm:col-span-7">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Cari judul atau isi notifikasi..."
                  aria-label="Cari notifikasi"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="sm:col-span-5">
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter kategori notifikasi"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua Kategori Notifikasi</option>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Daftar Notifikasi */}
          <div className="divide-y divide-slate-100">
            {loadingInbox ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs">Memuat riwayat notifikasi...</span>
              </div>
            ) : inboxError ? (
              <div className="py-14 px-4 text-center space-y-3">
                <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Gagal Memuat Notifikasi</p>
                  <p className="text-xs text-slate-500 mt-0.5">{inboxError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadInbox(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-2">
                <Bell className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  {searchQuery || filterUnread || filterCategory
                    ? 'Tidak ada notifikasi yang cocok dengan filter'
                    : 'Belum ada riwayat notifikasi'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {searchQuery || filterUnread || filterCategory
                    ? 'Coba ubah filter atau kata kunci pencarian untuk melihat pemberitahuan lainnya.'
                    : 'Semua pemberitahuan akademik, keuangan, dan pengumuman resmi akan tersimpan di sini.'}
                </p>
                {(searchQuery || filterUnread || filterCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterUnread(false);
                      setFilterCategory('');
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>
            ) : (
              paginatedNotifications.map((item) => {
                const catLabel =
                  categoryLabelMap.get(item.category_key) || item.category_key;
                const isMarkingThis = markingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(item);
                      }
                    }}
                    className={`w-full text-left p-4 sm:p-5 hover:bg-slate-50 focus:outline-none focus:bg-slate-50 transition flex items-start gap-3 sm:gap-3.5 cursor-pointer ${
                      !item.is_read ? 'bg-emerald-50/35' : ''
                    }`}
                  >
                    <div
                      className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                        !item.is_read ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold truncate max-w-full">
                          {catLabel}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {new Date(item.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <p
                        className={`text-xs sm:text-sm leading-snug break-words ${
                          !item.is_read
                            ? 'font-bold text-slate-900'
                            : 'font-semibold text-slate-700'
                        }`}
                      >
                        {item.title}
                      </p>

                      <p className="text-xs text-slate-600 leading-relaxed break-words">
                        {item.body}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <span>Buka halaman terkait</span>
                          <ArrowUpRight className="w-3 h-3 shrink-0" />
                        </span>

                        {!item.is_read && (
                          <button
                            type="button"
                            onClick={(e) => void handleMarkSingleRead(e, item)}
                            disabled={isMarkingThis}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-700 transition disabled:opacity-50"
                          >
                            {isMarkingThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>Tandai dibaca</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {!loadingInbox && !inboxError && filteredNotifications.length > PAGE_SIZE && (
            <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                Menampilkan{' '}
                <strong className="text-slate-800">
                  {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredNotifications.length)}
                </strong>{' '}
                dari <strong className="text-slate-800">{filteredNotifications.length}</strong>{' '}
                notifikasi
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>
                <span className="px-2.5 py-1 font-bold text-slate-700">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 transition"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PREFERENSI KATEGORI & JAM TENANG */}
      {activeTab === 'preferences' && (
        <div className="space-y-5">
          {prefsError ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3">
              <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto" />
              <div>
                <p className="text-sm font-bold text-slate-800">Gagal Memuat Preferensi</p>
                <p className="text-xs text-slate-500 mt-0.5">{prefsError}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadPreferences(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Preferensi Kategori Notifikasi
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Pilih saluran pemberitahuan yang ingin Anda terima. Kategori bertanda{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                        <Lock className="w-3 h-3 inline" /> Wajib (Dikunci Admin)
                      </span>{' '}
                      selalu aktif demi kelancaran informasi krusial.
                    </p>
                  </div>
                </div>

                {loadingPrefs ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {categories.map((cat) => (
                      <div
                        key={cat.key}
                        className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                              {cat.label}
                            </p>
                            {cat.lockedByAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                                <Lock className="w-3 h-3 shrink-0" />
                                <span>Wajib (Dikunci Admin)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                                Dapat Diatur
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">
                            {cat.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0">
                          <label
                            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                              cat.lockedByAdmin
                                ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                                : cat.pushEnabled
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 cursor-pointer'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
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

                          <label
                            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                              cat.lockedByAdmin
                                ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                                : cat.inAppEnabled
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 cursor-pointer'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
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
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900">
                        Jam Tenang (Quiet Hours — WIB)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Tahan bunyi Web Push opsional selama jam istirahat. Notifikasi tetap masuk ke Lonceng Portal dan kategori Wajib Admin tetap dikirim.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-800 cursor-pointer self-start sm:self-center shrink-0">
                    <input
                      type="checkbox"
                      checked={quietHours.enabled}
                      onChange={(e) =>
                        setQuietHours((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Aktifkan Jam Tenang</span>
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
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  {hasUnsavedPreferences && (
                    <button
                      type="button"
                      onClick={handleResetPreferences}
                      disabled={savingPrefs}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Kembalikan Perubahan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSavePreferences()}
                    disabled={savingPrefs || !hasUnsavedPreferences}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {savingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Simpan Preferensi</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: PERANGKAT SAYA (MULTI-DEVICE) */}
      {activeTab === 'devices' && (
        <div className="space-y-5">
          {/* Status Perangkat Saat Ini */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
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
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <p className="text-xs text-slate-500 mt-1 break-words">
                    Izin Browser:{' '}
                    <strong className="text-slate-700">{browserPermission}</strong> • Platform:{' '}
                    <strong className="text-slate-700">
                      {formatPlatformLabel(pwa.platform)}
                    </strong>
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
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Wajib Aktif di Perangkat Ini</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleEnableCurrentDevice()}
                    disabled={togglingCurrentDevice}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition disabled:opacity-60"
                  >
                    {togglingCurrentDevice ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Sinkronkan Ulang</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleEnableCurrentDevice()}
                  disabled={togglingCurrentDevice}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60 shrink-0"
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
            <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Semua Perangkat Terdaftar pada Akun Anda
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Mendukung multi-device. Saat Anda keluar (logout), perangkat otomatis dinonaktifkan sementara (tidak dihapus) agar notifikasi tidak terkirim ke pengguna lain.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadPreferences(false)}
                disabled={loadingPrefs}
                title="Muat ulang daftar perangkat"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPrefs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingPrefs ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : devices.length === 0 ? (
              <div className="py-12 px-4 text-center text-xs text-slate-500">
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
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          {dev.platform.includes('desktop') ? (
                            <Laptop className="w-4 h-4" />
                          ) : (
                            <Smartphone className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                              {dev.device_label}
                            </p>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                                Perangkat Ini
                              </span>
                            )}
                            {dev.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <ShieldCheck className="w-3 h-3 shrink-0" />
                                <span>Aktif</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                {formatDeactivatedReason(dev.deactivated_reason)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              Terakhir aktif:{' '}
                              {new Date(dev.last_seen_at).toLocaleString('id-ID', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                            <span>•</span>
                            <span>{formatPlatformLabel(dev.platform)}</span>
                          </p>
                        </div>
                      </div>

                      {dev.is_active && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeactivateDevice(dev)}
                          className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition self-end sm:self-center shrink-0"
                        >
                          Nonaktifkan Perangkat
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
                  <h3 id="deactivate-device-title" className="text-sm sm:text-base font-bold text-slate-900">
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
              Perangkat <strong>{confirmDeactivateDevice.device_label}</strong> tidak akan menerima Web Push Notification sampai Anda membuka dan masuk kembali ke akun SIMMS pada perangkat tersebut.
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
