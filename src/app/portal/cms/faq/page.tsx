'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

export default function CmsFaqPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/faqs', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFaqs();
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
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm('Hapus FAQ ini?')) return;
    const res = await fetch(`/api/cms/faqs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('FAQ berhasil dihapus.');
      await loadFaqs();
    } else {
      showToast('Gagal menghapus FAQ.', 'err');
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
                <HelpCircle className="w-5 h-5 text-emerald-700" />
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
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pertanyaan *</label>
              <input
                required
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="mis. Bagaimana cara mendaftar PPDB secara daring?"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jawaban *</label>
              <textarea
                required
                rows={3}
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="Tuliskan jawaban yang jelas dan membantu..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-slate-700">Urutan:</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                    className="w-20 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  Tampilkan di Publik
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Simpan Perubahan' : 'Simpan FAQ'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Daftar FAQ ({faqs.length})</h2>
          <button
            type="button"
            onClick={() => void loadFaqs()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Memuat daftar FAQ...</div>
        ) : faqs.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada FAQ yang terdaftar.
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.id} className="modular-card rounded-2xl p-4 space-y-2 text-xs border border-slate-200/80">
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
                    <p className="font-bold text-slate-900">{faq.question}</p>
                    <p className="text-slate-600 whitespace-pre-line">{faq.answer}</p>
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
                        }}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700"
                        title="Edit FAQ"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(faq.id)}
                        className="p-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                        title="Hapus FAQ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
