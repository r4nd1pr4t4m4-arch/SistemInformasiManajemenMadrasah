'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
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
  ip_address: string | null;
  created_at: string;
}

const LOGS_PAGE_SIZE = 20;

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
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
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
        setLogs(Array.isArray(data.logs) ? data.logs : []);
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

  async function handleRevokeOtherSessions() {
    setRevoking(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/akun/sessions/revoke-others', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
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
    const set = new Set<string>(['AUTH_SECURITY', 'USER_MANAGEMENT', 'KEUANGAN', 'PERSURATAN']);
    for (const l of logs) if (l.module) set.add(l.module);
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const hay = `${l.actor_email || ''} ${l.module} ${l.action} ${l.summary || ''} ${
        l.ip_address || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PAGE_SIZE));
  const safeLogPage = Math.min(logPage, totalLogPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeLogPage - 1) * LOGS_PAGE_SIZE;
    return filteredLogs.slice(start, start + LOGS_PAGE_SIZE);
  }, [filteredLogs, safeLogPage]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Keamanan Sesi &amp; Aktivitas Akun</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola sesi perangkat aktif, kata sandi, MFA, dan pantau jejak audit keamanan sistem.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portal/akun/kata-sandi"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-xs font-semibold text-slate-700 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              Ganti Kata Sandi
            </Link>
            <Link
              href="/portal/akun/mfa"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-xs font-semibold text-slate-700 transition"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
              Kelola MFA &amp; Kode Pemulihan
            </Link>
          </div>
        </div>

        {feedback && (
          <div
            role={feedback.type === 'err' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-600" />
              Akhiri Sesi di Semua Perangkat Lain
            </h2>
            <p className="text-xs text-slate-600 max-w-xl">
              Jika Anda pernah login di perangkat umum, komputer lab, atau mencurigai akses tidak
              dikenal, gunakan tombol ini untuk mengeluarkan seluruh sesi lain tanpa mengeluarkan
              perangkat yang sedang Anda pakai sekarang.
            </p>
          </div>
          <button
            type="button"
            disabled={revoking}
            onClick={handleRevokeOtherSessions}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold transition"
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

      <OfflineQueuePanel />

      {canViewAuditLogs && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <span>Log Audit Keamanan Sistem</span>
              </h2>
              <p className="text-xs text-slate-500">
                Rekam jejak aktivitas sensitif (keamanan akun, persetujuan pengguna, keuangan, dan
                administrasi).
              </p>
            </div>
            <button
              type="button"
              disabled={loadingLogs}
              onClick={() => void loadAuditLogs()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Cari log audit keamanan"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLogPage(1);
                }}
                placeholder="Cari email aktor, aksi, ringkasan, atau IP..."
                className="w-full min-h-[40px] pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <select
              aria-label="Filter modul log audit"
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setLogPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="ALL">Semua Modul</option>
              {availableModules.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          {logsError && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{logsError}</span>
              </span>
              <button
                type="button"
                onClick={() => void loadAuditLogs()}
                className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {loadingLogs && logs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              Memuat log audit...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Belum ada catatan audit keamanan yang sesuai filter.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Waktu</th>
                      <th className="px-3.5 py-2.5">Aktor</th>
                      <th className="px-3.5 py-2.5">Modul &amp; Aksi</th>
                      <th className="px-3.5 py-2.5">Ringkasan</th>
                      <th className="px-3.5 py-2.5">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedLogs.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {formatSafeAuditTime(row.created_at)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <p className="font-semibold text-slate-800">{row.actor_email || '-'}</p>
                          {row.actor_roles && row.actor_roles.length > 0 && (
                            <p className="text-[10px] text-slate-400">{row.actor_roles.join(', ')}</p>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalLogPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                  <span>
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeLogPage <= 1}
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                    </button>
                    <span className="px-2 font-semibold text-slate-700">
                      Hal. {safeLogPage} / {totalLogPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeLogPage >= totalLogPages}
                      onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                      className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-50"
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
    </div>
  );
}
