'use client';

import {
  Activity,
  BellRing,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Laptop,
  Layers,
  Loader2,
  Lock,
  MousePointerClick,
  Play,
  RotateCcw,
  Search,
  Send,
  Smartphone,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

export interface AllowedCategory {
  key: string;
  label: string;
  description: string;
  allow_user_opt_out: boolean;
  is_public_eligible: boolean;
  default_enabled?: boolean;
  canEdit?: boolean;
}

export interface CampaignRow {
  id: string;
  source_type: string;
  category_key: string;
  title: string;
  body: string;
  url: string;
  status: string;
  total_targets: number;
  sent_count: number;
  delivered_count: number;
  clicked_count: number;
  failed_count: number;
  expired_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface AnalyticsData {
  vapidConfigured: boolean;
  isFullAdmin: boolean;
  allowedCategoryCount: number;
  days: number;
  summary: {
    totalCampaigns: number;
    totalTargets: number;
    totalSent: number;
    totalDelivered: number;
    totalClicked: number;
    totalFailed: number;
    totalExpired: number;
    deliveryRate: number;
    clickRate: number;
    pendingQueueCount: number;
  } | null;
  subscriptions?: {
    activeTotal: number;
    activeUser: number;
    activePublic: number;
    logoutInactive: number;
    userDisabled: number;
    expired: number;
    platforms: Record<string, number>;
  };
  byCategory?: Array<{
    categoryKey: string;
    label: string;
    campaigns: number;
    sent: number;
    delivered: number;
    clicked: number;
    failed: number;
    expired: number;
    deliveryRate: number;
    clickRate: number;
  }>;
  dailyTrend?: Array<{
    date: string;
    sent: number;
    delivered: number;
    clicked: number;
    failed: number;
  }>;
}

export type TargetMode = 'ALL_AND_PUBLIC' | 'ALL_USERS' | 'PUBLIC_ONLY' | 'ROLES' | 'CLASSROOMS';

export const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: 'GURU', label: 'Guru' },
  { value: 'WALI_KELAS', label: 'Wali Kelas' },
  { value: 'GURU_WALI', label: 'Guru Wali' },
  { value: 'GURU_BK', label: 'Guru BK' },
  { value: 'SISWA', label: 'Siswa' },
  { value: 'ORANG_TUA', label: 'Orang Tua / Wali' },
  { value: 'STAF_TU', label: 'Staf TU' },
  { value: 'KEPALA_TU', label: 'Kepala TU' },
  { value: 'BENDAHARA', label: 'Bendahara' },
  { value: 'BENDAHARA_KOMITE', label: 'Bendahara Komite' },
  { value: 'PENGELOLA_TABUNGAN', label: 'Pengelola Tabungan' },
  { value: 'PUSTAKAWAN', label: 'Pustakawan' },
  { value: 'ALUMNI', label: 'Alumni' },
];

export const CAMPAIGN_PAGE_SIZE = 8;

export function formatPlatformName(platform: string): string {
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
      return platform || 'Browser Lainnya';
  }
}

export function formatTargetModeSummary(
  mode: TargetMode,
  rolesCount: number,
  classroomsCount: number
): string {
  switch (mode) {
    case 'ALL_USERS':
      return 'Semua Pengguna Portal (Login)';
    case 'ALL_AND_PUBLIC':
      return 'Semua Pengguna Portal + Pengunjung Publik Website';
    case 'PUBLIC_ONLY':
      return 'Hanya Pengunjung Publik Website';
    case 'ROLES':
      return `${rolesCount} Peran / Jabatan Terpilih`;
    case 'CLASSROOMS':
      return `${classroomsCount} Kelas / Rombel Terpilih (Siswa, Orang Tua & Wali Kelas)`;
  }
}

export function AdminPushAnalyticsTab({
  analyticsDays,
  setAnalyticsDays,
  analytics,
  loading,
}: {
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  analytics: AnalyticsData | null;
  loading: boolean;
}) {
  const summary = analytics?.summary;
  const subs = analytics?.subscriptions;
  const platformEntries = Object.entries(subs?.platforms || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/80 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Periode Analisis Pengiriman:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setAnalyticsDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                analyticsDays === d
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d} Hari Terakhir
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Perangkat Aktif</span>
            <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {subs?.activeTotal ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {subs?.activeUser ?? 0} pengguna portal • {subs?.activePublic ?? 0} pengunjung publik
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Delivery Rate ({analyticsDays} Hari)
            </span>
            <Activity className="w-4 h-4 text-teal-600 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">
            {summary?.deliveryRate ?? 0}%
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary?.totalDelivered ?? 0} tampil dari {summary?.totalSent ?? 0} terkirim
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Click-Through Rate (CTR)
            </span>
            <MousePointerClick className="w-4 h-4 text-indigo-600 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-700 mt-2">
            {summary?.clickRate ?? 0}%
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary?.totalClicked ?? 0} klik menuju halaman tujuan
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Status Antrean &amp; Cleanup
            </span>
            <Layers className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {summary?.pendingQueueCount ?? 0}{' '}
            <span className="text-xs font-semibold text-slate-500">di antrean</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {subs?.expired ?? 0} expired (410) • {subs?.logoutInactive ?? 0} nonaktif logout
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Distribusi Platform Perangkat Aktif
              </h2>
              <p className="text-xs text-slate-500">
                Komposisi jenis perangkat yang berlangganan Web Push.
              </p>
            </div>
            <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          {platformEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada perangkat aktif yang terdaftar.
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {platformEntries.map(([plat, count]) => {
                const total = Math.max(1, subs?.activeTotal || 1);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={plat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {formatPlatformName(plat)}
                      </span>
                      <span className="font-bold text-slate-900">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Tren Pengiriman Harian ({analyticsDays} Hari Terakhir)
              </h2>
              <p className="text-xs text-slate-500">
                Ringkasan jumlah notifikasi terkirim, tampil (delivered), dan diklik per tanggal.
              </p>
            </div>
            <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>

          {(analytics?.dailyTrend || []).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada aktivitas pengiriman pada rentang waktu ini.
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              {[...(analytics?.dailyTrend || [])]
                .reverse()
                .slice(0, 14)
                .map((day) => (
                  <div
                    key={day.date}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-slate-800">{day.date}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-slate-600">
                        Sent: <strong className="text-slate-900">{day.sent}</strong>
                      </span>
                      <span className="text-emerald-700">
                        Delivered: <strong>{day.delivered}</strong>
                      </span>
                      <span className="text-indigo-700">
                        Clicked: <strong>{day.clicked}</strong>
                      </span>
                      {day.failed > 0 && (
                        <span className="text-rose-600">
                          Gagal: <strong>{day.failed}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Performa Pengiriman &amp; Interaksi per Kategori ({analyticsDays} Hari Terakhir)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan statistik kategori yang berada dalam cakupan peran dan tugas tambahan Anda.
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (analytics?.byCategory || []).length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-slate-400">
            Belum ada data pengiriman dalam {analyticsDays} hari terakhir.
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {(analytics?.byCategory || []).map((row) => (
                <div key={row.categoryKey} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900 break-words">{row.label}</p>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold shrink-0">
                      {row.campaigns} Campaign
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-2.5">
                      <span className="text-[10px] text-emerald-800 block">Delivery Rate</span>
                      <span className="font-extrabold text-emerald-700 text-sm">
                        {row.deliveryRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {row.delivered} / {row.sent} terkirim
                      </span>
                    </div>
                    <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-2.5">
                      <span className="text-[10px] text-indigo-800 block">Click Rate (CTR)</span>
                      <span className="font-extrabold text-indigo-700 text-sm">
                        {row.clickRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">{row.clicked} klik</span>
                    </div>
                  </div>
                  {(row.failed > 0 || row.expired > 0) && (
                    <p className="text-[11px] text-rose-600">
                      Gagal: {row.failed} • Expired (410): {row.expired}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                    <th className="py-3 px-4 font-bold">Kategori</th>
                    <th className="py-3 px-4 font-bold text-right">Campaign</th>
                    <th className="py-3 px-4 font-bold text-right">Terkirim</th>
                    <th className="py-3 px-4 font-bold text-right">Delivered</th>
                    <th className="py-3 px-4 font-bold text-right">Delivery Rate</th>
                    <th className="py-3 px-4 font-bold text-right">Clicked</th>
                    <th className="py-3 px-4 font-bold text-right">Click Rate</th>
                    <th className="py-3 px-4 font-bold text-right">Gagal / Expired</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics?.byCategory || []).map((row) => (
                    <tr key={row.categoryKey} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">{row.label}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{row.campaigns}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {row.sent}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                        {row.delivered}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold">
                          {row.deliveryRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-indigo-700 font-semibold">
                        {row.clicked}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold">
                          {row.clickRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {row.failed} / {row.expired}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminPushBroadcastTab({
  allowedCategories,
  categoryKey,
  onCategoryChange,
  selectedCategoryObj,
  targetMode,
  setTargetMode,
  selectedRoles,
  setSelectedRoles,
  toggleRoleSelection,
  classrooms,
  selectedClassrooms,
  setSelectedClassrooms,
  toggleClassroomSelection,
  title,
  setTitle,
  body,
  setBody,
  url,
  setUrl,
  sendingBroadcast,
  processingQueue,
  onPreValidateBroadcast,
  campaignSearch,
  setCampaignSearch,
  campaignStatusFilter,
  setCampaignStatusFilter,
  setCampaignPage,
  filteredCampaigns,
  paginatedCampaigns,
  safeCampaignPage,
  totalCampaignPages,
  categoryLabelMap,
  onDrainQueueBatches,
}: {
  allowedCategories: AllowedCategory[];
  categoryKey: string;
  onCategoryChange: (key: string) => void;
  selectedCategoryObj: AllowedCategory | null;
  targetMode: TargetMode;
  setTargetMode: (m: TargetMode) => void;
  selectedRoles: AppRole[];
  setSelectedRoles: (roles: AppRole[]) => void;
  toggleRoleSelection: (r: AppRole) => void;
  classrooms: Array<{ id: string; name: string; grade_level: string }>;
  selectedClassrooms: string[];
  setSelectedClassrooms: (ids: string[]) => void;
  toggleClassroomSelection: (id: string) => void;
  title: string;
  setTitle: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  sendingBroadcast: boolean;
  processingQueue: boolean;
  onPreValidateBroadcast: (e: React.FormEvent) => void;
  campaignSearch: string;
  setCampaignSearch: (v: string) => void;
  campaignStatusFilter: string;
  setCampaignStatusFilter: (v: string) => void;
  setCampaignPage: (v: number | ((p: number) => number)) => void;
  filteredCampaigns: CampaignRow[];
  paginatedCampaigns: CampaignRow[];
  safeCampaignPage: number;
  totalCampaignPages: number;
  categoryLabelMap: Map<string, string>;
  onDrainQueueBatches: (campaignId?: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <form
        onSubmit={onPreValidateBroadcast}
        className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4 h-fit min-w-0"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Kirim Broadcast Notifikasi
            </h2>
            <p className="text-xs text-slate-500">
              Dikirim ke Lonceng Portal &amp; antrean Web Push perangkat aktif.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Kategori Notifikasi (Sesuai Wewenang Peran Anda)
          </label>
          <select
            value={categoryKey}
            onChange={(e) => onCategoryChange(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {allowedCategories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} {!c.allow_user_opt_out ? '🔒 (Wajib)' : ''}
              </option>
            ))}
          </select>
          {selectedCategoryObj && (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {selectedCategoryObj.description}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Target Penerima
          </label>
          <select
            value={targetMode}
            onChange={(e) => setTargetMode(e.target.value as TargetMode)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL_USERS">Semua Pengguna Portal (Login)</option>
            {selectedCategoryObj?.is_public_eligible && (
              <option value="ALL_AND_PUBLIC">
                Semua Pengguna Portal + Pengunjung Publik Website
              </option>
            )}
            {selectedCategoryObj?.is_public_eligible && (
              <option value="PUBLIC_ONLY">Hanya Pengunjung Publik Website</option>
            )}
            <option value="ROLES">Berdasarkan Peran / Jabatan Tertentu</option>
            <option value="CLASSROOMS">
              Berdasarkan Kelas / Rombel (Siswa, Orang Tua &amp; Wali Kelas)
            </option>
          </select>
        </div>

        {targetMode === 'ROLES' && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-700">
                Pilih Peran Penerima ({selectedRoles.length} dipilih):
              </p>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedRoles(ROLE_OPTIONS.map((r) => r.value))}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedRoles([])}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_OPTIONS.map((r) => {
                const active = selectedRoles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRoleSelection(r.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                      active
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {targetMode === 'CLASSROOMS' && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-700">
                Pilih Kelas / Rombel ({selectedClassrooms.length} dipilih):
              </p>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedClassrooms(classrooms.map((c) => c.id))}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedClassrooms([])}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Reset
                </button>
              </div>
            </div>
            {classrooms.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                Belum ada data kelas yang terdaftar.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {classrooms.map((cls) => {
                  const active = selectedClassrooms.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClassroomSelection(cls.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                        active
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-bold text-slate-700">Judul Notifikasi</label>
            <span className="text-[11px] text-slate-400">{title.length}/140</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={140}
            placeholder="Contoh: Pengumuman Rapat Wali Murid Semester Genap"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-bold text-slate-700">Isi Pesan Singkat</label>
            <span className="text-[11px] text-slate-400">{body.length}/320</span>
          </div>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={320}
            placeholder="Tulis isi pemberitahuan yang jelas dan ringkas..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Tautan Tujuan Saat Diklik (Deep Link)
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/portal"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={sendingBroadcast || processingQueue || allowedCategories.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
        >
          {sendingBroadcast || processingQueue ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Send className="w-4 h-4 shrink-0" />
          )}
          <span>
            {sendingBroadcast
              ? 'Menyiapkan Antrean...'
              : processingQueue
                ? 'Memproses Batch Pengiriman...'
                : 'Tinjau & Kirim Broadcast'}
          </span>
        </button>
      </form>

      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-w-0">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Riwayat Broadcast &amp; Event Pengiriman
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Status antrean, terkirim, tampil di perangkat (delivered), dan diklik (clicked).
              </p>
            </div>
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="relative sm:col-span-7">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={campaignSearch}
                onChange={(e) => {
                  setCampaignSearch(e.target.value);
                  setCampaignPage(1);
                }}
                placeholder="Cari riwayat judul atau kategori..."
                aria-label="Cari riwayat campaign"
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {campaignSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCampaignSearch('');
                    setCampaignPage(1);
                  }}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="sm:col-span-5">
              <select
                value={campaignStatusFilter}
                onChange={(e) => {
                  setCampaignStatusFilter(e.target.value);
                  setCampaignPage(1);
                }}
                aria-label="Filter status campaign"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua Status</option>
                <option value="COMPLETED">COMPLETED (Selesai)</option>
                <option value="QUEUED">QUEUED (Menunggu Antrean)</option>
                <option value="PROCESSING">PROCESSING (Diproses)</option>
                <option value="PARTIAL">PARTIAL (Terkirim Sebagian)</option>
                <option value="FAILED">FAILED (Gagal)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 flex-1">
          {filteredCampaigns.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-2">
              <BellRing className="w-9 h-9 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                {campaignSearch || campaignStatusFilter
                  ? 'Tidak ada riwayat campaign yang cocok'
                  : 'Belum ada riwayat campaign notifikasi'}
              </p>
              {(campaignSearch || campaignStatusFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setCampaignSearch('');
                    setCampaignStatusFilter('');
                    setCampaignPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          ) : (
            paginatedCampaigns.map((camp) => {
              const catLabel = categoryLabelMap.get(camp.category_key) || camp.category_key;
              const canDrainThis = camp.status === 'QUEUED' || camp.status === 'PROCESSING';
              return (
                <div
                  key={camp.id}
                  className="p-4 sm:p-5 space-y-2 hover:bg-slate-50/70 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {catLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                        {camp.source_type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          camp.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : canDrainThis
                              ? 'bg-amber-100 text-amber-800'
                              : camp.status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(camp.created_at).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                    {camp.title}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 break-words">{camp.body}</p>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        Target: <strong className="text-slate-800">{camp.total_targets}</strong>
                      </span>
                      <span>
                        Sent: <strong className="text-slate-800">{camp.sent_count}</strong>
                      </span>
                      <span>
                        Delivered:{' '}
                        <strong className="text-emerald-700">{camp.delivered_count}</strong>
                      </span>
                      <span>
                        Clicked: <strong className="text-indigo-700">{camp.clicked_count}</strong>
                      </span>
                      {(camp.failed_count > 0 || camp.expired_count > 0) && (
                        <span className="text-rose-600">
                          Gagal: {camp.failed_count} • Expired: {camp.expired_count}
                        </span>
                      )}
                    </div>

                    {canDrainThis && (
                      <button
                        type="button"
                        disabled={processingQueue}
                        onClick={() => onDrainQueueBatches(camp.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold transition disabled:opacity-50"
                      >
                        {processingQueue ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>Proses Batch</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredCampaigns.length > CAMPAIGN_PAGE_SIZE && (
          <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Menampilkan{' '}
              <strong className="text-slate-800">
                {(safeCampaignPage - 1) * CAMPAIGN_PAGE_SIZE + 1}–
                {Math.min(safeCampaignPage * CAMPAIGN_PAGE_SIZE, filteredCampaigns.length)}
              </strong>{' '}
              dari <strong className="text-slate-800">{filteredCampaigns.length}</strong> campaign
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCampaignPage <= 1}
                onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <span className="px-2 py-1 font-bold text-slate-700">
                {safeCampaignPage} / {totalCampaignPages}
              </span>
              <button
                type="button"
                disabled={safeCampaignPage >= totalCampaignPages}
                onClick={() =>
                  setCampaignPage((p) => Math.min(totalCampaignPages, p + 1))
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 transition"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPushPolicyTab({
  policySearch,
  setPolicySearch,
  filteredPolicyCategories,
  updatingPolicyKey,
  onTogglePolicyLock,
}: {
  policySearch: string;
  setPolicySearch: (v: string) => void;
  filteredPolicyCategories: AllowedCategory[];
  updatingPolicyKey: string | null;
  onTogglePolicyLock: (cat: AllowedCategory) => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Kebijakan Kategori Notifikasi (Kunci Preferensi Pengguna)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Tentukan kategori mana yang <strong>Wajib (Dikunci Admin)</strong> dan mana yang{' '}
            <strong>Boleh Dinonaktifkan Pengguna</strong>. Kategori yang dikunci tidak dapat
            dimatikan oleh pengguna dan tetap terkirim meskipun pengguna mengaktifkan Jam Tenang.
          </p>
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={policySearch}
            onChange={(e) => setPolicySearch(e.target.value)}
            placeholder="Cari kategori kebijakan..."
            aria-label="Cari kategori kebijakan"
            className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {policySearch && (
            <button
              type="button"
              onClick={() => setPolicySearch('')}
              aria-label="Hapus pencarian kebijakan"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {filteredPolicyCategories.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-slate-400">
            Tidak ada kategori yang cocok dengan pencarian.
          </div>
        ) : (
          filteredPolicyCategories.map((cat) => {
            const isLocked = !cat.allow_user_opt_out;
            const busy = updatingPolicyKey === cat.key;
            return (
              <div
                key={cat.key}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                      {cat.label}
                    </p>
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>Wajib (Tidak Bisa Dinonaktifkan User)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                        <Unlock className="w-3 h-3 shrink-0" />
                        <span>Opsional (User Boleh Opt-Out)</span>
                      </span>
                    )}
                    {cat.is_public_eligible && (
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold">
                        Termasuk Pengunjung Publik
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">
                    {cat.description}
                  </p>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onTogglePolicyLock(cat)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition disabled:opacity-50 ${
                      isLocked
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : isLocked ? (
                      <Unlock className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {isLocked
                        ? 'Buka Kunci (Izinkan Opt-Out)'
                        : 'Kunci (Wajibkan untuk Semua)'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
