'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  Image as ImageIcon,
  PlayCircle,
  RotateCcw,
  Search,
  Video,
  X,
} from 'lucide-react';

export interface PublicGalleryItem {
  id: string;
  title: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  description: string | null;
  event_date: string | null;
}

function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return url.startsWith('/');
  }
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('/')[0] || null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts') {
        return parts[1] || null;
      }
    }
    return null;
  } catch {
    return null;
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

export function GaleriGrid({ gallery }: { gallery: PublicGalleryItem[] }) {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState<PublicGalleryItem | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem]);

  const mediaTypes = useMemo(() => {
    const unique = new Set<string>();
    for (const item of gallery) {
      const t = (item.media_type || '').trim();
      if (t) unique.add(t);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
  }, [gallery]);

  const filteredGallery = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gallery.filter((item) => {
      if (selectedType !== 'ALL' && (item.media_type || '').trim() !== selectedType) {
        return false;
      }
      if (!q) return true;
      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    });
  }, [gallery, selectedType, searchQuery]);

  const hasActiveFilter = selectedType !== 'ALL' || searchQuery.trim().length > 0;

  if (gallery.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center space-y-3">
        <ImageIcon className="w-10 h-10 text-emerald-600 mx-auto" />
        <p className="font-bold text-slate-900">Belum Ada Dokumentasi Terunggah</p>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Dokumentasi foto dan video kegiatan akan tampil di sini setelah ditambahkan oleh tim
          Humas.
        </p>
      </div>
    );
  }

  function resolvePreviewUrl(item: PublicGalleryItem): string | null {
    if (item.thumbnail_url && isSafeHttpUrl(item.thumbnail_url)) {
      return item.thumbnail_url;
    }
    if (item.media_type === 'FOTO' && isSafeHttpUrl(item.media_url)) {
      return item.media_url;
    }
    const ytId = extractYouTubeId(item.media_url || '');
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Filter & Pencarian */}
      <div className="glass-card rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul atau keterangan dokumentasi..."
              aria-label="Cari dokumentasi galeri"
              className="w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 shrink-0">
            Menampilkan {filteredGallery.length} dari {gallery.length} dokumentasi
          </span>
        </div>

        {mediaTypes.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedType('ALL')}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                selectedType === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Semua ({gallery.length})
            </button>
            {mediaTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold border uppercase tracking-wide transition ${
                  selectedType === type
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {formatMediaType(type)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Galeri */}
      {filteredGallery.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Tidak ada dokumentasi yang cocok dengan filter saat ini.
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedType('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredGallery.map((item) => {
            const previewUrl = resolvePreviewUrl(item);
            const showPreview = Boolean(previewUrl) && !brokenImages[item.id];
            const isVideo = item.media_type !== 'FOTO';
            const dateLabel = formatEventDate(item.event_date);
            const safeMediaUrl = isSafeHttpUrl(item.media_url) ? item.media_url : null;

            return (
              <div
                key={item.id}
                className="modular-card rounded-3xl overflow-hidden flex flex-col justify-between min-w-0"
              >
                <div className="flex-1 flex flex-col min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveItem(item)}
                    className="relative aspect-video w-full bg-slate-100 overflow-hidden group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    aria-label={`Lihat pratinjau ${item.title}`}
                  >
                    {showPreview ? (
                      <img
                        src={previewUrl!}
                        alt={item.title}
                        loading="lazy"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
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
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{dateLabel}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words">
                      {item.title}
                    </h2>

                    {item.description && (
                      <p className="text-xs text-slate-600 leading-relaxed break-words line-clamp-3">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveItem(item)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition"
                  >
                    Lihat Pratinjau
                  </button>
                  {safeMediaUrl && (
                    <a
                      href={safeMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition"
                    >
                      <span>Buka Media</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Lightbox Media */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="galeri-modal-title"
          onClick={() => setActiveItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <span
                  className={`inline-block text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                    activeItem.media_type !== 'FOTO'
                      ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                      : 'bg-sky-50 text-sky-700 border-sky-200/80'
                  }`}
                >
                  {formatMediaType(activeItem.media_type)}
                </span>
                <h3
                  id="galeri-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words"
                >
                  {activeItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                aria-label="Tutup pratinjau media"
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 flex items-center justify-center">
              {(() => {
                const ytId = extractYouTubeId(activeItem.media_url || '');
                if (ytId) {
                  return (
                    <div className="w-full aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title={activeItem.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    </div>
                  );
                }

                if (
                  activeItem.media_type === 'FOTO' &&
                  isSafeHttpUrl(activeItem.media_url) &&
                  !brokenImages[activeItem.id]
                ) {
                  return (
                    <img
                      src={activeItem.media_url}
                      alt={activeItem.title}
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [activeItem.id]: true }))
                      }
                      className="max-h-[60vh] w-auto object-contain"
                    />
                  );
                }

                if (
                  activeItem.media_type !== 'FOTO' &&
                  isSafeHttpUrl(activeItem.media_url) &&
                  /\.(mp4|webm|ogg)$/i.test(activeItem.media_url)
                ) {
                  return (
                    <video
                      src={activeItem.media_url}
                      controls
                      className="w-full max-h-[60vh]"
                    />
                  );
                }

                return (
                  <div className="p-10 text-center text-slate-300 text-sm space-y-2">
                    <ImageIcon className="w-10 h-10 mx-auto text-slate-500" />
                    <p>Pratinjau langsung tidak tersedia untuk tautan media ini.</p>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {activeItem.description && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">
                  {activeItem.description}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Tutup
                </button>
                {isSafeHttpUrl(activeItem.media_url) && (
                  <a
                    href={activeItem.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                  >
                    <span>Buka di Tab Baru</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
