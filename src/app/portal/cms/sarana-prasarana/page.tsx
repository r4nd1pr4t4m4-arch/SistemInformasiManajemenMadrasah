'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

type ConditionType = 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT' | 'DALAM_PERBAIKAN';

interface FacilityItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  condition: ConditionType;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

const CONDITION_LABELS: Record<ConditionType, { label: string; badge: string }> = {
  BAIK: { label: 'Baik', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RUSAK_RINGAN: { label: 'Rusak Ringan', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  RUSAK_BERAT: { label: 'Rusak Berat', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  DALAM_PERBAIKAN: { label: 'Dalam Perbaikan', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const CATEGORY_PRESETS = [
  'Ruang Kelas',
  'Laboratorium',
  'Perpustakaan',
  'Sarana Ibadah',
  'Olahraga & Ekstrakurikuler',
  'Kantor & Tata Usaha',
  'Sanitasi & Kebersihan',
  'Teknologi & Multimedia',
  'Umum',
];

const CMS_QUICK_LINKS = [
  { href: '/portal/cms/profil', label: 'Identitas & Profil', icon: Building2, active: false },
  { href: '/portal/cms/berita', label: 'Berita & Artikel', icon: Newspaper, active: false },
  { href: '/portal/cms/ppdb', label: 'PPDB Online', icon: UserPlus, active: false },
  { href: '/portal/cms/sarana-prasarana', label: 'Sarana Prasarana', icon: Wrench, active: true },
];

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

const EMPTY_FORM = {
  name: '',
  category: 'Ruang Kelas',
  quantity: 1,
  condition: 'BAIK' as ConditionType,
  description: '',
  image_url: '',
};

export default function ManajemenSaranaPrasaranaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_SARPRAS_MANAGE);

  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<FacilityItem | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [filterCondition, setFilterCondition] = useState<string>('ALL');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function notify(type: 'ok' | 'err', msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  const loadFacilities = useCallback(async (isSilent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isSilent) setLoading(true);
    try {
      const res = await fetch('/api/cms/facilities', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal memuat data sarana & prasarana.');
      }
      setFacilities(Array.isArray(data?.facilities) ? data.facilities : []);
      setLoadError(null);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setLoadError((err as Error)?.message || 'Tidak dapat terhubung ke server.');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/cms/facilities', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat data sarana & prasarana.');
        return data;
      })
      .then((data) => {
        setFacilities(Array.isArray(data?.facilities) ? data.facilities : []);
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
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteItem, deletingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    const trimmedName = form.name.trim();
    if (trimmedName.length < 2) {
      notify('err', 'Nama sarana/prasarana minimal 2 karakter.');
      return;
    }

    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      notify('err', 'Jumlah unit minimal 1.');
      return;
    }

    const trimmedImage = form.image_url.trim();
    if (trimmedImage && !/^https?:\/\//i.test(trimmedImage) && !trimmedImage.startsWith('/')) {
      notify('err', 'URL foto fasilitas harus diawali http://, https://, atau /.');
      return;
    }

    setSaving(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const basePayload = {
        name: trimmedName,
        category: form.category.trim() || 'Umum',
        quantity: Math.floor(qty),
        condition: form.condition,
        description: form.description.trim(),
        image_url: trimmedImage || null,
      };
      const payload = editingId ? { ...basePayload, id: editingId } : basePayload;

      const res = await fetch('/api/cms/facilities', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('err', data?.error || 'Gagal menyimpan data sarana & prasarana.');
        return;
      }

      notify(
        'ok',
        editingId
          ? 'Data sarana & prasarana berhasil diperbarui.'
          : 'Sarana & prasarana baru berhasil ditambahkan.'
      );
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadFacilities(true);
    } catch {
      notify('err', 'Terjadi kesalahan koneksi saat menyimpan data.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: FacilityItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category || 'Umum',
      quantity: item.quantity ?? 1,
      condition: item.condition || 'BAIK',
      description: item.description || '',
      image_url: item.image_url || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(item: FacilityItem) {
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/cms/facilities?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('ok', 'Data sarana & prasarana berhasil dihapus.');
        setConfirmDeleteItem(null);
        if (editingId === item.id) cancelEdit();
        await loadFacilities(true);
      } else {
        notify('err', data?.error || 'Gagal menghapus data.');
      }
    } catch {
      notify('err', 'Terjadi kesalahan jaringan saat menghapus data.');
    } finally {
      setDeletingId(null);
    }
  }

  const stats = useMemo(() => {
    const totalJenis = facilities.length;
    const totalUnit = facilities.reduce((acc, f) => acc + (Number(f.quantity) || 0), 0);
    const baikCount = facilities.filter((f) => f.condition === 'BAIK').length;
    const needAttentionCount = facilities.filter((f) => f.condition !== 'BAIK').length;
    return { totalJenis, totalUnit, baikCount, needAttentionCount };
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return facilities.filter((f) => {
      const matchSearch =
        !q ||
        (f.name || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q);
      const matchCond = filterCondition === 'ALL' || f.condition === filterCondition;
      return matchSearch && matchCond;
    });
  }, [facilities, search, filterCondition]);

  const hasActiveFilter = search.trim().length > 0 || filterCondition !== 'ALL';

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
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.msg}</span>
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

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Jenis Sarana/Prasarana</p>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            {stats.totalJenis}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Total Unit Tersedia</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">
            {stats.totalUnit}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Kondisi Baik</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">
            {stats.baikCount}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Perlu Perhatian / Perbaikan</p>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
            {stats.needAttentionCount}
          </p>
        </div>
      </div>

      {/* Form Tambah / Edit */}
      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-3xl p-5 sm:p-6 md:p-7 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Sarana & Prasarana' : 'Manajemen Sarana & Prasarana'}
                </h1>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Data sarana dan prasarana yang disimpan otomatis tampil pada halaman Profil
                  publik.
                </p>
              </div>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shrink-0"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Sarana / Prasarana <span className="text-rose-600">*</span>
              </label>
              <input
                required
                minLength={2}
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Ruang Kelas Belajar / Lab Komputer"
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kategori</label>
              <input
                type="text"
                list="facility-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Pilih atau ketik kategori"
                className={INPUT_CLASS}
              />
              <datalist id="facility-categories">
                {CATEGORY_PRESETS.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-2.5 min-w-0">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jumlah <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.quantity === 0 ? '' : form.quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)),
                    })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kondisi
                </label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value as ConditionType })}
                  className={INPUT_CLASS}
                >
                  <option value="BAIK">Baik</option>
                  <option value="RUSAK_RINGAN">Rusak Ringan</option>
                  <option value="RUSAK_BERAT">Rusak Berat</option>
                  <option value="DALAM_PERBAIKAN">Perbaikan</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Keterangan / Spesifikasi Singkat
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Contoh: Dilengkapi proyektor LCD, AC, dan kapasitas 32 siswa per ruang."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                URL Foto Fasilitas (Opsional)
              </label>
              <input
                type="url"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editingId ? (
              <Save className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>
              {saving
                ? 'Menyimpan...'
                : editingId
                ? 'Simpan Perubahan'
                : 'Tambah Sarana & Prasarana'}
            </span>
          </button>
        </form>
      )}

      {/* Daftar Sarana & Prasarana */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 md:p-7 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Daftar Inventaris Sarana &amp; Prasarana
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari fasilitas..."
                aria-label="Cari sarana dan prasarana"
                className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              aria-label="Filter kondisi fasilitas"
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">Semua Kondisi</option>
              <option value="BAIK">Baik</option>
              <option value="RUSAK_RINGAN">Rusak Ringan</option>
              <option value="RUSAK_BERAT">Rusak Berat</option>
              <option value="DALAM_PERBAIKAN">Dalam Perbaikan</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat data sarana &amp; prasarana...</span>
          </div>
        ) : loadError ? (
          <div className="py-10 text-center space-y-3 border border-rose-200 bg-rose-50/40 rounded-2xl px-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadFacilities(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
            </button>
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl px-4 space-y-2.5">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
            <p>Belum ada data sarana &amp; prasarana yang sesuai.</p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterCondition('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFacilities.map((item) => {
              const cond = CONDITION_LABELS[item.condition] || CONDITION_LABELS.BAIK;
              const isDeleting = deletingId === item.id;
              return (
                <div
                  key={item.id}
                  className="modular-card rounded-2xl p-4 flex flex-col justify-between space-y-3 min-w-0"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-emerald-700 break-words">
                          {item.category || 'Umum'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm break-words leading-snug">
                          {item.name}
                        </h3>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                        {item.quantity} Unit
                      </span>
                    </div>

                    <span
                      className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cond.badge}`}
                    >
                      {cond.label}
                    </span>

                    {item.description && (
                      <p className="text-xs text-slate-600 leading-relaxed break-words">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteItem(item)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Fasilitas */}
      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-facility-title"
          onClick={() => setConfirmDeleteItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="delete-facility-title" className="text-base font-bold text-slate-900">
              Hapus Sarana &amp; Prasarana?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
              Data <strong>&ldquo;{confirmDeleteItem.name}&rdquo;</strong> akan dihapus permanen
              dari inventaris sarana &amp; prasarana.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={deletingId === confirmDeleteItem.id}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteItem)}
                disabled={deletingId === confirmDeleteItem.id}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId === confirmDeleteItem.id && (
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
