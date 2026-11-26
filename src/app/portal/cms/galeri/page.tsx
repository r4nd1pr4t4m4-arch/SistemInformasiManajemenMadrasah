'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

export default function CmsGaleriPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/gallery', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
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
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm('Hapus item galeri ini?')) return;
    const res = await fetch(`/api/cms/gallery?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Item galeri berhasil dihapus.');
      await loadItems();
    } else {
      showToast('Gagal menghapus item galeri.', 'err');
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-700" />
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
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Judul Kegiatan / Media *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="mis. Wisuda Tahfidz Angkatan 2026"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Media *</label>
                <select
                  value={form.media_type}
                  onChange={(e) =>
                    setForm({ ...form, media_type: e.target.value as GalleryItem['media_type'] })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="FOTO">Foto</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="VIDEO_PROFIL">Video Profil (MP4/URL)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Kegiatan</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">URL Media (Gambar / YouTube / Video) *</label>
              <input
                required
                value={form.media_url}
                onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">URL Thumbnail (Opsional)</label>
              <input
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Deskripsi Singkat</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Keterangan singkat dokumentasi..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Simpan Perubahan' : 'Publikasikan ke Galeri'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Daftar Galeri ({items.length})</h2>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Memuat galeri...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada item galeri yang dipublikasikan.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="modular-card rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200/80">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                    {item.media_type === 'FOTO' ? <ImageIcon className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                    {item.media_type}
                  </span>
                  <span className="text-[11px] text-slate-400">{item.event_date || '-'}</span>
                </div>
                <p className="font-bold text-slate-900 line-clamp-2">{item.title}</p>
                {item.description && <p className="text-slate-600 line-clamp-2">{item.description}</p>}
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
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-semibold"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
