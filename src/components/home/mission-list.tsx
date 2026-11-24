'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MissionListProps {
  missions: string[];
}

export function MissionList({ missions }: MissionListProps) {
  const [expanded, setExpanded] = useState(false);

  if (missions.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-justify">
        Daftar misi lembaga belum ditambahkan.
      </p>
    );
  }

  const visibleMissions = expanded ? missions : missions.slice(0, 1);
  const remainingCount = missions.length - 1;

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {visibleMissions.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed"
          >
            <span className="w-6 h-6 rounded-full bg-emerald-600/10 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {idx + 1}
            </span>
            <span className="min-w-0 flex-1 break-words text-justify">{item}</span>
          </li>
        ))}
      </ul>

      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg py-0.5"
        >
          <span>{expanded ? 'Tampilkan lebih sedikit' : 'Lihat selengkapnya'}</span>
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
