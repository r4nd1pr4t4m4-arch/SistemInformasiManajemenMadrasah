'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Crown,
  Lock,
  Search,
  Sparkles,
  Loader2,
  Layers,
  User,
  Calendar,
  BookMarked,
  SlidersHorizontal,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { FlipbookReader } from '@/components/elibrary/flipbook-reader';

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
  total_pages?: number;
}

export default function PublicELibraryPage() {
  const [books, setBooks] = useState<PublicEbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('SEMUA');
  const [accessFilter, setAccessFilter] = useState<'ALL' | 'FREE' | 'PREMIUM'>('ALL');
  const [selectedBook, setSelectedBook] = useState<PublicEbook | null>(null);
  const [premiumNotice, setPremiumNotice] = useState<string | null>(null);
  const [brokenCovers, setBrokenCovers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/layanan/perpustakaan?public=1');
        const json = await res.json();
        setBooks(json.books || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category?.trim()) set.add(b.category.trim());
    });
    return ['SEMUA', ...Array.from(set).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      if (selectedCategory !== 'SEMUA' && (b.category?.trim() || '') !== selectedCategory) {
        return false;
      }
      if (accessFilter === 'FREE' && b.is_premium) return false;
      if (accessFilter === 'PREMIUM' && !b.is_premium) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q)) ||
        (b.publisher && b.publisher.toLowerCase().includes(q)) ||
        (b.isbn && b.isbn.toLowerCase().includes(q))
      );
    });
  }, [books, search, selectedCategory, accessFilter]);

  const stats = useMemo(() => {
    const total = books.length;
    const premiumCount = books.filter((b) => b.is_premium).length;
    const regularCount = total - premiumCount;
    return { total, premiumCount, regularCount, categoryCount: Math.max(0, categories.length - 1) };
  }, [books, categories]);

  return (
    <PublicShell>
      <div className="space-y-8">
        {/* Modern Editorial Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white p-6 sm:p-10 shadow-xl">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                Perpustakaan Digital Resmi
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                E-Library &amp; Koleksi Buku Digital
              </h1>
              <p className="text-sm text-slate-200/90 leading-relaxed">
                Jelajahi koleksi buku elektronik pembelajaran, referensi akademik, dan literasi madrasah dalam tampilan pembaca interaktif yang nyaman di desktop maupun ponsel.
              </p>

              {/* Quick Library Metrics */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">
                    Total E-Book
                  </p>
                  <p className="text-lg font-black">{stats.total}</p>
                </div>
                <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">
                    Kategori
                  </p>
                  <p className="text-lg font-black">{stats.categoryCount || 1}</p>
                </div>
                <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wider text-amber-200 font-semibold">
                    Koleksi Premium
                  </p>
                  <p className="text-lg font-black">{stats.premiumCount}</p>
                </div>
              </div>
            </div>

            {/* Search Box inside Hero */}
            <div className="w-full lg:w-96 space-y-2.5">
              <label className="block text-xs font-semibold text-emerald-100">
                Cari Judul, Penulis, Penerbit, atau ISBN
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ketik kata kunci buku..."
                  className="w-full rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 pl-11 pr-4 py-3 text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Filter & Category Toolbar */}
        <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200/80">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 shrink-0 mr-1">
              <Layers className="w-3.5 h-3.5" /> Kategori:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat === 'SEMUA' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-1" />
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
                onClick={() => setAccessFilter(val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  accessFilter === val
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {premiumNotice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{premiumNotice}</span>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 text-center transition"
            >
              Masuk ke Portal
            </Link>
          </div>
        )}

        {/* Catalog Grid */}
        {loading ? (
          <div className="glass-card rounded-3xl p-16 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span>Memuat katalog E-Book...</span>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="glass-card rounded-3xl p-14 text-center space-y-2">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h2 className="text-base font-bold text-slate-800">Koleksi tidak ditemukan</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Belum ada E-Book yang sesuai dengan kata kunci atau filter kategori yang dipilih.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book) => {
              const showCoverImage = Boolean(book.cover_url && !brokenCovers[book.id]);
              return (
                <article
                  key={book.id}
                  className="group bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-emerald-300 transition-all duration-200 overflow-hidden flex flex-col"
                >
                  {/* Top Card Layout: Book Cover + Primary Info */}
                  <div className="p-5 flex gap-4 flex-1">
                    {/* Realistic Book Cover Frame */}
                    <div className="relative w-28 sm:w-32 aspect-[3/4] shrink-0 rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900">
                      {/* Subtle book spine crease */}
                      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/35 to-transparent z-10 pointer-events-none" />

                      {showCoverImage ? (
                        <img
                          src={book.cover_url as string}
                          alt={`Sampul ${book.title}`}
                          onError={() =>
                            setBrokenCovers((prev) => ({ ...prev, [book.id]: true }))
                          }
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full p-3 flex flex-col justify-between text-white">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300 line-clamp-1">
                            {book.category || 'E-Book'}
                          </span>
                          <p className="text-xs font-extrabold leading-snug line-clamp-4">
                            {book.title}
                          </p>
                          <p className="text-[10px] text-slate-300 truncate">{book.author}</p>
                        </div>
                      )}

                      {book.is_premium && (
                        <div className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black shadow">
                          <Crown className="w-2.5 h-2.5" /> PREMIUM
                        </div>
                      )}
                    </div>

                    {/* Book Metadata */}
                    <div className="flex flex-col justify-between min-w-0 flex-1 space-y-2.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[10px] font-bold">
                            <BookMarked className="w-3 h-3" />
                            {book.category || 'Umum'}
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
                          {book.title}
                        </h3>

                        <div className="space-y-1 text-xs text-slate-500">
                          <p className="flex items-center gap-1.5 truncate">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 truncate">
                              {book.author}
                            </span>
                          </p>
                          {(book.publisher || book.publish_year) && (
                            <p className="flex items-center gap-1.5 truncate text-[11px]">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {[book.publisher, book.publish_year].filter(Boolean).join(' • ')}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {book.description ||
                          'Koleksi buku digital resmi yang dapat dibaca langsung melalui E-Library.'}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500 font-medium truncate">
                      {book.isbn
                        ? `ISBN: ${book.isbn}`
                        : book.total_pages
                        ? `${book.total_pages} Halaman`
                        : 'Koleksi Digital'}
                    </div>

                    <button
                      type="button"
                      disabled={!book.has_ebook}
                      onClick={() => {
                        if (book.is_premium && !book.has_premium_access) {
                          setPremiumNotice(
                            `"${book.title}" adalah Buku Premium. Hanya pengguna terdaftar yang mendapatkan izin baca berdurasi dari Admin yang dapat membukanya.`
                          );
                          return;
                        }
                        setPremiumNotice(null);
                        setSelectedBook(book);
                      }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                        book.is_premium && !book.has_premium_access
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-slate-900 hover:bg-emerald-700 disabled:opacity-40 text-white shadow-xs'
                      }`}
                    >
                      {book.is_premium && !book.has_premium_access ? (
                        <>
                          <Lock className="w-3.5 h-3.5" /> Khusus Izin Admin
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-3.5 h-3.5" /> Baca Buku
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedBook && (
        <FlipbookReader
          bookId={selectedBook.id}
          bookTitle={selectedBook.title}
          author={selectedBook.author}
          isPublicMode={true}
          isPremium={selectedBook.is_premium}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </PublicShell>
  );
}
