'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
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
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity_type', entityType);
      fd.append('entity_id', entityId);
      fd.append('document_type', docType);
      if (docTitle.trim()) fd.append('document_title', docTitle.trim());
      if (docNumber.trim()) fd.append('document_number', docNumber.trim());

      const res = await fetch('/api/sdm/documents', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
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
    try {
      const res = await fetch('/api/sdm/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, verification_status: status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status verifikasi.');
      await onRefresh();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    }
  }

  async function handleDelete(doc: SdmDocumentItem) {
    if (!confirm(`Hapus dokumen "${doc.file_name}"?`)) return;
    try {
      const res = await fetch(
        `/api/sdm/documents?entity_type=${entityType}&id=${doc.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus dokumen.');
      setMessage({ type: 'ok', text: `Dokumen "${doc.file_name}" dihapus.` });
      await onRefresh();
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    }
  }

  const labelByType = new Map(documentOptions.map((o) => [o.value, o.label]));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Dokumen Terkait ({documents.length})
          </h2>
          <p className="text-xs text-slate-500">
            Unggah atau kelola scan dokumen resmi (JPG, PNG, WEBP, PDF maks 5 MB).
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {canManage && (
      <div className="grid sm:grid-cols-4 gap-2.5 text-xs bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
        >
          {documentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Nomor Dokumen (opsional)"
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
        />

        <input
          type="text"
          placeholder="Keterangan / Judul (opsional)"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
        />

        <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer">
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
        <div className="grid md:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200 p-3.5 flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-900">
                    {labelByType.get(doc.document_type) || doc.document_type.replace(/_/g, ' ')}
                  </span>
                  {supportsVerification && doc.verification_status && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                  <p className="text-slate-700 font-medium truncate">{doc.document_title}</p>
                )}
                <p className="text-slate-500 truncate">
                  {doc.file_name}
                  {doc.document_number ? ` • No: ${doc.document_number}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {canManage && supportsVerification && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerify(doc.id, 'TERVERIFIKASI')}
                      title="Verifikasi Dokumen"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify(doc.id, 'DITOLAK')}
                      title="Tolak Dokumen"
                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                  title="Buka / Pratinjau"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
