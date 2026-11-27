'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import type { PostItem } from '@/types/database';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

const CMS_QUICK_LINKS = [
  { href: '/portal/cms/profil', label: 'Identitas & Profil', icon: Building2, active: false },
  { href: '/portal/cms/berita', label: 'Berita & Artikel', icon: Newspaper, active: true },
  { href: '/portal/cms/ppdb', label: 'PPDB Online', icon: UserPlus, active: false },
  { href: '/portal/cms/sarana-prasarana', label: 'Sarana Prasarana', icon: Wrench, active: false },
];

const CATEGORY_OPTIONS: Array<{ value: PostItem['category']; label: string }> = [
  { value: 'BERITA', label: 'Berita' },
  { value: 'ARTIKEL', label: 'Artikel' },
  { value: 'PENGUMUMAN', label: 'Pengumuman' },
  { value: 'KARYA_GURU', label: 'Karya Tulis Guru' },
  { value: 'KARYA_SISWA', label: 'Karya Tulis Siswa' },
];

function formatCategory(cat: string | null | undefined): string {
  if (!cat) return 'UMUM';
  return cat.replace(/_/g, ' ');
}

function formatDateId(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CmsBeritaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePost, setConfirmDeletePost] = useState<PostItem | null>(null);
  const [previewPost, setPreviewPost] = useState<PostItem | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [newPost, setNewPost] = useState({
    title: '',
    category: 'BERITA' as PostItem['category'],
    status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    excerpt: '',
    content: '',
    author_display_name: 'Humas Lembaga',
    cover_image_url: '',
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastBannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/cms/posts', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat daftar artikel.');
        return data;
      })
      .then((data) => {
        setPosts(Array.isArray(data?.posts) ? data.posts : []);
        setLoadError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError((err as Error)?.message || 'Tidak dapat terhubung ke server.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retryTick]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!previewPost && !confirmDeletePost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) {
        setPreviewPost(null);
        setConfirmDeletePost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPost, confirmDeletePost, deletingId]);

  function showToast(type: ToastState['type'], message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    const trimmedTitle = newPost.title.trim();
    const trimmedContent = newPost.content.trim();
    const trimmedExcerpt = newPost.excerpt.trim();
    const trimmedAuthor = newPost.author_display_name.trim() || 'Humas Lembaga';
    const trimmedCover = newPost.cover_image_url.trim();

    if (trimmedTitle.length < 4) {
      showToast('error', 'Judul artikel minimal 4 karakter.');
      return;
    }
    if (trimmedContent.length < 10) {
      showToast('error', 'Isi konten artikel minimal 10 karakter.');
      return;
    }
    if (trimmedCover && !/^https?:\/\//i.test(trimmedCover) && !trimmedCover.startsWith('/')) {
      showToast('error', 'URL gambar sampul harus diawali http://, https://, atau /.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/cms/posts', {
        method: editingPostId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingPostId ? { id: editingPostId } : {}),
          title: trimmedTitle,
          category: newPost.category,
          excerpt: trimmedExcerpt,
          content: trimmedContent,
          author_display_name: trimmedAuthor,
          cover_image_url: trimmedCover || null,
          status: newPost.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.post) {
        if (editingPostId) {
          setPosts((prev) => prev.map((item) => (item.id === editingPostId ? data.post : item)));
          setEditingPostId(null);
          showToast('success', 'Perubahan artikel berhasil disimpan.');
        } else {
          setPosts((prev) => [data.post, ...prev]);
          showToast('success', 'Artikel berhasil disimpan.');
        }
        setNewPost({
          title: '',
          category: 'BERITA',
          status: 'PUBLISHED',
          excerpt: '',
          content: '',
          author_display_name: 'Humas Lembaga',
          cover_image_url: '',
        });
      } else {
        showToast('error', data?.error || 'Gagal membuat artikel.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menerbitkan artikel.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePost(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cms/posts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setConfirmDeletePost(null);
        if (editingPostId === id) {
          setEditingPostId(null);
          setNewPost({
            title: '',
            category: 'BERITA',
            status: 'PUBLISHED',
            excerpt: '',
            content: '',
            author_display_name: 'Humas Lembaga',
            cover_image_url: '',
          });
        }
        showToast('success', 'Artikel berhasil dihapus.');
      } else {
        showToast('error', data?.error || 'Gagal menghapus artikel.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menghapus artikel.');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.excerpt || '').toLowerCase().includes(q) ||
        (p.author_display_name || '').toLowerCase().includes(q)
      );
    });
  }, [posts, searchQuery, categoryFilter]);

  const hasActiveFilter = searchQuery.trim().length > 0 || categoryFilter !== 'ALL';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat daftar berita &amp; artikel...</span>
      </div>
    );
  }

  if (loadError && posts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center space-y-3 border border-rose-200">
        <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
        <h1 className="text-base sm:text-lg font-bold text-slate-900">
          Gagal Memuat Berita &amp; Artikel
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError(null);
            setRetryTick((t) => t + 1);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      {/* Quick CMS Sub-navigation */}
      <nav
        aria-label="Navigasi Modul CMS"
        className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {CMS_QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 ${
                item.active
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white/90 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {toast && (
        <div
          ref={toastBannerRef}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.message}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {canManage && (
          <form
            onSubmit={handleCreatePost}
            className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0"
          >
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {editingPostId ? (
                <Pencil className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <span>{editingPostId ? 'Edit Artikel' : 'Publikasi Konten Baru'}</span>
            </h1>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Judul <span className="text-rose-600">*</span>
              </label>
              <input
                required
                minLength={4}
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                placeholder="Minimal 4 karakter"
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newPost.category}
                  onChange={(e) =>
                    setNewPost({ ...newPost, category: e.target.value as PostItem['category'] })
                  }
                  className={INPUT_CLASS}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Penulis / Redaksi
                </label>
                <input
                  type="text"
                  value={newPost.author_display_name}
                  onChange={(e) =>
                    setNewPost({ ...newPost, author_display_name: e.target.value })
                  }
                  placeholder="Humas Lembaga"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Ringkasan (Opsional)
              </label>
              <input
                type="text"
                value={newPost.excerpt}
                onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
                placeholder="Ringkasan singkat untuk tampilan kartu berita"
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                URL Gambar Sampul (Opsional)
              </label>
              <input
                type="url"
                value={newPost.cover_image_url}
                onChange={(e) => setNewPost({ ...newPost, cover_image_url: e.target.value })}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Isi Konten <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                minLength={10}
                rows={5}
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                placeholder="Tuliskan isi berita, pengumuman, atau artikel (minimal 10 karakter)..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Status Publikasi
              </label>
              <select
                value={newPost.status}
                onChange={(e) =>
                  setNewPost({
                    ...newPost,
                    status: e.target.value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
                  })
                }
                className={INPUT_CLASS}
              >
                <option value="PUBLISHED">Terbit (Publik)</option>
                <option value="DRAFT">Draft (Disimpan Saja)</option>
                <option value="ARCHIVED">Arsip (Disembunyikan)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-2xl text-sm transition shadow-xs"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {saving
                    ? 'Menyimpan...'
                    : editingPostId
                    ? 'Simpan Perubahan'
                    : newPost.status === 'DRAFT'
                    ? 'Simpan sebagai Draft'
                    : 'Terbitkan Konten'}
                </span>
              </button>
              {editingPostId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPostId(null);
                    setNewPost({
                      title: '',
                      category: 'BERITA',
                      status: 'PUBLISHED',
                      excerpt: '',
                      content: '',
                      author_display_name: 'Humas Lembaga',
                      cover_image_url: '',
                    });
                  }}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        )}

        <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4 min-w-0`}>
          {/* Toolbar Pencarian & Filter */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari judul, ringkasan, atau penulis..."
                  aria-label="Cari artikel"
                  className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter kategori artikel"
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shrink-0"
              >
                <option value="ALL">Semua Kategori ({posts.length})</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center text-sm text-slate-600">
              Belum ada artikel yang diterbitkan.
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada artikel yang cocok dengan pencarian atau kategori tersebut.
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((p) => {
                const dateLabel = formatDateId(p.published_at || p.created_at);
                return (
                  <div
                    key={p.id}
                    className="modular-card rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 sm:gap-4 min-w-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          {formatCategory(p.category)}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            p.status === 'PUBLISHED'
                              ? 'bg-sky-50 text-sky-700'
                              : p.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.status}
                        </span>
                        {dateLabel && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar className="w-3 h-3" /> {dateLabel}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-sm leading-snug break-words">
                        {p.title}
                      </p>
                      {(p.excerpt || p.content) && (
                        <p className="text-xs text-slate-500 line-clamp-2 break-words leading-relaxed">
                          {p.excerpt || p.content}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5">
                        <User className="w-3 h-3 shrink-0" />
                        <span className="truncate">{p.author_display_name || 'Admin CMS'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(p.id);
                            setNewPost({
                              title: p.title,
                              category: p.category,
                              status: (p.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') || 'PUBLISHED',
                              excerpt: p.excerpt || '',
                              content: p.content || '',
                              author_display_name: p.author_display_name || 'Humas Lembaga',
                              cover_image_url: p.cover_image_url || '',
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          aria-label={`Edit ${p.title}`}
                          title="Edit artikel"
                          className="p-2 rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPreviewPost(p)}
                        className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                        title="Lihat Isi Artikel"
                        aria-label={`Lihat artikel ${p.title}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePost(p)}
                          disabled={deletingId === p.id}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                          title="Hapus"
                          aria-label={`Hapus artikel ${p.title}`}
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Pratinjau Artikel */}
      {previewPost && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-preview-title"
          onClick={() => setPreviewPost(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-bold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                {formatCategory(previewPost.category)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPost(null)}
                aria-label="Tutup pratinjau"
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2
              id="cms-preview-title"
              className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug break-words"
            >
              {previewPost.title}
            </h2>
            <p className="text-xs text-slate-500 pb-3 border-b border-slate-100">
              Penulis: {previewPost.author_display_name || 'Admin CMS'}
              {formatDateId(previewPost.published_at || previewPost.created_at)
                ? ` • ${formatDateId(previewPost.published_at || previewPost.created_at)}`
                : ''}
            </p>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">
              {previewPost.content}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Artikel */}
      {confirmDeletePost && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-delete-title"
          onClick={() => setConfirmDeletePost(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="cms-delete-title" className="text-base font-bold text-slate-900">
              Hapus Artikel Ini?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
              Artikel <strong>&ldquo;{confirmDeletePost.title}&rdquo;</strong> akan dihapus permanen
              dari portal publik.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePost(null)}
                disabled={deletingId === confirmDeletePost.id}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeletePost(confirmDeletePost.id)}
                disabled={deletingId === confirmDeletePost.id}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId === confirmDeletePost.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
