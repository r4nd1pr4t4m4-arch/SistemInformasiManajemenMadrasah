'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { DigitalStudentCard } from '@/components/portal/cards/digital-card-viewer';
import type { StudentCardData } from '@/lib/cards/card-png-renderer';
import {
  STANDARD_DOCUMENTS,
  type DocFilter,
  type DocumentType,
  type StudentDocument,
} from './types';

interface DigitalStudentCardSectionProps {
  studentRecord: StudentCardData;
}

export function DigitalStudentCardSection({ studentRecord }: DigitalStudentCardSectionProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Kartu Pelajar Digital Resmi</span>
        </h2>
        <p className="text-xs text-slate-500">
          Pratinjau sisi depan &amp; belakang kartu pelajar Anda, siap diunduh sebagai file PNG.
        </p>
      </div>
      <div className="w-full max-w-xl">
        <DigitalStudentCard student={studentRecord} />
      </div>
    </div>
  );
}

interface DokumenSectionProps {
  studentId: string | null;
  canManage: boolean;
  docByType: Map<string, StudentDocument>;
  otherDocs: StudentDocument[];
  docNumbers: Record<string, string>;
  setDocNumbers: Dispatch<SetStateAction<Record<string, string>>>;
  otherTitle: string;
  setOtherTitle: Dispatch<SetStateAction<string>>;
  docFilter: DocFilter;
  setDocFilter: Dispatch<SetStateAction<DocFilter>>;
  uploadingType: string | null;
  deletingDocId: string | null;
  onUploadDocument: (docType: DocumentType, file: File) => void | Promise<void>;
  onDeleteDocument: (doc: StudentDocument) => void | Promise<void>;
}

const FILTER_TABS: ReadonlyArray<{ key: DocFilter; label: string }> = [
  { key: 'ALL', label: 'Semua' },
  { key: 'MISSING', label: 'Belum Upload' },
  { key: 'UPLOADED', label: 'Sudah Upload' },
  { key: 'VERIFIED', label: 'Terverifikasi' },
];

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DokumenSection({
  studentId,
  canManage,
  docByType,
  otherDocs,
  docNumbers,
  setDocNumbers,
  otherTitle,
  setOtherTitle,
  docFilter,
  setDocFilter,
  uploadingType,
  deletingDocId,
  onUploadDocument,
  onDeleteDocument,
}: DokumenSectionProps) {
  const counts: Record<DocFilter, number> = {
    ALL: STANDARD_DOCUMENTS.length,
    UPLOADED: STANDARD_DOCUMENTS.filter((d) => docByType.has(d.type)).length,
    MISSING: STANDARD_DOCUMENTS.filter((d) => !docByType.has(d.type)).length,
    VERIFIED: STANDARD_DOCUMENTS.filter(
      (d) => docByType.get(d.type)?.verification_status === 'TERVERIFIKASI'
    ).length,
  };

  const filteredStdDocs = STANDARD_DOCUMENTS.filter((docDef) => {
    const existing = docByType.get(docDef.type);
    if (docFilter === 'UPLOADED') return Boolean(existing);
    if (docFilter === 'MISSING') return !existing;
    if (docFilter === 'VERIFIED') return existing?.verification_status === 'TERVERIFIKASI';
    return true;
  });

  const uploadDisabled = uploadingType !== null || !studentId;

  return (
    <div className="space-y-5 sm:space-y-6">
      {!studentId && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed">
          Data biodata siswa belum tersimpan. Silakan lengkapi dan klik{' '}
          <strong>Simpan Biodata Lengkap</strong> pada tab Biodata Lengkap terlebih dahulu agar
          dapat mengunggah scan dokumen.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <p className="text-xs font-semibold text-slate-600">
          Menampilkan {filteredStdDocs.length} dari {STANDARD_DOCUMENTS.length} dokumen standar
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setDocFilter(tabItem.key)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
                docFilter === tabItem.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {tabItem.label} ({counts[tabItem.key]})
            </button>
          ))}
        </div>
      </div>

      {filteredStdDocs.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Tidak ada dokumen standar pada kategori filter ini.
          </p>
          <button
            type="button"
            onClick={() => setDocFilter('ALL')}
            className="text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            Tampilkan semua dokumen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStdDocs.map((docDef) => {
            const existing = docByType.get(docDef.type);
            const isUploading = uploadingType === docDef.type;
            const sizeLabel = formatFileSize(existing?.file_size);

            return (
              <div
                key={docDef.type}
                className="glass-card rounded-2xl p-4 space-y-3 min-w-0 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 break-words">
                        {existing ? (
                          <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="min-w-0">{docDef.label}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {docDef.description}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        existing
                          ? existing.verification_status === 'TERVERIFIKASI'
                            ? 'bg-emerald-100 text-emerald-700'
                            : existing.verification_status === 'DITOLAK'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {existing ? existing.verification_status : 'BELUM UPLOAD'}
                    </span>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled={uploadDisabled}
                        aria-label={`Nomor dokumen ${docDef.label}`}
                        placeholder="Nomor Dokumen (opsional)"
                        value={docNumbers[docDef.type] || ''}
                        onChange={(e) =>
                          setDocNumbers((prev) => ({
                            ...prev,
                            [docDef.type]: e.target.value,
                          }))
                        }
                        className="w-full min-w-0 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      />
                    </div>
                  )}

                  {existing && (
                    <div className="space-y-1.5">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-700">
                            {existing.file_name}
                          </p>
                          {sizeLabel && (
                            <p className="text-[10px] text-slate-400">{sizeLabel}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/api/siswa/biodata-dokumen/file?id=${encodeURIComponent(existing.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                          >
                            <span>Lihat</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              aria-busy={deletingDocId === existing.id || undefined}
                              disabled={deletingDocId === existing.id}
                              onClick={() => void onDeleteDocument(existing)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 transition"
                              aria-label={`Hapus dokumen ${docDef.label}`}
                              title="Hapus Dokumen"
                            >
                              {deletingDocId === existing.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {existing.verification_notes && (
                        <p className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1.5 break-words">
                          Catatan Verifikasi: {existing.verification_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {canManage && (
                  <label
                    className={`inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold transition ${
                      uploadDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Mengunggah Scan...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {existing
                            ? 'Ganti Scan Dokumen (JPG/PNG/PDF)'
                            : 'Upload Scan (JPG/PNG/PDF)'}
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      disabled={uploadDisabled}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onUploadDocument(docDef.type, file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dokumen Pendukung Lainnya */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-900">Dokumen Pendukung Lainnya</h3>
          <p className="text-[11px] text-slate-500">
            Unggah sertifikat prestasi, piagam, surat pindah, atau dokumen tambahan lainnya (maks. 5 MB).
          </p>
        </div>

        {canManage && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              disabled={uploadDisabled}
              aria-label="Nama dokumen pendukung lainnya"
              placeholder="Nama Dokumen (cth: Sertifikat Prestasi / Surat Pindah)"
              value={otherTitle}
              onChange={(e) => setOtherTitle(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            <label
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold transition shrink-0 ${
                uploadDisabled
                  ? 'opacity-60 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-slate-800'
              }`}
            >
              {uploadingType === 'LAINNYA' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Upload className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {uploadingType === 'LAINNYA' ? 'Mengunggah...' : 'Upload Dokumen Lainnya'}
              </span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                disabled={uploadDisabled}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadDocument('LAINNYA', file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          </div>
        )}

        {otherDocs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            Belum ada dokumen pendukung lainnya yang diunggah.
          </p>
        ) : (
          <div className="space-y-2">
            {otherDocs.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-2 text-xs min-w-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 break-words">
                    {d.document_title || d.file_name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {d.file_name}
                    {d.file_size ? ` • ${formatFileSize(d.file_size)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <a
                    href={`/api/siswa/biodata-dokumen/file?id=${encodeURIComponent(d.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                  >
                    <span>Lihat</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {canManage && (
                    <button
                      type="button"
                      aria-busy={deletingDocId === d.id || undefined}
                      disabled={deletingDocId === d.id}
                      onClick={() => void onDeleteDocument(d)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 transition"
                      aria-label={`Hapus dokumen ${d.document_title || d.file_name}`}
                      title="Hapus Dokumen"
                    >
                      {deletingDocId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
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
