'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Newspaper,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import type { InstitutionSettings, InstitutionType, PostItem } from '@/types/database';

interface PpdbRow {
  id: string;
  registration_number: string;
  full_name: string;
  previous_school: string;
  pathway: string;
  parent_phone: string;
  status: string;
  admin_notes: string | null;
}

export default function PortalCmsPage() {
  const [tab, setTab] = useState<'settings' | 'posts' | 'ppdb'>('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [settings, setSettings] = useState<InstitutionSettings | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [ppdbList, setPpdbList] = useState<PpdbRow[]>([]);

  const [newPost, setNewPost] = useState({
    title: '',
    category: 'BERITA' as PostItem['category'],
    excerpt: '',
    content: '',
    author_display_name: 'Humas Lembaga',
  });

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [sRes, pRes, ppdbRes] = await Promise.all([
          fetch('/api/cms/settings'),
          fetch('/api/cms/posts'),
          fetch('/api/cms/ppdb'),
        ]);
        const sData = await sRes.json();
        const pData = await pRes.json();
        const ppdbData = await ppdbRes.json();
        if (sData.settings) setSettings(sData.settings);
        if (pData.posts) setPosts(pData.posts);
        if (ppdbData.registrations) setPpdbList(ppdbData.registrations);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cms/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_type: settings.institution_type,
          name: settings.name,
          short_name: settings.short_name,
          npsn: settings.npsn,
          nsm: settings.nsm,
          accreditation: settings.accreditation,
          student_org_label: settings.student_org_label,
          head_title_label: settings.head_title_label,
          headmaster_name: settings.headmaster_name,
          headmaster_greeting: settings.headmaster_greeting,
          history: settings.history,
          vision: settings.vision,
          mission: settings.mission,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          geofence_lat: settings.geofence_lat,
          geofence_lng: settings.geofence_lng,
          geofence_radius_meters: settings.geofence_radius_meters,
        }),
      });
      if (res.ok) {
        showToast('Pengaturan lembaga berhasil disimpan.');
      } else {
        const d = await res.json();
        showToast(d.error || 'Gagal menyimpan pengaturan.');
      }
    } finally {
      setSaving(false);
    }
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

  async function handleUpdatePpdbStatus(id: string, status: string) {
    const res = await fetch('/api/cms/ppdb', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (res.ok && data.registration) {
      setPpdbList((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status: data.registration.status } : row))
      );
      showToast(`Status pendaftar diperbarui menjadi ${status}.`);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 bg-white/80 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                tab === 'settings' ? 'bg-emerald-600 text-white' : 'text-slate-600'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Profil &amp; Lembaga
            </button>
            <button
              type="button"
              onClick={() => setTab('posts')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                tab === 'posts' ? 'bg-emerald-600 text-white' : 'text-slate-600'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" /> Berita &amp; Artikel
            </button>
            <button
              type="button"
              onClick={() => setTab('ppdb')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                tab === 'ppdb' ? 'bg-emerald-600 text-white' : 'text-slate-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Verifikasi PPDB ({ppdbList.length})
            </button>
          </div>
        </div>

        {toast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data CMS &amp; PPDB...
          </div>
        ) : (
          <>
            {tab === 'settings' && settings && (
              <form
                onSubmit={handleSaveSettings}
                className="glass-card rounded-3xl p-7 space-y-5"
              >
                <h2 className="text-lg font-bold text-slate-900">
                  Pengaturan Identitas Lembaga &amp; Geofencing
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipe Lembaga
                    </label>
                    <select
                      value={settings.institution_type}
                      onChange={(e) => {
                        const type = e.target.value as InstitutionType;
                        setSettings({
                          ...settings,
                          institution_type: type,
                          student_org_label: type === 'MADRASAH' ? 'OSIM' : 'OSIS',
                          head_title_label:
                            type === 'MADRASAH' ? 'Kepala Madrasah' : 'Kepala Sekolah',
                        });
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    >
                      <option value="MADRASAH">Madrasah</option>
                      <option value="SEKOLAH">Sekolah Umum</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Resmi Lembaga
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama {settings.head_title_label}
                    </label>
                    <input
                      type="text"
                      value={settings.headmaster_name || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, headmaster_name: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Radius Geofencing (Meter)
                    </label>
                    <input
                      type="number"
                      value={settings.geofence_radius_meters}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          geofence_radius_meters: Number(e.target.value) || 100,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visi</label>
                  <textarea
                    rows={2}
                    value={settings.vision || ''}
                    onChange={(e) => setSettings({ ...settings, vision: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </form>
            )}

            {tab === 'posts' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleCreatePost}
                  className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-4 h-fit"
                >
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-700" /> Publikasi Konten Baru
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Judul
                    </label>
                    <input
                      required
                      type="text"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kategori
                    </label>
                    <select
                      value={newPost.category}
                      onChange={(e) =>
                        setNewPost({
                          ...newPost,
                          category: e.target.value as PostItem['category'],
                        })
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ringkasan
                    </label>
                    <input
                      type="text"
                      value={newPost.excerpt}
                      onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Isi Konten
                    </label>
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

                <div className="lg:col-span-7 space-y-3">
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
                        <button
                          type="button"
                          onClick={() => handleDeletePost(p.id)}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'ppdb' && (
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Daftar Pendaftar PPDB Online</h2>
                {ppdbList.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Belum ada pendaftar masuk. Coba kirim formulir melalui halaman{' '}
                    <Link href="/ppdb" className="text-emerald-700 font-semibold underline">
                      /ppdb
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="space-y-3">
                    {ppdbList.map((row) => (
                      <div
                        key={row.id}
                        className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-mono text-xs font-bold text-emerald-700">
                            {row.registration_number}
                          </p>
                          <p className="font-bold text-slate-900 text-sm">{row.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {row.previous_school} • Jalur {row.pathway} • WA: {row.parent_phone}
                          </p>
                        </div>
                        <select
                          value={row.status}
                          onChange={(e) => handleUpdatePpdbStatus(row.id, e.target.value)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                        >
                          <option value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</option>
                          <option value="TERVERIFIKASI">Terverifikasi</option>
                          <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
                          <option value="LULUS">Lulus</option>
                          <option value="CADANGAN">Cadangan</option>
                          <option value="TIDAK_LULUS">Tidak Lulus</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
    </div>
  );
}
