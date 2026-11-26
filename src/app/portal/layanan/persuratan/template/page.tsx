'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  classification_code: string | null;
  subject_template: string;
  body_template: string;
}

export default function PersuratanTemplatePage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [tplForm, setTplForm] = useState({
    name: '',
    category: 'SURAT_KETERANGAN_AKTIF',
    classification_code: 'PP.00.6',
    subject_template: 'Surat Keterangan Siswa Aktif — {{nama_siswa}}',
    body_template:
      'Menerangkan bahwa {{nama_siswa}} (NIS: {{nis}}, Kelas: {{kelas}}) adalah peserta didik aktif pada tanggal {{tanggal}}.',
  });

  const [mergeForm, setMergeForm] = useState({
    template_id: '',
    target_type: 'CLASSROOM_STUDENTS' as 'CLASSROOM_STUDENTS' | 'ALL_GTK',
    classroom_id: '',
    letter_date: new Date().toISOString().slice(0, 10),
    number_prefix: 'MM',
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/layanan/persuratan/templates', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTemplates(data.templates || []);
        setClassrooms(data.classrooms || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    } finally {
      setBusy(false);
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Template Builder */}
        <form
          onSubmit={handleCreateTemplate}
          className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 text-xs"
        >
          <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            Custom Template Builder Surat
          </h1>
          <p className="text-slate-500">
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
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={tplForm.category}
              onChange={(e) => setTplForm({ ...tplForm, category: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2"
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
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
            />
          </div>
          <input
            required
            value={tplForm.subject_template}
            onChange={(e) => setTplForm({ ...tplForm, subject_template: e.target.value })}
            placeholder="Template Perihal / Subjek *"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
          />
          <textarea
            required
            rows={4}
            value={tplForm.body_template}
            onChange={(e) => setTplForm({ ...tplForm, body_template: e.target.value })}
            placeholder="Isi naskah template..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
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
            <Layers className="w-5 h-5 text-emerald-700" />
            Penerbitan Surat Massal (Mail Merge)
          </h2>
          <p className="text-slate-500">
            Terbitkan surat keluar secara otomatis untuk seluruh siswa dalam 1 rombel atau seluruh GTK aktif sekaligus.
          </p>
          <select
            required
            value={mergeForm.template_id}
            onChange={(e) => setMergeForm({ ...mergeForm, template_id: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
          >
            <option value="CLASSROOM_STUDENTS">Siswa pada 1 Rombel</option>
            <option value="ALL_GTK">Seluruh GTK Aktif</option>
          </select>
          {mergeForm.target_type === 'CLASSROOM_STUDENTS' && (
            <select
              required
              value={mergeForm.classroom_id}
              onChange={(e) => setMergeForm({ ...mergeForm, classroom_id: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
              className="rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
            <input
              required
              value={mergeForm.number_prefix}
              onChange={(e) => setMergeForm({ ...mergeForm, number_prefix: e.target.value })}
              placeholder="Prefix Nomor (mis. SKA)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Terbitkan Surat Massal
          </button>
        </form>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Daftar Template Tersimpan ({templates.length})</h3>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="modular-card rounded-2xl p-4 flex items-start justify-between gap-3 border border-slate-200/80"
            >
              <div className="space-y-1">
                <p className="font-bold text-slate-900">{t.name}</p>
                <p className="text-emerald-700 font-semibold">{t.subject_template}</p>
                <p className="text-slate-600 line-clamp-2">{t.body_template}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/layanan/persuratan/templates?id=${encodeURIComponent(t.id)}`, {
                    method: 'DELETE',
                  });
                  await loadData();
                }}
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
