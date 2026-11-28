'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
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

interface ParsedImportFaq {
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

const EMPTY_FORM = { question: '', answer: '', sort_order: 0, is_published: true };

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition';

function parseBooleanValue(raw: unknown, defaultVal = true): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return defaultVal;
  if (['false', '0', 'tidak', 'no', 'draft', 'nonaktif'].includes(s)) return false;
  if (['true', '1', 'ya', 'yes', 'publik', 'published', 'aktif'].includes(s)) return true;
  return defaultVal;
}

function parseMarkdownFaqs(markdownText: string, startOrder = 0): ParsedImportFaq[] {
  const normalized = markdownText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const results: ParsedImportFaq[] = [];

  // Pola 1: Heading (## / ###) sebagai pertanyaan, isi di bawahnya sebagai jawaban
  const headingMatches = Array.from(normalized.matchAll(/^#{2,4}\s+(.+)$/gm));
  if (headingMatches.length > 0) {
    for (let i = 0; i < headingMatches.length; i++) {
      const current = headingMatches[i];
      const next = headingMatches[i + 1];
      const question = (current[1] || '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^(?:Q|T|Pertanyaan)\s*:\s*/i, '')
        .replace(/\*\*/g, '')
        .trim();
      const bodyStart = (current.index ?? 0) + current[0].length;
      const bodyEnd = next?.index ?? normalized.length;
      const answer = normalized
        .slice(bodyStart, bodyEnd)
        .replace(/^\s*(?:A|J|Jawaban)\s*:\s*/i, '')
        .trim();
      if (question.length >= 5 && answer.length >= 5) {
        results.push({
          question,
          answer,
          sort_order: startOrder + results.length,
          is_published: true,
        });
      }
    }
    if (results.length > 0) return results;
  }

  // Pola 2: Blok Q:/Pertanyaan: diikuti A:/Jawaban:
  const lines = normalized.split('\n');
  let curQ = '';
  let curA: string[] = [];
  const flushQA = () => {
    const q = curQ.trim();
    const a = curA.join('\n').trim();
    if (q.length >= 5 && a.length >= 5) {
      results.push({
        question: q,
        answer: a,
        sort_order: startOrder + results.length,
        is_published: true,
      });
    }
    curQ = '';
    curA = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const qMatch = /^(?:[-*]\s*)?(?:\d+[.)]\s*)?(?:\*\*)?(?:Q|T|Pertanyaan)\s*:\s*(.+?)(?:\*\*)?$/i.exec(
      line
    );
    const numberedBoldQ = /^(?:\d+[.)]\s*)\*\*(.+?)\*\*\s*$/.exec(line);
    const aMatch = /^(?:[-*]\s*)?(?:\*\*)?(?:A|J|Jawaban)\s*:\s*(.*)$/i.exec(line);

    if (qMatch) {
      flushQA();
      curQ = qMatch[1].replace(/\*\*/g, '').trim();
    } else if (numberedBoldQ && !curQ) {
      flushQA();
      curQ = numberedBoldQ[1].trim();
    } else if (aMatch && curQ) {
      if (aMatch[1].trim()) curA.push(aMatch[1].replace(/\*\*/g, '').trim());
    } else if (curQ) {
      if (line === '---' || line === '***') {
        flushQA();
      } else if (line || curA.length > 0) {
        curA.push(rawLine);
      }
    }
  }
  flushQA();

  return results;
}

export default function CmsFaqPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteFaq, setConfirmDeleteFaq] = useState<FaqRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBatchDeleteOpen, setConfirmBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Import state
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedImportFaq[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteFaq && !confirmBatchDeleteOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!deletingId) setConfirmDeleteFaq(null);
        if (!batchDeleting) setConfirmBatchDeleteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteFaq, confirmBatchDeleteOpen, deletingId, batchDeleting]);

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
        const nextFaqs: FaqRow[] = Array.isArray(data.faqs) ? data.faqs : [];
        setFaqs(nextFaqs);
        const validIds = new Set(nextFaqs.map((f) => f.id));
        setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
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
        setSelectedIds((prev) => prev.filter((id) => id !== faq.id));
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

  async function handleBatchDelete() {
    if (!canManage || batchDeleting || selectedIds.length === 0) return;
    setBatchDeleting(true);
    try {
      const res = await fetch('/api/cms/faqs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menghapus FAQ terpilih.', 'err');
        return;
      }
      if (editingId && selectedIds.includes(editingId)) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      const deletedCount = Number(data.deletedCount) || selectedIds.length;
      setSelectedIds([]);
      setConfirmBatchDeleteOpen(false);
      showToast(`${deletedCount} FAQ terpilih berhasil dihapus.`);
      await loadFaqs();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus FAQ secara batch.', 'err');
    } finally {
      setBatchDeleting(false);
    }
  }

  function toggleSelectFaq(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const allSelected = faqs.length > 0 && faqs.every((f) => selectedIds.includes(f.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(faqs.map((f) => f.id));
    }
  }

  function handleDownloadXlsxTemplate() {
    const sampleRows = [
      {
        Pertanyaan: 'Bagaimana cara mendaftar PPDB secara daring?',
        Jawaban:
          'Buka halaman /ppdb pada website resmi, pilih jalur pendaftaran, lengkapi biodata, unggah berkas persyaratan, lalu cetak Kartu Bukti Pendaftaran.',
        Urutan: 1,
        Publik: 'Ya',
      },
      {
        Pertanyaan: 'Dokumen apa saja yang wajib disiapkan saat mendaftar?',
        Jawaban:
          'Kartu Keluarga (KK), Akta Kelahiran, Ijazah/SKL, Pas Foto 3x4, serta dokumen khusus sesuai jalur yang dipilih.',
        Urutan: 2,
        Publik: 'Ya',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_FAQ');
    XLSX.writeFile(wb, 'Template_Import_FAQ.xlsx');
  }

  function handleDownloadMarkdownTemplate() {
    const mdContent = [
      '## Bagaimana cara mendaftar PPDB secara daring?',
      'Buka halaman /ppdb pada website resmi, pilih jalur pendaftaran, lengkapi biodata, unggah berkas persyaratan, lalu cetak Kartu Bukti Pendaftaran.',
      '',
      '## Dokumen apa saja yang wajib disiapkan saat mendaftar?',
      'Kartu Keluarga (KK), Akta Kelahiran, Ijazah/SKL, Pas Foto 3x4, serta dokumen khusus sesuai jalur yang dipilih.',
      '',
    ].join('\n');
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Import_FAQ.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const startOrder = faqs.length;
    try {
      let parsed: ParsedImportFaq[] = [];

      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
          showToast('File Excel tidak memiliki lembar kerja (sheet).', 'err');
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[firstSheet],
          { defval: '' }
        );
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const entries = Object.entries(row);
          const findVal = (patterns: RegExp[]) => {
            const found = entries.find(([k]) => patterns.some((p) => p.test(k.trim())));
            return found ? found[1] : '';
          };
          const qRaw = findVal([/^(pertanyaan|question|soal|q)$/i, /pertanyaan|question/i]);
          const aRaw = findVal([/^(jawaban|answer|a)$/i, /jawaban|answer/i]);
          const orderRaw = findVal([/^(urutan|sort_order|order|no)$/i]);
          const pubRaw = findVal([/^(publik|published|is_published|status|tampil)$/i]);

          const question = String(qRaw ?? '').trim();
          const answer = String(aRaw ?? '').trim();
          if (question.length >= 5 && answer.length >= 5) {
            const parsedOrder = Number(orderRaw);
            parsed.push({
              question,
              answer,
              sort_order:
                Number.isFinite(parsedOrder) && parsedOrder >= 0
                  ? Math.floor(parsedOrder)
                  : startOrder + parsed.length,
              is_published: parseBooleanValue(pubRaw, true),
            });
          }
        }
      } else if (
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.markdown') ||
        lowerName.endsWith('.txt')
      ) {
        const text = await file.text();
        parsed = parseMarkdownFaqs(text, startOrder);
      } else {
        showToast('Format file harus berupa .xlsx, .xls, atau .md (Markdown).', 'err');
        return;
      }

      if (parsed.length === 0) {
        showToast(
          'Tidak ditemukan pasangan Pertanyaan & Jawaban yang valid (minimal 5 karakter masing-masing).',
          'err'
        );
        setImportPreview([]);
        setImportFileName(null);
        return;
      }

      setImportPreview(parsed.slice(0, 200));
      setImportFileName(file.name);
      showToast(`Berhasil membaca ${Math.min(parsed.length, 200)} item FAQ dari ${file.name}.`);
    } catch {
      showToast('Gagal membaca berkas impor FAQ. Pastikan format file valid.', 'err');
    }
  }

  async function handleConfirmImport() {
    if (!canManage || importing || importPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/cms/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BATCH_IMPORT',
          items: importPreview,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal mengimpor data FAQ.', 'err');
        return;
      }
      const importedCount = Number(data.importedCount) || importPreview.length;
      showToast(`${importedCount} FAQ berhasil diimpor ke database.`);
      setImportPreview([]);
      setImportFileName(null);
      setShowImportPanel(false);
      await loadFaqs();
    } catch {
      showToast('Terjadi kesalahan jaringan saat mengimpor FAQ.', 'err');
    } finally {
      setImporting(false);
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
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={() => setShowImportPanel((prev) => !prev)}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  showImportPanel
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import XLSX / Markdown</span>
              </button>
            </div>
          </div>

          {showImportPanel && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-emerald-950">
                    Import Massal FAQ (.xlsx / .md)
                  </h2>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5">
                    Unggah file Excel (kolom: Pertanyaan, Jawaban, Urutan, Publik) atau Markdown
                    (heading <code>## Pertanyaan</code> diikuti paragraf jawaban, atau format{' '}
                    <code>Q:</code> / <code>A:</code>).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadXlsxTemplate}
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 text-[11px] font-semibold transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <Download className="w-3 h-3" />
                    <span>Template XLSX</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadMarkdownTemplate}
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <Download className="w-3 h-3" />
                    <span>Template Markdown</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.md,.markdown,.txt"
                  onChange={(e) => void handleImportFileChange(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-emerald-400 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>Pilih Berkas .xlsx atau .md</span>
                </button>
                {importFileName && (
                  <span className="text-xs text-slate-600 font-medium truncate">
                    File terpilih: <strong>{importFileName}</strong> ({importPreview.length} item)
                  </span>
                )}
              </div>

              {importPreview.length > 0 && (
                <div className="space-y-3">
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                    {importPreview.map((item, idx) => (
                      <div key={idx} className="p-3 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-900">
                            {idx + 1}. {item.question}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            #{item.sort_order} • {item.is_published ? 'Publik' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 whitespace-pre-line">
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => {
                        setImportPreview([]);
                        setImportFileName(null);
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => void handleConfirmImport()}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition"
                    >
                      {importing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {importing ? 'Mengimpor...' : `Import ${importPreview.length} FAQ`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">Daftar FAQ ({faqs.length})</h2>
            {canManage && faqs.length > 0 && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                />
                <span>Pilih Semua</span>
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && selectedIds.length > 0 && (
              <button
                type="button"
                disabled={batchDeleting}
                onClick={() => setConfirmBatchDeleteOpen(true)}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih ({selectedIds.length})</span>
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadFaqs()}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
          </div>
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
            {faqs.map((faq) => {
              const isSelected = selectedIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`modular-card rounded-2xl p-4 space-y-2 text-xs border min-w-0 transition ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-400/30'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectFaq(faq.id)}
                          aria-label={`Pilih FAQ ${faq.question}`}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600 shrink-0 cursor-pointer"
                        />
                      )}
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
                        <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">
                          {faq.question}
                        </p>
                        <p className="text-slate-600 whitespace-pre-line [overflow-wrap:anywhere]">
                          {faq.answer}
                        </p>
                      </div>
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
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-semibold transition"
                          title="Edit FAQ"
                          aria-label={`Edit FAQ ${faq.question}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === faq.id}
                          onClick={() => setConfirmDeleteFaq(faq)}
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold disabled:opacity-50 transition"
                          title="Hapus FAQ"
                          aria-label={`Hapus FAQ ${faq.question}`}
                        >
                          {deletingId === faq.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Tunggal */}
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

      {/* Modal Konfirmasi Hapus Batch */}
      {confirmBatchDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-delete-faq-title"
          onClick={() => {
            if (!batchDeleting) setConfirmBatchDeleteOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="batch-delete-faq-title" className="text-base font-bold text-slate-900">
              Hapus {selectedIds.length} FAQ Terpilih?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Sebanyak <strong>{selectedIds.length} item FAQ</strong> yang dipilih akan dihapus
              permanen dari database dan halaman publik. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={batchDeleting}
                onClick={() => setConfirmBatchDeleteOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={batchDeleting}
                onClick={() => void handleBatchDelete()}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {batchDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus Semua ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
