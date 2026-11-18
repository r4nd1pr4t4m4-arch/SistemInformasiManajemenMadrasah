'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
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

const EMPTY_FORM = {
  name: '',
  category: 'Ruang Kelas',
  quantity: 1,
  condition: 'BAIK' as ConditionType,
  description: '',
};

export default function ManajemenSaranaPrasaranaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_SARPRAS_MANAGE);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [filterCondition, setFilterCondition] = useState<string>('ALL');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  function notify(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadFacilities() {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/facilities', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.facilities)) {
        setFacilities(data.facilities);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFacilities();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const payload = editingId ? { ...form, id: editingId } : form;
      const res = await fetch('/api/cms/facilities', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.error || 'Gagal menyimpan data sarana & prasarana.');
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
      await loadFacilities();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: FacilityItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category || 'Umum',
      quantity: item.quantity,
      condition: item.condition || 'BAIK',
      description: item.description || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(item: FacilityItem) {
    if (!confirm(`Hapus "${item.name}" dari daftar sarana & prasarana?`)) return;
    const res = await fetch(`/api/cms/facilities?id=${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      notify('ok', 'Data sarana & prasarana berhasil dihapus.');
      if (editingId === item.id) cancelEdit();
      await loadFacilities();
    } else {
      const d = await res.json();
      notify('err', d.error || 'Gagal menghapus data.');
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
        f.name.toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q);
      const matchCond = filterCondition === 'ALL' || f.condition === filterCondition;
      return matchSearch && matchCond;
    });
  }, [facilities, search, filterCondition]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Jenis Sarana/Prasarana</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalJenis}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Total Unit Tersedia</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.totalUnit}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Kondisi Baik</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.baikCount}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Perlu Perhatian / Perbaikan</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{stats.needAttentionCount}</p>
        </div>
      </div>

      {/* Form Tambah / Edit */}
      {canManage && (
      <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-6 md:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Sarana & Prasarana' : 'Manajemen Sarana & Prasarana'}
              </h1>
              <p className="text-xs text-slate-500">
                Data sarana dan prasarana yang disimpan otomatis tampil pada halaman Profil publik.
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5" /> Batal Edit
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Sarana / Prasarana <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Ruang Kelas Belajar / Lab Komputer"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
            <input
              type="text"
              list="facility-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Pilih atau ketik kategori"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
            <datalist id="facility-categories">
              {CATEGORY_PRESETS.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah</label>
              <input
                required
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kondisi</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as ConditionType })}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                <option value="BAIK">Baik</option>
                <option value="RUSAK_RINGAN">Rusak Ringan</option>
                <option value="RUSAK_BERAT">Rusak Berat</option>
                <option value="DALAM_PERBAIKAN">Perbaikan</option>
              </select>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Keterangan / Spesifikasi Singkat
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contoh: Dilengkapi proyektor LCD, AC, dan kapasitas 32 siswa per ruang."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {saving
            ? 'Menyimpan...'
            : editingId
            ? 'Simpan Perubahan'
            : 'Tambah Sarana & Prasarana'}
        </button>
      </form>
      )}

      {/* Daftar Sarana & Prasarana */}
      <div className="glass-card rounded-3xl p-6 md:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">Daftar Inventaris Sarana &amp; Prasarana</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari fasilitas..."
                className="pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs w-52"
              />
            </div>
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
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
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data sarana &amp; prasarana...
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Belum ada data sarana &amp; prasarana yang sesuai.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFacilities.map((item) => {
              const cond = CONDITION_LABELS[item.condition] || CONDITION_LABELS.BAIK;
              return (
                <div
                  key={item.id}
                  className="modular-card rounded-2xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {item.category || 'Umum'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
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
                      <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                    )}
                  </div>

                  {canManage && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
