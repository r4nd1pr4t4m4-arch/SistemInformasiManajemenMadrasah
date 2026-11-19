'use client';

import { useMemo, useState } from 'react';
import { Layers, RotateCcw, Search, X } from 'lucide-react';

export interface PublicFacilityItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  condition: string | null;
  description: string | null;
  image_url: string | null;
}

function getConditionMeta(condition: string | null): { label: string; badgeClass: string } {
  switch (condition) {
    case 'BAIK':
      return {
        label: 'Baik',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      };
    case 'RUSAK_RINGAN':
      return {
        label: 'Rusak Ringan',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
      };
    case 'RUSAK_BERAT':
      return {
        label: 'Rusak Berat',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      };
    case 'DALAM_PERBAIKAN':
      return {
        label: 'Dalam Perbaikan',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
      };
    default:
      return {
        label: condition || 'Baik',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
      };
  }
}

export function FacilitiesSection({ facilities }: { facilities: PublicFacilityItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const f of facilities) {
      const cat = (f.category || 'Umum').trim();
      if (cat) unique.add(cat);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return facilities.filter((f) => {
      const cat = (f.category || 'Umum').trim();
      if (selectedCategory !== 'ALL' && cat !== selectedCategory) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      );
    });
  }, [facilities, selectedCategory, searchQuery]);

  const hasActiveFilter = selectedCategory !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-5 h-5 text-emerald-700 shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Fasilitas Sarana &amp; Prasarana
          </h2>
          {facilities.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
              {facilities.length}
            </span>
          )}
        </div>

        {facilities.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari fasilitas..."
              aria-label="Cari fasilitas sarana dan prasarana"
              className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {facilities.length > 0 && categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white/80 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            Semua ({facilities.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white/80 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {facilities.length === 0 ? (
        <div className="modular-card rounded-2xl p-6 text-sm text-slate-600">
          Data fasilitas sarana &amp; prasarana dapat ditambahkan melalui menu CMS di Portal
          Terpadu.
        </div>
      ) : filteredFacilities.length === 0 ? (
        <div className="modular-card rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Tidak ada fasilitas yang cocok dengan filter saat ini.
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacilities.map((f) => {
            const cond = getConditionMeta(f.condition);
            const showImage = Boolean(f.image_url) && !brokenImages[f.id];
            return (
              <div
                key={f.id}
                className="modular-card rounded-2xl overflow-hidden flex flex-col min-w-0"
              >
                {showImage && (
                  <div className="aspect-video w-full bg-slate-100 overflow-hidden">
                    <img
                      src={f.image_url!}
                      alt={f.name}
                      loading="lazy"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [f.id]: true }))}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between min-w-0">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug break-words min-w-0">
                        {f.name}
                      </h3>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                        {f.quantity ?? 0} Unit
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-slate-500 font-medium">{f.category || 'Umum'}</span>
                      <span className="text-slate-300">•</span>
                      <span
                        className={`px-2 py-0.5 rounded-full border font-semibold ${cond.badgeClass}`}
                      >
                        {cond.label}
                      </span>
                    </div>
                  </div>
                  {f.description && (
                    <p className="text-xs text-slate-600 leading-relaxed break-words pt-1">
                      {f.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
