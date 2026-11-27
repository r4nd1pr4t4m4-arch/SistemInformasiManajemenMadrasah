'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

const EMPTY_FORM = { question: '', answer: '', sort_order: 0, is_published: true };

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition';

export default function CmsFaqPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteFaq, setConfirmDeleteFaq] = useState<FaqRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
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
    if (!confirmDeleteFaq) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteFaq(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteFaq, deletingId]);

  const loadFaqs = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/cms/faqs', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
      } else {
        setLoadError(data.error || 'Gagal memuat daftar FAQ.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat FAQ.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFaqs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFaqs]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cms/faqs', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan FAQ.', 'err');
        return;
      }
      showToast(editingId ? 'FAQ berhasil diperbarui.' : 'FAQ berhasil ditambahkan.');
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadFaqs();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan FAQ.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(faq: FaqRow) {
    if (!canManage || deletingId) return;
    setDeletingId(faq.id);
    try {
      const res = await fetch(`/api/cms/faqs?id=${encodeURIComponent(faq.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeleteFaq(null);
        if (editingId === faq.id) {
          setEditingId(null);
          setForm(EMPTY_FORM);
        }
        showToast('FAQ berhasil dihapus.');
        await loadFaqs();
      } else {
        showToast(data.error || 'Gagal menghapus FAQ.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus FAQ.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
                <HelpCircle className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>{editingId ? 'Edit Pertanyaan Umum (FAQ)' : 'Tambah FAQ Publik'}</span>
              </h1>
              <p className="text-xs text-slate-500">
                Pertanyaan yang sering diajukan oleh masyarakat dan calon wali murid di halaman /kontak.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pertanyaan *
              </label>
              <input
                required
                value={form.question}
                onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="mis. Bagaimana cara mendaftar PPDB secara daring?"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jawaban *</label>
              <textarea
                required
                rows={3}
                value={form.answer}
                onChange={(e) => setForm((prev) => ({ ...prev, answer: e.target.value }))}
                placeholder="Tuliskan jawaban yang jelas dan membantu..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-slate-700">Urutan:</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))
                    }
                    className="w-20 min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_published: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                  />
                  Tampilkan di Publik
                </label>
              </div>
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
                <span>{editingId ? 'Simpan Perubahan' : 'Simpan FAQ'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Daftar FAQ ({faqs.length})</h2>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadFaqs()}
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
              onClick={() => void loadFaqs()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat daftar FAQ...</span>
          </div>
        ) : faqs.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada FAQ yang terdaftar.
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="modular-card rounded-2xl p-4 space-y-2 text-xs border border-slate-200/80 min-w-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                        #{faq.sort_order}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          faq.is_published
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {faq.is_published ? 'Publik' : 'Draft'}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">{faq.question}</p>
                    <p className="text-slate-600 whitespace-pre-line [overflow-wrap:anywhere]">
                      {faq.answer}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(faq.id);
                          setForm({
                            question: faq.question,
                            answer: faq.answer,
                            sort_order: faq.sort_order,
                            is_published: faq.is_published,
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 transition"
                        title="Edit FAQ"
                        aria-label={`Edit FAQ ${faq.question}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === faq.id}
                        onClick={() => setConfirmDeleteFaq(faq)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-50 transition"
                        title="Hapus FAQ"
                        aria-label={`Hapus FAQ ${faq.question}`}
                      >
                        {deletingId === faq.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteFaq && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-faq-title"
          onClick={() => {
            if (!deletingId) setConfirmDeleteFaq(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="delete-faq-title" className="text-base font-bold text-slate-900">
              Hapus FAQ Ini?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Pertanyaan <strong>&ldquo;{confirmDeleteFaq.question}&rdquo;</strong> akan dihapus
              permanen dari halaman publik.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteFaq(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDelete(confirmDeleteFaq)}
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
