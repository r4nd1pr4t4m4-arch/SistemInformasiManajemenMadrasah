'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Laptop,
  Loader2,
  Lock,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Share,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { InAppNotificationItem } from '@/lib/notifications/types';

export interface CategoryPreferenceItem {
  key: string;
  label: string;
  description: string;
  allowUserOptOut: boolean;
  lockedByAdmin: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

export interface QuietHoursState {
  enabled: boolean;
  start: string;
  end: string;
}

export interface DeviceItem {
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

export const NOTIF_PAGE_SIZE = 10;

export function formatDeactivatedReason(reason: string | null): string {
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

export function formatPlatformLabel(platform: string): string {
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

export function UserNotificationsInboxTab({
  unreadCount,
  filterUnread,
  setFilterUnread,
  filterCategory,
  setFilterCategory,
  searchQuery,
  setSearchQuery,
  setCurrentPage,
  categories,
  categoryLabelMap,
  loadingInbox,
  inboxError,
  filteredNotifications,
  paginatedNotifications,
  safePage,
  totalPages,
  markingAll,
  markingItemId,
  onMarkAllRead,
  onMarkSingleRead,
  onNotificationClick,
  onReload,
}: {
  unreadCount: number;
  filterUnread: boolean;
  setFilterUnread: (v: boolean) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  setCurrentPage: (v: number | ((p: number) => number)) => void;
  categories: CategoryPreferenceItem[];
  categoryLabelMap: Map<string, string>;
  loadingInbox: boolean;
  inboxError: string | null;
  filteredNotifications: InAppNotificationItem[];
  paginatedNotifications: InAppNotificationItem[];
  safePage: number;
  totalPages: number;
  markingAll: boolean;
  markingItemId: string | null;
  onMarkAllRead: () => void;
  onMarkSingleRead: (e: React.MouseEvent, item: InAppNotificationItem) => void;
  onNotificationClick: (item: InAppNotificationItem) => void;
  onReload: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
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
                onClick={onMarkAllRead}
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
              onClick={onReload}
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
              onClick={onReload}
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
            const catLabel = categoryLabelMap.get(item.category_key) || item.category_key;
            const isMarkingThis = markingItemId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onNotificationClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNotificationClick(item);
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
                        onClick={(e) => onMarkSingleRead(e, item)}
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

      {!loadingInbox && !inboxError && filteredNotifications.length > NOTIF_PAGE_SIZE && (
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            Menampilkan{' '}
            <strong className="text-slate-800">
              {(safePage - 1) * NOTIF_PAGE_SIZE + 1}–
              {Math.min(safePage * NOTIF_PAGE_SIZE, filteredNotifications.length)}
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
  );
}

export function UserNotificationsPreferencesTab({
  prefsError,
  loadingPrefs,
  categories,
  quietHours,
  setQuietHours,
  hasUnsavedPreferences,
  savingPrefs,
  onToggleCategory,
  onResetPreferences,
  onSavePreferences,
  onReload,
}: {
  prefsError: string | null;
  loadingPrefs: boolean;
  categories: CategoryPreferenceItem[];
  quietHours: QuietHoursState;
  setQuietHours: React.Dispatch<React.SetStateAction<QuietHoursState>>;
  hasUnsavedPreferences: boolean;
  savingPrefs: boolean;
  onToggleCategory: (
    key: string,
    field: 'pushEnabled' | 'inAppEnabled',
    value: boolean
  ) => void;
  onResetPreferences: () => void;
  onSavePreferences: () => void;
  onReload: () => void;
}) {
  if (prefsError) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3">
        <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto" />
        <div>
          <p className="text-sm font-bold text-slate-800">Gagal Memuat Preferensi</p>
          <p className="text-xs text-slate-500 mt-0.5">{prefsError}</p>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Coba Lagi</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
                        onToggleCategory(cat.key, 'pushEnabled', e.target.checked)
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
                        onToggleCategory(cat.key, 'inAppEnabled', e.target.checked)
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
                Tahan bunyi Web Push opsional selama jam istirahat. Notifikasi tetap masuk ke Lonceng
                Portal dan kategori Wajib Admin tetap dikirim.
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
              onClick={onResetPreferences}
              disabled={savingPrefs}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kembalikan Perubahan</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSavePreferences}
            disabled={savingPrefs || !hasUnsavedPreferences}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {savingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Simpan Preferensi</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserNotificationsDevicesTab({
  isCurrentDeviceActive,
  browserPermission,
  platform,
  vapidConfigured,
  isIosNonStandalone,
  togglingCurrentDevice,
  loadingPrefs,
  devices,
  currentEndpoint,
  onEnableCurrentDevice,
  onReload,
  onConfirmDeactivateDevice,
}: {
  isCurrentDeviceActive: boolean;
  browserPermission: NotificationPermission | 'unsupported';
  platform: string;
  vapidConfigured: boolean;
  isIosNonStandalone: boolean;
  togglingCurrentDevice: boolean;
  loadingPrefs: boolean;
  devices: DeviceItem[];
  currentEndpoint: string | null;
  onEnableCurrentDevice: () => void;
  onReload: () => void;
  onConfirmDeactivateDevice: (dev: DeviceItem) => void;
}) {
  return (
    <div className="space-y-5">
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
                Izin Browser: <strong className="text-slate-700">{browserPermission}</strong> •
                Platform:{' '}
                <strong className="text-slate-700">{formatPlatformLabel(platform)}</strong>
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
                onClick={onEnableCurrentDevice}
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
              onClick={onEnableCurrentDevice}
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

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Daftar Semua Perangkat Terdaftar pada Akun Anda
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Mendukung multi-device. Saat Anda keluar (logout), perangkat otomatis dinonaktifkan
              sementara (tidak dihapus) agar notifikasi tidak terkirim ke pengguna lain.
            </p>
          </div>
          <button
            type="button"
            onClick={onReload}
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
              const isCurrent = Boolean(currentEndpoint && dev.endpoint === currentEndpoint);
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
                      onClick={() => onConfirmDeactivateDevice(dev)}
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
  );
}
