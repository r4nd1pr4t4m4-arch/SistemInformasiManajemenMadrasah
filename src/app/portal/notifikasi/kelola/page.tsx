'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { PermissionDeniedState } from '@/components/ui/state-views';
import { useToast } from '@/components/providers/toast-provider';
import type { AppRole } from '@/types/database';
import {
  AdminPushAnalyticsTab,
  AdminPushBroadcastTab,
  AdminPushPolicyTab,
  CAMPAIGN_PAGE_SIZE,
  formatTargetModeSummary,
  type AllowedCategory,
  type AnalyticsData,
  type CampaignRow,
  type TargetMode,
} from '@/components/notifications/admin-push-dashboard-tabs';

export default function ManagePushNotificationsDashboardPage() {
  const toast = useToast();
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

  useEffect(() => {
    return () => {
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
        toast.error('Terjadi gangguan jaringan saat memproses antrean push.');
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
    [processingQueue, loadAll, toast]
  );

  function handlePreValidateBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanUrl = url.trim() || '/portal';

    if (!categoryKey) {
      toast.error('Pilih kategori notifikasi terlebih dahulu.');
      return;
    }
    if (cleanTitle.length < 3) {
      toast.error('Judul notifikasi minimal 3 karakter.');
      return;
    }
    if (cleanBody.length < 5) {
      toast.error('Isi pesan notifikasi minimal 5 karakter.');
      return;
    }
    if (!cleanUrl.startsWith('/')) {
      toast.error('Tautan tujuan (Deep Link) harus diawali dengan "/" (contoh: /portal).');
      return;
    }
    if (targetMode === 'ROLES' && selectedRoles.length === 0) {
      toast.error('Pilih minimal satu peran penerima.');
      return;
    }
    if (targetMode === 'CLASSROOMS' && selectedClassrooms.length === 0) {
      toast.error('Pilih minimal satu kelas / rombel penerima.');
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
        toast.error(data.error || 'Gagal mengirim broadcast notifikasi.');
        return;
      }

      setConfirmBroadcastOpen(false);
      setTitle('');
      setBody('');
      toast.success(
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
      toast.error('Gagal terhubung ke server saat mengirim broadcast.');
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
        toast.success(
          `Kebijakan "${cat.label}" diubah menjadi: ${
            nextAllowOptOut
              ? 'Opsional (Boleh Dinonaktifkan Pengguna)'
              : 'Wajib (Dikunci Admin)'
          }.`
        );
      } else {
        toast.error(data.error || 'Gagal mengubah kebijakan kategori.');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat memperbarui kebijakan.');
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

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (campaignStatusFilter && c.status !== campaignStatusFilter) return false;
      if (!q) return true;
      const catLabel = (
        categoryLabelMap.get(c.category_key) || c.category_key
      ).toLowerCase();
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
                Pantau Delivery Rate &amp; Click Rate (CTR), kirim broadcast bertarget dengan sistem
                antrean batch anti-timeout, dan kelola kebijakan kategori wajib.
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

      {activeTab === 'analytics' && (
        <AdminPushAnalyticsTab
          analyticsDays={analyticsDays}
          setAnalyticsDays={setAnalyticsDays}
          analytics={analytics}
          loading={loading}
        />
      )}

      {activeTab === 'broadcast' && (
        <AdminPushBroadcastTab
          allowedCategories={allowedCategories}
          categoryKey={categoryKey}
          onCategoryChange={handleCategoryChange}
          selectedCategoryObj={selectedCategoryObj}
          targetMode={targetMode}
          setTargetMode={setTargetMode}
          selectedRoles={selectedRoles}
          setSelectedRoles={setSelectedRoles}
          toggleRoleSelection={toggleRoleSelection}
          classrooms={classrooms}
          selectedClassrooms={selectedClassrooms}
          setSelectedClassrooms={setSelectedClassrooms}
          toggleClassroomSelection={toggleClassroomSelection}
          title={title}
          setTitle={setTitle}
          body={body}
          setBody={setBody}
          url={url}
          setUrl={setUrl}
          sendingBroadcast={sendingBroadcast}
          processingQueue={processingQueue}
          onPreValidateBroadcast={handlePreValidateBroadcast}
          campaignSearch={campaignSearch}
          setCampaignSearch={setCampaignSearch}
          campaignStatusFilter={campaignStatusFilter}
          setCampaignStatusFilter={setCampaignStatusFilter}
          setCampaignPage={setCampaignPage}
          filteredCampaigns={filteredCampaigns}
          paginatedCampaigns={paginatedCampaigns}
          safeCampaignPage={safeCampaignPage}
          totalCampaignPages={totalCampaignPages}
          categoryLabelMap={categoryLabelMap}
          onDrainQueueBatches={(cid) => void drainQueueBatches(cid)}
        />
      )}

      {activeTab === 'policy' && (
        <AdminPushPolicyTab
          policySearch={policySearch}
          setPolicySearch={setPolicySearch}
          filteredPolicyCategories={filteredPolicyCategories}
          updatingPolicyKey={updatingPolicyKey}
          onTogglePolicyLock={(cat) => void handleTogglePolicyLock(cat)}
        />
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
            className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[90dvh] overflow-y-auto"
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
