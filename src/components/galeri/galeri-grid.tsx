'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  PlayCircle,
  Search,
  Video,
  X,
} from 'lucide-react';
import { EmptyState, NoSearchResultState } from '@/components/ui/state-views';

export interface PublicGalleryItem {
  id: string;
  title: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  description: string | null;
  event_date: string | null;
}

const PAGE_SIZE = 12;

function getSafeMediaUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

function getSafeImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  return getSafeMediaUrl(trimmed);
}

function extractYouTubeId(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    let candidate: string | null = null;
    if (parsed.hostname.includes('youtu.be')) {
      candidate = parsed.pathname.slice(1).split('/')[0] || null;
    } else if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) {
        candidate = v;
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
          candidate = parts[1] || null;
        }
      }
    }
    if (candidate && /^[A-Za-z0-9_-]{6,15}$/.test(candidate)) {
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

function isDirectVideoUrl(url: string | null | undefined): boolean {
  const safe = getSafeMediaUrl(url);
  if (!safe) return false;
  try {
    const parsed = safe.startsWith('/') ? new URL(safe, 'https://simms.local') : new URL(safe);
    return /\.(mp4|webm|ogg|mov)$/i.test(parsed.pathname);
  } catch {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(safe);
  }
}

function formatMediaType(mediaType: string | null | undefined): string {
  if (!mediaType) return 'Media';
  return mediaType.replace(/_/g, ' ');
}

function formatEventDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function resolvePreviewUrl(item: PublicGalleryItem): string | null {
  const safeThumb = getSafeImageUrl(item.thumbnail_url);
  if (safeThumb) return safeThumb;

  if (item.media_type === 'FOTO') {
    const safePhoto = getSafeImageUrl(item.media_url);
    if (safePhoto) return safePhoto;
  }

  const ytId = extractYouTubeId(item.media_url);
  if (ytId) {
    return `https://img.youtube.com/vi/${encodeURIComponent(ytId)}/hqdefault.jpg`;
  }

  return null;
}

export function GaleriGrid({ gallery }: { gallery: PublicGalleryItem[] }) {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const mediaTypeEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of gallery) {
      const t = (item.media_type || '').trim();
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [gallery]);

  const effectiveType = useMemo(() => {
    if (selectedType === 'ALL') return 'ALL';
    return mediaTypeEntries.some(([t]) => t === selectedType) ? selectedType : 'ALL';
  }, [selectedType, mediaTypeEntries]);

  const filteredGallery = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gallery.filter((item) => {
      if (effectiveType !== 'ALL' && (item.media_type || '').trim() !== effectiveType) {
        return false;
      }
      if (!q) return true;
      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    });
  }, [gallery, effectiveType, searchQuery]);

  const displayedGallery = filteredGallery.slice(0, visibleCount);
  const hasMore = visibleCount < filteredGallery.length;
  const hasActiveFilter = effectiveType !== 'ALL' || searchQuery.trim().length > 0;

  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return filteredGallery.findIndex((item) => item.id === activeId);
  }, [activeId, filteredGallery]);

  const activeItem = activeIndex >= 0 ? filteredGallery[activeIndex] : null;
  const canNavigatePrev = activeIndex > 0;
  const canNavigateNext = activeIndex >= 0 && activeIndex < filteredGallery.length - 1;

  function openLightbox(item: PublicGalleryItem, buttonEl: HTMLButtonElement | null) {
    triggerRef.current = buttonEl;
    setActiveId(item.id);
  }

  function closeLightbox() {
    setActiveId(null);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!activeItem) return;
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveId(null);
        requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveId(filteredGallery[activeIndex - 1].id);
      } else if (e.key === 'ArrowRight' && activeIndex < filteredGallery.length - 1) {
        setActiveId(filteredGallery[activeIndex + 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, activeIndex, filteredGallery]);

  if (gallery.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="w-6 h-6" />}
        title="Belum Ada Dokumentasi Terunggah"
        description="Dokumentasi foto dan video kegiatan akan tampil di sini setelah ditambahkan oleh tim Humas."
      />
    );
  }

  const activeSafeMediaUrl = activeItem ? getSafeMediaUrl(activeItem.media_url) : null;
  const activeSafePhotoUrl = activeItem ? getSafeImageUrl(activeItem.media_url) : null;
  const activeYouTubeId = activeItem ? extractYouTubeId(activeItem.media_url) : null;

  return (
    <div className="space-y-6">
      {/* Filter & Pencarian */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Cari judul atau keterangan dokumentasi..."
              aria-label="Cari dokumentasi galeri"
              className="w-full min-h-[44px] rounded-xl border border-slate-300/90 bg-white pl-10 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 shrink-0 tabular-nums">
            Menampilkan {displayedGallery.length.toLocaleString('id-ID')} dari{' '}
            {filteredGallery.length.toLocaleString('id-ID')} dokumentasi
          </span>
        </div>

        {mediaTypeEntries.length > 1 && (
          <div
            role="tablist"
            aria-label="Filter jenis media galeri"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={effectiveType === 'ALL'}
              onClick={() => {
                setSelectedType('ALL');
                setVisibleCount(PAGE_SIZE);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                effectiveType === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Semua ({gallery.length})
            </button>
            {mediaTypeEntries.map(([type, count]) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={effectiveType === type}
                onClick={() => {
                  setSelectedType(type);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border uppercase tracking-wide transition ${
                  effectiveType === type
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {formatMediaType(type)} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Galeri */}
      {filteredGallery.length === 0 ? (
        <NoSearchResultState
          query={searchQuery}
          title="Dokumentasi Tidak Ditemukan"
          description="Tidak ada foto atau video yang sesuai dengan kata kunci maupun tipe media yang sedang dipilih."
          onReset={
            hasActiveFilter
              ? () => {
                  setSelectedType('ALL');
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }
              : undefined
          }
          resetLabel="Reset Filter Galeri"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {displayedGallery.map((item) => {
              const previewUrl = resolvePreviewUrl(item);
              const showPreview = Boolean(previewUrl) && !brokenUrls[previewUrl!];
              const isVideo = item.media_type !== 'FOTO';
              const dateLabel = formatEventDate(item.event_date);
              const safeMediaUrl = getSafeMediaUrl(item.media_url);

              return (
                <article
                  key={item.id}
                  className="modular-card rounded-3xl overflow-hidden flex flex-col justify-between min-w-0"
                >
                  <div className="flex-1 flex flex-col min-w-0">
                    <button
                      type="button"
                      onClick={(e) => openLightbox(item, e.currentTarget)}
                      className="relative aspect-video w-full bg-slate-100 overflow-hidden group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-label={`Lihat pratinjau ${item.title}`}
                    >
                      {showPreview && previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={item.title || 'Dokumentasi Galeri'}
                          loading="lazy"
                          decoding="async"
                          onError={() =>
                            setBrokenUrls((prev) => ({ ...prev, [previewUrl]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200/70 text-slate-400">
                          {isVideo ? (
                            <Video className="w-10 h-10" />
                          ) : (
                            <ImageIcon className="w-10 h-10" />
                          )}
                        </div>
                      )}

                      {isVideo && (
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/20 group-hover:bg-slate-900/35 transition">
                          <PlayCircle className="w-12 h-12 text-white drop-shadow-md" />
                        </span>
                      )}
                    </button>

                    <div className="p-5 space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                            isVideo
                              ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                              : 'bg-sky-50 text-sky-700 border-sky-200/80'
                          }`}
                        >
                          {formatMediaType(item.media_type)}
                        </span>
                        {dateLabel && (
                          <time
                            dateTime={item.event_date || undefined}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500"
                          >
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{dateLabel}</span>
                          </time>
                        )}
                      </div>

                      <h2 className="font-bold text-slate-900 text-sm sm:text-base leading-snug [overflow-wrap:anywhere]">
                        {item.title}
                      </h2>

                      {item.description?.trim() && (
                        <p className="text-xs text-slate-600 leading-relaxed [overflow-wrap:anywhere] line-clamp-3">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => openLightbox(item, e.currentTarget)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition"
                    >
                      Lihat Pratinjau
                    </button>
                    {safeMediaUrl && (
                      <a
                        href={safeMediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition"
                      >
                        <span>Buka Media</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-sm font-semibold text-slate-700 hover:text-emerald-800 shadow-xs transition"
              >
                Muat Lebih Banyak ({(filteredGallery.length - displayedGallery.length).toLocaleString('id-ID')}{' '}
                tersisa)
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Lightbox Media */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="galeri-modal-title"
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90dvh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header Modal Sticky */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-white shrink-0">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                      activeItem.media_type !== 'FOTO'
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : 'bg-sky-50 text-sky-700 border-sky-200/80'
                    }`}
                  >
                    {formatMediaType(activeItem.media_type)}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                    {activeIndex + 1} / {filteredGallery.length}
                  </span>
                </div>
                <h3
                  id="galeri-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug [overflow-wrap:anywhere]"
                >
                  {activeItem.title}
                </h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeLightbox}
                aria-label="Tutup pratinjau media"
                className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal Scrollable */}
            <div className="overflow-y-auto overscroll-contain flex-1">
              <div className="bg-slate-950 flex items-center justify-center relative">
                {activeYouTubeId ? (
                  <div className="w-full aspect-video">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(activeYouTubeId)}`}
                      title={activeItem.title || 'Video YouTube'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : activeItem.media_type === 'FOTO' &&
                  activeSafePhotoUrl &&
                  !brokenUrls[activeSafePhotoUrl] ? (
                  <div className="w-full flex items-center justify-center p-2 sm:p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSafePhotoUrl}
                      alt={activeItem.title || 'Foto Dokumentasi'}
                      decoding="async"
                      onError={() =>
                        setBrokenUrls((prev) => ({ ...prev, [activeSafePhotoUrl]: true }))
                      }
                      className="max-h-[58dvh] w-auto max-w-full object-contain rounded-xl"
                    />
                  </div>
                ) : activeItem.media_type !== 'FOTO' &&
                  activeSafeMediaUrl &&
                  isDirectVideoUrl(activeSafeMediaUrl) ? (
                  <video
                    src={activeSafeMediaUrl}
                    controls
                    playsInline
                    className="w-full max-h-[58dvh]"
                  />
                ) : (
                  <div className="p-10 text-center text-slate-300 text-sm space-y-2">
                    <ImageIcon className="w-10 h-10 mx-auto text-slate-500" />
                    <p>Pratinjau langsung tidak tersedia untuk tautan media ini.</p>
                  </div>
                )}
              </div>

              {(activeItem.description?.trim() || formatEventDate(activeItem.event_date)) && (
                <div className="p-4 sm:p-6 space-y-2">
                  {formatEventDate(activeItem.event_date) && (
                    <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{formatEventDate(activeItem.event_date)}</span>
                    </p>
                  )}
                  {activeItem.description?.trim() && (
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                      {activeItem.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal Sticky dengan Navigasi Prev/Next */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canNavigatePrev}
                  onClick={() => {
                    if (canNavigatePrev) setActiveId(filteredGallery[activeIndex - 1].id);
                  }}
                  aria-label="Media sebelumnya"
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <button
                  type="button"
                  disabled={!canNavigateNext}
                  onClick={() => {
                    if (canNavigateNext) setActiveId(filteredGallery[activeIndex + 1].id);
                  }}
                  aria-label="Media berikutnya"
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition disabled:opacity-40"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {activeSafeMediaUrl && (
                  <a
                    href={activeSafeMediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                  >
                    <span>Buka Media</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
