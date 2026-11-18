'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import type { PostItem } from '@/types/database';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

export default function CmsBeritaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [newPost, setNewPost] = useState({
    title: '',
    category: 'BERITA' as PostItem['category'],
    excerpt: '',
    content: '',
    author_display_name: 'Humas Lembaga',
  });

  useEffect(() => {
    fetch('/api/cms/posts')
      .then((res) => res.json())
      .then((data) => {
        if (data.posts) setPosts(data.posts);
      })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/cms/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPost, status: 'PUBLISHED' }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setPosts((prev) => [data.post, ...prev]);
        setNewPost({
          title: '',
          category: 'BERITA',
          excerpt: '',
          content: '',
          author_display_name: 'Humas Lembaga',
        });
        showToast('Artikel berhasil dipublikasikan.');
      } else {
        showToast(data.error || 'Gagal membuat artikel.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePost(id: string) {
    const res = await fetch(`/api/cms/posts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      showToast('Artikel dihapus.');
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar berita &amp; artikel...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {canManage && (
        <form
          onSubmit={handleCreatePost}
          className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-4 h-fit"
        >
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-700" /> Publikasi Konten Baru
          </h1>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul</label>
            <input
              required
              type="text"
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
            <select
              value={newPost.category}
              onChange={(e) =>
                setNewPost({ ...newPost, category: e.target.value as PostItem['category'] })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="BERITA">Berita</option>
              <option value="ARTIKEL">Artikel</option>
              <option value="PENGUMUMAN">Pengumuman</option>
              <option value="KARYA_GURU">Karya Tulis Guru</option>
              <option value="KARYA_SISWA">Karya Tulis Siswa</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ringkasan</label>
            <input
              type="text"
              value={newPost.excerpt}
              onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Isi Konten</label>
            <textarea
              required
              rows={4}
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-2xl text-sm"
          >
            Terbitkan Konten
          </button>
        </form>
        )}

        <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
          {posts.length === 0 ? (
            <div className="glass-card rounded-3xl p-6 text-sm text-slate-600">
              Belum ada artikel yang diterbitkan.
            </div>
          ) : (
            posts.map((p) => (
              <div
                key={p.id}
                className="modular-card rounded-2xl p-5 flex items-start justify-between gap-4"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    {p.category.replace('_', ' ')}
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-1.5">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.excerpt}</p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(p.id)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
