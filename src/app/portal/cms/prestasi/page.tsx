'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
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
import { normalizeSafeImageUrl } from '@/lib/storage/r2-url-helper';

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

function getTodayWibIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function createEmptyForm() {
  return {
    title: '',
    level: 'KABUPATEN' as AchievementRow['level'],
    rank: '',
    participant_name: '',
    achieved_at: getTodayWibIso(),
    organizer: '',
    image_url: '',
    description: '',
  };
}

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition';

export default function CmsPrestasiPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<AchievementRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(createEmptyForm);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteRow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteRow(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteRow, deletingId]);

  const loadRows = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/cms/achievements', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        setRows(Array.isArray(data.achievements) ? data.achievements : []);
      } else {
        setLoadError(data.error || 'Gagal memuat daftar prestasi.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat data prestasi.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRows();
    }, 0);
    return () => window.clearTimeout(timer);
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
      setForm(createEmptyForm());
      await loadRows();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan prestasi.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: AchievementRow) {
    if (!canManage || deletingId) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/cms/achievements?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeleteRow(null);
        if (editingId === row.id) {
          setEditingId(null);
          setForm(createEmptyForm());
        }
        showToast('Data prestasi berhasil dihapus.');
        await loadRows();
      } else {
        showToast(data.error || 'Gagal menghapus prestasi.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus prestasi.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="[overflow-wrap:anywhere]">{toast.text}</span>
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

      {canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-700 shrink-0" />
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
                  setForm(createEmptyForm());
                }}
                className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Judul Kejuaraan / Lomba *
              </label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="mis. Kompetisi Sains Madrasah (KSM) Matematika"
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat *</label>
              <select
                value={form.level}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, level: e.target.value as AchievementRow['level'] }))
                }
                className={INPUT_CLASS}
              >
                {LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Peringkat / Medali
              </label>
              <input
                value={form.rank}
                onChange={(e) => setForm((prev) => ({ ...prev, rank: e.target.value }))}
                placeholder="mis. Juara 1 / Medali Emas"
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Siswa / Tim Peraih *
              </label>
              <input
                required
                value={form.participant_name}
                onChange={(e) => setForm((prev) => ({ ...prev, participant_name: e.target.value }))}
                placeholder="Nama lengkap siswa atau tim"
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Prestasi *
              </label>
              <input
                type="date"
                required
                value={form.achieved_at}
                onChange={(e) => setForm((prev) => ({ ...prev, achieved_at: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Penyelenggara
              </label>
              <input
                value={form.organizer}
                onChange={(e) => setForm((prev) => ({ ...prev, organizer: e.target.value }))}
                placeholder="mis. Kemenag RI"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL Foto Dokumentasi (Opsional)
              </label>
              <input
                value={form.image_url}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ringkasan capaian..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{editingId ? 'Simpan Perubahan' : 'Simpan Prestasi'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Daftar Prestasi ({rows.length})</h2>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadRows()}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadRows()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat prestasi...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada data prestasi yang tercatat.
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => {
              const safeImageUrl = normalizeSafeImageUrl(row.image_url);
              const showImage = Boolean(safeImageUrl) && !brokenImages[row.id];
              return (
                <div
                  key={row.id}
                  className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-slate-200/80 min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
                    {showImage && safeImageUrl && (
                      <div className="w-full sm:w-28 aspect-video sm:aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={safeImageUrl}
                          alt={row.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [row.id]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
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
                      <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">
                        {row.title}
                      </p>
                      <p className="text-slate-600 [overflow-wrap:anywhere]">
                        Peraih: <strong>{row.participant_name}</strong>
                        {row.organizer ? ` • Penyelenggara: ${row.organizer}` : ''}
                      </p>
                    </div>
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
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-semibold transition"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === row.id}
                        onClick={() => setConfirmDeleteRow(row)}
                        className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold disabled:opacity-50 transition"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-achievement-title"
          onClick={() => {
            if (!deletingId) setConfirmDeleteRow(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="delete-achievement-title" className="text-base font-bold text-slate-900">
              Hapus Data Prestasi?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Prestasi <strong>&ldquo;{confirmDeleteRow.title}&rdquo;</strong> ({confirmDeleteRow.participant_name}) akan dihapus permanen.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteRow(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDelete(confirmDeleteRow)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
