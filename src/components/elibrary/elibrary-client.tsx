'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookMarked,
  BookOpen,
  Calendar,
  Crown,
  Layers,
  Lock,
  Search,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import { FlipbookReader } from '@/components/elibrary/flipbook-reader';
import { toPublicMediaProxyUrl } from '@/lib/storage/r2-url-helper';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoSearchResultState,
} from '@/components/ui/state-views';

interface PublicEbook {
  id: string;
  title: string;
  author: string;
  publisher?: string | null;
  publish_year?: number | null;
  isbn?: string | null;
  category?: string | null;
  book_format: string;
  cover_url?: string | null;
  description?: string | null;
  has_ebook: boolean;
  is_premium: boolean;
  has_premium_access: boolean;
  grant_expires_at?: string | null;
  total_pages?: number;
}

type SortMode = 'TITLE_ASC' | 'YEAR_DESC' | 'PAGES_DESC';

const PAGE_SIZE = 12;

function extractGoogleDriveId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) return null;

    const fileMatch = /\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(parsed.pathname);
    if (fileMatch?.[1]) return fileMatch[1];

    const idParam = parsed.searchParams.get('id');
    if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) return idParam;
    return null;
  } catch {
    return null;
  }
}

function getSafeImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w800`;
  }
  const proxied = toPublicMediaProxyUrl(trimmed);
  if (proxied.startsWith('/')) return proxied;
  try {
    const parsed = new URL(proxied);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? proxied : null;
  } catch {
    return null;
  }
}

export function ELibraryClient() {
  const [books, setBooks] = useState<PublicEbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('SEMUA');
  const [accessFilter, setAccessFilter] = useState<'ALL' | 'FREE' | 'PREMIUM'>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('TITLE_ASC');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedBook, setSelectedBook] = useState<PublicEbook | null>(null);
  const [premiumNotice, setPremiumNotice] = useState<string | null>(null);
  const [brokenCovers, setBrokenCovers] = useState<Record<string, boolean>>({});

  const premiumNoticeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/layanan/perpustakaan?public=1', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Gagal memuat katalog E-Library.');
        }
        return res.json();
      })
      .then((json) => {
        setBooks(Array.isArray(json?.books) ? json.books : []);
        setFetchError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setBooks([]);
        setFetchError(err?.message || 'Tidak dapat terhubung ke server E-Library.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retryTick]);

  const categoryEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) {
      const cat = b.category?.trim();
      if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [books]);

  const effectiveCategory = useMemo(() => {
    if (selectedCategory === 'SEMUA') return 'SEMUA';
    return categoryEntries.some(([cat]) => cat === selectedCategory)
      ? selectedCategory
      : 'SEMUA';
  }, [selectedCategory, categoryEntries]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = books.filter((b) => {
      if (effectiveCategory !== 'SEMUA' && (b.category?.trim() || '') !== effectiveCategory) {
        return false;
      }
      if (accessFilter === 'FREE' && b.is_premium) return false;
      if (accessFilter === 'PREMIUM' && !b.is_premium) return false;
      if (!q) return true;
      return (
        (b.title || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        Boolean(b.category && b.category.toLowerCase().includes(q)) ||
        Boolean(b.publisher && b.publisher.toLowerCase().includes(q)) ||
        Boolean(b.isbn && b.isbn.toLowerCase().includes(q))
      );
    });

    if (sortMode === 'YEAR_DESC') {
      return [...list].sort(
        (a, b) =>
          (Number(b.publish_year) || 0) - (Number(a.publish_year) || 0) ||
          (a.title || '').localeCompare(b.title || '', 'id')
      );
    }
    if (sortMode === 'PAGES_DESC') {
      return [...list].sort(
        (a, b) =>
          (Number(b.total_pages) || 0) - (Number(a.total_pages) || 0) ||
          (a.title || '').localeCompare(b.title || '', 'id')
      );
    }
    return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'id'));
  }, [books, search, effectiveCategory, accessFilter, sortMode]);

  const displayedBooks = filteredBooks.slice(0, visibleCount);
  const hasMore = visibleCount < filteredBooks.length;
  const hasActiveFilter =
    search.trim().length > 0 || effectiveCategory !== 'SEMUA' || accessFilter !== 'ALL';

  const stats = useMemo(() => {
    const total = books.length;
    const premiumCount = books.filter((b) => b.is_premium).length;
    return { total, premiumCount, categoryCount: categoryEntries.length };
  }, [books, categoryEntries]);

  function resetFilters() {
    setSearch('');
    setSelectedCategory('SEMUA');
    setAccessFilter('ALL');
    setSortMode('TITLE_ASC');
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Modern Editorial Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white p-5 sm:p-8 lg:p-10 shadow-xl">
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-teal-400/10 blur-3xl pointer-events-none"
          />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-8">
              <div className="space-y-3 max-w-2xl min-w-0">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight [overflow-wrap:anywhere]">
                  E-Library &amp; Koleksi Buku Digital
                </h1>
                <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed">
                  Jelajahi koleksi buku elektronik pembelajaran, referensi akademik, dan literasi
                  lembaga dalam tampilan pembaca interaktif yang nyaman di desktop maupun ponsel.
                </p>
              </div>

              {/* Search Box inside Hero */}
              <div className="w-full lg:w-96 space-y-2 shrink-0">
                <label
                  htmlFor="elibrary-search"
                  className="block text-xs font-semibold text-emerald-100"
                >
                  Cari Judul, Penulis, Penerbit, atau ISBN
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="elibrary-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    placeholder="Ketik kata kunci buku..."
                    className="w-full min-h-[46px] rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 pl-11 pr-11 py-3 text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setVisibleCount(PAGE_SIZE);
                      }}
                      aria-label="Hapus pencarian buku"
                      className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Library Metrics — Full Width & Centered Values */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full pt-1">
              <div className="w-full px-3 sm:px-4 py-3 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-center">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-200 font-semibold">
                  Total E-Book
                </p>
                <p className="text-lg sm:text-2xl font-black tabular-nums mt-0.5 text-center">
                  {stats.total.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="w-full px-3 sm:px-4 py-3 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-center">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-200 font-semibold">
                  Kategori
                </p>
                <p className="text-lg sm:text-2xl font-black tabular-nums mt-0.5 text-center">
                  {stats.categoryCount.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="w-full px-3 sm:px-4 py-3 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-center">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-200 font-semibold">
                  Koleksi Premium
                </p>
                <p className="text-lg sm:text-2xl font-black tabular-nums mt-0.5 text-center">
                  {stats.premiumCount.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Filter & Category Toolbar */}
        <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 border border-slate-200/80">
          <div
            role="tablist"
            aria-label="Filter kategori E-Book"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0 min-w-0"
          >
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 shrink-0 mr-1">
              <Layers className="w-3.5 h-3.5" /> Kategori:
            </span>
            <button
              type="button"
              role="tab"
              aria-selected={effectiveCategory === 'SEMUA'}
              onClick={() => {
                setSelectedCategory('SEMUA');
                setVisibleCount(PAGE_SIZE);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                effectiveCategory === 'SEMUA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Semua ({books.length})
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
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                  effectiveCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat} ({count})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 shrink-0">
            <div
              role="tablist"
              aria-label="Filter akses buku"
              className="flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0" />
              {(
                [
                  ['ALL', 'Semua'],
                  ['FREE', 'Umum'],
                  ['PREMIUM', 'Premium'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  role="tab"
                  aria-selected={accessFilter === val}
                  onClick={() => {
                    setAccessFilter(val);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    accessFilter === val
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Urutkan katalog buku"
              className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            >
              <option value="TITLE_ASC">Urutkan: Judul A–Z</option>
              <option value="YEAR_DESC">Urutkan: Tahun Terbaru</option>
              <option value="PAGES_DESC">Urutkan: Halaman Terbanyak</option>
            </select>

            {!loading && !fetchError && (
              <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                {displayedBooks.length}/{filteredBooks.length} buku
              </span>
            )}
          </div>
        </div>

        {premiumNotice && (
          <div
            ref={premiumNoticeRef}
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs"
          >
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              <span className="leading-relaxed [overflow-wrap:anywhere]">{premiumNotice}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/login?next=%2Fe-library"
                className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-center transition"
              >
                Masuk ke Portal
              </Link>
              <button
                type="button"
                onClick={() => setPremiumNotice(null)}
                aria-label="Tutup pemberitahuan"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-amber-700 hover:bg-amber-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Catalog Grid */}
        {loading ? (
          <LoadingState
            variant="skeleton"
            rows={6}
            title="Memuat katalog E-Book perpustakaan digital..."
          />
        ) : fetchError ? (
          <ErrorState
            title="Gagal Memuat Katalog E-Library"
            message={fetchError}
            onRetry={() => {
              setLoading(true);
              setFetchError(null);
              setRetryTick((t) => t + 1);
            }}
          />
        ) : books.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="Belum Ada Koleksi E-Book"
            description="Koleksi buku digital akan tampil di sini setelah ditambahkan oleh pustakawan melalui Portal Perpustakaan."
          />
        ) : filteredBooks.length === 0 ? (
          <NoSearchResultState
            query={search}
            title="Koleksi E-Book Tidak Ditemukan"
            description="Belum ada E-Book yang sesuai dengan kata kunci, kategori, atau filter akses yang dipilih."
            onReset={hasActiveFilter ? resetFilters : undefined}
            resetLabel="Reset Pencarian & Filter"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {displayedBooks.map((book) => {
                const safeCoverUrl = getSafeImageUrl(book.cover_url);
                const showCoverImage = Boolean(safeCoverUrl && !brokenCovers[book.id]);
                const isLockedPremium = book.is_premium && !book.has_premium_access;

                return (
                  <article
                    key={book.id}
                    className="group bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-emerald-300 transition-all duration-200 overflow-hidden flex flex-col min-w-0"
                  >
                    {/* Top Card Layout: Book Cover + Primary Info */}
                    <div className="p-4 sm:p-5 flex gap-3.5 sm:gap-4 flex-1 min-w-0">
                      {/* Realistic Book Cover Frame */}
                      <div className="relative w-24 sm:w-32 aspect-[3/4] self-start shrink-0 rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900">
                        <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/35 to-transparent z-10 pointer-events-none" />

                        {showCoverImage && safeCoverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={safeCoverUrl}
                            alt={`Sampul ${book.title}`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenCovers((prev) => ({ ...prev, [book.id]: true }))
                            }
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full p-2.5 sm:p-3 flex flex-col justify-between text-white">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300 line-clamp-1">
                              {book.category || 'E-Book'}
                            </span>
                            <p className="text-[11px] sm:text-xs font-extrabold leading-snug line-clamp-4 [overflow-wrap:anywhere]">
                              {book.title}
                            </p>
                            <p className="text-[10px] text-slate-300 truncate">{book.author}</p>
                          </div>
                        )}

                        {book.is_premium && (
                          <div className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black shadow">
                            <Crown className="w-2.5 h-2.5 shrink-0" /> PREMIUM
                          </div>
                        )}
                      </div>

                      {/* Book Metadata */}
                      <div className="flex flex-col justify-between min-w-0 flex-1 space-y-2.5">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[10px] font-bold max-w-full truncate">
                              <BookMarked className="w-3 h-3 shrink-0" />
                              <span className="truncate">{book.category || 'Umum'}</span>
                            </span>
                          </div>

                          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug line-clamp-2 [overflow-wrap:anywhere] group-hover:text-emerald-700 transition-colors">
                            {book.title}
                          </h2>

                          <div className="space-y-1 text-xs text-slate-500 min-w-0">
                            <p className="flex items-center gap-1.5 min-w-0">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-700 truncate">
                                {book.author}
                              </span>
                            </p>
                            {(book.publisher || book.publish_year) && (
                              <p className="flex items-center gap-1.5 text-[11px] min-w-0">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {[book.publisher, book.publish_year].filter(Boolean).join(' • ')}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed [overflow-wrap:anywhere]">
                          {book.description ||
                            'Koleksi buku digital resmi yang dapat dibaca langsung melalui E-Library.'}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 sm:px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="text-[11px] text-slate-500 font-medium truncate min-w-0">
                        {book.isbn
                          ? `ISBN: ${book.isbn}`
                          : book.total_pages
                            ? `${book.total_pages.toLocaleString('id-ID')} Halaman`
                            : 'Koleksi Digital'}
                      </div>

                      <button
                        type="button"
                        disabled={!book.has_ebook}
                        onClick={() => {
                          if (isLockedPremium) {
                            setPremiumNotice(
                              `"${book.title}" adalah Buku Premium. Hanya pengguna terdaftar yang mendapatkan izin baca berdurasi dari Admin yang dapat membukanya.`
                            );
                            requestAnimationFrame(() => {
                              premiumNoticeRef.current?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              });
                            });
                            return;
                          }
                          setPremiumNotice(null);
                          setSelectedBook(book);
                        }}
                        className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                          isLockedPremium
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-slate-900 hover:bg-emerald-700 disabled:opacity-45 text-white shadow-xs'
                        }`}
                      >
                        {!book.has_ebook ? (
                          <>
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span>Belum Tersedia</span>
                          </>
                        ) : isLockedPremium ? (
                          <>
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span>Khusus Izin Admin</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span>Baca Buku</span>
                          </>
                        )}
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
                  Muat Lebih Banyak ({(filteredBooks.length - displayedBooks.length).toLocaleString('id-ID')}{' '}
                  tersisa)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedBook && (
        <FlipbookReader
          bookId={selectedBook.id}
          bookTitle={selectedBook.title}
          author={selectedBook.author}
          isPublicMode={true}
          isPremium={selectedBook.is_premium}
          grantExpiresAt={selectedBook.grant_expires_at}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </>
  );
}
