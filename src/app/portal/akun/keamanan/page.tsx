'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { OfflineQueuePanel } from '@/components/pwa/offline-queue-panel';

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_roles: string[] | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const LOGS_PAGE_SIZE = 20;
const BASE_AUDIT_MODULES = ['AUTH_SECURITY', 'USER_MANAGEMENT', 'KEUANGAN', 'PERSURATAN'];

function formatSafeAuditTime(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AkunKeamananPage() {
  const { hasPermission } = usePortalSession();
  const canViewAuditLogs = hasPermission(PERMISSIONS.USER_MANAGEMENT_VIEW);

  const [revoking, setRevoking] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [knownModules, setKnownModules] = useState<string[]>(BASE_AUDIT_MODULES);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
  const logsAbortRef = useRef<AbortController | null>(null);

  const loadAuditLogs = useCallback(async () => {
    if (!canViewAuditLogs) return;
    logsAbortRef.current?.abort();
    const controller = new AbortController();
    logsAbortRef.current = controller;

    setLoadingLogs(true);
    setLogsError(null);
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (moduleFilter !== 'ALL') qs.set('module', moduleFilter);
      const res = await fetch(`/api/akun/audit-logs?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        const nextLogs: AuditLogRow[] = Array.isArray(data.logs) ? data.logs : [];
        setLogs(nextLogs);
        setKnownModules((prev) => {
          const merged = new Set(prev);
          for (const l of nextLogs) {
            if (l.module) merged.add(l.module);
          }
          return Array.from(merged).sort();
        });
      } else {
        setLogsError(data.error || 'Gagal memuat log audit keamanan.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLogsError('Tidak dapat terhubung ke server saat memuat log audit.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingLogs(false);
      }
    }
  }, [canViewAuditLogs, moduleFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuditLogs();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      logsAbortRef.current?.abort();
    };
  }, [loadAuditLogs]);

  // Escape key untuk menutup modal konfirmasi & detail log
  useEffect(() => {
    if (!confirmRevokeOpen && !selectedLog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedLog) {
        setSelectedLog(null);
      } else if (confirmRevokeOpen && !revoking) {
        setConfirmRevokeOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmRevokeOpen, selectedLog, revoking]);

  async function handleRevokeOtherSessions() {
    if (revoking) return;
    setRevoking(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/akun/sessions/revoke-others', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmRevokeOpen(false);
        setFeedback({
          type: 'ok',
          text: data.message || 'Seluruh sesi login di perangkat lain berhasil diakhiri.',
        });
        if (canViewAuditLogs) void loadAuditLogs();
      } else {
        setFeedback({
          type: 'err',
          text: data.error || 'Gagal mengakhiri sesi di perangkat lain.',
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setRevoking(false);
    }
  }

  const availableModules = useMemo(() => {
    const set = new Set<string>(knownModules);
    if (moduleFilter !== 'ALL') set.add(moduleFilter);
    return Array.from(set).sort();
  }, [knownModules, moduleFilter]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const hay = `${l.actor_email || ''} ${l.module} ${l.action} ${l.summary || ''} ${
        l.ip_address || ''
      } ${l.entity_type || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PAGE_SIZE));
  const safeLogPage = Math.min(logPage, totalLogPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeLogPage - 1) * LOGS_PAGE_SIZE;
    return filteredLogs.slice(start, start + LOGS_PAGE_SIZE);
  }, [filteredLogs, safeLogPage]);

  const hasActiveFilter = search.trim().length > 0 || moduleFilter !== 'ALL';

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0">
      {/* Header & Manajemen Sesi */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Keamanan Sesi &amp; Aktivitas Akun
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Kelola sesi perangkat aktif, kata sandi, MFA, dan pantau jejak audit keamanan sistem.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/portal/akun/kata-sandi"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-xs font-semibold text-slate-700 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Ganti Kata Sandi</span>
            </Link>
            <Link
              href="/portal/akun/mfa"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-xs font-semibold text-slate-700 transition"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Kelola MFA &amp; Kode</span>
            </Link>
          </div>
        </div>

        {feedback && (
          <div
            role={feedback.type === 'err' ? 'alert' : 'status'}
            aria-live="polite"
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-start justify-between gap-2 ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span className="[overflow-wrap:anywhere] leading-relaxed">{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Tutup pesan status"
              className="p-1 rounded-lg hover:bg-black/5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Akhiri Sesi di Semua Perangkat Lain</span>
            </h2>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              Jika Anda pernah login di perangkat umum, komputer lab, atau mencurigai akses tidak
              dikenal, gunakan tombol ini untuk mengeluarkan seluruh sesi lain tanpa mengeluarkan
              perangkat yang sedang Anda pakai sekarang.
            </p>
          </div>
          <button
            type="button"
            disabled={revoking}
            onClick={() => setConfirmRevokeOpen(true)}
            className="w-full sm:w-auto min-h-[42px] shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs"
          >
            {revoking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            <span>Keluarkan Perangkat Lain</span>
          </button>
        </div>
      </div>

      {/* Panel Antrean Sinkronisasi Offline */}
      <OfflineQueuePanel />

      {/* Log Audit Keamanan (Khusus Admin / Manajemen Pengguna) */}
      {canViewAuditLogs && (
        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Log Audit Keamanan Sistem</span>
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Rekam jejak aktivitas sensitif (keamanan akun, persetujuan pengguna, keuangan, dan
                administrasi).
              </p>
            </div>
            <button
              type="button"
              disabled={loadingLogs}
              onClick={() => void loadAuditLogs()}
              className="w-full sm:w-auto min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Cari log audit keamanan"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLogPage(1);
                }}
                placeholder="Cari email aktor, aksi, ringkasan, atau IP..."
                className="w-full min-h-[40px] pl-9 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setLogPage(1);
                  }}
                  aria-label="Hapus pencarian log"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                aria-label="Filter modul log audit"
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setLogPage(1);
                }}
                className="flex-1 sm:flex-none min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="ALL">Semua Modul</option>
                {availableModules.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>

              {hasActiveFilter && (
                <button
                  type="button"
                  title="Reset filter"
                  aria-label="Reset filter log"
                  onClick={() => {
                    setSearch('');
                    setModuleFilter('ALL');
                    setLogPage(1);
                  }}
                  className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shrink-0 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {logsError && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="[overflow-wrap:anywhere]">{logsError}</span>
              </span>
              <button
                type="button"
                onClick={() => void loadAuditLogs()}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition shrink-0"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {loadingLogs && logs.length === 0 ? (
            <div className="space-y-2.5 animate-pulse">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-slate-100 border border-slate-200/70" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Belum ada catatan audit keamanan yang sesuai filter.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Kartu Mobile (< sm) */}
              <div className="sm:hidden space-y-2.5">
                {paginatedLogs.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedLog(row)}
                    className="w-full text-left rounded-2xl bg-white border border-slate-200 p-3.5 space-y-1.5 hover:border-emerald-300 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.module}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatSafeAuditTime(row.created_at)}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] font-bold text-slate-800 [overflow-wrap:anywhere]">
                      {row.action}
                    </p>
                    <p className="text-xs text-slate-600 [overflow-wrap:anywhere] line-clamp-2">
                      {row.summary || '-'}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                      <span className="truncate">{row.actor_email || '-'}</span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {row.ip_address || '-'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Tabel Desktop (sm+) */}
              <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Waktu</th>
                      <th className="px-3.5 py-2.5">Aktor</th>
                      <th className="px-3.5 py-2.5">Modul &amp; Aksi</th>
                      <th className="px-3.5 py-2.5">Ringkasan</th>
                      <th className="px-3.5 py-2.5">IP</th>
                      <th className="px-3.5 py-2.5 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedLogs.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {formatSafeAuditTime(row.created_at)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <p className="font-semibold text-slate-800 [overflow-wrap:anywhere]">
                            {row.actor_email || '-'}
                          </p>
                          {row.actor_roles && row.actor_roles.length > 0 && (
                            <p className="text-[10px] text-slate-400">
                              {row.actor_roles.join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                            {row.module}
                          </span>
                          <p className="font-mono text-[11px] text-slate-700 mt-0.5">{row.action}</p>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 max-w-md [overflow-wrap:anywhere]">
                          {row.summary || '-'}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {row.ip_address || '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(row)}
                            aria-label={`Lihat detail log ${row.action}`}
                            className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            title="Lihat Detail Log"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalLogPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                  <span className="tabular-nums">
                    Menampilkan{' '}
                    <strong className="text-slate-900">
                      {(safeLogPage - 1) * LOGS_PAGE_SIZE + 1}
                    </strong>
                    –
                    <strong className="text-slate-900">
                      {Math.min(safeLogPage * LOGS_PAGE_SIZE, filteredLogs.length)}
                    </strong>{' '}
                    dari <strong className="text-slate-900">{filteredLogs.length}</strong> log
                  </span>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <button
                      type="button"
                      disabled={safeLogPage <= 1}
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                    </button>
                    <span className="px-2 font-semibold text-slate-700 tabular-nums">
                      Hal. {safeLogPage} / {totalLogPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeLogPage >= totalLogPages}
                      onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                      className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-40"
                    >
                      Berikutnya <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Akhiri Sesi Perangkat Lain */}
      {confirmRevokeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-sessions-title"
          onClick={() => {
            if (!revoking) setConfirmRevokeOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 id="revoke-sessions-title" className="text-base font-bold text-slate-900">
                  Keluarkan Semua Perangkat Lain?
                </h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Seluruh sesi login Anda di perangkat atau browser lain akan langsung diakhiri.
                  Sesi di perangkat ini tetap aktif.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={revoking}
                onClick={() => setConfirmRevokeOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={revoking}
                aria-busy={revoking}
                onClick={() => void handleRevokeOtherSessions()}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {revoking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Keluarkan Perangkat Lain</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Log Audit */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
          onClick={() => setSelectedLog(null)}
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                  {selectedLog.module}
                </span>
                <h2
                  id="audit-detail-title"
                  className="text-sm sm:text-base font-bold text-slate-900 font-mono mt-1 [overflow-wrap:anywhere]"
                >
                  {selectedLog.action}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Tutup detail log"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-3 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Waktu</p>
                  <p className="font-mono text-slate-800 mt-0.5">
                    {formatSafeAuditTime(selectedLog.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Alamat IP</p>
                  <p className="font-mono text-slate-800 mt-0.5">{selectedLog.ip_address || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Aktor &amp; Peran</p>
                  <p className="font-semibold text-slate-800 mt-0.5 [overflow-wrap:anywhere]">
                    {selectedLog.actor_email || '-'}
                  </p>
                  {selectedLog.actor_roles && selectedLog.actor_roles.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      {selectedLog.actor_roles.join(', ')}
                    </p>
                  )}
                </div>
                {(selectedLog.entity_type || selectedLog.entity_id) && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Entitas</p>
                    <p className="font-mono text-slate-700 mt-0.5 [overflow-wrap:anywhere]">
                      {selectedLog.entity_type || '-'}
                      {selectedLog.entity_id ? ` • ${selectedLog.entity_id}` : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">Ringkasan</p>
                <p className="text-slate-700 leading-relaxed [overflow-wrap:anywhere]">
                  {selectedLog.summary || '-'}
                </p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Metadata</p>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
