'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileEdit,
  Globe,
  Image as ImageIcon,
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
import { RichTextEditor } from '@/components/cms/rich-text-editor';
import {
  prepareRichTextHtmlForRender,
  stripHtmlToPlainText,
} from '@/lib/security/rich-text';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface PostFormState {
  title: string;
  category: PostItem['category'];
  status: PostStatus;
  excerpt: string;
  content: string;
  author_display_name: string;
  cover_image_url: string;
}

const INITIAL_FORM_STATE: PostFormState = {
  title: '',
  category: 'BERITA',
  status: 'PUBLISHED',
  excerpt: '',
  content: '',
  author_display_name: 'Humas Lembaga',
  cover_image_url: '',
};

const ITEMS_PER_PAGE = 8;

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:opacity-60';

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

const STATUS_META: Record<PostStatus, { label: string; badgeClass: string }> = {
  PUBLISHED: {
    label: 'Terbit',
    badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200/70',
  },
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  },
  ARCHIVED: {
    label: 'Arsip',
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200/80',
  },
};

function formatCategory(cat: string | null | undefined): string {
  if (!cat) return 'UMUM';
  return cat.replace(/_/g, ' ');
}

function getCategoryBadgeClass(cat: string | null | undefined): string {
  const norm = (cat || '').toUpperCase();
  if (norm.includes('PENGUMUMAN')) {
    return 'bg-amber-50 text-amber-800 border-amber-200/70';
  }
  if (norm.includes('ARTIKEL')) {
    return 'bg-sky-50 text-sky-800 border-sky-200/70';
  }
  if (norm.includes('KARYA')) {
    return 'bg-violet-50 text-violet-800 border-violet-200/70';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
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

function getSafeCoverUrl(rawUrl: string | null | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
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
  const [brokenCoverMap, setBrokenCoverMap] = useState<Record<string, boolean>>({});

  const [toast, setToast] = useState<ToastState | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PostStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const [newPost, setNewPost] = useState<PostFormState>(INITIAL_FORM_STATE);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

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

  function resetForm() {
    setEditingPostId(null);
    setNewPost(INITIAL_FORM_STATE);
  }

  function startEditPost(post: PostItem) {
    if (saving || deletingId) return;
    setPreviewPost(null);
    setEditingPostId(post.id);
    setNewPost({
      title: post.title || '',
      category: post.category,
      status: (post.status as PostStatus) || 'PUBLISHED',
      excerpt: post.excerpt || '',
      content: post.content || '',
      author_display_name: post.author_display_name || 'Humas Lembaga',
      cover_image_url: post.cover_image_url || '',
    });
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || saving) return;

    const trimmedTitle = newPost.title.trim();
    const trimmedContent = newPost.content.trim();
    const trimmedExcerpt = newPost.excerpt.trim();
    const trimmedAuthor = newPost.author_display_name.trim() || 'Humas Lembaga';
    const trimmedCover = newPost.cover_image_url.trim();

    if (stripHtmlToPlainText(trimmedTitle).length < 4) {
      showToast('error', 'Judul artikel minimal 4 karakter teks.');
      return;
    }
    if (stripHtmlToPlainText(trimmedContent).length < 10) {
      showToast('error', 'Isi konten artikel minimal 10 karakter teks.');
      return;
    }
    if (trimmedCover && !getSafeCoverUrl(trimmedCover)) {
      showToast('error', 'URL gambar sampul harus diawali http://, https://, atau /.');
      return;
    }

    const activeEditId = editingPostId;
    setSaving(true);
    try {
      const res = await fetch('/api/cms/posts', {
        method: activeEditId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(activeEditId ? { id: activeEditId } : {}),
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
        const savedPost = data.post as PostItem;
        if (activeEditId) {
          setPosts((prev) => prev.map((item) => (item.id === activeEditId ? savedPost : item)));
          setPreviewPost((prev) => (prev?.id === activeEditId ? savedPost : prev));
          showToast('success', 'Perubahan artikel berhasil disimpan.');
        } else {
          setPosts((prev) => [savedPost, ...prev]);
          setCurrentPage(1);
          showToast('success', 'Artikel berhasil disimpan.');
        }
        resetForm();
      } else {
        showToast('error', data?.error || 'Gagal menyimpan artikel.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menerbitkan artikel.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePost(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cms/posts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setConfirmDeletePost(null);
        setPreviewPost((prev) => (prev?.id === id ? null : prev));
        if (editingPostId === id) {
          resetForm();
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

  const statusCounts = useMemo(() => {
    let published = 0;
    let draft = 0;
    let archived = 0;
    for (const p of posts) {
      if (p.status === 'PUBLISHED') published += 1;
      else if (p.status === 'DRAFT') draft += 1;
      else if (p.status === 'ARCHIVED') archived += 1;
    }
    return { total: posts.length, published, draft, archived };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        stripHtmlToPlainText(p.title).toLowerCase().includes(q) ||
        stripHtmlToPlainText(p.excerpt).toLowerCase().includes(q) ||
        stripHtmlToPlainText(p.content).toLowerCase().includes(q) ||
        (p.author_display_name || '').toLowerCase().includes(q)
      );
    });
  }, [posts, searchQuery, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPosts = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredPosts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPosts, safePage]);

  const hasActiveFilter =
    searchQuery.trim().length > 0 || categoryFilter !== 'ALL' || statusFilter !== 'ALL';

  const formCoverPreviewUrl = getSafeCoverUrl(newPost.cover_image_url);
  const showFormCoverPreview =
    Boolean(formCoverPreviewUrl) && !brokenCoverMap[`form:${formCoverPreviewUrl}`];

  const previewCoverUrl = previewPost ? getSafeCoverUrl(previewPost.cover_image_url) : null;
  const showPreviewCover =
    Boolean(previewCoverUrl) && !brokenCoverMap[`preview:${previewPost?.id}`];

  const editingPostTitle = useMemo(() => {
    if (!editingPostId) return '';
    const found = posts.find((p) => p.id === editingPostId);
    return found ? stripHtmlToPlainText(found.title) : '';
  }, [editingPostId, posts]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5 animate-pulse" aria-busy="true">
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-36 rounded-xl bg-white/80 border border-slate-200" />
          ))}
        </div>
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Memuat daftar berita &amp; artikel...</span>
        </div>
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
          className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0">
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
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 ${
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

      {/* Header Ringkasan Statistik CMS Berita */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Newspaper className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
              Manajemen Berita &amp; Artikel
            </h1>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kelola berita, pengumuman, artikel, dan karya tulis lembaga dengan Rich Text Editor.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'PUBLISHED' ? 'ALL' : 'PUBLISHED');
              setCurrentPage(1);
            }}
            className={`px-3 py-2 rounded-2xl border text-left transition min-w-[78px] ${
              statusFilter === 'PUBLISHED'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-white/85 border-slate-200/80 hover:border-sky-300'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase opacity-80">
              <Globe className="w-3 h-3 shrink-0" />
              <span>Terbit</span>
            </div>
            <p className="text-base font-extrabold tabular-nums mt-0.5">
              {statusCounts.published}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT');
              setCurrentPage(1);
            }}
            className={`px-3 py-2 rounded-2xl border text-left transition min-w-[78px] ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white/85 border-slate-200/80 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase opacity-80">
              <FileEdit className="w-3 h-3 shrink-0" />
              <span>Draft</span>
            </div>
            <p className="text-base font-extrabold tabular-nums mt-0.5">{statusCounts.draft}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'ARCHIVED' ? 'ALL' : 'ARCHIVED');
              setCurrentPage(1);
            }}
            className={`px-3 py-2 rounded-2xl border text-left transition min-w-[78px] ${
              statusFilter === 'ARCHIVED'
                ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                : 'bg-white/85 border-slate-200/80 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase opacity-80">
              <Archive className="w-3 h-3 shrink-0" />
              <span>Arsip</span>
            </div>
            <p className="text-base font-extrabold tabular-nums mt-0.5">{statusCounts.archived}</p>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 left-3 right-3 sm:left-auto sm:right-6 z-[60] sm:max-w-md p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="break-words leading-relaxed">{toast.message}</span>
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
        {/* Form Publikasi / Edit Artikel */}
        {canManage && (
          <form
            ref={formRef}
            onSubmit={handleCreatePost}
            className="lg:col-span-6 glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0 scroll-mt-20"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 min-w-0">
                {editingPostId ? (
                  <Pencil className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
                )}
                <span className="truncate">
                  {editingPostId ? 'Edit Artikel' : 'Publikasi Konten Baru'}
                </span>
              </h2>
              {editingPostId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition shrink-0"
                >
                  <X className="w-3 h-3" />
                  <span>Batal Edit</span>
                </button>
              )}
            </div>

            {editingPostId && editingPostTitle && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900">
                <Pencil className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">
                  Mode Edit: <strong>{editingPostTitle}</strong>
                </span>
              </div>
            )}

            <div className="min-w-0">
              <label
                htmlFor="cms-berita-title"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Judul <span className="text-rose-600">*</span>
              </label>
              <RichTextEditor
                id="cms-berita-title"
                variant="title"
                value={newPost.title}
                onChange={(html) => setNewPost((prev) => ({ ...prev, title: html }))}
                placeholder="Tuliskan judul artikel (minimal 4 karakter)..."
                ariaLabel="Judul artikel"
                minChars={4}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="min-w-0">
                <label
                  htmlFor="cms-berita-category"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Kategori <span className="text-rose-600">*</span>
                </label>
                <select
                  id="cms-berita-category"
                  value={newPost.category}
                  disabled={saving}
                  onChange={(e) =>
                    setNewPost((prev) => ({
                      ...prev,
                      category: e.target.value as PostItem['category'],
                    }))
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
                <label
                  htmlFor="cms-berita-author"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Nama Penulis / Redaksi
                </label>
                <input
                  id="cms-berita-author"
                  type="text"
                  value={newPost.author_display_name}
                  disabled={saving}
                  onChange={(e) =>
                    setNewPost((prev) => ({ ...prev, author_display_name: e.target.value }))
                  }
                  placeholder="Humas Lembaga"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="cms-berita-excerpt"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Ringkasan (Opsional)
              </label>
              <RichTextEditor
                id="cms-berita-excerpt"
                variant="summary"
                value={newPost.excerpt}
                onChange={(html) => setNewPost((prev) => ({ ...prev, excerpt: html }))}
                placeholder="Ringkasan singkat untuk tampilan kartu berita..."
                ariaLabel="Ringkasan artikel"
                disabled={saving}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <label
                htmlFor="cms-berita-cover"
                className="block text-xs font-semibold text-slate-700"
              >
                URL Gambar Sampul (Opsional)
              </label>
              <input
                id="cms-berita-cover"
                type="text"
                inputMode="url"
                value={newPost.cover_image_url}
                disabled={saving}
                onChange={(e) =>
                  setNewPost((prev) => ({ ...prev, cover_image_url: e.target.value }))
                }
                placeholder="https://... atau /api/public/media?..."
                className={INPUT_CLASS}
              />
              {showFormCoverPreview && formCoverPreviewUrl && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[16/7]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formCoverPreviewUrl}
                    alt="Pratinjau gambar sampul"
                    loading="lazy"
                    onError={() =>
                      setBrokenCoverMap((prev) => ({
                        ...prev,
                        [`form:${formCoverPreviewUrl}`]: true,
                      }))
                    }
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/70 text-white text-[10px] font-medium backdrop-blur-xs">
                    <ImageIcon className="w-3 h-3" /> Pratinjau Sampul
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <label
                htmlFor="cms-berita-content"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Isi Konten <span className="text-rose-600">*</span>
              </label>
              <RichTextEditor
                id="cms-berita-content"
                variant="content"
                value={newPost.content}
                onChange={(html) => setNewPost((prev) => ({ ...prev, content: html }))}
                placeholder="Tuliskan isi berita, pengumuman, atau artikel (minimal 10 karakter)..."
                ariaLabel="Isi konten artikel"
                minChars={10}
                disabled={saving}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="cms-berita-status"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Status Publikasi
              </label>
              <select
                id="cms-berita-status"
                value={newPost.status}
                disabled={saving}
                onChange={(e) =>
                  setNewPost((prev) => ({
                    ...prev,
                    status: e.target.value as PostStatus,
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="PUBLISHED">Terbit (Publik)</option>
                <option value="DRAFT">Draft (Disimpan Saja)</option>
                <option value="ARCHIVED">Arsip (Disembunyikan)</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
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
                  disabled={saving}
                  onClick={resetForm}
                  className="min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        )}

        {/* Daftar Artikel */}
        <div className={`${canManage ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4 min-w-0`}>
          {/* Toolbar Pencarian & Filter */}
          <div className="glass-card rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="relative min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari judul, ringkasan, isi, atau penulis..."
                aria-label="Cari artikel"
                className="w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter kategori artikel"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Semua Kategori ({posts.length})</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | PostStatus);
                  setCurrentPage(1);
                }}
                aria-label="Filter status publikasi"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Semua Status ({statusCounts.total})</option>
                <option value="PUBLISHED">Terbit ({statusCounts.published})</option>
                <option value="DRAFT">Draft ({statusCounts.draft})</option>
                <option value="ARCHIVED">Arsip ({statusCounts.archived})</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
              <span className="tabular-nums">
                Menampilkan <strong>{paginatedPosts.length}</strong> dari{' '}
                <strong>{filteredPosts.length}</strong> artikel
              </span>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Filter
                </button>
              )}
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Newspaper className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">Belum Ada Artikel</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Mulai tulis berita, pengumuman, atau artikel pendidikan melalui formulir di samping.
              </p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada artikel yang cocok dengan pencarian atau filter tersebut.
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedPosts.map((p) => {
                  const dateLabel = formatDateId(p.published_at || p.created_at);
                  const plainTitle = stripHtmlToPlainText(p.title);
                  const snippetText = stripHtmlToPlainText(p.excerpt || p.content);
                  const statusInfo =
                    STATUS_META[(p.status as PostStatus) || 'PUBLISHED'] || STATUS_META.PUBLISHED;
                  const isBeingEdited = editingPostId === p.id;
                  const cardCoverUrl = getSafeCoverUrl(p.cover_image_url);
                  const showCardThumb =
                    Boolean(cardCoverUrl) && !brokenCoverMap[`card:${p.id}`];

                  return (
                    <article
                      key={p.id}
                      className={`modular-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 min-w-0 ${
                        isBeingEdited ? 'ring-2 ring-emerald-500/60 border-emerald-400' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {showCardThumb && cardCoverUrl && (
                          <div className="hidden sm:block w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 mt-0.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={cardCoverUrl}
                              alt={plainTitle || 'Sampul'}
                              loading="lazy"
                              onError={() =>
                                setBrokenCoverMap((prev) => ({ ...prev, [`card:${p.id}`]: true }))
                              }
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${getCategoryBadgeClass(
                                p.category
                              )}`}
                            >
                              {formatCategory(p.category)}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusInfo.badgeClass}`}
                            >
                              {statusInfo.label}
                            </span>
                            {isBeingEdited && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                Sedang Diedit
                              </span>
                            )}
                            {dateLabel && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Calendar className="w-3 h-3 shrink-0" /> {dateLabel}
                              </span>
                            )}
                          </div>

                          <h3
                            className="font-bold text-slate-900 text-sm leading-snug [overflow-wrap:anywhere] rich-text-inline"
                            dangerouslySetInnerHTML={{
                              __html: prepareRichTextHtmlForRender(p.title, 'inline-single'),
                            }}
                          />

                          {snippetText && (
                            <p className="text-xs text-slate-500 line-clamp-2 [overflow-wrap:anywhere] leading-relaxed">
                              {snippetText}
                            </p>
                          )}

                          <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {p.author_display_name || 'Admin CMS'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        {canManage && (
                          <button
                            type="button"
                            disabled={saving || Boolean(deletingId)}
                            onClick={() => startEditPost(p)}
                            aria-label={`Edit ${plainTitle}`}
                            title="Edit artikel"
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewPost(p)}
                          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          title="Pratinjau Artikel"
                          aria-label={`Pratinjau artikel ${plainTitle}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePost(p)}
                            disabled={saving || deletingId === p.id}
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
                            title="Hapus Artikel"
                            aria-label={`Hapus artikel ${plainTitle}`}
                          >
                            {deletingId === p.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    Hal. {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 transition"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Pratinjau Artikel (Sticky Header & Footer) */}
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
            className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header Modal Sticky */}
            <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-b border-slate-100 bg-white/95 backdrop-blur shrink-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className={`text-[11px] font-bold uppercase px-3 py-1 rounded-full border ${getCategoryBadgeClass(
                    previewPost.category
                  )}`}
                >
                  {formatCategory(previewPost.category)}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    (STATUS_META[(previewPost.status as PostStatus) || 'PUBLISHED'] ||
                      STATUS_META.PUBLISHED
                    ).badgeClass
                  }`}
                >
                  {
                    (STATUS_META[(previewPost.status as PostStatus) || 'PUBLISHED'] ||
                      STATUS_META.PUBLISHED
                    ).label
                  }
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPost(null)}
                aria-label="Tutup pratinjau"
                className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal Scrollable */}
            <div className="overflow-y-auto overscroll-contain flex-1">
              {showPreviewCover && previewCoverUrl && (
                <div className="aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewCoverUrl}
                    alt={stripHtmlToPlainText(previewPost.title) || 'Sampul Artikel'}
                    onError={() =>
                      setBrokenCoverMap((prev) => ({
                        ...prev,
                        [`preview:${previewPost.id}`]: true,
                      }))
                    }
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-5 sm:p-7 space-y-4">
                <h2
                  id="cms-preview-title"
                  className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug [overflow-wrap:anywhere] rich-text-inline"
                  dangerouslySetInnerHTML={{
                    __html: prepareRichTextHtmlForRender(previewPost.title, 'inline-single'),
                  }}
                />
                <p className="text-xs text-slate-500 pb-3 border-b border-slate-100">
                  Penulis: {previewPost.author_display_name || 'Admin CMS'}
                  {formatDateId(previewPost.published_at || previewPost.created_at)
                    ? ` • ${formatDateId(previewPost.published_at || previewPost.created_at)}`
                    : ''}
                </p>
                {stripHtmlToPlainText(previewPost.excerpt) && (
                  <div
                    className="text-sm font-medium text-slate-700 bg-emerald-50/50 border-l-4 border-emerald-500 px-4 py-3 rounded-r-xl leading-relaxed rich-text-inline"
                    dangerouslySetInnerHTML={{
                      __html: prepareRichTextHtmlForRender(previewPost.excerpt, 'inline'),
                    }}
                  />
                )}
                <div
                  className="text-sm text-slate-700 leading-relaxed rich-text-content"
                  dangerouslySetInnerHTML={{
                    __html: prepareRichTextHtmlForRender(previewPost.content, 'block'),
                  }}
                />
              </div>
            </div>

            {/* Footer Modal Sticky */}
            <div className="px-5 sm:px-7 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {previewPost.status === 'PUBLISHED' && previewPost.slug?.trim() && (
                  <Link
                    href={`/berita/${encodeURIComponent(previewPost.slug.trim())}`}
                    target="_blank"
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-800 text-slate-700 text-xs font-semibold transition"
                  >
                    <span>Buka Publik</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                )}
                {canManage && (
                  <button
                    type="button"
                    disabled={saving || Boolean(deletingId)}
                    onClick={() => startEditPost(previewPost)}
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0" />
                    <span>Edit Artikel</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewPost(null)}
                className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                Tutup
              </button>
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
          onClick={() => {
            if (!deletingId) setConfirmDeletePost(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="cms-delete-title" className="text-base font-bold text-slate-900">
              Hapus Artikel Ini?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Artikel{' '}
              <strong>&ldquo;{stripHtmlToPlainText(confirmDeletePost.title)}&rdquo;</strong> akan
              dihapus permanen dari portal publik.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePost(null)}
                disabled={deletingId === confirmDeletePost.id}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeletePost(confirmDeletePost.id)}
                disabled={deletingId === confirmDeletePost.id}
                aria-busy={deletingId === confirmDeletePost.id}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
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
