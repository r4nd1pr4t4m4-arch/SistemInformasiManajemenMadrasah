'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  ExternalLink,
  Newspaper,
  Search,
  User,
  X,
} from 'lucide-react';
import type { PostItem } from '@/types/database';
import { EmptyState, NoSearchResultState } from '@/components/ui/state-views';

const PAGE_SIZE = 9;

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

function formatCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Umum';
  return category.replace(/_/g, ' ');
}

function getCategoryBadgeClass(category: string | null | undefined): string {
  const norm = (category || '').toUpperCase();
  if (norm.includes('PENGUMUMAN')) {
    return 'bg-amber-50 text-amber-800 border-amber-200/80';
  }
  if (norm.includes('ARTIKEL') || norm.includes('OPINI')) {
    return 'bg-sky-50 text-sky-800 border-sky-200/80';
  }
  if (norm.includes('PRESTASI') || norm.includes('KARYA')) {
    return 'bg-violet-50 text-violet-800 border-violet-200/80';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
}

function formatPublishedDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildExcerpt(post: PostItem, maxLength = 145): string {
  const raw = (post.excerpt?.trim() || post.content?.trim() || '');
  if (!raw) return 'Tidak ada ringkasan artikel.';
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_`>~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Tidak ada ringkasan artikel.';
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${truncated || cleaned.slice(0, maxLength).trim()}…`;
}

export function BeritaFeed({ posts }: { posts: PostItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activePost, setActivePost] = useState<PostItem | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  function openPostModal(post: PostItem, buttonEl: HTMLButtonElement | null) {
    triggerRef.current = buttonEl;
    setActivePost(post);
  }

  function closePostModal() {
    setActivePost(null);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!activePost) return;
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePost(null);
        requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePost]);

  const categoryEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const cat = (p.category || '').trim();
      if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [posts]);

  const effectiveCategory = useMemo(() => {
    if (selectedCategory === 'ALL') return 'ALL';
    return categoryEntries.some(([cat]) => cat === selectedCategory) ? selectedCategory : 'ALL';
  }, [selectedCategory, categoryEntries]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      if (effectiveCategory !== 'ALL' && (post.category || '').trim() !== effectiveCategory) {
        return false;
      }
      if (!q) return true;
      return (
        (post.title || '').toLowerCase().includes(q) ||
        (post.excerpt || '').toLowerCase().includes(q) ||
        (post.content || '').toLowerCase().includes(q) ||
        (post.author_display_name || '').toLowerCase().includes(q)
      );
    });
  }, [posts, effectiveCategory, searchQuery]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;
  const hasActiveFilter = effectiveCategory !== 'ALL' || searchQuery.trim().length > 0;

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper className="w-6 h-6" />}
        title="Belum Ada Berita atau Publikasi"
        description="Berita, pengumuman, dan artikel pendidikan akan tampil di sini setelah dipublikasikan melalui Portal CMS."
      />
    );
  }

  const activeCoverUrl = activePost ? isSafeImageSrc(activePost.cover_image_url) : null;
  const activeSlug = activePost?.slug?.trim() || '';

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
              placeholder="Cari judul, topik, atau penulis berita..."
              aria-label="Cari berita atau publikasi"
              className="w-full min-h-[44px] rounded-xl border border-slate-300/90 bg-white pl-10 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="Hapus kata kunci pencarian"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 shrink-0 tabular-nums">
            Menampilkan {displayedPosts.length.toLocaleString('id-ID')} dari{' '}
            {filteredPosts.length.toLocaleString('id-ID')} publikasi
          </span>
        </div>

        {categoryEntries.length > 0 && (
          <div
            role="tablist"
            aria-label="Filter kategori publikasi"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={effectiveCategory === 'ALL'}
              onClick={() => {
                setSelectedCategory('ALL');
                setVisibleCount(PAGE_SIZE);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                effectiveCategory === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Semua ({posts.length})
            </button>
            {categoryEntries.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={effectiveCategory === cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border uppercase tracking-wide transition ${
                  effectiveCategory === cat
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {formatCategoryLabel(cat)} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Daftar Publikasi */}
      {filteredPosts.length === 0 ? (
        <NoSearchResultState
          query={searchQuery}
          title="Publikasi Tidak Ditemukan"
          description="Tidak ada berita atau pengumuman yang cocok dengan kata kunci maupun kategori yang Anda pilih."
          onReset={
            hasActiveFilter
              ? () => {
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }
              : undefined
          }
          resetLabel="Reset Pencarian & Kategori"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {displayedPosts.map((post) => {
              const safeCoverUrl = isSafeImageSrc(post.cover_image_url);
              const showCover = Boolean(safeCoverUrl) && !brokenImages[post.id];
              const dateLabel = formatPublishedDate(post.published_at);

              return (
                <article
                  key={post.id}
                  className="modular-card rounded-3xl overflow-hidden flex flex-col justify-between min-w-0 group"
                >
                  <div className="flex-1 flex flex-col min-w-0">
                    {showCover && safeCoverUrl && (
                      <div className="relative aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={safeCoverUrl}
                          alt={post.title || 'Sampul Publikasi'}
                          loading="lazy"
                          decoding="async"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [post.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}

                    <div className="p-5 sm:p-6 space-y-3 flex-1 min-w-0">
                      <span
                        className={`inline-block text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full border ${getCategoryBadgeClass(
                          post.category
                        )}`}
                      >
                        {formatCategoryLabel(post.category)}
                      </span>
                      <h2 className="font-bold text-slate-900 text-base leading-snug [overflow-wrap:anywhere] group-hover:text-emerald-700 transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere] line-clamp-3">
                        {buildExcerpt(post)}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 sm:px-6 pb-5 pt-3.5 border-t border-slate-100 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 min-w-0">
                      <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {post.author_display_name || 'Tim Redaksi'}
                        </span>
                      </span>
                      {dateLabel && (
                        <time
                          dateTime={post.published_at || undefined}
                          className="inline-flex items-center gap-1 shrink-0"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateLabel}</span>
                        </time>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => openPostModal(post, e.currentTarget)}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50/85 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 text-xs font-semibold px-3 py-2 transition"
                    >
                      <span>Baca Selengkapnya</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
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
                Muat Lebih Banyak ({(filteredPosts.length - displayedPosts.length).toLocaleString('id-ID')}{' '}
                tersisa)
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Baca Artikel Lengkap */}
      {activePost && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="berita-modal-title"
          onClick={closePostModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header Modal Sticky */}
            <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-b border-slate-100 bg-white/95 backdrop-blur shrink-0">
              <span
                className={`inline-block text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full border ${getCategoryBadgeClass(
                  activePost.category
                )}`}
              >
                {formatCategoryLabel(activePost.category)}
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePostModal}
                aria-label="Tutup artikel"
                className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal Scrollable */}
            <div className="overflow-y-auto overscroll-contain flex-1">
              {activeCoverUrl && !brokenImages[activePost.id] && (
                <div className="relative aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeCoverUrl}
                    alt={activePost.title || 'Sampul Publikasi'}
                    decoding="async"
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [activePost.id]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-5 sm:p-7 space-y-4">
                <h2
                  id="berita-modal-title"
                  className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug [overflow-wrap:anywhere]"
                >
                  {activePost.title}
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pb-3 border-b border-slate-100">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{activePost.author_display_name || 'Tim Redaksi'}</span>
                  </span>
                  {formatPublishedDate(activePost.published_at) && (
                    <time
                      dateTime={activePost.published_at || undefined}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{formatPublishedDate(activePost.published_at)}</span>
                    </time>
                  )}
                </div>

                {activePost.excerpt?.trim() && activePost.content?.trim() && (
                  <p className="text-sm font-medium text-slate-700 bg-slate-50 border-l-4 border-emerald-500 px-4 py-3 rounded-r-xl leading-relaxed [overflow-wrap:anywhere]">
                    {activePost.excerpt}
                  </p>
                )}

                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                  {activePost.content?.trim() ||
                    activePost.excerpt?.trim() ||
                    'Konten artikel tidak tersedia.'}
                </div>
              </div>
            </div>

            {/* Footer Modal Sticky */}
            <div className="px-5 sm:px-7 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
              {activeSlug ? (
                <Link
                  href={`/berita/${encodeURIComponent(activeSlug)}`}
                  onClick={() => setActivePost(null)}
                  className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-800 text-slate-700 text-xs sm:text-sm font-semibold transition"
                >
                  <span>Buka Halaman Penuh</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={closePostModal}
                className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition"
              >
                Tutup Artikel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
