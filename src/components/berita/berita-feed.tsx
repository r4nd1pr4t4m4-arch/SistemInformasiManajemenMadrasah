'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Newspaper,
  Search,
  User,
  X,
} from 'lucide-react';
import type { PostItem } from '@/types/database';
import { EmptyState, NoSearchResultState } from '@/components/ui/state-views';

const PAGE_SIZE = 9;

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

function buildExcerpt(post: PostItem): string {
  const raw = (post.excerpt || post.content || '').trim();
  if (!raw) return 'Tidak ada ringkasan artikel.';
  if (raw.length <= 140) return raw;
  return `${raw.slice(0, 140).trimEnd()}...`;
}

export function BeritaFeed({ posts }: { posts: PostItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activePost, setActivePost] = useState<PostItem | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activePost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePost(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePost]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const p of posts) {
      const cat = (p.category || '').trim();
      if (cat) unique.add(cat);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      if (selectedCategory !== 'ALL' && (post.category || '').trim() !== selectedCategory) {
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
  }, [posts, selectedCategory, searchQuery]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;
  const hasActiveFilter = selectedCategory !== 'ALL' || searchQuery.trim().length > 0;

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper className="w-6 h-6" />}
        title="Belum Ada Berita atau Publikasi"
        description="Berita, pengumuman, dan artikel pendidikan akan tampil di sini setelah dipublikasikan melalui Portal CMS."
      />
    );
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Cari judul, topik, atau penulis berita..."
              aria-label="Cari berita atau publikasi"
              className="w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="Hapus kata kunci pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 shrink-0">
            Menampilkan {displayedPosts.length} dari {filteredPosts.length} publikasi
          </span>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setVisibleCount(PAGE_SIZE);
              }}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Semua ({posts.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold border uppercase tracking-wide transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {formatCategoryLabel(cat)}
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
              const showCover = Boolean(post.cover_image_url) && !brokenImages[post.id];
              const dateLabel = formatPublishedDate(post.published_at);

              return (
                <article
                  key={post.id}
                  className="modular-card rounded-3xl overflow-hidden flex flex-col justify-between min-w-0"
                >
                  <div className="flex-1 flex flex-col min-w-0">
                    {showCover && (
                      <div className="aspect-video w-full bg-slate-100 overflow-hidden">
                        <img
                          src={post.cover_image_url!}
                          alt={post.title}
                          loading="lazy"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [post.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
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
                      <h2 className="font-bold text-slate-900 text-base leading-snug break-words">
                        {post.title}
                      </h2>
                      <p className="text-sm text-slate-600 leading-relaxed break-words">
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
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateLabel}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePost(post)}
                      className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-2 transition"
                    >
                      <span>Baca Selengkapnya</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
                Muat Lebih Banyak ({filteredPosts.length - displayedPosts.length} tersisa)
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
          onClick={() => setActivePost(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            {activePost.cover_image_url && !brokenImages[activePost.id] && (
              <div className="aspect-video w-full bg-slate-100 overflow-hidden">
                <img
                  src={activePost.cover_image_url}
                  alt={activePost.title}
                  onError={() =>
                    setBrokenImages((prev) => ({ ...prev, [activePost.id]: true }))
                  }
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-5 sm:p-7 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-block text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full border ${getCategoryBadgeClass(
                    activePost.category
                  )}`}
                >
                  {formatCategoryLabel(activePost.category)}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePost(null)}
                  aria-label="Tutup artikel"
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2
                id="berita-modal-title"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug break-words"
              >
                {activePost.title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pb-3 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{activePost.author_display_name || 'Tim Redaksi'}</span>
                </span>
                {formatPublishedDate(activePost.published_at) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{formatPublishedDate(activePost.published_at)}</span>
                  </span>
                )}
              </div>

              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">
                {activePost.content || activePost.excerpt || 'Konten artikel tidak tersedia.'}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActivePost(null)}
                  className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition"
                >
                  Tutup Artikel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
