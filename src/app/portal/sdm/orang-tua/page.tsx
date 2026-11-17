'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Link2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type StudentRef = {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  status: string;
};

type GuardianItem = {
  id: string;
  student_id: string;
  profile_id: string | null;
  relationship: 'AYAH' | 'IBU' | 'WALI';
  full_name: string;
  nik: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  is_primary: boolean;
  is_active: boolean;
  student?: StudentRef | null;
  profile?: ActiveAccount | null;
};

const EMPTY_FORM = {
  student_id: '',
  profile_id: '',
  relationship: 'WALI' as 'AYAH' | 'IBU' | 'WALI',
  full_name: '',
  nik: '',
  phone: '',
  email: '',
  occupation: '',
  address: '',
  is_primary: true,
  is_active: true,
};

export default function ManajemenOrangTuaPage() {
  const [items, setItems] = useState<GuardianItem[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRel, setFilterRel] = useState('ALL');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/sdm?scope=orang-tua', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data orang tua/wali.');
      setItems(data.items || []);
      setStudents(data.students || []);
      setAccounts(data.activeAccounts || []);
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filterRel !== 'ALL' && item.relationship !== filterRel) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        (item.student?.full_name || '').toLowerCase().includes(q) ||
        (item.student?.nis || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, filterRel]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      linked: items.filter((i) => !!i.profile_id).length,
      primary: items.filter((i) => i.is_primary).length,
      active: items.filter((i) => i.is_active).length,
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: GuardianItem) {
    setEditingId(item.id);
    setForm({
      student_id: item.student_id,
      profile_id: item.profile_id || '',
      relationship: item.relationship || 'WALI',
      full_name: item.full_name || '',
      nik: item.nik || '',
      phone: item.phone || '',
      email: item.email || '',
      occupation: item.occupation || '',
      address: item.address || '',
      is_primary: item.is_primary,
      is_active: item.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'orang-tua',
          ...(editingId ? { id: editingId } : {}),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data orang tua/wali.');
      setModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingId
          ? 'Data orang tua/wali berhasil diperbarui.'
          : 'Data orang tua/wali baru berhasil ditambahkan.',
      });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GuardianItem) {
    if (!confirm(`Hapus data wali "${item.full_name}"?`)) return;
    try {
      const res = await fetch(`/api/sdm?scope=orang-tua&id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data orang tua/wali.');
      setMessage({ type: 'ok', text: `Data ${item.full_name} berhasil dihapus.` });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Orang Tua / Wali Siswa</h1>
          <p className="text-sm text-slate-500">
            Kelola data orang tua/wali siswa beserta relasi ke peserta didik dan akun portal orang tua.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Orang Tua/Wali
        </button>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Orang Tua/Wali</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Terhubung Akun Portal</span>
            <Link2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.linked}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Wali Utama</span>
            <UserCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.primary}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Status Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.active}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama wali, nomor HP, atau nama/NIS siswa..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterRel}
            onChange={(e) => setFilterRel(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="ALL">Semua Hubungan</option>
            <option value="AYAH">Ayah</option>
            <option value="IBU">Ibu</option>
            <option value="WALI">Wali</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-3">Nama Orang Tua / Wali</th>
                <th className="py-3 px-3">Hubungan</th>
                <th className="py-3 px-3">Siswa Terkait</th>
                <th className="py-3 px-3">Akun Portal</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat data orang tua/wali...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada data orang tua/wali yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {item.phone || '-'} · {item.occupation || 'Pekerjaan belum diisi'}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {item.relationship}
                      </span>
                      {item.is_primary && (
                        <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                          Utama
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-700">
                      <p className="font-medium">{item.student?.full_name || '-'}</p>
                      <p className="text-slate-400">NIS: {item.student?.nis || '-'}</p>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {item.profile ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                          <Link2 className="w-3 h-3" />
                          {item.profile.full_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum ditautkan</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Data Orang Tua / Wali' : 'Tambah Data Orang Tua / Wali'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Siswa Terkait *
                </label>
                <select
                  required
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  required
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Hubungan
                </label>
                <select
                  value={form.relationship}
                  onChange={(e) =>
                    setForm({ ...form, relationship: e.target.value as 'AYAH' | 'IBU' | 'WALI' })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="AYAH">Ayah</option>
                  <option value="IBU">Ibu</option>
                  <option value="WALI">Wali</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIK</label>
                <input
                  type="text"
                  value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP / WA</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pekerjaan</label>
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tautkan Akun Portal Orang Tua
                </label>
                <select
                  value={form.profile_id}
                  onChange={(e) => setForm({ ...form, profile_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Tidak Ditautkan --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.full_name} ({acc.email || acc.phone || acc.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-6">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_primary}
                    onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Jadikan Wali Utama
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Status Aktif
                </label>
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
