'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, CheckCircle2, FileCheck2, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  DEFAULT_PATHWAY_QUOTAS,
  PPDB_PATHWAYS,
  type PathwayQuotas,
} from '@/lib/ppdb/pathways';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface PpdbPeriodRow {
  id: string;
  name: string;
  open_date: string;
  close_date: string;
  announcement_date: string | null;
  quota: number | null;
  pathway_quotas?: PathwayQuotas | null;
  is_active: boolean;
}

export default function ManajemenPpdbPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [periods, setPeriods] = useState<PpdbPeriodRow[]>([]);

  const [form, setForm] = useState({
    name: 'PPDB Tahun Ajaran 2026/2027',
    open_date: '2026-01-01',
    close_date: '2026-07-15',
    announcement_date: '2026-07-20',
    pathway_quotas: { ...DEFAULT_PATHWAY_QUOTAS },
    is_active: true,
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function loadPeriods() {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/ppdb-periods');
      const data = await res.json();
      setPeriods(data.periods || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  const totalQuota =
    form.pathway_quotas.DOMISILI +
    form.pathway_quotas.AFIRMASI +
    form.pathway_quotas.PRESTASI;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/cms/ppdb-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quota: totalQuota,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan periode PPDB.');
        return;
      }
      showToast('Periode pembukaan & kuota jalur PPDB berhasil disimpan.');
      await loadPeriods();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(period: PpdbPeriodRow) {
    const res = await fetch('/api/cms/ppdb-periods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: period.id, is_active: !period.is_active }),
    });
    if (res.ok) {
      showToast(
        !period.is_active
          ? `Periode "${period.name}" diaktifkan.`
          : `Periode "${period.name}" dinonaktifkan.`
      );
      await loadPeriods();
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/cms/ppdb-periods?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Periode PPDB dihapus.');
      await loadPeriods();
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat pengaturan periode PPDB...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {canManage && (
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-4 h-fit"
        >
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-700" /> Atur Periode &amp; Kuota Jalur PPDB
          </h1>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Periode / Gelombang
            </label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Buka</label>
              <input
                required
                type="date"
                value={form.open_date}
                onChange={(e) => setForm({ ...form, open_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tutup</label>
              <input
                required
                type="date"
                value={form.close_date}
                onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pengumuman</label>
              <input
                type="date"
                value={form.announcement_date}
                onChange={(e) => setForm({ ...form, announcement_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Kuota per Jalur Pendaftaran</span>
              <span className="text-xs font-bold text-emerald-700">Total: {totalQuota} Siswa</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Jalur Domisili
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.pathway_quotas.DOMISILI}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pathway_quotas: {
                        ...form.pathway_quotas,
                        DOMISILI: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Jalur Afirmasi
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.pathway_quotas.AFIRMASI}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pathway_quotas: {
                        ...form.pathway_quotas,
                        AFIRMASI: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Jalur Prestasi
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.pathway_quotas.PRESTASI}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pathway_quotas: {
                        ...form.pathway_quotas,
                        PRESTASI: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>Langsung aktifkan sebagai periode berjalan</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-2xl text-xs transition"
          >
            {saving ? 'Menyimpan...' : 'Simpan Periode & Kuota PPDB'}
          </button>
        </form>
        )}

        <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-emerald-700" /> Daftar Periode PPDB (
              {periods.length})
            </h2>

            {periods.length === 0 ? (
              <p className="text-sm text-slate-600">Belum ada periode PPDB yang dikonfigurasi.</p>
            ) : (
              <div className="space-y-3">
                {periods.map((p) => {
                  const pq = p.pathway_quotas || DEFAULT_PATHWAY_QUOTAS;
                  return (
                    <div
                      key={p.id}
                      className="modular-card rounded-2xl p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {p.is_active ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(p)}
                              className="px-3 py-1 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 transition"
                            >
                              {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                              title="Hapus Periode"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Buka: {p.open_date} s/d {p.close_date} • Pengumuman:{' '}
                        {p.announcement_date || '-'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold">
                          Domisili: {pq.DOMISILI}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 font-semibold">
                          Afirmasi: {pq.AFIRMASI}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold">
                          Prestasi: {pq.PRESTASI}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Referensi Dokumen Persyaratan Umum & Khusus per Jalur untuk Verifikasi Panitia */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-700" /> Standar Dokumen Persyaratan per Jalur
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {PPDB_PATHWAYS.map((pw) => (
                <div key={pw.code} className="modular-card rounded-2xl p-4 space-y-2 text-xs">
                  <p className="font-bold text-slate-900">{pw.title}</p>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Umum</p>
                    <ul className="list-disc pl-4 text-slate-600 space-y-0.5 mt-0.5">
                      {pw.generalDocs.map((d) => (
                        <li key={d.key}>{d.label}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-emerald-700">Khusus</p>
                    <ul className="list-disc pl-4 text-emerald-800 font-medium space-y-0.5 mt-0.5">
                      {pw.specialDocs.map((d) => (
                        <li key={d.key}>{d.label}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
