'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface GalleryItem {
  id: string;
  title: string;
  media_type: 'FOTO' | 'VIDEO_PROFIL' | 'YOUTUBE';
  media_url: string;
  thumbnail_url: string | null;
  description: string | null;
  event_date: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  title: '',
  media_type: 'FOTO' as 'FOTO' | 'VIDEO_PROFIL' | 'YOUTUBE',
  media_url: '',
  thumbnail_url: '',
  description: '',
  event_date: '',
};

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition';

export default function CmsGaleriPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<GalleryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteItem, deletingId]);

  const loadItems = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/cms/gallery', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        setItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setLoadError(data.error || 'Gagal memuat daftar galeri.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat galeri.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cms/gallery', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan media galeri.', 'err');
        return;
      }
      showToast(editingId ? 'Item galeri berhasil diperbarui.' : 'Item galeri berhasil ditambahkan.');
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadItems();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan media galeri.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GalleryItem) {
    if (!canManage || deletingId) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/cms/gallery?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeleteItem(null);
        if (editingId === item.id) {
          setEditingId(null);
          setForm(EMPTY_FORM);
        }
        showToast('Item galeri berhasil dihapus.');
        await loadItems();
      } else {
        showToast(data.error || 'Gagal menghapus item galeri.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus item galeri.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="[overflow-wrap:anywhere]">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>{editingId ? 'Edit Item Galeri' : 'Tambah Foto / Video Galeri Publik'}</span>
              </h1>
              <p className="text-xs text-slate-500">
                Kelola dokumentasi foto kegiatan, video profil, dan tautan YouTube yang tampil di halaman /galeri.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Judul Kegiatan / Media *
              </label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="mis. Wisuda Tahfidz Angkatan 2026"
                className={INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Media *
                </label>
                <select
                  value={form.media_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      media_type: e.target.value as GalleryItem['media_type'],
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="FOTO">Foto</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="VIDEO_PROFIL">Video Profil (MP4/URL)</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Kegiatan
                </label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, event_date: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL Media (Gambar / YouTube / Video) *
              </label>
              <input
                required
                value={form.media_url}
                onChange={(e) => setForm((prev) => ({ ...prev, media_url: e.target.value }))}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL Thumbnail (Opsional)
              </label>
              <input
                value={form.thumbnail_url}
                onChange={(e) => setForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi Singkat
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Keterangan singkat dokumentasi..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{editingId ? 'Simpan Perubahan' : 'Publikasikan ke Galeri'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Daftar Galeri ({items.length})</h2>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadItems()}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadItems()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat galeri...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada item galeri yang dipublikasikan.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80 min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                    {item.media_type === 'FOTO' ? (
                      <ImageIcon className="w-3 h-3" />
                    ) : (
                      <Video className="w-3 h-3" />
                    )}
                    {item.media_type}
                  </span>
                  <span className="text-[11px] text-slate-400">{item.event_date || '-'}</span>
                </div>
                <p className="font-bold text-slate-900 line-clamp-2 [overflow-wrap:anywhere]">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-slate-600 line-clamp-2 [overflow-wrap:anywhere]">
                    {item.description}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 truncate">{item.media_url}</p>
                {canManage && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          title: item.title,
                          media_type: item.media_type,
                          media_url: item.media_url,
                          thumbnail_url: item.thumbnail_url || '',
                          description: item.description || '',
                          event_date: item.event_date || '',
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-semibold transition"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => setConfirmDeleteItem(item)}
                      className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold disabled:opacity-50 transition"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-gallery-title"
          onClick={() => {
            if (!deletingId) setConfirmDeleteItem(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="delete-gallery-title" className="text-base font-bold text-slate-900">
              Hapus Item Galeri?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Media <strong>&ldquo;{confirmDeleteItem.title}&rdquo;</strong> akan dihapus permanen
              dari galeri publik.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteItem(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDelete(confirmDeleteItem)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
