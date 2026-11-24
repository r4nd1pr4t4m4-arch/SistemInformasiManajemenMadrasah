'use client';

import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MailCheck,
  Play,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { AkademikEmptyState } from '../akademik-ui';
import {
  PAGE_SIZE,
  type PaidHolidayLogRow,
  type PostKalenderFn,
  type ShowToastFn,
  computeLogStats,
} from './types';

interface LogJtmSectionProps {
  logs: PaidHolidayLogRow[];
  canManageCalendar: boolean;
  refreshing: boolean;
  runDate: string;
  setRunDate: Dispatch<SetStateAction<string>>;
  onRefresh: () => void;
  postKalender: PostKalenderFn;
  showToast: ShowToastFn;
}

export function LogJtmSection({
  logs,
  canManageCalendar,
  refreshing,
  runDate,
  setRunDate,
  onRefresh,
  postKalender,
  showToast,
}: LogJtmSectionProps) {
  const [runningAuto, setRunningAuto] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState<'ALL' | 'SENT' | 'UNSENT'>('ALL');
  const [logPage, setLogPage] = useState(1);

  const logStats = useMemo(() => computeLogStats(logs), [logs]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((log) => {
      if (emailFilter === 'SENT' && !log.email_sent) return false;
      if (emailFilter === 'UNSENT' && log.email_sent) return false;
      if (!q) return true;
      return (
        log.holiday_date.toLowerCase().includes(q) ||
        (log.teacher?.full_name || '').toLowerCase().includes(q) ||
        (log.calendar_event?.title || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q)
      );
    });
  }, [logs, emailFilter, logSearch]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentLogPage = Math.min(logPage, totalLogPages);
  const logPageStart = (currentLogPage - 1) * PAGE_SIZE;
  const pagedLogs = useMemo(
    () => filteredLogs.slice(logPageStart, logPageStart + PAGE_SIZE),
    [filteredLogs, logPageStart]
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="glass-card rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Otomasi JTM Libur Berbayar</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Setiap tanggal bertipe <strong>Libur Berbayar</strong> memicu sistem otomatis pada{' '}
            <strong>pukul 10.00 WIB</strong> untuk menambahkan JTM jadwal mengajar &amp; jadwal
            piket guru hari itu serta mengirimkan <strong>email notifikasi otomatis</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>

          {canManageCalendar && (
            <>
              <input
                type="date"
                aria-label="Tanggal eksekusi otomasi JTM"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <button
                type="button"
                disabled={runningAuto || !runDate}
                onClick={async () => {
                  if (!runDate) {
                    showToast('error', 'Pilih tanggal terlebih dahulu.');
                    return;
                  }
                  setRunningAuto(true);
                  try {
                    const res = await postKalender({
                      action: 'RUN_AUTO_JTM_NOW',
                      date: runDate,
                    });
                    if (res?.result) {
                      showToast(
                        res.result.isPaidHoliday ? 'success' : 'error',
                        res.result.message
                      );
                      if (res.result.isPaidHoliday) {
                        setLogPage(1);
                      }
                    }
                  } finally {
                    setRunningAuto(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
              >
                {runningAuto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Jalankan Otomasi JTM Sekarang
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Total Log JTM</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {logStats.total}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Akumulasi JTM</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            +{logStats.totalJtm}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Email Terkirim</p>
          <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
            {logStats.emailSent}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Email Belum Terkirim</p>
          <p className="text-lg sm:text-xl font-bold text-amber-700 mt-1 tabular-nums">
            {logStats.emailUnsent}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Riwayat Penambahan JTM Otomatis Libur Berbayar ({filteredLogs.length})
          </h2>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select
              aria-label="Filter status email log JTM"
              value={emailFilter}
              onChange={(e) => {
                setEmailFilter(e.target.value as 'ALL' | 'SENT' | 'UNSENT');
                setLogPage(1);
              }}
              className="w-full sm:w-44 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">Semua Status Email</option>
              <option value="SENT">Email Terkirim</option>
              <option value="UNSENT">Email Tidak Terkirim</option>
            </select>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setLogPage(1);
                }}
                placeholder="Cari guru, tanggal, agenda..."
                aria-label="Cari riwayat log JTM"
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {logSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLogSearch('');
                    setLogPage(1);
                  }}
                  aria-label="Hapus pencarian log"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {pagedLogs.length === 0 ? (
          <AkademikEmptyState
            icon={<Clock className="w-6 h-6 text-slate-300" />}
            message={
              logs.length === 0
                ? 'Belum ada log JTM otomatis hari libur berbayar.'
                : 'Tidak ada log JTM yang cocok dengan filter pencarian.'
            }
          />
        ) : (
          <div className="space-y-2.5">
            {pagedLogs.map((log) => (
              <div
                key={log.id}
                className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-bold text-slate-900 break-words tabular-nums">
                    {log.holiday_date} • {log.teacher?.full_name || 'Guru'} —{' '}
                    {log.calendar_event?.title || 'Libur Berbayar'}
                  </p>
                  <p className="text-slate-600 break-words leading-relaxed">
                    Mengajar: {log.teaching_jtm} JTM • Piket: {log.picket_jtm} JTM
                    {log.details ? ` • ${log.details}` : ''}
                  </p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold tabular-nums">
                    +{log.total_jtm} JTM
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                      log.email_sent ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    <MailCheck className="w-3 h-3" />
                    {log.email_sent ? 'Email Terkirim' : 'Email Tidak Terkirim'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredLogs.length > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Menampilkan {logPageStart + 1}–
              {Math.min(logPageStart + PAGE_SIZE, filteredLogs.length)} dari{' '}
              {filteredLogs.length} log
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                disabled={currentLogPage <= 1}
                aria-label="Halaman log sebelumnya"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700 tabular-nums">
                Hal {currentLogPage} / {totalLogPages}
              </span>
              <button
                type="button"
                onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                disabled={currentLogPage >= totalLogPages}
                aria-label="Halaman log berikutnya"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
