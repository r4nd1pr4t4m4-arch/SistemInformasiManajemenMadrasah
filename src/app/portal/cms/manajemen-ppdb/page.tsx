'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
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

interface ToastState {
  type: 'ok' | 'err';
  text: string;
}

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

export default function ManajemenPpdbPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_PPDB_MANAGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState<PpdbPeriodRow | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [periods, setPeriods] = useState<PpdbPeriodRow[]>([]);

  const [form, setForm] = useState({
    name: 'PPDB Tahun Ajaran 2026/2027',
    open_date: '2026-01-01',
    close_date: '2026-07-15',
    announcement_date: '2026-07-20',
    pathway_quotas: { ...DEFAULT_PATHWAY_QUOTAS },
    is_active: true,
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function showToast(text: string, type: 'ok' | 'err' = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }

  const loadPeriods = useCallback(async (isSilent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isSilent) setLoading(true);
    try {
      const res = await fetch('/api/cms/ppdb-periods', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal memuat daftar periode PPDB.');
      }
      setPeriods(Array.isArray(data?.periods) ? data.periods : []);
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

    fetch('/api/cms/ppdb-periods', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat daftar periode PPDB.');
        return data;
      })
      .then((data) => {
        setPeriods(Array.isArray(data?.periods) ? data.periods : []);
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
    if (!confirmDeletePeriod) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeletePeriod(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeletePeriod, deletingId]);

  const totalQuota =
    (Number(form.pathway_quotas.DOMISILI) || 0) +
    (Number(form.pathway_quotas.AFIRMASI) || 0) +
    (Number(form.pathway_quotas.PRESTASI) || 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    const trimmedName = form.name.trim();
    if (trimmedName.length < 3) {
      showToast('Nama periode / gelombang minimal 3 karakter.', 'err');
      return;
    }
    if (!form.open_date || !form.close_date) {
      showToast('Tanggal buka dan tanggal tutup wajib diisi.', 'err');
      return;
    }
    if (form.close_date < form.open_date) {
      showToast('Tanggal tutup tidak boleh lebih awal dari tanggal buka.', 'err');
      return;
    }
    if (totalQuota < 1) {
      showToast('Total kuota seluruh jalur minimal 1 siswa.', 'err');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/cms/ppdb-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          open_date: form.open_date,
          close_date: form.close_date,
          announcement_date: form.announcement_date || null,
          pathway_quotas: {
            DOMISILI: Math.max(0, Number(form.pathway_quotas.DOMISILI) || 0),
            AFIRMASI: Math.max(0, Number(form.pathway_quotas.AFIRMASI) || 0),
            PRESTASI: Math.max(0, Number(form.pathway_quotas.PRESTASI) || 0),
          },
          is_active: form.is_active,
          quota: totalQuota,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyimpan periode PPDB.', 'err');
        return;
      }
      showToast('Periode pembukaan & kuota jalur PPDB berhasil disimpan.');
      await loadPeriods(true);
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan periode PPDB.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(period: PpdbPeriodRow) {
    setTogglingId(period.id);
    try {
      const res = await fetch('/api/cms/ppdb-periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: period.id, is_active: !period.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          !period.is_active
            ? `Periode "${period.name}" diaktifkan.`
            : `Periode "${period.name}" dinonaktifkan.`
        );
        await loadPeriods(true);
      } else {
        showToast(data?.error || 'Gagal mengubah status periode PPDB.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat memperbarui status periode.', 'err');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cms/ppdb-periods?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeletePeriod(null);
        showToast('Periode PPDB berhasil dihapus.');
        await loadPeriods(true);
      } else {
        showToast(data?.error || 'Gagal menghapus periode PPDB.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus periode PPDB.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat pengaturan periode PPDB...</span>
      </div>
    );
  }

  if (loadError && periods.length === 0) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center space-y-3 border border-rose-200">
        <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
        <h1 className="text-base sm:text-lg font-bold text-slate-900">
          Gagal Memuat Periode PPDB
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadPeriods(false)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
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
            <span className="break-words">{toast.text}</span>
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
        {canManage && (
          <form
            onSubmit={handleCreate}
            className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0"
          >
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Atur Periode &amp; Kuota Jalur PPDB</span>
            </h1>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Periode / Gelombang <span className="text-rose-600">*</span>
              </label>
              <input
                required
                minLength={3}
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Buka <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={form.open_date}
                  onChange={(e) => setForm({ ...form, open_date: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tutup <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="date"
                  min={form.open_date || undefined}
                  value={form.close_date}
                  onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pengumuman
                </label>
                <input
                  type="date"
                  value={form.announcement_date}
                  onChange={(e) => setForm({ ...form, announcement_date: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Kuota per Jalur Pendaftaran
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  Total: {totalQuota} Siswa
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    ['DOMISILI', 'Jalur Domisili'],
                    ['AFIRMASI', 'Jalur Afirmasi'],
                    ['PRESTASI', 'Jalur Prestasi'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.pathway_quotas[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pathway_quotas: {
                            ...form.pathway_quotas,
                            [key]: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              <span>Langsung aktifkan sebagai periode berjalan</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-2xl text-xs sm:text-sm transition shadow-xs"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Periode & Kuota PPDB'}</span>
            </button>
          </form>
        )}

        <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6 min-w-0`}>
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Daftar Periode PPDB ({periods.length})</span>
            </h2>

            {periods.length === 0 ? (
              <p className="text-sm text-slate-600">Belum ada periode PPDB yang dikonfigurasi.</p>
            ) : (
              <div className="space-y-3">
                {periods.map((p) => {
                  const pq = p.pathway_quotas || DEFAULT_PATHWAY_QUOTAS;
                  const isToggling = togglingId === p.id;
                  const isDeleting = deletingId === p.id;
                  return (
                    <div key={p.id} className="modular-card rounded-2xl p-4 space-y-2.5 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <p className="font-bold text-slate-900 text-sm break-words">{p.name}</p>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                              p.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {p.is_active ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isToggling || isDeleting}
                              onClick={() => handleToggleActive(p)}
                              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 transition"
                            >
                              {isToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>{p.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting || isToggling}
                              onClick={() => setConfirmDeletePeriod(p)}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                              title="Hapus Periode"
                              aria-label={`Hapus periode ${p.name}`}
                            >
                              {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 break-words">
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
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Standar Dokumen Persyaratan per Jalur</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PPDB_PATHWAYS.map((pw) => (
                <div key={pw.code} className="modular-card rounded-2xl p-4 space-y-2.5 text-xs min-w-0">
                  <p className="font-bold text-slate-900 break-words">{pw.title}</p>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Umum</p>
                    <ul className="list-disc pl-4 text-slate-600 space-y-0.5 mt-0.5">
                      {pw.generalDocs.map((d) => (
                        <li key={d.key} className="break-words">
                          {d.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-emerald-700">Khusus</p>
                    {pw.specialDocs.length === 0 ? (
                      <p className="text-slate-400 italic mt-0.5">Tidak ada syarat khusus.</p>
                    ) : (
                      <ul className="list-disc pl-4 text-emerald-800 font-medium space-y-0.5 mt-0.5">
                        {pw.specialDocs.map((d) => (
                          <li key={d.key} className="break-words">
                            {d.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Periode */}
      {confirmDeletePeriod && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-period-title"
          onClick={() => setConfirmDeletePeriod(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="delete-period-title" className="text-base font-bold text-slate-900">
              Hapus Periode PPDB?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
              Periode <strong>&ldquo;{confirmDeletePeriod.name}&rdquo;</strong> akan dihapus dari
              daftar pengaturan PPDB.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePeriod(null)}
                disabled={deletingId === confirmDeletePeriod.id}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeletePeriod.id)}
                disabled={deletingId === confirmDeletePeriod.id}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId === confirmDeletePeriod.id && (
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
