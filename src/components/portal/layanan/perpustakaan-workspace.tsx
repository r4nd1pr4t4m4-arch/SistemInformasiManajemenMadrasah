'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { DigitalLibraryCard } from '@/components/portal/cards/digital-card-viewer';
import { FlipbookReader } from '@/components/elibrary/flipbook-reader';

interface BookRow {
  id: string;
  title: string;
  author: string;
  category?: string | null;
  cover_url?: string | null;
  description?: string | null;
  book_format: string;
  available_copies: number;
  total_copies: number;
  has_ebook?: boolean;
  is_premium?: boolean;
  has_premium_access?: boolean;
  grant_expires_at?: string | null;
}

interface GrantRow {
  id: string;
  book_id: string;
  user_id: string;
  duration_hours: number;
  starts_at: string;
  expires_at: string;
  is_revoked: boolean;
  notes?: string | null;
  book?: { id: string; title: string; is_premium: boolean } | null;
  user?: { id: string; full_name: string; email: string } | null;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
}

interface MemberRow {
  id: string;
  member_code: string;
  member_type: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
  joined_at?: string | null;
  is_auto_registered: boolean;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export type PerpustakaanSection = 'katalog' | 'anggota';

export function PerpustakaanWorkspace({ section }: { section: PerpustakaanSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.PERPUSTAKAAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [books, setBooks] = useState<BookRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [readingBook, setReadingBook] = useState<BookRow | null>(null);
  const [bookSearch, setBookSearch] = useState('');
  const [bookFilter, setBookFilter] = useState<'ALL' | 'EBOOK' | 'FISIK' | 'PREMIUM'>('ALL');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'ALL' | 'AUTO' | 'UMUM'>('ALL');

  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    category: '',
    book_format: 'KEDUANYA' as 'FISIK' | 'EBOOK' | 'KEDUANYA',
    total_copies: 3,
    ebook_file_url: '',
    cover_url: '',
    description: '',
    is_premium: false,
  });
  const [grantForm, setGrantForm] = useState({
    book_id: '',
    user_id: '',
    duration_value: 7,
    duration_unit: 'HARI' as 'JAM' | 'HARI',
    notes: '',
  });
  const [publicMemberForm, setPublicMemberForm] = useState({
    full_name: '',
    phone: '',
    email: '',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const fetchLibraryData = useCallback(async () => {
    const res = await fetch('/api/layanan/perpustakaan', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error || 'Gagal memuat data perpustakaan dari server.');
    }
    return {
      books: (data.books || []) as BookRow[],
      members: (data.members || []) as MemberRow[],
      grants: (data.grants || []) as GrantRow[],
      users: (data.users || []) as UserOption[],
    };
  }, []);

  const applyLibraryData = useCallback(
    (data: Awaited<ReturnType<typeof fetchLibraryData>>) => {
      setBooks(data.books);
      setMembers(data.members);
      setGrants(data.grants);
      setUsers(data.users);
      setNowMs(Date.now());
      setLoadError(null);
    },
    []
  );

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchLibraryData();
        applyLibraryData(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat perpustakaan.';
        if (mode === 'initial') {
          setLoadError(message);
        } else {
          showToast(message, 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyLibraryData, fetchLibraryData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLibraryData();
        if (!cancelled) {
          applyLibraryData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat perpustakaan.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLibraryData, fetchLibraryData]);

  async function postLib(body: { action?: string;[key: string]: unknown }, msg: string) {
    const actionKey = body.action || 'POST';
    if (submittingAction) return false;
    setSubmittingAction(actionKey);
    try {
      const res = await fetch('/api/layanan/perpustakaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Terjadi kesalahan saat memproses permintaan.', 'error');
        return false;
      }
      showToast(msg, 'success');
      await loadData('refresh');
      return true;
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
      return false;
    } finally {
      setSubmittingAction(null);
    }
  }

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

  const memberSummary = useMemo(() => {
    let autoCount = 0;
    let umumCount = 0;
    for (const m of members) {
      if (m.is_auto_registered) autoCount += 1;
      else umumCount += 1;
    }
    return { autoCount, umumCount };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (memberFilter === 'AUTO' && !m.is_auto_registered) return false;
      if (memberFilter === 'UMUM' && m.is_auto_registered) return false;
      if (q) {
        const haystack = `${m.full_name} ${m.member_code} ${m.member_type} ${m.phone || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [memberFilter, memberSearch, members]);

  async function handleRegisterPublicMember(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    const fullName = publicMemberForm.full_name.trim();
    const phone = publicMemberForm.phone.trim();
    const email = publicMemberForm.email.trim();
    if (fullName.length < 2) {
      showToast('Nama lengkap minimal 2 karakter.', 'error');
      return;
    }
    if (phone.length < 6) {
      showToast('Nomor HP / WhatsApp minimal 6 karakter.', 'error');
      return;
    }
    const ok = await postLib(
      {
        action: 'REGISTER_PUBLIC_MEMBER',
        full_name: fullName,
        phone,
        email,
      },
      'Anggota umum E-Library berhasil didaftarkan.'
    );
    if (ok) {
      setPublicMemberForm({ full_name: '', phone: '', email: '' });
    }
  }

  async function handleAddBook(e: React.FormEvent) {
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
        category: '',
        total_copies: 3,
        ebook_file_url: '',
        cover_url: '',
        description: '',
        is_premium: false,
      });
    }
  }

  async function handleGrantPremium(e: React.FormEvent) {
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat perpustakaan digital...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Perpustakaan</h1>
          <p className="text-xs text-slate-500">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData('refresh')}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>
    );
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId) || members[0] || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 shadow-sm ${toast.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      )}

      {section === 'katalog' && (
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
                onClick={() => void loadData('refresh')}
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
            {canManage && (
              <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Tambah Koleksi Buku / E-Book
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Tambahkan buku fisik, e-book PDF, atau keduanya ke katalog perpustakaan.
                  </p>
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
                            book_format: e.target.value as typeof bookForm.book_format,
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
              className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'
                } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Katalog Buku &amp; E-Book ({filteredBooks.length})
                </h2>

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
                <div className="space-y-2.5 max-h-[34rem] overflow-y-auto pr-0.5">
                  {filteredBooks.map((b) => {
                    const isEbook = b.book_format === 'EBOOK' || b.book_format === 'KEDUANYA';
                    return (
                      <div
                        key={b.id}
                        className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {b.cover_url ? (
                            <img
                              src={b.cover_url}
                              alt={b.title}
                              className="w-10 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-emerald-900 text-white text-[9px] font-bold flex items-center justify-center p-1 text-center shrink-0">
                              BUKU
                            </div>
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 break-words">{b.title}</p>
                              {b.is_premium && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
                                  <Crown className="w-3 h-3" /> PREMIUM
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 break-words">
                              {b.author} • {b.book_format}
                              {b.category ? ` • ${b.category}` : ''}
                              {b.grant_expires_at
                                ? ` • Izin s/d ${new Date(b.grant_expires_at).toLocaleString('id-ID')}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                            Tersedia: {b.available_copies}/{b.total_copies}
                          </span>
                          {canManage && isEbook && (
                            <button
                              type="button"
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
                              className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] transition disabled:opacity-60"
                            >
                              {b.is_premium ? 'Hapus Premium' : 'Set Premium'}
                            </button>
                          )}
                          {isEbook && b.has_ebook && (
                            b.has_premium_access ? (
                              <button
                                type="button"
                                onClick={() => setReadingBook(b)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                              >
                                <BookOpen className="w-3 h-3" /> Baca Buku
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[11px]">
                                <Lock className="w-3 h-3 text-amber-600" /> Butuh Izin Admin
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Manajemen Izin Baca Buku Premium (Khusus Admin / Pustakawan) */}
          {canManage && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Izin Baca Buku Premium (Berdurasi)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berikan izin membaca buku premium kepada pengguna tertentu dengan durasi waktu
                  (Jam atau Hari) yang dapat diatur oleh Admin.
                </p>
              </div>

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
                          duration_unit: e.target.value as 'JAM' | 'HARI',
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
                              disabled={Boolean(submittingAction)}
                              onClick={() =>
                                void postLib(
                                  { action: 'REVOKE_PREMIUM_ACCESS', grant_id: g.id },
                                  'Izin baca buku premium berhasil dicabut.'
                                )
                              }
                              className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold text-[11px] transition disabled:opacity-60"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cabut Izin
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
                                    disabled={Boolean(submittingAction)}
                                    onClick={() =>
                                      void postLib(
                                        { action: 'REVOKE_PREMIUM_ACCESS', grant_id: g.id },
                                        'Izin baca buku premium berhasil dicabut.'
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold text-[11px] disabled:opacity-60"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Cabut
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

          {selectedMember && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-sky-700" /> Kartu Anggota E-Library Saya
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pratinjau sisi depan &amp; belakang kartu anggota perpustakaan Anda, siap diunduh
                    sebagai file PNG.
                  </p>
                </div>
              </div>
              <div className="max-w-xl">
                <DigitalLibraryCard member={selectedMember} />
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'anggota' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-700 shrink-0" />
                  <span>Keanggotaan &amp; Kartu E-Library</span>
                </h1>
                {!canManage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Kelola pendaftaran anggota umum E-Library serta pratinjau dan unduh kartu anggota
                perpustakaan digital.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px]">
                <span className="text-slate-500">Otomatis: </span>
                <span className="font-bold text-sky-800">{memberSummary.autoCount}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
                <span className="text-slate-500">Umum: </span>
                <span className="font-bold text-emerald-800">{memberSummary.umumCount}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadData('refresh')}
                disabled={refreshing || Boolean(submittingAction)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                title="Muat ulang daftar anggota perpustakaan"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {canManage && (
              <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Daftar Anggota Umum E-Library
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Warga madrasah/sekolah otomatis terdaftar saat masuk Buku Induk. Masyarakat
                    umum mendaftar di sini untuk akses e-book.
                  </p>
                </div>

                <form onSubmit={handleRegisterPublicMember} className="space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="lib-member-name"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nama Lengkap
                    </label>
                    <input
                      id="lib-member-name"
                      required
                      minLength={2}
                      disabled={submittingAction === 'REGISTER_PUBLIC_MEMBER'}
                      placeholder="Nama Lengkap"
                      value={publicMemberForm.full_name}
                      onChange={(e) =>
                        setPublicMemberForm({ ...publicMemberForm, full_name: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="lib-member-phone"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      No. HP / WhatsApp
                    </label>
                    <input
                      id="lib-member-phone"
                      type="tel"
                      required
                      minLength={6}
                      disabled={submittingAction === 'REGISTER_PUBLIC_MEMBER'}
                      placeholder="mis. 081234567890"
                      value={publicMemberForm.phone}
                      onChange={(e) =>
                        setPublicMemberForm({ ...publicMemberForm, phone: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="lib-member-email"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Email (Opsional)
                    </label>
                    <input
                      id="lib-member-email"
                      type="email"
                      disabled={submittingAction === 'REGISTER_PUBLIC_MEMBER'}
                      placeholder="nama@email.com"
                      value={publicMemberForm.email}
                      onChange={(e) =>
                        setPublicMemberForm({ ...publicMemberForm, email: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={Boolean(submittingAction)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'REGISTER_PUBLIC_MEMBER' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Daftar Anggota Umum</span>
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'
                } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Kartu Anggota Perpustakaan ({filteredMembers.length})
                </h2>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { key: 'ALL', label: 'Semua' },
                      { key: 'AUTO', label: 'Otomatis' },
                      { key: 'UMUM', label: 'Umum' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMemberFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${memberFilter === tab.key
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
                <label htmlFor="lib-member-search" className="sr-only">
                  Cari anggota perpustakaan
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="lib-member-search"
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Cari nama, kode anggota, atau nomor HP..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              {filteredMembers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    {members.length === 0
                      ? 'Belum ada anggota perpustakaan terdaftar.'
                      : 'Tidak ada anggota yang cocok dengan pencarian atau filter.'}
                  </p>
                  {(memberSearch || memberFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemberSearch('');
                        setMemberFilter('ALL');
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Reset pencarian &amp; filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-0.5">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMember?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`w-full text-left modular-card rounded-xl p-3 flex items-center justify-between gap-2.5 text-xs transition border ${isSelected
                          ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-300'
                          : 'border-transparent hover:border-slate-200'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 break-words">{m.full_name}</p>
                          <p className="font-mono text-[11px] text-emerald-700 break-all">
                            {m.member_code}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px]">
                          {m.member_type} {m.is_auto_registered ? '(Otomatis)' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedMember && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>Pratinjau &amp; Unduh Kartu Perpustakaan (PNG)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Klik salah satu anggota di atas untuk menampilkan kartu depan &amp; belakangnya.
                  </p>
                </div>
                <div className="w-full sm:w-auto min-w-0">
                  <label htmlFor="lib-member-preview-select" className="sr-only">
                    Pilih anggota untuk pratinjau kartu
                  </label>
                  <select
                    id="lib-member-preview-select"
                    value={selectedMember.id}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full sm:w-72 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.member_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="max-w-xl">
                <DigitalLibraryCard member={selectedMember} />
              </div>
            </div>
          )}
        </div>
      )}

      {readingBook && (
        <FlipbookReader
          bookId={readingBook.id}
          bookTitle={readingBook.title}
          author={readingBook.author}
          isPublicMode={false}
          isPremium={Boolean(readingBook.is_premium)}
          grantExpiresAt={readingBook.grant_expires_at}
          onClose={() => setReadingBook(null)}
        />
      )}
    </div>
  );
}
