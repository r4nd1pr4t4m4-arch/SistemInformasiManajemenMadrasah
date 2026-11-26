'use client';

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  BookFilter,
  BookFormat,
  BookFormState,
  BookRow,
  DeleteTarget,
  DurationUnit,
  GrantFormState,
  GrantRow,
  PostLibFn,
  ShowToastFn,
  UserOption,
} from './types';

interface KatalogSectionProps {
  books: BookRow[];
  grants: GrantRow[];
  users: UserOption[];
  nowMs: number;
  canManage: boolean;
  refreshing: boolean;
  submittingAction: string | null;
  selectedBookIds: string[];
  setSelectedBookIds: Dispatch<SetStateAction<string[]>>;
  onRefresh: () => void;
  postLib: PostLibFn;
  showToast: ShowToastFn;
  onOpenEditBook: (book: BookRow) => void;
  onSetDeleteTarget: (target: DeleteTarget | null) => void;
  onOpenReader: (book: BookRow) => void;
}

export function KatalogSection({
  books,
  grants,
  users,
  nowMs,
  canManage,
  refreshing,
  submittingAction,
  selectedBookIds,
  setSelectedBookIds,
  onRefresh,
  postLib,
  showToast,
  onOpenEditBook,
  onSetDeleteTarget,
  onOpenReader,
}: KatalogSectionProps) {
  const [bookSearch, setBookSearch] = useState('');
  const [bookFilter, setBookFilter] = useState<BookFilter>('ALL');
  const [showAddBookForm, setShowAddBookForm] = useState(true);
  const [showGrantForm, setShowGrantForm] = useState(true);

  const [bookForm, setBookForm] = useState<BookFormState>({
    title: '',
    author: '',
    isbn: '',
    category: '',
    book_format: 'KEDUANYA',
    total_copies: 3,
    ebook_file_url: '',
    cover_url: '',
    description: '',
    is_premium: false,
  });

  const [grantForm, setGrantForm] = useState<GrantFormState>({
    book_id: '',
    user_id: '',
    duration_value: 7,
    duration_unit: 'HARI',
    notes: '',
  });

  const catalogSummary = useMemo(() => {
    let ebookCount = 0;
    let premiumCount = 0;
    for (const b of books) {
      if (b.book_format === 'EBOOK' || b.book_format === 'KEDUANYA') ebookCount += 1;
      if (b.is_premium) premiumCount += 1;
    }
    return { ebookCount, premiumCount };
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    return books.filter((b) => {
      if (bookFilter === 'EBOOK' && b.book_format !== 'EBOOK' && b.book_format !== 'KEDUANYA') {
        return false;
      }
      if (bookFilter === 'FISIK' && b.book_format !== 'FISIK' && b.book_format !== 'KEDUANYA') {
        return false;
      }
      if (bookFilter === 'PREMIUM' && !b.is_premium) {
        return false;
      }
      if (q) {
        const haystack = `${b.title} ${b.author} ${b.category || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [bookFilter, bookSearch, books]);

  const premiumBooks = useMemo(() => books.filter((b) => b.is_premium), [books]);

  function toggleBookSelection(bookId: string) {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  }

  const allFilteredSelected =
    filteredBooks.length > 0 &&
    filteredBooks.every((b) => selectedBookIds.includes(b.id));

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredBooks.map((b) => b.id));
      setSelectedBookIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      setSelectedBookIds((prev) => {
        const merged = new Set(prev);
        for (const b of filteredBooks) merged.add(b.id);
        return Array.from(merged);
      });
    }
  }

  async function handleAddBook(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    const title = bookForm.title.trim();
    const author = bookForm.author.trim();
    if (title.length < 2) {
      showToast('Judul buku minimal 2 karakter.', 'error');
      return;
    }
    if (author.length < 2) {
      showToast('Nama penulis minimal 2 karakter.', 'error');
      return;
    }
    const copies = Number.isFinite(bookForm.total_copies)
      ? Math.max(1, Math.round(bookForm.total_copies))
      : 1;
    const ok = await postLib(
      {
        action: 'ADD_BOOK',
        ...bookForm,
        title,
        author,
        isbn: bookForm.isbn.trim() || null,
        category: bookForm.category.trim() || null,
        ebook_file_url: bookForm.ebook_file_url.trim() || null,
        cover_url: bookForm.cover_url.trim() || null,
        description: bookForm.description.trim() || null,
        total_copies: copies,
      },
      'Buku berhasil ditambahkan ke katalog.'
    );
    if (ok) {
      setBookForm({
        ...bookForm,
        title: '',
        author: '',
        isbn: '',
        category: '',
        total_copies: 3,
        ebook_file_url: '',
        cover_url: '',
        description: '',
        is_premium: false,
      });
    }
  }

  async function handleGrantPremium(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!grantForm.book_id || !grantForm.user_id) {
      showToast('Pilih buku premium dan pengguna penerima izin.', 'error');
      return;
    }
    const dur = Number(grantForm.duration_value);
    if (!Number.isInteger(dur) || dur < 1 || dur > 8760) {
      showToast('Durasi izin harus berupa bilangan bulat antara 1 sampai 8760.', 'error');
      return;
    }
    const ok = await postLib(
      {
        action: 'GRANT_PREMIUM_ACCESS',
        book_id: grantForm.book_id,
        user_id: grantForm.user_id,
        duration_value: dur,
        duration_unit: grantForm.duration_unit,
        notes: grantForm.notes.trim() || null,
      },
      'Izin baca buku premium berhasil diberikan.'
    );
    if (ok) {
      setGrantForm((prev) => ({ ...prev, notes: '' }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Katalog Perpustakaan &amp; E-Book</span>
            </h1>
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Jelajahi koleksi buku fisik &amp; e-book digital, baca langsung di Flipbook Reader,
            dan kelola izin akses buku premium.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">E-Book: </span>
            <span className="font-bold text-emerald-800">{catalogSummary.ebookCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px]">
            <span className="text-slate-500">Premium: </span>
            <span className="font-bold text-amber-800">{catalogSummary.premiumCount}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang katalog perpustakaan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {canManage && showAddBookForm && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-sm font-bold text-slate-900">
                  Tambah Koleksi Buku / E-Book
                </h2>
                <p className="text-[11px] text-slate-500">
                  Tambahkan buku fisik, e-book PDF, atau keduanya ke katalog perpustakaan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBookForm(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold shrink-0 transition"
                title="Sembunyikan form tambah koleksi"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Sembunyikan</span>
              </button>
            </div>
            <form onSubmit={handleAddBook} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="lib-book-title"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Judul Buku / E-Book
                </label>
                <input
                  id="lib-book-title"
                  required
                  minLength={2}
                  disabled={submittingAction === 'ADD_BOOK'}
                  placeholder="Judul Buku / E-Book"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="lib-book-author"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Penulis / Pengarang
                </label>
                <input
                  id="lib-book-author"
                  required
                  minLength={2}
                  disabled={submittingAction === 'ADD_BOOK'}
                  placeholder="Penulis / Pengarang"
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="lib-book-format"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Format Buku
                  </label>
                  <select
                    id="lib-book-format"
                    disabled={submittingAction === 'ADD_BOOK'}
                    value={bookForm.book_format}
                    onChange={(e) =>
                      setBookForm({
                        ...bookForm,
                        book_format: e.target.value as BookFormat,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  >
                    <option value="KEDUANYA">Fisik &amp; E-Book</option>
                    <option value="FISIK">Fisik Saja</option>
                    <option value="EBOOK">E-Book Saja</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="lib-book-copies"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Jumlah Eksemplar
                  </label>
                  <input
                    id="lib-book-copies"
                    type="number"
                    min={1}
                    required
                    disabled={submittingAction === 'ADD_BOOK'}
                    value={bookForm.total_copies}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBookForm({
                        ...bookForm,
                        total_copies: Number.isFinite(val) ? Math.max(1, val) : 1,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="lib-book-isbn"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    ISBN (Opsional)
                  </label>
                  <input
                    id="lib-book-isbn"
                    disabled={submittingAction === 'ADD_BOOK'}
                    placeholder="mis. 978-602-..."
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="lib-book-category"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Kategori (Opsional)
                  </label>
                  <input
                    id="lib-book-category"
                    disabled={submittingAction === 'ADD_BOOK'}
                    placeholder="mis. Pelajaran, Fiksi, Referensi"
                    value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="lib-book-cover"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  URL Cover Buku (JPG/PNG, Opsional)
                </label>
                <input
                  id="lib-book-cover"
                  disabled={submittingAction === 'ADD_BOOK'}
                  placeholder="https://..."
                  value={bookForm.cover_url}
                  onChange={(e) => setBookForm({ ...bookForm, cover_url: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              {bookForm.book_format !== 'FISIK' && (
                <div className="space-y-1">
                  <label
                    htmlFor="lib-book-ebook"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    URL E-Book PDF
                  </label>
                  <input
                    id="lib-book-ebook"
                    disabled={submittingAction === 'ADD_BOOK'}
                    placeholder="https://..."
                    value={bookForm.ebook_file_url}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, ebook_file_url: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="lib-book-desc"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  id="lib-book-desc"
                  rows={2}
                  disabled={submittingAction === 'ADD_BOOK'}
                  placeholder="Deskripsi singkat buku (opsional)"
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium py-1 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={submittingAction === 'ADD_BOOK'}
                  checked={bookForm.is_premium}
                  onChange={(e) => setBookForm({ ...bookForm, is_premium: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Tandai sebagai Buku Premium (Butuh Izin Admin)</span>
              </label>

              <button
                type="submit"
                disabled={Boolean(submittingAction)}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'ADD_BOOK' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Simpan Katalog</span>
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManage && showAddBookForm ? 'lg:col-span-7' : 'lg:col-span-12'
            } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Katalog Buku &amp; E-Book ({filteredBooks.length})
              </h2>
              {canManage && !showAddBookForm && (
                <button
                  type="button"
                  onClick={() => setShowAddBookForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tampilkan Form Tambah</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'EBOOK', label: 'E-Book' },
                  { key: 'FISIK', label: 'Fisik' },
                  { key: 'PREMIUM', label: 'Premium' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setBookFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${bookFilter === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <label htmlFor="lib-book-search" className="sr-only">
              Cari judul, penulis, atau kategori buku
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="lib-book-search"
              type="search"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              placeholder="Cari judul buku, penulis, atau kategori..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {canManage && filteredBooks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  Pilih Semua ({filteredBooks.length})
                </span>
              </label>

              {selectedBookIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-600">
                    {selectedBookIds.length} dipilih
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBookIds([])}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition"
                  >
                    Batal Pilih
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(submittingAction)}
                    onClick={() =>
                      onSetDeleteTarget({ mode: 'batch', ids: selectedBookIds })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Terpilih ({selectedBookIds.length})</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {filteredBooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {books.length === 0
                  ? 'Belum ada koleksi buku pada katalog perpustakaan.'
                  : 'Tidak ada buku yang cocok dengan pencarian atau filter.'}
              </p>
              {(bookSearch || bookFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setBookSearch('');
                    setBookFilter('ALL');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter
                </button>
              )}
            </div>
          ) : (
            <div
              className={`grid gap-3.5 max-h-[42rem] overflow-y-auto pr-1 ${
                canManage && showAddBookForm
                  ? 'grid-cols-1 xl:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
              }`}
            >
              {filteredBooks.map((b) => {
                const isEbook = b.book_format === 'EBOOK' || b.book_format === 'KEDUANYA';
                const isSelected = selectedBookIds.includes(b.id);
                const formatLabel =
                  b.book_format === 'KEDUANYA'
                    ? 'Fisik & E-Book'
                    : b.book_format === 'EBOOK'
                    ? 'E-Book'
                    : 'Fisik';
                const formatBadgeClass =
                  b.book_format === 'EBOOK'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : b.book_format === 'KEDUANYA'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200';
                const inStock = b.available_copies > 0;

                return (
                  <article
                    key={b.id}
                    className={`group rounded-2xl bg-white p-4 flex flex-col justify-between gap-3.5 text-xs border transition shadow-xs hover:shadow-md min-w-0 ${
                      isSelected
                        ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-200'
                        : 'border-slate-200/90 hover:border-emerald-300/80'
                    }`}
                  >
                    {/* Top: Cover + Metadata */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        {b.cover_url ? (
                          <img
                            src={b.cover_url}
                            alt={b.title}
                            className="w-16 h-24 sm:w-[72px] sm:h-28 rounded-xl object-cover border border-slate-200 shadow-sm bg-slate-100"
                          />
                        ) : (
                          <div className="w-16 h-24 sm:w-[72px] sm:h-28 rounded-xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-white flex flex-col items-center justify-center p-2 text-center shadow-sm border border-emerald-700/40">
                            <BookOpen className="w-5 h-5 text-emerald-200 mb-1" />
                            <span className="text-[9px] font-bold tracking-wider uppercase text-emerald-100 leading-tight">
                              {b.book_format === 'EBOOK' ? 'E-BOOK' : 'KOLEKSI'}
                            </span>
                          </div>
                        )}
                        {b.is_premium && (
                          <span
                            title="Buku Premium"
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-amber-950 border-2 border-white shadow-xs flex items-center justify-center"
                          >
                            <Crown className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${formatBadgeClass}`}
                            >
                              {formatLabel}
                            </span>
                            {b.category && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold truncate max-w-[120px]">
                                {b.category}
                              </span>
                            )}
                            {b.is_premium && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Premium
                              </span>
                            )}
                          </div>
                          {canManage && (
                            <input
                              type="checkbox"
                              aria-label={`Pilih buku ${b.title}`}
                              checked={isSelected}
                              onChange={() => toggleBookSelection(b.id)}
                              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                            />
                          )}
                        </div>

                        <div>
                          <h3
                            className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 break-words"
                            title={b.title}
                          >
                            {b.title}
                          </h3>
                          <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                            {b.author}
                          </p>
                        </div>

                        {b.description && (
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 break-words">
                            {b.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Middle: Info & Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          inStock ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            inStock ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        Tersedia {b.available_copies}/{b.total_copies} eks.
                      </span>

                      {b.grant_expires_at ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <Clock className="w-3 h-3 shrink-0" />
                          Izin s/d {new Date(b.grant_expires_at).toLocaleDateString('id-ID')}
                        </span>
                      ) : isEbook && !b.has_ebook ? (
                        <span className="text-slate-400 italic">PDF belum ditautkan</span>
                      ) : isEbook && b.has_ebook ? (
                        <span className="text-sky-700 font-semibold">Flipbook Siap Baca</span>
                      ) : null}
                    </div>

                    {/* Bottom: Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {canManage && isEbook && (
                          <button
                            type="button"
                            aria-busy={submittingAction === 'TOGGLE_BOOK_PREMIUM' || undefined}
                            disabled={Boolean(submittingAction)}
                            onClick={() =>
                              void postLib(
                                {
                                  action: 'TOGGLE_BOOK_PREMIUM',
                                  book_id: b.id,
                                  is_premium: !b.is_premium,
                                },
                                b.is_premium
                                  ? 'Status buku premium dinonaktifkan.'
                                  : 'Buku ditandai sebagai Buku Premium.'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] transition disabled:opacity-60"
                            title={b.is_premium ? 'Hapus status premium' : 'Tandai sebagai buku premium'}
                          >
                            {submittingAction === 'TOGGLE_BOOK_PREMIUM' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Crown className="w-3 h-3" />
                            )}
                            <span>{b.is_premium ? 'Non-Premium' : 'Set Premium'}</span>
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(submittingAction)}
                              onClick={() => onOpenEditBook(b)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-[11px] transition disabled:opacity-60"
                              title="Edit buku"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(submittingAction)}
                              onClick={() => onSetDeleteTarget({ mode: 'single', book: b })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition disabled:opacity-60"
                              title="Hapus buku"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>

                      {isEbook && b.has_ebook && (
                        b.has_premium_access ? (
                          <button
                            type="button"
                            onClick={() => onOpenReader(b)}
                            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-xs transition"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Baca E-Book</span>
                          </button>
                        ) : (
                          <span className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[11px]">
                            <Lock className="w-3 h-3 text-amber-600" /> Butuh Izin Admin
                          </span>
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Manajemen Izin Baca Buku Premium (Khusus Admin / Pustakawan) */}
      {canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Izin Baca Buku Premium (Berdurasi)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Berikan izin membaca buku premium kepada pengguna tertentu dengan durasi waktu
                (Jam atau Hari) yang dapat diatur oleh Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGrantForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shrink-0 transition"
            >
              {showGrantForm ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Sembunyikan Form</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Tampilkan Form</span>
                </>
              )}
            </button>
          </div>

          {showGrantForm && (
            <form
              onSubmit={handleGrantPremium}
              className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70"
            >
              <div className="min-w-0">
                <label
                  htmlFor="lib-grant-book"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Buku Premium
                </label>
                <select
                  id="lib-grant-book"
                  required
                  disabled={submittingAction === 'GRANT_PREMIUM_ACCESS'}
                  value={grantForm.book_id}
                  onChange={(e) => setGrantForm({ ...grantForm, book_id: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Buku Premium --</option>
                  {premiumBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="lib-grant-user"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Pengguna Penerima Izin
                </label>
                <select
                  id="lib-grant-user"
                  required
                  disabled={submittingAction === 'GRANT_PREMIUM_ACCESS'}
                  value={grantForm.user_id}
                  onChange={(e) => setGrantForm({ ...grantForm, user_id: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Pengguna --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="lib-grant-duration"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Durasi
                  </label>
                  <input
                    id="lib-grant-duration"
                    type="number"
                    min={1}
                    max={8760}
                    required
                    disabled={submittingAction === 'GRANT_PREMIUM_ACCESS'}
                    value={grantForm.duration_value}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGrantForm({
                        ...grantForm,
                        duration_value: Number.isFinite(val) ? val : 1,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="lib-grant-unit"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Satuan
                  </label>
                  <select
                    id="lib-grant-unit"
                    disabled={submittingAction === 'GRANT_PREMIUM_ACCESS'}
                    value={grantForm.duration_unit}
                    onChange={(e) =>
                      setGrantForm({
                        ...grantForm,
                        duration_unit: e.target.value as DurationUnit,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs disabled:bg-slate-100"
                  >
                    <option value="HARI">Hari</option>
                    <option value="JAM">Jam</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="lib-grant-notes"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Catatan (Opsional)
                </label>
                <input
                  id="lib-grant-notes"
                  disabled={submittingAction === 'GRANT_PREMIUM_ACCESS'}
                  placeholder="Alasan / keterangan izin"
                  value={grantForm.notes}
                  onChange={(e) => setGrantForm({ ...grantForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={Boolean(submittingAction) || premiumBooks.length === 0}
                className="inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'GRANT_PREMIUM_ACCESS' && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Berikan Izin</span>
              </button>
            </form>
          )}

          {grants.length > 0 && (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2.5">
                {grants.map((g) => {
                  const expired = new Date(g.expires_at).getTime() <= nowMs;
                  const active = !g.is_revoked && !expired;
                  return (
                    <div
                      key={g.id}
                      className="modular-card rounded-xl p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 break-words">
                            {g.user?.full_name || g.user_id}
                          </p>
                          <p className="text-[11px] text-slate-600 break-words">
                            {g.book?.title || g.book_id}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                          {g.is_revoked ? 'Dicabut' : expired ? 'Kedaluwarsa' : 'Aktif'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {g.duration_hours} jam
                        </span>
                        <span>s/d {new Date(g.expires_at).toLocaleString('id-ID')}</span>
                      </div>
                      {active && (
                        <button
                          type="button"
                          aria-busy={submittingAction === 'REVOKE_PREMIUM_ACCESS' || undefined}
                          disabled={Boolean(submittingAction)}
                          onClick={() =>
                            void postLib(
                              { action: 'REVOKE_PREMIUM_ACCESS', grant_id: g.id },
                              'Izin baca buku premium berhasil dicabut.'
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold text-[11px] transition disabled:opacity-60"
                        >
                          {submittingAction === 'REVOKE_PREMIUM_ACCESS' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}{' '}
                          Cabut Izin
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Pengguna</th>
                      <th className="py-2 px-3">Buku Premium</th>
                      <th className="py-2 px-3">Durasi</th>
                      <th className="py-2 px-3">Berlaku Hingga</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grants.map((g) => {
                      const expired = new Date(g.expires_at).getTime() <= nowMs;
                      const active = !g.is_revoked && !expired;
                      return (
                        <tr key={g.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {g.user?.full_name || g.user_id}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {g.book?.title || g.book_id}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {g.duration_hours} jam
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {new Date(g.expires_at).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                              {g.is_revoked ? 'Dicabut' : expired ? 'Kedaluwarsa' : 'Aktif'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {active && (
                              <button
                                type="button"
                                aria-busy={submittingAction === 'REVOKE_PREMIUM_ACCESS' || undefined}
                                disabled={Boolean(submittingAction)}
                                onClick={() =>
                                  void postLib(
                                    { action: 'REVOKE_PREMIUM_ACCESS', grant_id: g.id },
                                    'Izin baca buku premium berhasil dicabut.'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold text-[11px] disabled:opacity-60"
                              >
                                {submittingAction === 'REVOKE_PREMIUM_ACCESS' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}{' '}
                                Cabut
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
