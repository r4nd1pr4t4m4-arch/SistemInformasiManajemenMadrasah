'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Crown, Lock, Search, Sparkles, Loader2 } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { FlipbookReader } from '@/components/elibrary/flipbook-reader';

interface PublicEbook {
  id: string;
  title: string;
  author: string;
  category?: string | null;
  publish_year?: number | null;
  book_format: string;
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
  const [selectedBook, setSelectedBook] = useState<PublicEbook | null>(null);
  const [premiumNotice, setPremiumNotice] = useState<string | null>(null);

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

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q))
    );
  }, [books, search]);

  return (
    <PublicShell>
      <div className="space-y-8">
        <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Perpustakaan Digital Publik
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              E-Library Publik (Koleksi E-Book)
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Jelajahi koleksi E-Book resmi lembaga dalam format flipbook interaktif. Pengunjung publik dapat membaca pratinjau hingga <strong>10% dari total halaman</strong>.
            </p>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, penulis, kategori..."
              className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {premiumNotice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{premiumNotice}</span>
            </div>
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 text-center"
            >
              Masuk ke Portal
            </Link>
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-3xl p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat koleksi E-Book...
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <h2 className="text-sm font-bold text-slate-800">Belum ada koleksi E-Book</h2>
            <p className="text-xs text-slate-500">
              Koleksi E-Book akan tampil di sini setelah ditambahkan oleh Pustakawan atau Admin.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="glass-card rounded-3xl p-5 flex flex-col justify-between gap-4 border border-slate-200/80 hover:border-emerald-300 transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                      {book.category || 'E-BOOK'}
                    </span>
                    {book.is_premium ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold">
                        <Crown className="w-3 h-3" /> PREMIUM
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold">
                        PRATINJAU 10%
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">{book.title}</h3>
                  <p className="text-xs text-slate-500">
                    Penulis: <strong className="text-slate-700">{book.author}</strong>
                    {book.publish_year ? ` • ${book.publish_year}` : ''}
                  </p>
                  {book.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{book.description}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {book.has_ebook ? 'Format Flipbook Terproteksi' : 'Berkas belum diunggah'}
                  </span>
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
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                      book.is_premium && !book.has_premium_access
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-slate-900 hover:bg-emerald-700 disabled:opacity-40 text-white'
                    }`}
                  >
                    {book.is_premium && !book.has_premium_access ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Khusus Izin Admin
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5" /> Baca Flipbook
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
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
