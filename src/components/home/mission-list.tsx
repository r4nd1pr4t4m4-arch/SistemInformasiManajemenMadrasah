'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MissionListProps {
  missions: string[];
}

const DEFAULT_VISIBLE_MISSIONS = 3;

export function MissionList({ missions }: MissionListProps) {
  const [expanded, setExpanded] = useState(false);

  if (missions.length === 0) {
    return (
      <p className="text-sm text-slate-500 leading-relaxed">
        Daftar misi lembaga belum ditambahkan.
      </p>
    );
  }

  const hasMore = missions.length > DEFAULT_VISIBLE_MISSIONS;
  const visibleMissions = expanded
    ? missions
    : missions.slice(0, DEFAULT_VISIBLE_MISSIONS);
  const remainingCount = missions.length - DEFAULT_VISIBLE_MISSIONS;

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {visibleMissions.map((item, idx) => (
          <li
            key={`${idx}-${item.slice(0, 24)}`}
            className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed"
          >
            <span className="w-6 h-6 rounded-full bg-emerald-600/10 text-emerald-700 border border-emerald-200/60 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {idx + 1}
            </span>
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-left sm:text-justify">
              {item}
            </span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/70 text-xs sm:text-sm font-semibold text-emerald-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span>
            {expanded
              ? 'Tampilkan lebih sedikit'
              : `Lihat ${remainingCount} misi lainnya`}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" />
          )}
        </button>
      )}
    </div>
  );
}
