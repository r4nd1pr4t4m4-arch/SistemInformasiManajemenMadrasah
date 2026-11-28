'use client';

import { useMemo, useState } from 'react';
import { Eye, Search, UserCheck } from 'lucide-react';

export interface SelectableEntityOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface EntitySelectorBarProps {
  title: string;
  placeholder: string;
  options: SelectableEntityOption[];
  selectedId: string;
  isInspectingOther: boolean;
  onSelect: (id: string) => void;
}

export function EntitySelectorBar({
  title,
  placeholder,
  options,
  selectedId,
  isInspectingOther,
  onSelect,
}: EntitySelectorBarProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  if (options.length === 0) return null;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3 border border-emerald-200/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{title}</span>
        </div>
        {isInspectingOther && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            Mode Tinjau Admin/TU (Read-Only + Komentar)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-5 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full min-h-[40px] pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          />
        </div>

        <div className="md:col-span-7">
          <select
            aria-label={title}
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          >
            <option value="">-- Data Pribadi Saya (Jika Terdaftar) --</option>
            {filtered.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
                {opt.sublabel ? ` — ${opt.sublabel}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
