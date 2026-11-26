'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import type {
  BookFormat,
  BookFormState,
  BookRow,
  DeleteTarget,
  GrantRow,
  LoanRow,
  MemberRow,
  PerpustakaanSection,
  ToastState,
  UserOption,
} from './perpustakaan/types';
import { KatalogSection } from './perpustakaan/katalog-section';
import { AnggotaSection } from './perpustakaan/anggota-section';
import { SirkulasiSection } from './perpustakaan/sirkulasi-section';
import { PerpustakaanModals } from './perpustakaan/perpustakaan-modals';

export type { PerpustakaanSection };

export function PerpustakaanWorkspace({ section }: { section: PerpustakaanSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.PERPUSTAKAAN_MANAGE);
  const canViewAllMembers = hasPermission(PERMISSIONS.PERPUSTAKAAN_ANGGOTA_VIEW);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [books, setBooks] = useState<BookRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [readingBook, setReadingBook] = useState<BookRow | null>(null);
  const [editingBook, setEditingBook] = useState<BookRow | null>(null);
  const [editBookForm, setEditBookForm] = useState<BookFormState>({
    title: '',
    author: '',
    isbn: '',
    category: '',
    book_format: 'KEDUANYA',
    total_copies: 1,
    ebook_file_url: '',
    cover_url: '',
    description: '',
    is_premium: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

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
      loans: (data.loans || []) as LoanRow[],
      grants: (data.grants || []) as GrantRow[],
      users: (data.users || []) as UserOption[],
    };
  }, []);

  const applyLibraryData = useCallback(
    (data: Awaited<ReturnType<typeof fetchLibraryData>>) => {
      setBooks(data.books);
      setMembers(data.members);
      setLoans(data.loans);
      setGrants(data.grants);
      setUsers(data.users);
      setSelectedBookIds((prev) => {
        const validIds = new Set(data.books.map((b) => b.id));
        return prev.filter((id) => validIds.has(id));
      });
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

  async function postLib(body: { action?: string; [key: string]: unknown }, msg: string) {
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

  function openEditBookModal(book: BookRow) {
    setEditingBook(book);
    setEditBookForm({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      category: book.category || '',
      book_format: (book.book_format === 'FISIK' || book.book_format === 'EBOOK'
        ? book.book_format
        : 'KEDUANYA') as BookFormat,
      total_copies: Math.max(1, Number(book.total_copies || 1)),
      ebook_file_url: book.ebook_file_url || '',
      cover_url: book.cover_url || '',
      description: book.description || '',
      is_premium: Boolean(book.is_premium),
    });
  }

  async function handleUpdateBook(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !editingBook || submittingAction) return;
    const title = editBookForm.title.trim();
    const author = editBookForm.author.trim();
    if (title.length < 2) {
      showToast('Judul buku minimal 2 karakter.', 'error');
      return;
    }
    if (author.length < 2) {
      showToast('Nama penulis minimal 2 karakter.', 'error');
      return;
    }
    const copies = Number.isFinite(editBookForm.total_copies)
      ? Math.max(1, Math.round(editBookForm.total_copies))
      : 1;

    const ok = await postLib(
      {
        action: 'UPDATE_BOOK',
        book_id: editingBook.id,
        title,
        author,
        isbn: editBookForm.isbn.trim() || null,
        category: editBookForm.category.trim() || null,
        book_format: editBookForm.book_format,
        total_copies: copies,
        ebook_file_url: editBookForm.ebook_file_url.trim() || null,
        cover_url: editBookForm.cover_url.trim() || null,
        description: editBookForm.description.trim() || null,
        is_premium: editBookForm.is_premium,
      },
      'Data koleksi buku berhasil diperbarui.'
    );
    if (ok) {
      setEditingBook(null);
    }
  }

  async function handleConfirmDeleteBook() {
    if (!canManage || !deleteTarget || submittingAction) return;
    if (deleteTarget.mode === 'single') {
      const ok = await postLib(
        { action: 'DELETE_BOOK', book_id: deleteTarget.book.id },
        `Buku "${deleteTarget.book.title}" berhasil dihapus dari katalog.`
      );
      if (ok) {
        setDeleteTarget(null);
      }
      return;
    }

    const ok = await postLib(
      { action: 'DELETE_BOOKS_BATCH', book_ids: deleteTarget.ids },
      `${deleteTarget.ids.length} buku berhasil dihapus dari katalog.`
    );
    if (ok) {
      setSelectedBookIds([]);
      setDeleteTarget(null);
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start gap-2.5 shadow-xl backdrop-blur-md transition-all ${toast.type === 'error'
            ? 'bg-rose-50/95 border-rose-200 text-rose-950'
            : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
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
        <KatalogSection
          books={books}
          grants={grants}
          users={users}
          nowMs={nowMs}
          canManage={canManage}
          refreshing={refreshing}
          submittingAction={submittingAction}
          selectedBookIds={selectedBookIds}
          setSelectedBookIds={setSelectedBookIds}
          onRefresh={() => void loadData('refresh')}
          postLib={postLib}
          showToast={showToast}
          onOpenEditBook={openEditBookModal}
          onSetDeleteTarget={setDeleteTarget}
          onOpenReader={setReadingBook}
        />
      )}

      {section === 'anggota' && (
        <AnggotaSection
          members={members}
          canManage={canManage}
          canViewAllMembers={canViewAllMembers}
          refreshing={refreshing}
          submittingAction={submittingAction}
          onRefresh={() => void loadData('refresh')}
          postLib={postLib}
          showToast={showToast}
        />
      )}

      {section === 'sirkulasi' && (
        <SirkulasiSection
          books={books}
          members={members}
          loans={loans}
          canManage={canManage}
          refreshing={refreshing}
          submittingAction={submittingAction}
          onRefresh={() => void loadData('refresh')}
          postLib={postLib}
          showToast={showToast}
        />
      )}

      <PerpustakaanModals
        canManage={canManage}
        submittingAction={submittingAction}
        editingBook={editingBook}
        editBookForm={editBookForm}
        setEditBookForm={setEditBookForm}
        onCloseEditBook={() => setEditingBook(null)}
        onUpdateBook={(e) => void handleUpdateBook(e)}
        deleteTarget={deleteTarget}
        onCloseDeleteModal={() => setDeleteTarget(null)}
        onConfirmDeleteBook={() => void handleConfirmDeleteBook()}
        readingBook={readingBook}
        onCloseReader={() => setReadingBook(null)}
      />
    </div>
  );
}
