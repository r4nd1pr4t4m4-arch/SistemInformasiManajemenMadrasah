'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface AchievementRow {
  id: string;
  title: string;
  level: 'SEKOLAH' | 'KECAMATAN' | 'KABUPATEN' | 'PROVINSI' | 'NASIONAL' | 'INTERNASIONAL';
  rank: string | null;
  participant_name: string;
  achieved_at: string;
  organizer: string | null;
  image_url: string | null;
  description: string | null;
}

const LEVELS: AchievementRow['level'][] = [
  'SEKOLAH',
  'KECAMATAN',
  'KABUPATEN',
  'PROVINSI',
  'NASIONAL',
  'INTERNASIONAL',
];

const EMPTY_FORM = {
  title: '',
  level: 'KABUPATEN' as AchievementRow['level'],
  rank: '',
  participant_name: '',
  achieved_at: new Date().toISOString().slice(0, 10),
  organizer: '',
  image_url: '',
  description: '',
};

export default function CmsPrestasiPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/achievements', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRows(Array.isArray(data.achievements) ? data.achievements : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cms/achievements', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan data prestasi.', 'err');
        return;
      }
      showToast(editingId ? 'Data prestasi berhasil diperbarui.' : 'Prestasi berhasil ditambahkan.');
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadRows();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm('Hapus data prestasi ini?')) return;
    const res = await fetch(`/api/cms/achievements?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Data prestasi berhasil dihapus.');
      await loadRows();
    } else {
      showToast('Gagal menghapus prestasi.', 'err');
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-700" />
                <span>{editingId ? 'Edit Data Prestasi' : 'Tambah Prestasi Siswa & Lembaga'}</span>
              </h1>
              <p className="text-xs text-slate-500">
                Rekam prestasi akademik maupun non-akademik yang akan ditampilkan pada Direktori Prestasi publik.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Judul Kejuaraan / Lomba *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="mis. Kompetisi Sains Madrasah (KSM) Matematika"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tingkat *</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as AchievementRow['level'] })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Peringkat / Medali</label>
              <input
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                placeholder="mis. Juara 1 / Medali Emas"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Siswa / Tim Peraih *</label>
              <input
                required
                value={form.participant_name}
                onChange={(e) => setForm({ ...form, participant_name: e.target.value })}
                placeholder="Nama lengkap siswa atau tim"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Prestasi *</label>
              <input
                type="date"
                required
                value={form.achieved_at}
                onChange={(e) => setForm({ ...form, achieved_at: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Penyelenggara</label>
              <input
                value={form.organizer}
                onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                placeholder="mis. Kemenag RI"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">URL Foto Dokumentasi (Opsional)</label>
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ringkasan capaian..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Simpan Perubahan' : 'Simpan Prestasi'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Daftar Prestasi ({rows.length})</h2>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Memuat prestasi...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada data prestasi yang tercatat.
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => (
              <div
                key={row.id}
                className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-slate-200/80"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px]">
                      {row.level}
                    </span>
                    {row.rank && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.rank}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{row.achieved_at}</span>
                  </div>
                  <p className="font-bold text-slate-900">{row.title}</p>
                  <p className="text-slate-600">
                    Peraih: <strong>{row.participant_name}</strong>
                    {row.organizer ? ` • Penyelenggara: ${row.organizer}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(row.id);
                        setForm({
                          title: row.title,
                          level: row.level,
                          rank: row.rank || '',
                          participant_name: row.participant_name,
                          achieved_at: row.achieved_at,
                          organizer: row.organizer || '',
                          image_url: row.image_url || '',
                          description: row.description || '',
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-semibold"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
