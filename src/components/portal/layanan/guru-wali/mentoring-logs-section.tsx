'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  ASPECT_LABELS,
  getAspectLabel,
  type MentoringAspect,
  type MentoringLogRow,
} from './types';

interface MentoringLogsSectionProps {
  logs: MentoringLogRow[];
  hasFormsColumn: boolean;
}

export function MentoringLogsSection({ logs, hasFormsColumn }: MentoringLogsSectionProps) {
  const [logSearch, setLogSearch] = useState('');
  const [aspectFilter, setAspectFilter] = useState<'ALL' | MentoringAspect>('ALL');

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((l) => {
      if (aspectFilter !== 'ALL' && l.aspect !== aspectFilter) return false;
      if (q) {
        const haystack = `${l.assignment?.student?.full_name || ''} ${
          l.assignment?.teacher?.full_name || ''
        } ${l.topic} ${l.notes} ${l.mentoring_date}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [aspectFilter, logSearch, logs]);

  return (
    <div
      className={`${
        hasFormsColumn ? 'lg:col-span-7' : 'lg:col-span-12'
      } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">
          Rekam Jejak Bimbingan Guru Wali ({filteredLogs.length})
        </h2>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setAspectFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              aspectFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Semua
          </button>
          {(Object.entries(ASPECT_LABELS) as Array<[MentoringAspect, string]>).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAspectFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  aspectFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="relative">
        <label htmlFor="gw-log-search" className="sr-only">
          Cari log bimbingan Guru Wali
        </label>
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="gw-log-search"
          type="search"
          value={logSearch}
          onChange={(e) => setLogSearch(e.target.value)}
          placeholder="Cari siswa, Guru Wali, topik, atau catatan..."
          className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
        />
      </div>

      {filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">
            {logs.length === 0
              ? 'Belum ada rekam jejak bimbingan Guru Wali.'
              : 'Tidak ada log bimbingan yang cocok dengan filter pencarian.'}
          </p>
          {(logSearch || aspectFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setLogSearch('');
                setAspectFilter('ALL');
              }}
              className="text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              Reset pencarian &amp; filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[36rem] overflow-y-auto pr-0.5">
          {filteredLogs.map((l) => {
            const aspectLabel = getAspectLabel(l.aspect);
            return (
              <div
                key={l.id}
                className="modular-card rounded-xl p-3.5 text-xs space-y-1.5 min-w-0"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    {aspectLabel}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{l.mentoring_date}</span>
                </div>
                <p className="font-bold text-slate-900 break-words">
                  {l.assignment?.student?.full_name || 'Siswa'} — {l.topic}
                </p>
                <p className="text-slate-600 break-words">{l.notes}</p>
                {l.recommendation && (
                  <p className="text-[11px] text-emerald-700 font-medium break-words">
                    Rekomendasi: {l.recommendation}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 break-words">
                  Guru Wali: {l.assignment?.teacher?.full_name || '-'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
