'use client';

import { useMemo, useState } from 'react';
import { Building2, Layers, RotateCcw, Search, X } from 'lucide-react';

export interface PublicFacilityItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  condition: string | null;
  description: string | null;
  image_url: string | null;
}

const CONDITION_OPTIONS = [
  { value: 'ALL', label: 'Semua Kondisi' },
  { value: 'BAIK', label: 'Baik' },
  { value: 'RUSAK_RINGAN', label: 'Rusak Ringan' },
  { value: 'RUSAK_BERAT', label: 'Rusak Berat' },
  { value: 'DALAM_PERBAIKAN', label: 'Dalam Perbaikan' },
] as const;

function isSafeImageSrc(rawUrl?: string | null): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
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
        label: condition?.trim() || 'Baik',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
      };
  }
}

export function FacilitiesSection({ facilities }: { facilities: PublicFacilityItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const categoryEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of facilities) {
      const cat = (f.category || 'Umum').trim() || 'Umum';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [facilities]);

  const effectiveCategory = useMemo(() => {
    if (selectedCategory === 'ALL') return 'ALL';
    return categoryEntries.some(([cat]) => cat === selectedCategory) ? selectedCategory : 'ALL';
  }, [selectedCategory, categoryEntries]);

  const filteredFacilities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return facilities.filter((f) => {
      const cat = (f.category || 'Umum').trim() || 'Umum';
      if (effectiveCategory !== 'ALL' && cat !== effectiveCategory) return false;
      if (selectedCondition !== 'ALL' && (f.condition || 'BAIK') !== selectedCondition) {
        return false;
      }
      if (!q) return true;
      return (
        (f.name || '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      );
    });
  }, [facilities, effectiveCategory, selectedCondition, searchQuery]);

  const totalUnits = useMemo(
    () =>
      filteredFacilities.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)),
        0
      ),
    [filteredFacilities]
  );

  const hasActiveFilter =
    effectiveCategory !== 'ALL' ||
    selectedCondition !== 'ALL' ||
    searchQuery.trim().length > 0;

  function handleResetFilters() {
    setSelectedCategory('ALL');
    setSelectedCondition('ALL');
    setSearchQuery('');
  }

  return (
    <section id="sarana" className="scroll-mt-20 sm:scroll-mt-24 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Fasilitas Sarana &amp; Prasarana
              </h2>
              {facilities.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums shrink-0">
                  {facilities.length.toLocaleString('id-ID')} Item
                </span>
              )}
            </div>
            {facilities.length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan {filteredFacilities.length.toLocaleString('id-ID')} dari{' '}
                {facilities.length.toLocaleString('id-ID')} fasilitas ({totalUnits.toLocaleString('id-ID')}{' '}
                unit)
              </p>
            )}
          </div>
        </div>

        {facilities.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari fasilitas..."
                aria-label="Cari fasilitas sarana dan prasarana"
                className="w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              aria-label="Filter kondisi fasilitas"
              className="min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 sm:w-44"
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {facilities.length > 0 && categoryEntries.length > 1 && (
        <div
          role="tablist"
          aria-label="Filter kategori fasilitas"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={effectiveCategory === 'ALL'}
            onClick={() => setSelectedCategory('ALL')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
              effectiveCategory === 'ALL'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white/85 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            Semua ({facilities.length})
          </button>
          {categoryEntries.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={effectiveCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                effectiveCategory === cat
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white/85 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {cat} ({count})
            </button>
          ))}
        </div>
      )}

      {facilities.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6 text-emerald-600/80" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Data Sarana &amp; Prasarana Belum Tersedia
          </p>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Data fasilitas sarana &amp; prasarana dapat ditambahkan melalui menu CMS di Portal
            Terpadu.
          </p>
        </div>
      ) : filteredFacilities.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            Tidak ada fasilitas yang cocok dengan filter saat ini.
          </p>
          <p className="text-xs text-slate-500">
            Coba ubah kata kunci pencarian, kategori, atau kondisi fasilitas.
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacilities.map((f) => {
            const cond = getConditionMeta(f.condition);
            const safeImageUrl = isSafeImageSrc(f.image_url);
            const showImage = Boolean(safeImageUrl) && !brokenImages[f.id];
            const unitCount = Math.max(0, Number(f.quantity ?? 0));

            return (
              <article
                key={f.id}
                className="modular-card rounded-2xl overflow-hidden flex flex-col min-w-0"
              >
                {showImage && safeImageUrl && (
                  <div className="aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={safeImageUrl}
                      alt={f.name || 'Foto Fasilitas'}
                      loading="lazy"
                      decoding="async"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [f.id]: true }))}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between min-w-0">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug [overflow-wrap:anywhere] min-w-0">
                        {f.name || 'Fasilitas'}
                      </h3>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0 tabular-nums">
                        {unitCount.toLocaleString('id-ID')} Unit
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-slate-500 font-medium truncate max-w-full">
                        {(f.category || 'Umum').trim() || 'Umum'}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        •
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full border font-semibold ${cond.badgeClass}`}
                      >
                        {cond.label}
                      </span>
                    </div>
                  </div>
                  {f.description?.trim() && (
                    <p className="text-xs text-slate-600 leading-relaxed [overflow-wrap:anywhere] pt-1">
                      {f.description}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
