'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

export interface SdmDocumentItem {
  id: string;
  document_type: string;
  document_title: string | null;
  document_number: string | null;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  verification_status?: 'MENUNGGU' | 'TERVERIFIKASI' | 'DITOLAK';
  created_at: string;
}

export interface DocumentTypeOption {
  value: string;
  label: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SdmDocumentSection({
  entityType,
  entityId,
  documentOptions,
  documents,
  onRefresh,
  supportsVerification = false,
  allowSelfManage = false,
}: {
  entityType: 'GTK' | 'ORANG_TUA' | 'SISWA' | 'ALUMNI';
  entityId: string;
  documentOptions: DocumentTypeOption[];
  documents: SdmDocumentItem[];
  onRefresh: () => Promise<void>;
  supportsVerification?: boolean;
  allowSelfManage?: boolean;
}) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SDM_MANAGE) || allowSelfManage;
  const [docType, setDocType] = useState(documentOptions[0]?.value || 'LAINNYA');
  const [docTitle, setDocTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleUpload(file: File) {
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      setMessage({ type: 'err', text: 'Format file harus JPG, PNG, WEBP, atau PDF.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'err', text: 'Ukuran file maksimal 5 MB.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity_type', entityType);
      fd.append('entity_id', entityId);
      fd.append('document_type', effectiveDocType);
      if (docTitle.trim()) fd.append('document_title', docTitle.trim());
      if (docNumber.trim()) fd.append('document_number', docNumber.trim());

      const res = await fetch('/api/sdm/documents', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah dokumen.');
      setDocTitle('');
      setDocNumber('');
      setMessage({ type: 'ok', text: `Dokumen "${file.name}" berhasil diunggah.` });
      await onRefresh();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify(docId: string, status: 'TERVERIFIKASI' | 'DITOLAK') {
    if (busyDocId) return;
    setBusyDocId(docId);
    try {
      const res = await fetch('/api/sdm/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, verification_status: status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status verifikasi.');
      await onRefresh();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleDelete(doc: SdmDocumentItem) {
    if (busyDocId) return;
    setBusyDocId(doc.id);
    try {
      const res = await fetch(
        `/api/sdm/documents?entity_type=${entityType}&id=${doc.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus dokumen.');
      setConfirmDeleteId(null);
      setMessage({ type: 'ok', text: `Dokumen "${doc.file_name}" dihapus.` });
      await onRefresh();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setBusyDocId(null);
    }
  }

  const effectiveDocType = documentOptions.some((o) => o.value === docType)
    ? docType
    : documentOptions[0]?.value || 'LAINNYA';
  const labelByType = new Map(documentOptions.map((o) => [o.value, o.label]));

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Dokumen Terkait ({documents.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Unggah atau kelola scan dokumen resmi (JPG, PNG, WEBP, PDF maks 5 MB).
          </p>
        </div>
      </div>

      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          className={`p-3 rounded-xl text-xs border flex items-start sm:items-center justify-between gap-2 ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="break-words">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Tutup pesan dokumen"
            className="p-1 rounded-md hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {canManage && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
        <select
          aria-label="Jenis dokumen"
          value={effectiveDocType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full min-w-0 min-h-[40px] px-3 py-2 rounded-xl border border-slate-300/90 bg-white text-sm sm:text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
        >
          {documentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          aria-label="Nomor dokumen"
          placeholder="Nomor Dokumen (opsional)"
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
          className="w-full min-w-0 min-h-[40px] px-3 py-2 rounded-xl border border-slate-300/90 bg-white text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
        />

        <input
          type="text"
          aria-label="Keterangan atau judul dokumen"
          placeholder="Keterangan / Judul (opsional)"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          className="w-full min-w-0 min-h-[40px] px-3 py-2 rounded-xl border border-slate-300/90 bg-white text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
        />

        <label
          className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold transition ${
            uploading
              ? 'opacity-60 pointer-events-none'
              : 'hover:bg-emerald-700 cursor-pointer shadow-xs'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengunggah...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" /> Pilih &amp; Upload
            </>
          )}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = '';
            }}
            className="hidden"
          />
        </label>
      </div>
      )}

      {documents.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">
          Belum ada dokumen yang diunggah.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const sizeLabel = formatFileSize(doc.file_size);
            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs min-w-0 hover:border-slate-300 transition"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900 break-words">
                      {labelByType.get(doc.document_type) || doc.document_type.replace(/_/g, ' ')}
                    </span>
                    {supportsVerification && doc.verification_status && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          doc.verification_status === 'TERVERIFIKASI'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.verification_status === 'DITOLAK'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {doc.verification_status}
                      </span>
                    )}
                  </div>
                  {doc.document_title && (
                    <p className="text-slate-700 font-medium break-words">{doc.document_title}</p>
                  )}
                  <p className="text-slate-500 break-all">
                    {doc.file_name}
                    {sizeLabel ? ` (${sizeLabel})` : ''}
                    {doc.document_number ? ` • No: ${doc.document_number}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-start">
                  {canManage && supportsVerification && (
                    <>
                      <button
                        type="button"
                        disabled={busyDocId === doc.id}
                        onClick={() => handleVerify(doc.id, 'TERVERIFIKASI')}
                        title="Verifikasi Dokumen"
                        aria-label={`Verifikasi ${doc.file_name}`}
                        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busyDocId === doc.id}
                        onClick={() => handleVerify(doc.id, 'DITOLAK')}
                        title="Tolak Dokumen"
                        aria-label={`Tolak ${doc.file_name}`}
                        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 rounded-xl text-amber-600 hover:bg-amber-50 disabled:opacity-40 transition"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition"
                    title="Buka / Pratinjau"
                    aria-label={`Buka ${doc.file_name}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {canManage &&
                    (confirmDeleteId === doc.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busyDocId === doc.id}
                          onClick={() => handleDelete(doc)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {busyDocId === doc.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          Hapus
                        </button>
                        <button
                          type="button"
                          disabled={busyDocId === doc.id}
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(busyDocId)}
                        onClick={() => setConfirmDeleteId(doc.id)}
                        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
                        title="Hapus"
                        aria-label={`Hapus ${doc.file_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
