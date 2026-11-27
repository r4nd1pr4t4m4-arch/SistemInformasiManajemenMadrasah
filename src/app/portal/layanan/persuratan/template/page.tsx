'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  classification_code: string | null;
  subject_template: string;
  body_template: string;
}

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function PersuratanTemplatePage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteTpl, setConfirmDeleteTpl] = useState<TemplateRow | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [tplForm, setTplForm] = useState({
    name: '',
    category: 'SURAT_KETERANGAN_AKTIF',
    classification_code: 'PP.00.6',
    subject_template: 'Surat Keterangan Siswa Aktif — {{nama_siswa}}',
    body_template:
      'Menerangkan bahwa {{nama_siswa}} (NIS: {{nis}}, Kelas: {{kelas}}) adalah peserta didik aktif pada tanggal {{tanggal}}.',
  });

  const [mergeForm, setMergeForm] = useState(() => ({
    template_id: '',
    target_type: 'CLASSROOM_STUDENTS' as 'CLASSROOM_STUDENTS' | 'ALL_GTK',
    classroom_id: '',
    letter_date: getTodayWibIso(),
    number_prefix: 'MM',
  }));

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/layanan/persuratan/templates', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat daftar template surat.');
      } else {
        setTemplates(data.templates || []);
        setClassrooms(data.classrooms || []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadData]);

  useEffect(() => {
    if (!confirmDeleteTpl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteTpl(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteTpl, deletingId]);

  async function handleCreateTemplate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/layanan/persuratan/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_TEMPLATE', ...tplForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.error || 'Gagal menyimpan template.', 'err');
      else {
        showToast('Template surat kustom berhasil disimpan.');
        setTplForm((p) => ({ ...p, name: '' }));
        await loadData();
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan template.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleMailMerge(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/layanan/persuratan/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MAIL_MERGE_BATCH',
          ...mergeForm,
          classroom_id: mergeForm.classroom_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.error || 'Gagal menjalankan Mail Merge.', 'err');
      else {
        showToast(
          `Berhasil menerbitkan ${data.generatedCount} surat massal ke Buku Agenda Persuratan!`
        );
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menjalankan Mail Merge.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDeleteTpl() {
    if (!confirmDeleteTpl) return;
    setDeletingId(confirmDeleteTpl.id);
    try {
      const res = await fetch(
        `/api/layanan/persuratan/templates?id=${encodeURIComponent(confirmDeleteTpl.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menghapus template surat.', 'err');
        return;
      }
      showToast(`Template "${confirmDeleteTpl.name}" berhasil dihapus.`);
      setConfirmDeleteTpl(null);
      await loadData();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus template.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Template Builder */}
        <form
          onSubmit={handleCreateTemplate}
          className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 text-xs"
        >
          <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
            Custom Template Builder Surat
          </h1>
          <p className="text-slate-500 leading-relaxed">
            Gunakan variabel dinamis: <code className="bg-slate-100 px-1 rounded">{'{{nama_siswa}}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{nis}}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{kelas}}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{nama_gtk}}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{nip}}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{tanggal}}'}</code>.
          </p>
          <input
            required
            value={tplForm.name}
            onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
            placeholder="Nama Template (mis. Surat Undangan Rapat Wali Murid)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={tplForm.category}
              onChange={(e) => setTplForm({ ...tplForm, category: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            >
              <option value="SURAT_KETERANGAN_AKTIF">Surat Keterangan Aktif</option>
              <option value="SURAT_UNDANGAN">Surat Undangan</option>
              <option value="SURAT_EDARAN">Surat Edaran</option>
              <option value="SURAT_TUGAS">Surat Tugas / SK</option>
              <option value="SURAT_REKOMENDASI">Surat Rekomendasi</option>
            </select>
            <input
              value={tplForm.classification_code}
              onChange={(e) => setTplForm({ ...tplForm, classification_code: e.target.value })}
              placeholder="Kode Klasifikasi"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono"
            />
          </div>
          <input
            required
            value={tplForm.subject_template}
            onChange={(e) => setTplForm({ ...tplForm, subject_template: e.target.value })}
            placeholder="Template Perihal / Subjek *"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
          />
          <textarea
            required
            rows={4}
            value={tplForm.body_template}
            onChange={(e) => setTplForm({ ...tplForm, body_template: e.target.value })}
            placeholder="Isi naskah template..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Simpan Template
          </button>
        </form>

        {/* Mail Merge Massal */}
        <form
          onSubmit={handleMailMerge}
          className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 text-xs"
        >
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-700 shrink-0" />
            Penerbitan Surat Massal (Mail Merge)
          </h2>
          <p className="text-slate-500">
            Terbitkan surat keluar secara otomatis untuk seluruh siswa dalam 1 rombel atau seluruh GTK aktif sekaligus.
          </p>
          <select
            required
            value={mergeForm.template_id}
            onChange={(e) => setMergeForm({ ...mergeForm, template_id: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
          >
            <option value="">-- Pilih Template Surat --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
          <select
            value={mergeForm.target_type}
            onChange={(e) =>
              setMergeForm({
                ...mergeForm,
                target_type: e.target.value as 'CLASSROOM_STUDENTS' | 'ALL_GTK',
              })
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
          >
            <option value="CLASSROOM_STUDENTS">Siswa pada 1 Rombel</option>
            <option value="ALL_GTK">Seluruh GTK Aktif</option>
          </select>
          {mergeForm.target_type === 'CLASSROOM_STUDENTS' && (
            <select
              required
              value={mergeForm.classroom_id}
              onChange={(e) => setMergeForm({ ...mergeForm, classroom_id: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            >
              <option value="">-- Pilih Rombel Target --</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              required
              value={mergeForm.letter_date}
              onChange={(e) => setMergeForm({ ...mergeForm, letter_date: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
            />
            <input
              required
              value={mergeForm.number_prefix}
              onChange={(e) => setMergeForm({ ...mergeForm, number_prefix: e.target.value })}
              placeholder="Prefix Nomor (mis. SKA)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Terbitkan Surat Massal
          </button>
        </form>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900">Daftar Template Tersimpan ({templates.length})</h3>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>
        <div className="space-y-2">
          {templates.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
              {loading ? 'Memuat daftar template...' : 'Belum ada template surat tersimpan.'}
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="modular-card rounded-2xl p-4 flex items-start justify-between gap-3 border border-slate-200/80"
              >
                <div className="space-y-1 min-w-0">
                  <p className="font-bold text-slate-900 break-words">{t.name}</p>
                  <p className="text-emerald-700 font-semibold break-words">{t.subject_template}</p>
                  <p className="text-slate-600 line-clamp-2 break-words">{t.body_template}</p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => setConfirmDeleteTpl(t)}
                  aria-label={`Hapus template ${t.name}`}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 shrink-0 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Template */}
      {confirmDeleteTpl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-delete-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) setConfirmDeleteTpl(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 id="tpl-delete-modal-title" className="text-base font-bold text-slate-900">
                  Hapus Template Surat?
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  Anda akan menghapus template <strong className="text-slate-900">{confirmDeleteTpl.name}</strong>. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteTpl(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleConfirmDeleteTpl()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
