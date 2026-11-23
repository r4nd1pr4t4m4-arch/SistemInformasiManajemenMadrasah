'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  Info,
  Layers,
  Loader2,
  Lock,
  MousePointerClick,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Unlock,
  Users,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

interface AllowedCategory {
  key: string;
  label: string;
  description: string;
  allow_user_opt_out: boolean;
  is_public_eligible: boolean;
  default_enabled?: boolean;
  canEdit?: boolean;
}

interface CampaignRow {
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

interface AnalyticsData {
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

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: 'GURU', label: 'Guru' },
  { value: 'WALI_KELAS', label: 'Wali Kelas' },
  { value: 'GURU_WALI', label: 'Guru Wali' },
  { value: 'GURU_BK', label: 'Guru BK' },
  { value: 'SISWA', label: 'Siswa' },
  { value: 'ORANG_TUA', label: 'Orang Tua / Wali' },
  { value: 'STAF_TU', label: 'Staf TU' },
  { value: 'KEPALA_TU', label: 'Kepala TU' },
  { value: 'BENDAHARA', label: 'Bendahara' },
  { value: 'PUSTAKAWAN', label: 'Pustakawan' },
  { value: 'ALUMNI', label: 'Alumni' },
];

export default function ManagePushNotificationsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'broadcast' | 'policy'>('analytics');

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [allowedCategories, setAllowedCategories] = useState<AllowedCategory[]>([]);
  const [policyCategories, setPolicyCategories] = useState<AllowedCategory[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string; grade_level: string }>>([]);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Broadcast Form
  const [categoryKey, setCategoryKey] = useState('');
  const [targetMode, setTargetMode] = useState<
    'ALL_AND_PUBLIC' | 'ALL_USERS' | 'PUBLIC_ONLY' | 'ROLES' | 'CLASSROOMS'
  >('ALL_USERS');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/portal');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Queue Batch Processor state (Anti-Timeout Vercel Hobby)
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueProgressText, setQueueProgressText] = useState<string | null>(null);
  const [updatingPolicyKey, setUpdatingPolicyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [anaRes, bcRes, polRes] = await Promise.all([
        fetch('/api/admin/notifikasi/analytics?days=30', { cache: 'no-store' }),
        fetch('/api/admin/notifikasi/broadcast', { cache: 'no-store' }),
        fetch('/api/admin/notifikasi/kebijakan', { cache: 'no-store' }),
      ]);

      if (anaRes.ok) {
        const anaData = (await anaRes.json()) as AnalyticsData;
        setAnalytics(anaData);
        setIsFullAdmin(Boolean(anaData.isFullAdmin));
      }

      if (bcRes.ok) {
        const bcData = await bcRes.json();
        const cats = (bcData.allowedCategories || []) as AllowedCategory[];
        setAllowedCategories(cats);
        setCampaigns(bcData.campaigns || []);
        setClassrooms(bcData.classrooms || []);
        if (cats.length > 0 && !categoryKey) {
          setCategoryKey(cats[0].key);
        }
      }

      if (polRes.ok) {
        const polData = await polRes.json();
        setPolicyCategories(polData.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [categoryKey]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /**
   * Live Batch Queue Drain:
   * Memproses antrean 40 perangkat per batch secara bertahap sampai remaining === 0,
   * sehingga broadcast 150-250+ perangkat selesai aman tanpa timeout Vercel Hobby.
   */
  const drainQueueBatches = useCallback(
    async (campaignId?: string) => {
      setProcessingQueue(true);
      setQueueProgressText('Memulai pemrosesan batch antrean...');
      let totalSentSession = 0;
      let loops = 0;

      try {
        while (loops < 15) {
          loops += 1;
          const res = await fetch('/api/admin/notifikasi/process-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, batchSize: 40 }),
          });
          if (!res.ok) break;
          const data = await res.json();
          totalSentSession += Number(data.sent || 0);
          const rem = Number(data.remaining || 0);
          setQueueProgressText(
            `Batch #${loops}: Terkirim ${totalSentSession} perangkat • Sisa antrean: ${rem}`
          );
          if (rem <= 0 || Number(data.processed || 0) === 0) {
            break;
          }
        }
      } finally {
        setProcessingQueue(false);
        await loadAll();
        window.setTimeout(() => setQueueProgressText(null), 4000);
      }
    },
    [loadAll]
  );

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryKey || !title.trim() || !body.trim()) return;

    setSendingBroadcast(true);
    setToast(null);
    try {
      const res = await fetch('/api/admin/notifikasi/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryKey,
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || '/portal',
          targetMode,
          roles: targetMode === 'ROLES' ? selectedRoles : undefined,
          classroomIds: targetMode === 'CLASSROOMS' ? selectedClassrooms : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          type: 'error',
          text: data.error || 'Gagal mengirim broadcast notifikasi.',
        });
        return;
      }

      setTitle('');
      setBody('');
      setToast({
        type: 'success',
        text: `Broadcast dibuat: ${data.inAppCount || 0} notifikasi in-app & ${data.pushQueuedCount || 0} perangkat dalam antrean Web Push.`,
      });

      if (Number(data.pushQueuedCount || 0) > 0 && data.campaignId) {
        await drainQueueBatches(data.campaignId);
      } else {
        await loadAll();
      }
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function handleTogglePolicyLock(cat: AllowedCategory) {
    if (!cat.canEdit) return;
    setUpdatingPolicyKey(cat.key);
    setToast(null);
    try {
      const nextAllowOptOut = !cat.allow_user_opt_out;
      const res = await fetch('/api/admin/notifikasi/kebijakan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryKey: cat.key,
          allowUserOptOut: nextAllowOptOut,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPolicyCategories((prev) =>
          prev.map((c) =>
            c.key === cat.key ? { ...c, allow_user_opt_out: nextAllowOptOut } : c
          )
        );
        setToast({
          type: 'success',
          text: `Kebijakan "${cat.label}" diubah menjadi: ${
            nextAllowOptOut
              ? 'Boleh Dinonaktifkan Pengguna'
              : 'Wajib / Dikunci Admin'
          }.`,
        });
      } else {
        setToast({
          type: 'error',
          text: data.error || 'Gagal mengubah kebijakan kategori.',
        });
      }
    } finally {
      setUpdatingPolicyKey(null);
    }
  }

  function toggleRoleSelection(role: AppRole) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleClassroomSelection(cid: string) {
    setSelectedClassrooms((prev) =>
      prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]
    );
  }

  const summary = analytics?.summary;
  const subs = analytics?.subscriptions;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold">
                  Dashboard Broadcast, Antrean &amp; Analitik Web Push
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  {isFullAdmin
                    ? 'Akses Penuh Admin (Semua Kategori)'
                    : `Akses Peran & Tugas (${allowedCategories.length} Kategori)`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Pantau Delivery Rate &amp; Click Rate (CTR), kirim broadcast bertarget dengan sistem antrean batch anti-timeout, dan kelola kebijakan kategori wajib.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(summary?.pendingQueueCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => void drainQueueBatches()}
                disabled={processingQueue}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm transition disabled:opacity-60"
              >
                {processingQueue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Proses Antrean ({summary?.pendingQueueCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {queueProgressText && (
          <div className="mt-4 rounded-2xl bg-emerald-950/90 border border-emerald-400/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
            <span>{queueProgressText}</span>
          </div>
        )}
      </div>

      {analytics && !analytics.vapidConfigured && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Kunci VAPID Web Push Belum Dikonfigurasi</p>
            <p className="mt-0.5 leading-relaxed">
              Jalankan perintah <code>npm run push:vapid</code> di terminal untuk menghasilkan{' '}
              <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> dan <code>VAPID_PRIVATE_KEY</code>, lalu
              tambahkan ke <code>.env.local</code> dan Environment Variables Vercel.
            </p>
          </div>
        </div>
      )}

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

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'analytics'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analitik Delivery &amp; Click Rate</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'broadcast'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Kirim Broadcast &amp; Antrean</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policy')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'policy'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Kebijakan Kategori (Admin Lock)</span>
        </button>
      </div>

      {/* TAB 1: ANALITIK */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Perangkat Aktif
                </span>
                <Smartphone className="w-4 h-4 text-emerald-600" />
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
                  Delivery Rate (30 Hari)
                </span>
                <Activity className="w-4 h-4 text-teal-600" />
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
                <MousePointerClick className="w-4 h-4 text-indigo-600" />
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
                <Layers className="w-4 h-4 text-amber-600" />
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

          {/* Breakdown Per Kategori */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200/80">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Performa Pengiriman &amp; Interaksi per Kategori (30 Hari Terakhir)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan statistik kategori yang berada dalam cakupan peran dan tugas tambahan Anda.
              </p>
            </div>

            <div className="overflow-x-auto">
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
                  {(analytics?.byCategory || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Belum ada data pengiriman dalam 30 hari terakhir.
                      </td>
                    </tr>
                  ) : (
                    (analytics?.byCategory || []).map((row) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BROADCAST & ANTREAN */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Broadcast */}
          <form
            onSubmit={handleSendBroadcast}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
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
                onChange={(e) => setCategoryKey(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
              >
                {allowedCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} {!c.allow_user_opt_out ? '🔒 (Wajib)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Penerima
              </label>
              <select
                value={targetMode}
                onChange={(e) =>
                  setTargetMode(
                    e.target.value as
                      | 'ALL_AND_PUBLIC'
                      | 'ALL_USERS'
                      | 'PUBLIC_ONLY'
                      | 'ROLES'
                      | 'CLASSROOMS'
                  )
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
              >
                <option value="ALL_USERS">Semua Pengguna Portal (Login)</option>
                <option value="ALL_AND_PUBLIC">
                  Semua Pengguna Portal + Pengunjung Publik Website
                </option>
                <option value="PUBLIC_ONLY">Hanya Pengunjung Publik Website</option>
                <option value="ROLES">Berdasarkan Peran / Jabatan Tertentu</option>
                <option value="CLASSROOMS">
                  Berdasarkan Kelas / Rombel (Siswa, Orang Tua &amp; Wali Kelas)
                </option>
              </select>
            </div>

            {targetMode === 'ROLES' && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
                <p className="text-[11px] font-bold text-slate-700">
                  Pilih Peran Penerima:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_OPTIONS.map((r) => {
                    const active = selectedRoles.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRoleSelection(r.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          active
                            ? 'bg-emerald-600 text-white'
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
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2 max-h-44 overflow-y-auto">
                <p className="text-[11px] font-bold text-slate-700">
                  Pilih Kelas / Rombel:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {classrooms.map((cls) => {
                    const active = selectedClassrooms.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClassroomSelection(cls.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Judul Notifikasi
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={140}
                placeholder="Contoh: Pengumuman Rapat Wali Murid Semester Genap"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Isi Pesan Singkat
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={320}
                placeholder="Tulis isi pemberitahuan yang jelas dan ringkas..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={sendingBroadcast || processingQueue || allowedCategories.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
            >
              {sendingBroadcast || processingQueue ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>
                {sendingBroadcast
                  ? 'Menyiapkan Antrean...'
                  : processingQueue
                    ? 'Memproses Batch Pengiriman...'
                    : 'Kirim Broadcast Sekarang'}
              </span>
            </button>
          </form>

          {/* Riwayat Campaign & Status Queue */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Riwayat Broadcast &amp; Event Pengiriman
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status antrean, terkirim, tampil di perangkat (delivered), dan diklik (clicked).
                </p>
              </div>
              <Users className="w-4 h-4 text-slate-400" />
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {campaigns.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Belum ada riwayat campaign notifikasi.
                </div>
              ) : (
                campaigns.map((camp) => (
                  <div key={camp.id} className="p-4 sm:p-5 space-y-2 hover:bg-slate-50/70">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {camp.category_key}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                          {camp.source_type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            camp.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : camp.status === 'PROCESSING' || camp.status === 'QUEUED'
                                ? 'bg-amber-100 text-amber-800'
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

                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      {camp.title}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-2">{camp.body}</p>

                    <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        Target Device: <strong className="text-slate-800">{camp.total_targets}</strong>
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KEBIJAKAN KATEGORI (ADMIN LOCK) */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200/80">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Kebijakan Kategori Notifikasi (Kunci Preferensi Pengguna)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan kategori mana yang <strong>Wajib (Dikunci Admin)</strong> dan mana yang{' '}
              <strong>Boleh Dinonaktifkan Pengguna</strong>. Kategori yang dikunci tidak dapat dimatikan oleh pengguna dan tetap terkirim meskipun pengguna mengaktifkan Jam Tenang.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {policyCategories.map((cat) => {
              const isLocked = !cat.allow_user_opt_out;
              const busy = updatingPolicyKey === cat.key;
              return (
                <div
                  key={cat.key}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        {cat.label}
                      </p>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                          <Lock className="w-3 h-3" />
                          <span>Wajib (Tidak Bisa Dinonaktifkan User)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                          <Unlock className="w-3 h-3" />
                          <span>Opsional (User Boleh Opt-Out)</span>
                        </span>
                      )}
                      {cat.is_public_eligible && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold">
                          Termasuk Pengunjung Publik
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    {cat.canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleTogglePolicyLock(cat)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition disabled:opacity-50 ${
                          isLocked
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isLocked ? (
                          <Unlock className="w-3.5 h-3.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isLocked
                            ? 'Buka Kunci (Izinkan Opt-Out)'
                            : 'Kunci (Wajibkan untuk Semua)'}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Hanya Baca</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
