'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Edit3,
  GraduationCap,
  Link2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';

type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type AlumniStudent = {
  id: string;
  profile_id: string | null;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  graduation_year: number | null;
  profile?: ActiveAccount | null;
};

type ActiveStudent = {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
};

type AlumniTracer = {
  id: string;
  student_id: string | null;
  full_name: string;
  graduation_year: number;
  phone: string | null;
  email: string | null;
  current_activity: 'KULIAH' | 'BEKERJA' | 'WIRAUSAHA' | 'PESANTREN' | 'MENCARI_KERJA' | 'LAINNYA';
  institution_or_company: string | null;
  major_or_position: string | null;
  city: string | null;
  testimonial: string | null;
};

const EMPTY_TRACER_FORM = {
  student_id: '',
  full_name: '',
  graduation_year: String(new Date().getFullYear()),
  phone: '',
  email: '',
  current_activity: 'KULIAH' as AlumniTracer['current_activity'],
  institution_or_company: '',
  major_or_position: '',
  city: '',
  testimonial: '',
};

export default function ManajemenAlumniPage() {
  const [tab, setTab] = useState<'lulusan' | 'tracer'>('lulusan');
  const [alumniStudents, setAlumniStudents] = useState<AlumniStudent[]>([]);
  const [tracers, setTracers] = useState<AlumniTracer[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [tracerModalOpen, setTracerModalOpen] = useState(false);
  const [editingTracerId, setEditingTracerId] = useState<string | null>(null);
  const [tracerForm, setTracerForm] = useState(EMPTY_TRACER_FORM);

  const [graduateModalOpen, setGraduateModalOpen] = useState(false);
  const [graduateStudentId, setGraduateStudentId] = useState('');
  const [graduateYear, setGraduateYear] = useState(String(new Date().getFullYear()));

  const [linkModalStudent, setLinkModalStudent] = useState<AlumniStudent | null>(null);
  const [linkProfileId, setLinkProfileId] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/sdm?scope=alumni', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data alumni.');
      setAlumniStudents(data.alumniStudents || []);
      setTracers(data.tracers || []);
      setActiveStudents(data.activeStudents || []);
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

  const filteredLulusan = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alumniStudents;
    return alumniStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        String(s.graduation_year || '').includes(q)
    );
  }, [alumniStudents, search]);

  const filteredTracers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracers;
    return tracers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        (t.institution_or_company || '').toLowerCase().includes(q) ||
        String(t.graduation_year).includes(q)
    );
  }, [tracers, search]);

  function openCreateTracer() {
    setEditingTracerId(null);
    setTracerForm(EMPTY_TRACER_FORM);
    setTracerModalOpen(true);
  }

  function openEditTracer(item: AlumniTracer) {
    setEditingTracerId(item.id);
    setTracerForm({
      student_id: item.student_id || '',
      full_name: item.full_name,
      graduation_year: String(item.graduation_year),
      phone: item.phone || '',
      email: item.email || '',
      current_activity: item.current_activity,
      institution_or_company: item.institution_or_company || '',
      major_or_position: item.major_or_position || '',
      city: item.city || '',
      testimonial: item.testimonial || '',
    });
    setTracerModalOpen(true);
  }

  async function handleSubmitTracer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: editingTracerId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'alumni-tracer',
          ...(editingTracerId ? { id: editingTracerId } : {}),
          ...tracerForm,
          graduation_year: Number(tracerForm.graduation_year),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tracer alumni.');
      setTracerModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingTracerId
          ? 'Data tracer alumni berhasil diperbarui.'
          : 'Data tracer alumni baru berhasil ditambahkan.',
      });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleGraduate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'alumni-graduate',
          student_id: graduateStudentId,
          graduation_year: Number(graduateYear),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal meluluskan siswa.');
      setGraduateModalOpen(false);
      setGraduateStudentId('');
      setMessage({ type: 'ok', text: 'Siswa berhasil ditetapkan sebagai Alumni (LULUS).' });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkModalStudent) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'siswa',
          id: linkModalStudent.id,
          profile_id: linkProfileId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menautkan akun alumni.');
      setLinkModalStudent(null);
      setMessage({ type: 'ok', text: 'Penautan akun alumni berhasil disimpan.' });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTracer(item: AlumniTracer) {
    if (!confirm(`Hapus data tracer alumni "${item.full_name}"?`)) return;
    try {
      const res = await fetch(`/api/sdm?scope=alumni-tracer&id=${item.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data tracer.');
      setMessage({ type: 'ok', text: `Data tracer ${item.full_name} berhasil dihapus.` });
      await loadData();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Alumni</h1>
          <p className="text-sm text-slate-500">
            Kelola data lulusan madrasah, penautan akun alumni, serta data tracer study alumni.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGraduateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Luluskan Siswa
          </button>
          <button
            onClick={openCreateTracer}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Tracer Alumni
          </button>
        </div>
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Alumni (Siswa Lulus)</span>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{alumniStudents.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Data Tracer Study</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{tracers.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Akun Alumni Tertaut</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {alumniStudents.filter((a) => !!a.profile_id).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTab('lulusan')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'lulusan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Daftar Lulusan ({alumniStudents.length})
            </button>
            <button
              onClick={() => setTab('tracer')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'tracer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Tracer Study ({tracers.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIS, atau tahun lulus..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {tab === 'lulusan' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-3">Nama Alumni</th>
                  <th className="py-3 px-3">NIS / NISN</th>
                  <th className="py-3 px-3">Tahun Lulus</th>
                  <th className="py-3 px-3">Akun Portal</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Memuat data alumni...
                    </td>
                  </tr>
                ) : filteredLulusan.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada siswa berstatus LULUS.
                    </td>
                  </tr>
                ) : (
                  filteredLulusan.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{item.full_name}</p>
                        <p className="text-xs text-slate-500">
                          {item.phone || '-'} · {item.email || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        <div>NIS: {item.nis || '-'}</div>
                        <div>NISN: {item.nisn || '-'}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {item.graduation_year || '-'}
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
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setLinkModalStudent(item);
                            setLinkProfileId(item.profile_id || '');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Tautkan Akun
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-3">Nama Alumni</th>
                  <th className="py-3 px-3">Angkatan</th>
                  <th className="py-3 px-3">Aktivitas Saat Ini</th>
                  <th className="py-3 px-3">Instansi / Kampus</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Memuat tracer study...
                    </td>
                  </tr>
                ) : filteredTracers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada data tracer study alumni.
                    </td>
                  </tr>
                ) : (
                  filteredTracers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{item.full_name}</p>
                        <p className="text-xs text-slate-500">{item.city || '-'}</p>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {item.graduation_year}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                          {item.current_activity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700">
                        <p className="font-medium">{item.institution_or_company || '-'}</p>
                        <p className="text-slate-400">{item.major_or_position || '-'}</p>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditTracer(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTracer(item)}
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
        )}
      </div>

      {graduateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Tetapkan Siswa sebagai Alumni</h2>
              <button
                onClick={() => setGraduateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGraduate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pilih Siswa Aktif *
                </label>
                <select
                  required
                  value={graduateStudentId}
                  onChange={(e) => setGraduateStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tahun Lulus *
                </label>
                <input
                  required
                  type="number"
                  value={graduateYear}
                  onChange={(e) => setGraduateYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGraduateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
                  {saving ? 'Memproses...' : 'Luluskan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkModalStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Tautkan Akun Alumni</h2>
              <button
                onClick={() => setLinkModalStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLink} className="space-y-4 text-sm">
              <p className="text-xs text-slate-600">
                Alumni: <span className="font-semibold text-slate-900">{linkModalStudent.full_name}</span>
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Akun Portal Aktif
                </label>
                <select
                  value={linkProfileId}
                  onChange={(e) => setLinkProfileId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Lepas Tautan --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.full_name} ({acc.email || acc.phone || acc.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkModalStudent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tracerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingTracerId ? 'Edit Tracer Alumni' : 'Tambah Tracer Alumni'}
              </h2>
              <button
                onClick={() => setTracerModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitTracer} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  required
                  type="text"
                  value={tracerForm.full_name}
                  onChange={(e) => setTracerForm({ ...tracerForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tahun Lulus *
                </label>
                <input
                  required
                  type="number"
                  value={tracerForm.graduation_year}
                  onChange={(e) => setTracerForm({ ...tracerForm, graduation_year: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Aktivitas Saat Ini
                </label>
                <select
                  value={tracerForm.current_activity}
                  onChange={(e) =>
                    setTracerForm({
                      ...tracerForm,
                      current_activity: e.target.value as AlumniTracer['current_activity'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="KULIAH">Kuliah</option>
                  <option value="BEKERJA">Bekerja</option>
                  <option value="WIRAUSAHA">Wirausaha</option>
                  <option value="PESANTREN">Pesantren</option>
                  <option value="MENCARI_KERJA">Mencari Kerja</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Instansi / Kampus / Usaha
                </label>
                <input
                  type="text"
                  value={tracerForm.institution_or_company}
                  onChange={(e) =>
                    setTracerForm({ ...tracerForm, institution_or_company: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Jurusan / Jabatan
                </label>
                <input
                  type="text"
                  value={tracerForm.major_or_position}
                  onChange={(e) =>
                    setTracerForm({ ...tracerForm, major_or_position: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kota</label>
                <input
                  type="text"
                  value={tracerForm.city}
                  onChange={(e) => setTracerForm({ ...tracerForm, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tautkan Data Siswa Lulus (Opsional)
                </label>
                <select
                  value={tracerForm.student_id}
                  onChange={(e) => setTracerForm({ ...tracerForm, student_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Tidak Ditautkan --</option>
                  {alumniStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} (Lulus {s.graduation_year || '-'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Testimoni / Pesan
                </label>
                <textarea
                  rows={2}
                  value={tracerForm.testimonial}
                  onChange={(e) => setTracerForm({ ...tracerForm, testimonial: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTracerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
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
