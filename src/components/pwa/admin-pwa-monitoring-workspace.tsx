'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  Laptop,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { MANDATORY_MOBILE_PWA_ROLES } from '@/config/portal-navigation';
import {
  exportPwaMonitoringToPng,
  exportPwaMonitoringToXlsx,
} from '@/lib/pwa/pwa-monitoring-export';
import type { AppRole } from '@/types/database';

type StatusFilter = 'ALL' | 'INSTALLED' | 'NOT_INSTALLED' | 'ACTIVE_14D' | 'INACTIVE_30D';
type ActivityStatus = 'ACTIVE' | 'IDLE' | 'STALE' | 'NOT_INSTALLED';

interface PwaDeviceItem {
  id: string;
  device_id: string;
  platform: string;
  device_label: string;
  install_source: string;
  display_mode: string;
  launch_count: number;
  installed_at: string;
  last_seen_at: string;
}

interface PwaUserRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: string;
  is_installed: boolean;
  device_count: number;
  platforms: string[];
  devices: PwaDeviceItem[];
  first_installed_at: string | null;
  last_seen_at: string | null;
  total_launches: number;
  activity_status: ActivityStatus;
}

interface PwaMonitoringResponse {
  summary: {
    totalUsers: number;
    installedUsers: number;
    notInstalledUsers: number;
    adoptionRatePercent: number;
    activeLast14Days: number;
    staleOver30Days: number;
    totalDevices: number;
    platformBreakdown: Record<string, number>;
    roleBreakdown: Array<{
      role: string;
      total: number;
      installed: number;
      percentage: number;
    }>;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  items: PwaUserRow[];
}

const PLATFORM_LABELS: Record<string, string> = {
  'android-chrome': 'Android (Chrome)',
  'ios-safari': 'iOS (Safari)',
  'desktop-chromium': 'Desktop (Chrome/Edge)',
  'desktop-safari': 'Desktop (Safari)',
  other: 'Lainnya',
};

const STATUS_TABS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: 'ALL', label: 'Semua' },
  { key: 'INSTALLED', label: 'Sudah Install' },
  { key: 'NOT_INSTALLED', label: 'Belum Install' },
  { key: 'ACTIVE_14D', label: 'Aktif (≤14 Hari)' },
  { key: 'INACTIVE_30D', label: 'Lama Tidak Aktif (>30 Hari)' },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '-';
  try {
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function renderStatusBadge(status: ActivityStatus) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        Aktif di PWA
      </span>
    );
  }
  if (status === 'IDLE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold whitespace-nowrap">
        <Clock className="w-3 h-3 shrink-0" />
        Jarang Aktif
      </span>
    );
  }
  if (status === 'STALE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold whitespace-nowrap">
        <Clock className="w-3 h-3 shrink-0" />
        Lama Tidak Aktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold whitespace-nowrap">
      <XCircle className="w-3 h-3 shrink-0" />
      Belum Install
    </span>
  );
}

export function AdminPwaMonitoringWorkspace() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'png' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [data, setData] = useState<PwaMonitoringResponse | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstSearchEffectRef = useRef(true);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isFirstSearchEffectRef.current) {
      isFirstSearchEffectRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchMonitoring = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeqRef.current;

    if (hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const qs = new URLSearchParams({
        status: statusFilter,
        role: roleFilter,
        platform: platformFilter,
        page: String(page),
        pageSize: '25',
      });
      if (debouncedQuery) qs.set('q', debouncedQuery);

      const res = await fetch(`/api/admin/pwa/installations?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (seq !== requestSeqRef.current) return;
      if (!res.ok || !json) {
        throw new Error(json?.error || 'Gagal memuat data monitoring PWA.');
      }

      hasLoadedOnceRef.current = true;
      const typed = json as PwaMonitoringResponse;
      setData(typed);
      if (typed.pagination.page !== page) {
        setPage(typed.pagination.page);
      }
    } catch (err) {
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      setError((err as Error).message || 'Gagal memuat data monitoring PWA.');
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [debouncedQuery, page, platformFilter, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchMonitoring();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchMonitoring]);

  const handleStatusChange = useCallback((next: StatusFilter) => {
    setStatusFilter(next);
    if (next === 'NOT_INSTALLED') {
      setPlatformFilter('ALL');
    }
    setPage(1);
    setExpandedUserId(null);
  }, []);

  const handleResetFilters = useCallback(() => {
    setStatusFilter('ALL');
    setRoleFilter('ALL');
    setPlatformFilter('ALL');
    setSearchInput('');
    setDebouncedQuery('');
    setPage(1);
    setExpandedUserId(null);
  }, []);

  const activeQueryForExport = searchInput.trim();
  const hasActiveFilter =
    statusFilter !== 'ALL' ||
    roleFilter !== 'ALL' ||
    platformFilter !== 'ALL' ||
    Boolean(activeQueryForExport);

  async function fetchAllFilteredForExport(): Promise<PwaMonitoringResponse> {
    const qs = new URLSearchParams({
      status: statusFilter,
      role: roleFilter,
      platform: statusFilter === 'NOT_INSTALLED' ? 'ALL' : platformFilter,
      exportAll: '1',
    });
    if (activeQueryForExport) qs.set('q', activeQueryForExport);

    const res = await fetch(`/api/admin/pwa/installations?${qs.toString()}`, {
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as PwaMonitoringResponse | null;
    if (!res.ok || !json) {
      throw new Error('Gagal memuat data sesuai filter untuk ekspor.');
    }
    return json;
  }

  function getActiveFilterLabels() {
    const statusLabel =
      STATUS_TABS.find((t) => t.key === statusFilter)?.label || statusFilter;
    const roleLabel = roleFilter === 'ALL' ? 'Semua Peran' : roleFilter;
    const effectivePlatform = statusFilter === 'NOT_INSTALLED' ? 'ALL' : platformFilter;
    const platformLabel =
      effectivePlatform === 'ALL'
        ? 'Semua Platform'
        : PLATFORM_LABELS[effectivePlatform] || effectivePlatform;
    return {
      statusLabel,
      roleLabel,
      platformLabel,
      searchQuery: activeQueryForExport,
    };
  }

  async function handleExportXlsx() {
    if (exportingFormat) return;
    setExportingFormat('xlsx');
    try {
      const json = await fetchAllFilteredForExport();
      await exportPwaMonitoringToXlsx({
        items: json.items,
        summary: json.summary,
        filters: getActiveFilterLabels(),
      });
      showToast('ok', `Berhasil mengekspor ${json.items.length} data pengguna ke Excel (.xlsx).`);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal mengekspor Excel (.xlsx).';
      showToast('err', msg);
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleExportPng() {
    if (exportingFormat) return;
    setExportingFormat('png');
    try {
      const json = await fetchAllFilteredForExport();
      await exportPwaMonitoringToPng({
        items: json.items,
        filters: getActiveFilterLabels(),
      });
      showToast('ok', `Berhasil mengekspor laporan gambar (.png) untuk ${json.items.length} pengguna.`);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal mengekspor gambar (.png).';
      showToast('err', msg);
    } finally {
      setExportingFormat(null);
    }
  }

  if (loading && !data) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="max-w-7xl mx-auto glass-card rounded-3xl p-8 sm:p-12 text-center space-y-3 border border-slate-200/80"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center mx-auto shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm sm:text-base font-bold text-slate-900">
            Memuat Monitoring Instalasi PWA
          </p>
          <p className="text-xs text-slate-500">
            Menghitung tingkat adopsi perangkat Android, iOS, dan Desktop...
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const pagination = data?.pagination;
  const items = data?.items || [];

  const androidCount = summary?.platformBreakdown['android-chrome'] || 0;
  const iosCount = summary?.platformBreakdown['ios-safari'] || 0;
  const desktopCount =
    (summary?.platformBreakdown['desktop-chromium'] || 0) +
    (summary?.platformBreakdown['desktop-safari'] || 0);

  return (
    <div className="max-w-7xl mx-auto w-full min-w-0 space-y-5 sm:space-y-6 pb-8">
      {/* Floating Toast */}
      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl text-xs font-medium border flex items-start justify-between gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <span className="min-w-0 break-words leading-relaxed">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <span className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 inline-flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </span>
            <span className="truncate">Monitoring Instalasi PWA</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Pantau adopsi aplikasi PWA lintas perangkat (Android, iOS, Desktop), status keaktifan,
            serta daftar pengguna yang belum menginstal aplikasi.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={Boolean(exportingFormat) || !data}
            onClick={() => void handleExportXlsx()}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs"
            title="Ekspor seluruh data sesuai filter aktif ke Excel (.xlsx)"
          >
            {exportingFormat === 'xlsx' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Export XLSX</span>
          </button>
          <button
            type="button"
            disabled={Boolean(exportingFormat) || !data}
            onClick={() => void handleExportPng()}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs"
            title="Ekspor laporan ringkas sesuai filter aktif ke gambar (.png)"
          >
            {exportingFormat === 'png' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Export PNG</span>
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void fetchMonitoring()}
            className="col-span-2 sm:col-span-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5 sm:mt-0" />
            <span className="break-words">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchMonitoring()}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100 shrink-0 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 4 Kartu KPI Utama */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => handleStatusChange('INSTALLED')}
            className={`modular-card rounded-2xl p-4 text-left space-y-2 transition min-w-0 ${
              statusFilter === 'INSTALLED'
                ? 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/40'
                : 'hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500 font-medium truncate">Sudah Install PWA</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800 shrink-0 tabular-nums">
                {summary.adoptionRatePercent}%
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">
              {summary.installedUsers}{' '}
              <span className="text-xs font-normal text-slate-400">
                / {summary.totalUsers} akun
              </span>
            </p>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(100, summary.adoptionRatePercent)}%` }}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange('NOT_INSTALLED')}
            className={`modular-card rounded-2xl p-4 text-left space-y-1.5 transition min-w-0 ${
              statusFilter === 'NOT_INSTALLED'
                ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50/40'
                : 'hover:border-amber-300'
            }`}
          >
            <p className="text-xs text-slate-500 font-medium truncate">Belum Menginstal PWA</p>
            <p className="text-2xl font-bold text-amber-700 tabular-nums">
              {summary.notInstalledUsers}
            </p>
            <p className="text-[11px] text-amber-700/85 font-medium">
              Klik untuk filter belum install →
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange('ACTIVE_14D')}
            className={`modular-card rounded-2xl p-4 text-left space-y-1.5 transition min-w-0 ${
              statusFilter === 'ACTIVE_14D'
                ? 'border-sky-400 ring-1 ring-sky-300 bg-sky-50/40'
                : 'hover:border-sky-300'
            }`}
          >
            <p className="text-xs text-slate-500 font-medium truncate">Aktif di PWA (≤ 14 Hari)</p>
            <p className="text-2xl font-bold text-sky-700 tabular-nums">
              {summary.activeLast14Days}
            </p>
            <p className="text-[11px] text-slate-500">
              Lama tidak aktif (&gt;30 hari): <strong className="text-slate-700">{summary.staleOver30Days}</strong>
            </p>
          </button>

          <div className="modular-card rounded-2xl p-4 space-y-1.5 min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">Total Perangkat Terpasang</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {summary.totalDevices}
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-600 font-semibold">
              <span className="inline-flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" /> Android: {androidCount}
              </span>
              <span>iOS: {iosCount}</span>
              <span className="inline-flex items-center gap-1">
                <Laptop className="w-3 h-3 text-blue-600 shrink-0" /> Desktop: {desktopCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ringkasan Adopsi per Peran */}
      {summary && summary.roleBreakdown.length > 0 && (
        <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Tingkat Adopsi PWA per Peran</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Klik peran untuk memfilter daftar pengguna di bawah
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {summary.roleBreakdown.map((rb) => {
              const isMandatory = MANDATORY_MOBILE_PWA_ROLES.includes(rb.role as AppRole);
              const isSelected = roleFilter === rb.role;
              return (
                <button
                  key={rb.role}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setRoleFilter(isSelected ? 'ALL' : rb.role);
                    setPage(1);
                    setExpandedUserId(null);
                  }}
                  className={`rounded-2xl border p-3 text-left space-y-1.5 transition min-w-0 ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate">{rb.role}</span>
                    {isMandatory && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-800 shrink-0">
                        Wajib PWA
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-slate-600">
                      <strong className="text-emerald-700">{rb.installed}</strong> / {rb.total} akun
                    </span>
                    <span className="font-bold text-slate-800 tabular-nums">{rb.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, rb.percentage)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter & Daftar Pengguna */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4 min-w-0">
        {/* Status Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div
            role="tablist"
            aria-label="Filter status instalasi PWA"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={statusFilter === t.key}
                onClick={() => handleStatusChange(t.key)}
                className={`shrink-0 min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap ${
                  statusFilter === t.key
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="self-start sm:self-auto shrink-0 min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Search & Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-6 relative min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama pengguna, email, atau nomor HP..."
              aria-label="Cari pengguna"
              className="w-full min-h-[42px] pl-9 pr-9 py-2 rounded-xl border border-slate-300 bg-white text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedQuery('');
                  setPage(1);
                }}
                aria-label="Hapus kata kunci pencarian"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 absolute right-1.5 top-1/2 -translate-y-1/2 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-3 min-w-0">
            <select
              aria-label="Filter peran"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
                setExpandedUserId(null);
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            >
              <option value="ALL">Semua Peran</option>
              {(summary?.roleBreakdown || []).map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role} ({r.installed}/{r.total})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 min-w-0">
            <select
              aria-label="Filter platform"
              disabled={statusFilter === 'NOT_INSTALLED'}
              value={statusFilter === 'NOT_INSTALLED' ? 'ALL' : platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setPage(1);
                setExpandedUserId(null);
              }}
              title={
                statusFilter === 'NOT_INSTALLED'
                  ? 'Filter platform tidak berlaku untuk pengguna yang belum menginstal PWA'
                  : undefined
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            >
              <option value="ALL">Semua Platform</option>
              {Object.entries(PLATFORM_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Info Ringkas Hasil Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 px-0.5">
          <div className="inline-flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Menampilkan <strong className="text-slate-800">{items.length}</strong> dari{' '}
              <strong className="text-slate-800">{pagination?.totalItems ?? items.length}</strong>{' '}
              pengguna
              {hasActiveFilter ? ' (sesuai filter aktif)' : ''}
            </span>
          </div>
          {refreshing && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <Loader2 className="w-3 h-3 animate-spin" />
              Memperbarui...
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              Tidak ada pengguna yang cocok dengan filter saat ini.
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-emerald-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tampilkan Semua Pengguna</span>
              </button>
            )}
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${refreshing ? 'opacity-65' : ''}`}>
            {/* Tampilan Kartu Responsif untuk Mobile (< md) — Bebas Horizontal Overflow */}
            <div className="md:hidden space-y-2.5">
              {items.map((u) => {
                const isExpanded = expandedUserId === u.user_id;
                return (
                  <div
                    key={u.user_id}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5 min-w-0 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs break-words">
                          {u.full_name}
                        </p>
                        <p className="text-[11px] text-slate-500 break-all mt-0.5">
                          {u.email || u.phone || '-'}
                        </p>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(u.activity_status)}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                        {u.primary_role}
                      </span>
                      {u.total_launches > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold tabular-nums">
                          {u.total_launches}x sesi PWA
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400">Install Pertama</p>
                        <p className="font-medium text-slate-700 truncate">
                          {formatDateTime(u.first_installed_at)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400">Terakhir Aktif</p>
                        <p className="font-medium text-slate-700 truncate">
                          {formatDateTime(u.last_seen_at)}
                        </p>
                      </div>
                    </div>

                    {u.device_count > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                          className="w-full min-h-[34px] flex items-center justify-between gap-2 text-left text-[11px] font-semibold text-slate-800 hover:text-emerald-700"
                        >
                          <span className="break-words min-w-0">
                            {u.device_count} perangkat (
                            {u.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')})
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="space-y-1.5 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[11px]">
                            {u.devices.map((d) => (
                              <div
                                key={d.id}
                                className="flex flex-col gap-0.5 border-b border-slate-200/60 last:border-0 pb-1.5 last:pb-0"
                              >
                                <span className="font-semibold text-slate-800 break-words">
                                  {d.device_label || PLATFORM_LABELS[d.platform] || d.platform}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {d.launch_count}x buka • {formatDateTime(d.last_seen_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tampilan Tabel untuk Tablet & Desktop (>= md) */}
            <div className="hidden md:block overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    <th className="py-2.5 pr-3">Pengguna</th>
                    <th className="py-2.5 px-3">Peran</th>
                    <th className="py-2.5 px-3">Status PWA</th>
                    <th className="py-2.5 px-3">Perangkat &amp; Platform</th>
                    <th className="py-2.5 px-3">Install Pertama</th>
                    <th className="py-2.5 pl-3 text-right">Terakhir Aktif / Buka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((u) => {
                    const isExpanded = expandedUserId === u.user_id;
                    return (
                      <tr key={u.user_id} className="align-top hover:bg-slate-50/70 transition">
                        <td className="py-3 pr-3 max-w-[240px]">
                          <p className="font-bold text-slate-900 break-words">{u.full_name}</p>
                          <p className="text-[11px] text-slate-500 break-all">
                            {u.email || u.phone || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {u.primary_role}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderStatusBadge(u.activity_status)}
                        </td>
                        <td className="py-3 px-3 max-w-[280px]">
                          {u.device_count === 0 ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <div className="space-y-1">
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setExpandedUserId(isExpanded ? null : u.user_id)
                                }
                                className="inline-flex items-center gap-1 text-left font-semibold text-slate-800 hover:text-emerald-700"
                              >
                                <span className="break-words">
                                  {u.device_count} perangkat (
                                  {u.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')})
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="mt-1.5 space-y-1.5 rounded-xl bg-slate-50 border border-slate-200 p-2 text-[11px]">
                                  {u.devices.map((d) => (
                                    <div
                                      key={d.id}
                                      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 last:border-0 pb-1 last:pb-0"
                                    >
                                      <span className="font-semibold text-slate-800 break-words">
                                        {d.device_label || PLATFORM_LABELS[d.platform] || d.platform}
                                      </span>
                                      <span className="text-slate-500">
                                        {d.launch_count}x buka • {formatDateTime(d.last_seen_at)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {formatDateTime(u.first_installed_at)}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <p className="font-medium text-slate-800">
                            {formatDateTime(u.last_seen_at)}
                          </p>
                          {u.total_launches > 0 && (
                            <p className="text-[10px] text-slate-500 tabular-nums">
                              {u.total_launches}x sesi PWA
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span>
              Halaman <strong>{pagination.page}</strong> dari{' '}
              <strong>{pagination.totalPages}</strong> ({pagination.totalItems} pengguna)
            </span>
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || refreshing}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setExpandedUserId(null);
                }}
                className="min-h-[38px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || refreshing}
                onClick={() => {
                  setPage((p) => Math.min(pagination.totalPages, p + 1));
                  setExpandedUserId(null);
                }}
                className="min-h-[38px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold transition"
              >
                Berikutnya
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
