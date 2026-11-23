'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Laptop,
  Layers,
  Loader2,
  Lock,
  MousePointerClick,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { PermissionDeniedState } from '@/components/ui/state-views';
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

type TargetMode = 'ALL_AND_PUBLIC' | 'ALL_USERS' | 'PUBLIC_ONLY' | 'ROLES' | 'CLASSROOMS';

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
  { value: 'BENDAHARA_KOMITE', label: 'Bendahara Komite' },
  { value: 'PENGELOLA_TABUNGAN', label: 'Pengelola Tabungan' },
  { value: 'PUSTAKAWAN', label: 'Pustakawan' },
  { value: 'ALUMNI', label: 'Alumni' },
];

const CAMPAIGN_PAGE_SIZE = 8;

function formatPlatformName(platform: string): string {
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

function formatTargetModeSummary(
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

export default function ManagePushNotificationsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'broadcast' | 'policy'>('analytics');

  const [analyticsDays, setAnalyticsDays] = useState<number>(30);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [allowedCategories, setAllowedCategories] = useState<AllowedCategory[]>([]);
  const [policyCategories, setPolicyCategories] = useState<AllowedCategory[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [classrooms, setClassrooms] = useState<
    Array<{ id: string; name: string; grade_level: string }>
  >([]);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadReqIdRef = useRef(0);

  // Broadcast Form state
  const [categoryKey, setCategoryKey] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('ALL_USERS');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/portal');
  const [confirmBroadcastOpen, setConfirmBroadcastOpen] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Campaign History Filter & Pagination state
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);

  // Policy Filter state
  const [policySearch, setPolicySearch] = useState('');

  // Queue Batch Processor state (Anti-Timeout Vercel Hobby)
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueProgressText, setQueueProgressText] = useState<string | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updatingPolicyKey, setUpdatingPolicyKey] = useState<string | null>(null);

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
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    };
  }, []);

  const loadAll = useCallback(
    async (silent = false) => {
      const reqId = ++loadReqIdRef.current;
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const [anaRes, bcRes, polRes] = await Promise.all([
          fetch(`/api/admin/notifikasi/analytics?days=${analyticsDays}`, {
            cache: 'no-store',
          }),
          fetch('/api/admin/notifikasi/broadcast', { cache: 'no-store' }),
          fetch('/api/admin/notifikasi/kebijakan', { cache: 'no-store' }),
        ]);

        if (reqId !== loadReqIdRef.current) return;

        if (
          anaRes.status === 401 ||
          anaRes.status === 403 ||
          bcRes.status === 401 ||
          bcRes.status === 403
        ) {
          setAccessDenied(true);
          return;
        }

        if (!anaRes.ok || !bcRes.ok || !polRes.ok) {
          if (!silent) {
            setLoadError('Gagal memuat sebagian data dashboard notifikasi dari server.');
          }
          return;
        }

        const [anaData, bcData, polData] = await Promise.all([
          anaRes.json() as Promise<AnalyticsData>,
          bcRes.json(),
          polRes.json(),
        ]);

        if (reqId !== loadReqIdRef.current) return;

        const cats = (bcData.allowedCategories || []) as AllowedCategory[];
        if (cats.length === 0) {
          setAccessDenied(true);
          return;
        }

        setAccessDenied(false);
        setAnalytics(anaData);
        setIsFullAdmin(Boolean(anaData.isFullAdmin));
        setAllowedCategories(cats);
        setCampaigns(Array.isArray(bcData.campaigns) ? bcData.campaigns : []);
        setClassrooms(Array.isArray(bcData.classrooms) ? bcData.classrooms : []);
        setPolicyCategories(
          Array.isArray(polData.categories) ? polData.categories : []
        );

        setCategoryKey((prev) =>
          prev && cats.some((c) => c.key === prev) ? prev : cats[0]?.key || ''
        );
        setLoadError(null);
      } catch {
        if (reqId === loadReqIdRef.current && !silent) {
          setLoadError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
        }
      } finally {
        if (reqId === loadReqIdRef.current && !silent) {
          setLoading(false);
        }
      }
    },
    [analyticsDays]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  // Tutup modal konfirmasi broadcast dengan Escape
  useEffect(() => {
    if (!confirmBroadcastOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sendingBroadcast) {
        setConfirmBroadcastOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmBroadcastOpen, sendingBroadcast]);

  const selectedCategoryObj = useMemo(
    () => allowedCategories.find((c) => c.key === categoryKey) ?? null,
    [allowedCategories, categoryKey]
  );

  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allowedCategories) {
      map.set(c.key, c.label);
    }
    return map;
  }, [allowedCategories]);

  function handleCategoryChange(nextKey: string) {
    setCategoryKey(nextKey);
    const nextCat = allowedCategories.find((c) => c.key === nextKey);
    if (
      nextCat &&
      !nextCat.is_public_eligible &&
      (targetMode === 'ALL_AND_PUBLIC' || targetMode === 'PUBLIC_ONLY')
    ) {
      setTargetMode('ALL_USERS');
    }
  }

  /**
   * Live Batch Queue Drain:
   * Memproses antrean 40 perangkat per batch secara bertahap sampai remaining === 0,
   * sehingga broadcast 150-250+ perangkat selesai aman tanpa timeout Vercel Hobby.
   */
  const drainQueueBatches = useCallback(
    async (campaignId?: string) => {
      if (processingQueue) return;
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
      } catch {
        showToast('error', 'Terjadi gangguan jaringan saat memproses antrean push.');
      } finally {
        setProcessingQueue(false);
        await loadAll(true);
        if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
        queueTimerRef.current = setTimeout(() => {
          setQueueProgressText(null);
          queueTimerRef.current = null;
        }, 4000);
      }
    },
    [processingQueue, loadAll, showToast]
  );

  function handlePreValidateBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanUrl = url.trim() || '/portal';

    if (!categoryKey) {
      showToast('error', 'Pilih kategori notifikasi terlebih dahulu.');
      return;
    }
    if (cleanTitle.length < 3) {
      showToast('error', 'Judul notifikasi minimal 3 karakter.');
      return;
    }
    if (cleanBody.length < 5) {
      showToast('error', 'Isi pesan notifikasi minimal 5 karakter.');
      return;
    }
    if (!cleanUrl.startsWith('/')) {
      showToast('error', 'Tautan tujuan (Deep Link) harus diawali dengan "/" (contoh: /portal).');
      return;
    }
    if (targetMode === 'ROLES' && selectedRoles.length === 0) {
      showToast('error', 'Pilih minimal satu peran penerima.');
      return;
    }
    if (targetMode === 'CLASSROOMS' && selectedClassrooms.length === 0) {
      showToast('error', 'Pilih minimal satu kelas / rombel penerima.');
      return;
    }

    setConfirmBroadcastOpen(true);
  }

  async function handleConfirmSendBroadcast() {
    if (sendingBroadcast) return;
    setSendingBroadcast(true);
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
        showToast('error', data.error || 'Gagal mengirim broadcast notifikasi.');
        return;
      }

      setConfirmBroadcastOpen(false);
      setTitle('');
      setBody('');
      showToast(
        'success',
        `Broadcast berhasil dibuat: ${data.inAppCount || 0} notifikasi in-app & ${
          data.pushQueuedCount || 0
        } perangkat dalam antrean Web Push.`
      );

      if (Number(data.pushQueuedCount || 0) > 0 && data.campaignId) {
        await drainQueueBatches(data.campaignId);
      } else {
        await loadAll(true);
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server saat mengirim broadcast.');
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function handleTogglePolicyLock(cat: AllowedCategory) {
    if (updatingPolicyKey) return;
    setUpdatingPolicyKey(cat.key);
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
        setAllowedCategories((prev) =>
          prev.map((c) =>
            c.key === cat.key ? { ...c, allow_user_opt_out: nextAllowOptOut } : c
          )
        );
        showToast(
          'success',
          `Kebijakan "${cat.label}" diubah menjadi: ${
            nextAllowOptOut
              ? 'Opsional (Boleh Dinonaktifkan Pengguna)'
              : 'Wajib (Dikunci Admin)'
          }.`
        );
      } else {
        showToast('error', data.error || 'Gagal mengubah kebijakan kategori.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan saat memperbarui kebijakan.');
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

  // Filter & Pagination untuk Riwayat Campaign
  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (campaignStatusFilter && c.status !== campaignStatusFilter) return false;
      if (!q) return true;
      const catLabel = (categoryLabelMap.get(c.category_key) || c.category_key).toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q) ||
        catLabel.includes(q) ||
        c.source_type.toLowerCase().includes(q)
      );
    });
  }, [campaigns, campaignSearch, campaignStatusFilter, categoryLabelMap]);

  const totalCampaignPages = Math.max(
    1,
    Math.ceil(filteredCampaigns.length / CAMPAIGN_PAGE_SIZE)
  );
  const safeCampaignPage = Math.min(campaignPage, totalCampaignPages);
  const paginatedCampaigns = useMemo(() => {
    const start = (safeCampaignPage - 1) * CAMPAIGN_PAGE_SIZE;
    return filteredCampaigns.slice(start, start + CAMPAIGN_PAGE_SIZE);
  }, [filteredCampaigns, safeCampaignPage]);

  // Filter untuk Kebijakan Kategori
  const filteredPolicyCategories = useMemo(() => {
    const q = policySearch.trim().toLowerCase();
    if (!q) return policyCategories;
    return policyCategories.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q)
    );
  }, [policyCategories, policySearch]);

  const summary = analytics?.summary;
  const subs = analytics?.subscriptions;
  const platformEntries = useMemo(
    () => Object.entries(subs?.platforms || {}).sort((a, b) => b[1] - a[1]),
    [subs?.platforms]
  );

  if (!loading && accessDenied) {
    return (
      <div className="max-w-4xl mx-auto mt-6">
        <PermissionDeniedState />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full min-w-0 space-y-5 sm:space-y-6 pb-4">
      {/* Top Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white p-5 sm:p-6 shadow-lg overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold leading-snug break-words">
                  Dashboard Broadcast, Antrean &amp; Analitik Web Push
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  {isFullAdmin
                    ? 'Akses Penuh Admin (Semua Kategori)'
                    : `Akses Peran & Tugas (${allowedCategories.length} Kategori)`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Pantau Delivery Rate &amp; Click Rate (CTR), kirim broadcast bertarget dengan sistem antrean batch anti-timeout, dan kelola kebijakan kategori wajib.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(summary?.pendingQueueCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => void drainQueueBatches()}
                disabled={processingQueue}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm transition disabled:opacity-60"
              >
                {processingQueue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Play className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Proses Antrean ({summary?.pendingQueueCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadAll(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`}
              />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {queueProgressText && (
          <div className="mt-4 rounded-2xl bg-emerald-950/90 border border-emerald-400/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
            <span className="break-words">{queueProgressText}</span>
          </div>
        )}
      </div>

      {/* Peringatan VAPID */}
      {analytics && !analytics.vapidConfigured && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold">Kunci VAPID Web Push Belum Dikonfigurasi</p>
            <p className="mt-0.5 leading-relaxed break-words">
              Jalankan perintah <code>npm run push:vapid</code> di terminal untuk menghasilkan{' '}
              <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> dan <code>VAPID_PRIVATE_KEY</code>, lalu
              tambahkan ke <code>.env.local</code> dan Environment Variables Vercel.
            </p>
          </div>
        </div>
      )}

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

      {/* Error State Global */}
      {loadError && (
        <div className="bg-white rounded-3xl border border-rose-200 p-6 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-rose-500 mx-auto" />
          <div>
            <p className="text-sm font-bold text-slate-900">Gagal Memuat Data Dashboard</p>
            <p className="text-xs text-slate-500 mt-0.5">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Navigasi Pengelolaan Notifikasi"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-200 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
            activeTab === 'analytics'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Analitik Delivery &amp; Click Rate</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'broadcast'}
          onClick={() => setActiveTab('broadcast')}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
            activeTab === 'broadcast'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Send className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Kirim Broadcast &amp; Antrean</span>
          {(summary?.pendingQueueCount ?? 0) > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                activeTab === 'broadcast'
                  ? 'bg-white text-emerald-800'
                  : 'bg-amber-500 text-slate-950'
              }`}
            >
              {summary?.pendingQueueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'policy'}
          onClick={() => setActiveTab('policy')}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
            activeTab === 'policy'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Kebijakan Kategori ({policyCategories.length})</span>
        </button>
      </div>

      {/* TAB 1: ANALITIK */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Filter Rentang Waktu Analitik */}
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

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Perangkat Aktif
                </span>
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

          {/* Distribusi Platform & Tren Harian */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Distribusi Platform */}
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

            {/* Tren Pengiriman Harian */}
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

          {/* Breakdown Per Kategori (Responsive Cards di Mobile + Tabel di Desktop) */}
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
                {/* Tampilan Mobile: Data Cards (Tanpa Horizontal Scroll) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {(analytics?.byCategory || []).map((row) => (
                    <div key={row.categoryKey} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 break-words">
                          {row.label}
                        </p>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold shrink-0">
                          {row.campaigns} Campaign
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-2.5">
                          <span className="text-[10px] text-emerald-800 block">
                            Delivery Rate
                          </span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {row.deliveryRate}%
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {row.delivered} / {row.sent} terkirim
                          </span>
                        </div>
                        <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-2.5">
                          <span className="text-[10px] text-indigo-800 block">
                            Click Rate (CTR)
                          </span>
                          <span className="font-extrabold text-indigo-700 text-sm">
                            {row.clickRate}%
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {row.clicked} klik
                          </span>
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

                {/* Tampilan Tablet/Desktop: Tabel Lengkap */}
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
      )}

      {/* TAB 2: BROADCAST & ANTREAN */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Broadcast */}
          <form
            onSubmit={handlePreValidateBroadcast}
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
                onChange={(e) => handleCategoryChange(e.target.value)}
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
                <label className="text-xs font-bold text-slate-700">
                  Judul Notifikasi
                </label>
                <span className="text-[11px] text-slate-400">
                  {title.length}/140
                </span>
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
                <label className="text-xs font-bold text-slate-700">
                  Isi Pesan Singkat
                </label>
                <span className="text-[11px] text-slate-400">
                  {body.length}/320
                </span>
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

          {/* Riwayat Campaign & Status Queue */}
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
                  const catLabel =
                    categoryLabelMap.get(camp.category_key) || camp.category_key;
                  const canDrainThis =
                    camp.status === 'QUEUED' || camp.status === 'PROCESSING';
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
                      <p className="text-xs text-slate-600 line-clamp-2 break-words">
                        {camp.body}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-slate-500">
                          <span>
                            Target:{' '}
                            <strong className="text-slate-800">{camp.total_targets}</strong>
                          </span>
                          <span>
                            Sent: <strong className="text-slate-800">{camp.sent_count}</strong>
                          </span>
                          <span>
                            Delivered:{' '}
                            <strong className="text-emerald-700">{camp.delivered_count}</strong>
                          </span>
                          <span>
                            Clicked:{' '}
                            <strong className="text-indigo-700">{camp.clicked_count}</strong>
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
                            onClick={() => void drainQueueBatches(camp.id)}
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

            {/* Pagination Riwayat Campaign */}
            {filteredCampaigns.length > CAMPAIGN_PAGE_SIZE && (
              <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-500">
                  Menampilkan{' '}
                  <strong className="text-slate-800">
                    {(safeCampaignPage - 1) * CAMPAIGN_PAGE_SIZE + 1}–
                    {Math.min(
                      safeCampaignPage * CAMPAIGN_PAGE_SIZE,
                      filteredCampaigns.length
                    )}
                  </strong>{' '}
                  dari <strong className="text-slate-800">{filteredCampaigns.length}</strong>{' '}
                  campaign
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
      )}

      {/* TAB 3: KEBIJAKAN KATEGORI (ADMIN LOCK) */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Kebijakan Kategori Notifikasi (Kunci Preferensi Pengguna)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Tentukan kategori mana yang <strong>Wajib (Dikunci Admin)</strong> dan mana yang{' '}
                <strong>Boleh Dinonaktifkan Pengguna</strong>. Kategori yang dikunci tidak dapat dimatikan oleh pengguna dan tetap terkirim meskipun pengguna mengaktifkan Jam Tenang.
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
                        onClick={() => void handleTogglePolicyLock(cat)}
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
      )}

      {/* Modal Konfirmasi Kirim Broadcast */}
      {confirmBroadcastOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-broadcast-title"
          onClick={() => {
            if (!sendingBroadcast) setConfirmBroadcastOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="confirm-broadcast-title"
                    className="text-sm sm:text-base font-bold text-slate-900"
                  >
                    Konfirmasi Pengiriman Broadcast
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pastikan rincian pesan dan target penerima sudah sesuai.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={sendingBroadcast}
                onClick={() => setConfirmBroadcastOpen(false)}
                aria-label="Tutup modal konfirmasi"
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Kategori</span>
                <span className="font-bold text-slate-900 text-right break-words">
                  {selectedCategoryObj?.label || categoryKey}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Target Penerima</span>
                <span className="font-semibold text-emerald-800 text-right break-words">
                  {formatTargetModeSummary(
                    targetMode,
                    selectedRoles.length,
                    selectedClassrooms.length
                  )}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Tautan Tujuan</span>
                <span className="font-mono text-[11px] text-slate-700 text-right break-all">
                  {url.trim() || '/portal'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900 break-words">{title.trim()}</p>
                <p className="text-slate-600 leading-relaxed break-words">{body.trim()}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={sendingBroadcast}
                onClick={() => setConfirmBroadcastOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                disabled={sendingBroadcast}
                onClick={() => void handleConfirmSendBroadcast()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
              >
                {sendingBroadcast ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Ya, Kirim Broadcast Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
