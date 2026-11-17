'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  GraduationCap,
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

type StudentItem = {
  id: string;
  profile_id: string | null;
  nis: string | null;
  nisn: string | null;
  nik: string | null;
  full_name: string;
  gender: 'L' | 'P' | null;
  birth_place: string | null;
  birth_date: string | null;
  religion: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  entry_year: number | null;
  graduation_year: number | null;
  status: 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF';
  profile?: ActiveAccount | null;
};

const EMPTY_FORM = {
  full_name: '',
  nis: '',
  nisn: '',
  nik: '',
  gender: 'L' as 'L' | 'P',
  birth_place: '',
  birth_date: '',
  religion: 'Islam',
  phone: '',
  email: '',
  address: '',
  father_name: '',
  mother_name: '',
  guardian_name: '',
  entry_year: String(new Date().getFullYear()),
  graduation_year: '',
  status: 'AKTIF' as 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF',
  profile_id: '',
};

export default function ManajemenSiswaPage() {
  const [items, setItems] = useState<StudentItem[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/sdm?scope=siswa', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data siswa.');
      setItems(data.items || []);
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
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        (item.nis || '').toLowerCase().includes(q) ||
        (item.nisn || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      aktif: items.filter((i) => i.status === 'AKTIF').length,
      lulus: items.filter((i) => i.status === 'LULUS').length,
      mutasi: items.filter((i) => i.status === 'MUTASI').length,
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: StudentItem) {
    setEditingId(item.id);
    setForm({
      full_name: item.full_name || '',
      nis: item.nis || '',
      nisn: item.nisn || '',
      nik: item.nik || '',
      gender: item.gender || 'L',
      birth_place: item.birth_place || '',
      birth_date: item.birth_date || '',
      religion: item.religion || 'Islam',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      father_name: item.father_name || '',
      mother_name: item.mother_name || '',
      guardian_name: item.guardian_name || '',
      entry_year: item.entry_year ? String(item.entry_year) : '',
      graduation_year: item.graduation_year ? String(item.graduation_year) : '',
      status: item.status || 'AKTIF',
      profile_id: item.profile_id || '',
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
          scope: 'siswa',
          ...(editingId ? { id: editingId } : {}),
          ...form,
          entry_year: form.entry_year ? Number(form.entry_year) : null,
          graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data siswa.');
      setModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingId
          ? 'Data siswa berhasil diperbarui.'
          : 'Data siswa baru berhasil ditambahkan.',
      });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: StudentItem) {
    if (!confirm(`Hapus data siswa "${item.full_name}"?`)) return;
    try {
      const res = await fetch(`/api/sdm?scope=siswa&id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data siswa.');
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
          <h1 className="text-xl font-bold text-slate-900">Manajemen Siswa</h1>
          <p className="text-sm text-slate-500">
            Kelola data induk peserta didik, status akademik, dan penautan akun siswa.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Siswa
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
            <span>Total Data Siswa</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Siswa Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.aktif}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Lulus / Alumni</span>
            <GraduationCap className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.lulus}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Mutasi</span>
            <UserCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.mutasi}</p>
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
              placeholder="Cari nama siswa, NIS, NISN, atau email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="LULUS">Lulus (Alumni)</option>
            <option value="MUTASI">Mutasi</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-3">Nama Siswa</th>
                <th className="py-3 px-3">NIS / NISN</th>
                <th className="py-3 px-3">Tahun Masuk / Lulus</th>
                <th className="py-3 px-3">Akun Portal</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat data siswa...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada data siswa yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {item.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · {item.phone || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      <div>NIS: {item.nis || '-'}</div>
                      <div>NISN: {item.nisn || '-'}</div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      <div>Masuk: {item.entry_year || '-'}</div>
                      <div>Lulus: {item.graduation_year || '-'}</div>
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
                          item.status === 'AKTIF'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'LULUS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
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
                {editingId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIS</label>
                <input
                  type="text"
                  value={form.nis}
                  onChange={(e) => setForm({ ...form, nis: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NISN</label>
                <input
                  type="text"
                  value={form.nisn}
                  onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Jenis Kelamin
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="AKTIF">AKTIF</option>
                  <option value="LULUS">LULUS (Alumni)</option>
                  <option value="MUTASI">MUTASI</option>
                  <option value="NONAKTIF">NONAKTIF</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tahun Masuk
                </label>
                <input
                  type="number"
                  value={form.entry_year}
                  onChange={(e) => setForm({ ...form, entry_year: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tahun Lulus
                </label>
                <input
                  type="number"
                  value={form.graduation_year}
                  onChange={(e) => setForm({ ...form, graduation_year: e.target.value })}
                  placeholder="Isi jika sudah lulus"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP</label>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Ayah</label>
                <input
                  type="text"
                  value={form.father_name}
                  onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Ibu</label>
                <input
                  type="text"
                  value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tautkan Akun Portal Siswa
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
