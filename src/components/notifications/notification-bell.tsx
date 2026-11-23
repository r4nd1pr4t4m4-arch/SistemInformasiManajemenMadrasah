'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react';
import {
  NOTIF_BROADCAST_CHANNEL_NAME,
  NOTIF_READ_SYNC_EVENT,
  PUSH_RECEIVED_EVENT,
  notifyNotificationReadSync,
} from '@/lib/pwa/push-client';
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
import type { InAppNotificationItem } from '@/lib/notifications/types';

// Cooldown minimal 3 menit saat pengguna berpindah tab (visibilitychange)
// agar server tidak dihujani request setiap kali user alt-tab
const VISIBILITY_FETCH_COOLDOWN_MS = 3 * 60 * 1000;

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

export function NotificationBell({
  userId,
  canManageDashboard,
}: {
  userId?: string;
  canManageDashboard?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFetchedAtRef = useRef<number>(0);
  const inflightRef = useRef<boolean>(false);

  const fetchNotifications = useCallback(async (silent = false, force = false) => {
    if (inflightRef.current) return;
    if (!force && silent && Date.now() - lastFetchedAtRef.current < 1500) {
      return;
    }
    inflightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/notifikasi?limit=15', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      lastFetchedAtRef.current = Date.now();
      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Abaikan saat offline
    } finally {
      inflightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  // 1. Fetch awal + Event Listener (Service Worker Push, Read Sync, Cross-Tab BroadcastChannel, & Cooldown Visibility)
  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void fetchNotifications(true, true);
    }, 0);

    const handlePushOrReadSync = () => {
      void fetchNotifications(true, true);
    };

    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFetchedAtRef.current >= VISIBILITY_FETCH_COOLDOWN_MS
      ) {
        void fetchNotifications(true, false);
      }
    };

    window.addEventListener(PUSH_RECEIVED_EVENT, handlePushOrReadSync);
    window.addEventListener(NOTIF_READ_SYNC_EVENT, handlePushOrReadSync);
    document.addEventListener('visibilitychange', handleVisibility);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(NOTIF_BROADCAST_CHANNEL_NAME);
        bc.onmessage = (ev) => {
          if (
            ev.data?.type === NOTIF_READ_SYNC_EVENT ||
            ev.data?.type === PUSH_RECEIVED_EVENT
          ) {
            void fetchNotifications(true, true);
          }
        };
      } catch {
        // abaikan jika BroadcastChannel tidak didukung
      }
    }

    return () => {
      window.clearTimeout(initTimer);
      window.removeEventListener(PUSH_RECEIVED_EVENT, handlePushOrReadSync);
      window.removeEventListener(NOTIF_READ_SYNC_EVENT, handlePushOrReadSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bc) {
        bc.close();
      }
    };
  }, [fetchNotifications]);

  // 2. Supabase Realtime Subscription (postgres_changes) pada tabel in_app_notifications
  //    Menggantikan polling interval 45 detik dengan update instan berbasis WebSocket
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;

    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`in-app-notifs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newItem = payload.new as InAppNotificationItem | undefined;
          if (!newItem || !newItem.id) {
            void fetchNotifications(true, true);
            return;
          }
          lastFetchedAtRef.current = Date.now();
          setItems((prev) => {
            if (prev.some((it) => it.id === newItem.id)) return prev;
            return [newItem, ...prev].slice(0, 15);
          });
          if (!newItem.is_read) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchNotifications(true, true);
        }
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && Date.now() - lastFetchedAtRef.current > 10_000) {
      await fetchNotifications(false, true);
    }
  }

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
        setItems((prev) => prev.map((it) => ({ ...it, is_read: true })));
        lastFetchedAtRef.current = Date.now();
        notifyNotificationReadSync();
      }
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleItemClick(item: InAppNotificationItem) {
    setOpen(false);
    if (!item.is_read) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_read: true } : it))
      );
      lastFetchedAtRef.current = Date.now();
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Pusat Notifikasi"
        title="Pusat Notifikasi"
        className="relative p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200/70 transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60 border-b border-slate-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-900 text-sm truncate">
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-100/70 transition disabled:opacity-50"
                >
                  {markingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Tandai dibaca</span>
                </button>
              )}
              <Link
                href="/portal/akun/notifikasi"
                onClick={() => setOpen(false)}
                title="Pengaturan & Preferensi Notifikasi"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading && items.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Memuat notifikasi...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  Belum ada notifikasi
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pemberitahuan penting dan pembaruan aktivitas akan tampil di sini.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start gap-3 ${!item.is_read ? 'bg-emerald-50/40' : ''
                    }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!item.is_read ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs leading-snug line-clamp-1 ${!item.is_read
                          ? 'font-bold text-slate-900'
                          : 'font-medium text-slate-700'
                          }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
            <Link
              href="/portal/akun/notifikasi"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <span>Semua Notifikasi & Preferensi</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            {canManageDashboard && (
              <Link
                href="/portal/notifikasi/kelola"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800"
              >
                <Sparkles className="w-3 h-3" />
                <span>Broadcast & Analitik</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
