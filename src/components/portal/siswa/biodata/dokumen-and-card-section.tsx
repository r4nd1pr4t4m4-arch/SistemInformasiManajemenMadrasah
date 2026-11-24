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
    <div className="glass-card rounded-3xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-700" /> Kartu Pelajar Digital Resmi
        </h2>
        <p className="text-xs text-slate-500">
          Pratinjau sisi depan &amp; belakang kartu pelajar Anda, siap diunduh sebagai file PNG.
        </p>
      </div>
      <div className="max-w-xl">
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
  const filteredStdDocs = STANDARD_DOCUMENTS.filter((docDef) => {
    const existing = docByType.get(docDef.type);
    if (docFilter === 'UPLOADED') return Boolean(existing);
    if (docFilter === 'MISSING') return !existing;
    if (docFilter === 'VERIFIED') return existing?.verification_status === 'TERVERIFIKASI';
    return true;
  });

  return (
    <div className="space-y-6">
      {!studentId && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
          Data biodata siswa belum tersimpan. Silakan lengkapi dan klik{' '}
          <strong>Simpan Biodata Lengkap</strong> pada tab Biodata Lengkap terlebih dahulu agar
          dapat mengunggah scan dokumen.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">
          Menampilkan {filteredStdDocs.length} dari {STANDARD_DOCUMENTS.length} dokumen standar
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setDocFilter(tabItem.key)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition ${
                docFilter === tabItem.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {tabItem.label}
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
        <div className="grid md:grid-cols-2 gap-4">
          {filteredStdDocs.map((docDef) => {
            const existing = docByType.get(docDef.type);
            const isUploading = uploadingType === docDef.type;
            return (
              <div key={docDef.type} className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      {existing ? (
                        <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      {docDef.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{docDef.description}</p>
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
                      placeholder="Nomor Dokumen (opsional)"
                      value={docNumbers[docDef.type] || ''}
                      onChange={(e) =>
                        setDocNumbers({ ...docNumbers, [docDef.type]: e.target.value })
                      }
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                    />
                  </div>
                )}

                {existing && (
                  <div className="space-y-1.5">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0">
                      <span className="truncate font-medium text-slate-700 min-w-0">
                        {existing.file_name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={existing.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                        >
                          Lihat <ExternalLink className="w-3 h-3" />
                        </a>
                        {canManage && (
                          <button
                            type="button"
                            aria-busy={deletingDocId === existing.id || undefined}
                            disabled={deletingDocId === existing.id}
                            onClick={() => void onDeleteDocument(existing)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 transition"
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
                      <p className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1 break-words">
                        Catatan Verifikasi: {existing.verification_notes}
                      </p>
                    )}
                  </div>
                )}

                {canManage && (
                  <label
                    className={`inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold transition ${
                      uploadingType !== null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Mengunggah Scan...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        {existing
                          ? 'Ganti Scan Dokumen (JPG/PNG/PDF)'
                          : 'Upload Scan (JPG/PNG/PDF)'}
                      </>
                    )}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      disabled={uploadingType !== null}
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

      <div className="glass-card rounded-3xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Dokumen Pendukung Lainnya</h3>
        {canManage && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              disabled={uploadingType !== null}
              placeholder="Nama Dokumen (cth: Sertifikat Prestasi / Surat Pindah)"
              value={otherTitle}
              onChange={(e) => setOtherTitle(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs disabled:bg-slate-100"
            />
            <label
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold transition ${
                uploadingType !== null
                  ? 'opacity-60 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-slate-800'
              }`}
            >
              {uploadingType === 'LAINNYA' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploadingType === 'LAINNYA' ? 'Mengunggah...' : 'Upload Dokumen Lainnya'}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                disabled={uploadingType !== null}
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 break-words">
                    {d.document_title || d.file_name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{d.file_name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                  >
                    Lihat <ExternalLink className="w-3 h-3" />
                  </a>
                  {canManage && (
                    <button
                      type="button"
                      aria-busy={deletingDocId === d.id || undefined}
                      disabled={deletingDocId === d.id}
                      onClick={() => void onDeleteDocument(d)}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 transition"
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
