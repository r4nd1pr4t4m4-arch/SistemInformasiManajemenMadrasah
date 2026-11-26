'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Crown, Loader2, Save, Trash2, X } from 'lucide-react';
import { FlipbookReader } from '@/components/elibrary/flipbook-reader';
import type { BookFormat, BookFormState, BookRow, DeleteTarget } from './types';

interface PerpustakaanModalsProps {
  canManage: boolean;
  submittingAction: string | null;
  editingBook: BookRow | null;
  editBookForm: BookFormState;
  setEditBookForm: Dispatch<SetStateAction<BookFormState>>;
  onCloseEditBook: () => void;
  onUpdateBook: (e: FormEvent) => void;
  deleteTarget: DeleteTarget | null;
  onCloseDeleteModal: () => void;
  onConfirmDeleteBook: () => void;
  readingBook: BookRow | null;
  onCloseReader: () => void;
}

export function PerpustakaanModals({
  canManage,
  submittingAction,
  editingBook,
  editBookForm,
  setEditBookForm,
  onCloseEditBook,
  onUpdateBook,
  deleteTarget,
  onCloseDeleteModal,
  onConfirmDeleteBook,
  readingBook,
  onCloseReader,
}: PerpustakaanModalsProps) {
  return (
    <>
      {/* Modal Edit Buku */}
      {canManage && editingBook && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-book-modal-title"
          onClick={() => {
            if (submittingAction !== 'UPDATE_BOOK') onCloseEditBook();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-book-modal-title" className="text-base font-bold text-slate-900">
                  Edit Koleksi Buku / E-Book
                </h2>
                <p className="text-xs text-slate-500">
                  Perbarui informasi katalog buku yang dipilih.
                </p>
              </div>
              <button
                type="button"
                disabled={submittingAction === 'UPDATE_BOOK'}
                onClick={onCloseEditBook}
                aria-label="Tutup modal edit buku"
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onUpdateBook} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="edit-book-title"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Judul Buku / E-Book
                </label>
                <input
                  id="edit-book-title"
                  required
                  minLength={2}
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  value={editBookForm.title}
                  onChange={(e) => setEditBookForm({ ...editBookForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-book-author"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Penulis / Pengarang
                </label>
                <input
                  id="edit-book-author"
                  required
                  minLength={2}
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  value={editBookForm.author}
                  onChange={(e) => setEditBookForm({ ...editBookForm, author: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-book-isbn"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  ISBN (Opsional)
                </label>
                <input
                  id="edit-book-isbn"
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  placeholder="mis. 978-602-..."
                  value={editBookForm.isbn}
                  onChange={(e) => setEditBookForm({ ...editBookForm, isbn: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-book-format"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Format Buku
                  </label>
                  <select
                    id="edit-book-format"
                    disabled={submittingAction === 'UPDATE_BOOK'}
                    value={editBookForm.book_format}
                    onChange={(e) =>
                      setEditBookForm({
                        ...editBookForm,
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
                    htmlFor="edit-book-copies"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Jumlah Eksemplar
                  </label>
                  <input
                    id="edit-book-copies"
                    type="number"
                    min={1}
                    required
                    disabled={submittingAction === 'UPDATE_BOOK'}
                    value={editBookForm.total_copies}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditBookForm({
                        ...editBookForm,
                        total_copies: Number.isFinite(val) ? Math.max(1, val) : 1,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-book-category"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Kategori (Opsional)
                </label>
                <input
                  id="edit-book-category"
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  placeholder="mis. Pelajaran, Fiksi, Referensi"
                  value={editBookForm.category}
                  onChange={(e) => setEditBookForm({ ...editBookForm, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-book-cover"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  URL Cover Buku (Opsional)
                </label>
                <input
                  id="edit-book-cover"
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  placeholder="https://..."
                  value={editBookForm.cover_url}
                  onChange={(e) => setEditBookForm({ ...editBookForm, cover_url: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              {editBookForm.book_format !== 'FISIK' && (
                <div className="space-y-1">
                  <label
                    htmlFor="edit-book-ebook"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    URL E-Book PDF
                  </label>
                  <input
                    id="edit-book-ebook"
                    disabled={submittingAction === 'UPDATE_BOOK'}
                    placeholder="https://..."
                    value={editBookForm.ebook_file_url}
                    onChange={(e) =>
                      setEditBookForm({ ...editBookForm, ebook_file_url: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="edit-book-desc"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  id="edit-book-desc"
                  rows={2}
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  value={editBookForm.description}
                  onChange={(e) =>
                    setEditBookForm({ ...editBookForm, description: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium py-1 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  checked={editBookForm.is_premium}
                  onChange={(e) =>
                    setEditBookForm({ ...editBookForm, is_premium: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Tandai sebagai Buku Premium (Butuh Izin Admin)</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  disabled={submittingAction === 'UPDATE_BOOK'}
                  onClick={onCloseEditBook}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={Boolean(submittingAction)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-60"
                >
                  {submittingAction === 'UPDATE_BOOK' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Buku (Satuan / Batch) */}
      {canManage && deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-book-modal-title"
          onClick={() => {
            if (!submittingAction) onCloseDeleteModal();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 id="delete-book-modal-title" className="text-base font-bold text-slate-900">
                  {deleteTarget.mode === 'single'
                    ? 'Hapus Koleksi Buku?'
                    : `Hapus ${deleteTarget.ids.length} Buku Terpilih?`}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {deleteTarget.mode === 'single' ? (
                    <>
                      Buku <strong>{deleteTarget.book.title}</strong> akan dihapus permanen dari
                      katalog perpustakaan beserta riwayat izin akses premiumnya.
                    </>
                  ) : (
                    <>
                      Sebanyak <strong>{deleteTarget.ids.length} buku</strong> yang dipilih akan
                      dihapus permanen dari katalog perpustakaan beserta riwayat izin akses
                      premiumnya.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
              <button
                type="button"
                disabled={Boolean(submittingAction)}
                onClick={onCloseDeleteModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(submittingAction)}
                onClick={onConfirmDeleteBook}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-60"
              >
                {(submittingAction === 'DELETE_BOOK' ||
                  submittingAction === 'DELETE_BOOKS_BATCH') && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
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
          onClose={onCloseReader}
        />
      )}
    </>
  );
}
