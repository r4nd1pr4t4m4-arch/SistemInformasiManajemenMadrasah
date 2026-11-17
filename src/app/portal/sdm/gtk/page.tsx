'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
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

type GtkItem = {
  id: string;
  profile_id: string | null;
  staff_type: 'GURU' | 'TATA_USAHA' | 'LAINNYA';
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  nik: string | null;
  gender: 'L' | 'P' | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  education_level: string | null;
  major: string | null;
  employment_status: string | null;
  join_date: string | null;
  is_active: boolean;
  show_in_public_directory: boolean;
  profile?: ActiveAccount | null;
};

const EMPTY_FORM = {
  full_name: '',
  staff_type: 'GURU' as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
  nip: '',
  nuptk: '',
  nik: '',
  gender: 'L' as 'L' | 'P',
  birth_place: '',
  birth_date: '',
  phone: '',
  email: '',
  address: '',
  education_level: 'S1',
  major: '',
  employment_status: 'GTY',
  join_date: '',
  profile_id: '',
  is_active: true,
  show_in_public_directory: true,
};

export default function ManajemenGtkPage() {
  const [items, setItems] = useState<GtkItem[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterActive, setFilterActive] = useState<string>('ALL');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/sdm?scope=gtk', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data GTK.');
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
      if (filterType !== 'ALL' && item.staff_type !== filterType) return false;
      if (filterActive === 'AKTIF' && !item.is_active) return false;
      if (filterActive === 'NONAKTIF' && item.is_active) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        (item.nip || '').toLowerCase().includes(q) ||
        (item.nuptk || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, filterType, filterActive]);

  const stats = useMemo(() => {
    const total = items.length;
    const guru = items.filter((i) => i.staff_type === 'GURU').length;
    const tu = items.filter((i) => i.staff_type === 'TATA_USAHA').length;
    const active = items.filter((i) => i.is_active).length;
    return { total, guru, tu, active };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: GtkItem) {
    setEditingId(item.id);
    setForm({
      full_name: item.full_name || '',
      staff_type: item.staff_type || 'GURU',
      nip: item.nip || '',
      nuptk: item.nuptk || '',
      nik: item.nik || '',
      gender: item.gender || 'L',
      birth_place: item.birth_place || '',
      birth_date: item.birth_date || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      education_level: item.education_level || '',
      major: item.major || '',
      employment_status: item.employment_status || 'GTY',
      join_date: item.join_date || '',
      profile_id: item.profile_id || '',
      is_active: item.is_active,
      show_in_public_directory: item.show_in_public_directory,
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
          scope: 'gtk',
          ...(editingId ? { id: editingId } : {}),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data GTK.');
      setModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingId ? 'Data GTK berhasil diperbarui.' : 'Data GTK baru berhasil ditambahkan.',
      });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: GtkItem) {
    try {
      const res = await fetch('/api/sdm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'gtk',
          id: item.id,
          is_active: !item.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status GTK.');
      setMessage({ type: 'ok', text: `Status ${item.full_name} berhasil diperbarui.` });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    }
  }

  async function handleDelete(item: GtkItem) {
    if (!confirm(`Hapus data GTK "${item.full_name}"?`)) return;
    try {
      const res = await fetch(`/api/sdm?scope=gtk&id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data GTK.');
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
          <h1 className="text-xl font-bold text-slate-900">Manajemen GTK</h1>
          <p className="text-sm text-slate-500">
            Kelola data Guru dan Tenaga Kependidikan, status kepegawaian, dan penautan akun portal.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah GTK
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
            <span>Total GTK</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tenaga Pendidik (Guru)</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.guru}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tata Usaha</span>
            <UserCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.tu}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>GTK Aktif</span>
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
              placeholder="Cari nama, NIP, NUPTK, atau email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="ALL">Semua Jenis GTK</option>
            <option value="GURU">Guru</option>
            <option value="TATA_USAHA">Tata Usaha</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-3">Nama & Kontak</th>
                <th className="py-3 px-3">Jenis & Status Pegawai</th>
                <th className="py-3 px-3">NIP / NUPTK</th>
                <th className="py-3 px-3">Akun Portal</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat data GTK...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada data GTK yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {item.email || '-'} · {item.phone || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {item.staff_type}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.employment_status || '-'} · {item.education_level || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      <div>NIP: {item.nip || '-'}</div>
                      <div>NUPTK: {item.nuptk || '-'}</div>
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
                      <button
                        onClick={() => toggleStatus(item)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
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
                {editingId ? 'Edit Data GTK' : 'Tambah Data GTK'}
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis GTK</label>
                <select
                  value={form.staff_type}
                  onChange={(e) =>
                    setForm({ ...form, staff_type: e.target.value as 'GURU' | 'TATA_USAHA' | 'LAINNYA' })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="GURU">Guru</option>
                  <option value="TATA_USAHA">Tata Usaha</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Status Kepegawaian
                </label>
                <select
                  value={form.employment_status}
                  onChange={(e) => setForm({ ...form, employment_status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="PNS">PNS</option>
                  <option value="PPPK">PPPK</option>
                  <option value="GTY">GTY</option>
                  <option value="GTT">GTT</option>
                  <option value="PTY">PTY</option>
                  <option value="PTT">PTT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIP</label>
                <input
                  type="text"
                  value={form.nip}
                  onChange={(e) => setForm({ ...form, nip: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NUPTK</label>
                <input
                  type="text"
                  value={form.nuptk}
                  onChange={(e) => setForm({ ...form, nuptk: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pendidikan Terakhir
                </label>
                <input
                  type="text"
                  value={form.education_level}
                  onChange={(e) => setForm({ ...form, education_level: e.target.value })}
                  placeholder="Contoh: S1 / S2"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jurusan</label>
                <input
                  type="text"
                  value={form.major}
                  onChange={(e) => setForm({ ...form, major: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tautkan Akun Portal Aktif
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
