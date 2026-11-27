'use client';

import { useEffect, useRef } from 'react';
import { FileCheck2, FileUp, ShieldAlert, Upload, X } from 'lucide-react';
import { DocType, formatFileSize, MUTATION_DOCS, MutasiDocItem } from './types';

interface MutasiDocumentsSectionProps {
  docFiles: Record<string, MutasiDocItem>;
  submitting: boolean;
  onFileChange: (key: string, documentType: DocType, label: string, file: File | null) => void;
  onRemoveFile: (key: string) => void;
}

export function MutasiDocumentsSection({
  docFiles,
  submitting,
  onFileChange,
  onRemoveFile,
}: MutasiDocumentsSectionProps) {
  return (
    <div className="border-t border-slate-200/80 pt-5 space-y-3">
      <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
        <FileUp className="w-4 h-4 text-emerald-700 shrink-0" /> Dokumen Persyaratan Mutasi Masuk
      </p>
      <p className="text-xs text-slate-500">
        Unggah scan/foto berkas asli dalam format PDF, JPG, atau PNG (maksimal 2 MB per berkas).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {MUTATION_DOCS.map((doc) => {
          const uploaded = docFiles[doc.key];
          return (
            <div
              key={doc.key}
              className={`modular-card rounded-2xl p-4 text-xs flex flex-col justify-between gap-3 min-w-0 ${
                uploaded ? 'border-emerald-300 bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 leading-snug break-words">
                    {doc.label} {doc.required && <span className="text-rose-600">*</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Wajib diunggah • PDF, JPG, PNG (Maks. 2 MB)
                  </p>
                </div>
                {uploaded && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <FileCheck2 className="w-3 h-3" /> Siap
                  </span>
                )}
              </div>

              {uploaded ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{uploaded.fileName}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(uploaded.fileSize)}
                    </p>
                  </div>
                  {!submitting && (
                    <button
                      type="button"
                      onClick={() => onRemoveFile(doc.key)}
                      title="Hapus berkas"
                      aria-label={`Hapus berkas ${doc.label}`}
                      className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <label
                  className={`flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-dashed transition text-xs font-semibold ${
                    submitting
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 bg-slate-50/70 text-slate-700 hover:bg-emerald-50/50 hover:border-emerald-400 cursor-pointer'
                  }`}
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>Pilih Berkas</span>
                  <input
                    type="file"
                    disabled={submitting}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      onFileChange(
                        doc.key,
                        doc.documentType,
                        doc.label,
                        e.target.files?.[0] || null
                      );
                      e.target.value = '';
                    }}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MutasiFinalGradeModalProps {
  open: boolean;
  targetGrade: string;
  onClose: () => void;
}

export function MutasiFinalGradeModal({ open, targetGrade, onClose }: MutasiFinalGradeModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousActive?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="final-grade-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h3
          id="final-grade-modal-title"
          className="mt-4 text-base sm:text-lg font-bold text-slate-900"
        >
          Mutasi Masuk Kelas Akhir Tidak Diperkenankan
        </h3>
        <div className="mt-2 space-y-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p>
            Anda memilih <strong>Kelas {targetGrade}</strong> sebagai kelas/tingkat tujuan.
          </p>
          <p>
            Berdasarkan peraturan pendidikan dan ketentuan terbaru Kementerian Agama /
            Kemendikdasmen, madrasah/sekolah{' '}
            <strong>tidak dapat menerima mutasi masuk siswa pada kelas tingkat akhir</strong>.
          </p>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
            Ketentuan ini berlaku demi menjaga validitas data Dapodik/EMIS, pemenuhan syarat
            ketuntasan belajar, serta keabsahan peserta asesmen akhir dan penerbitan ijazah.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[42px] rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            Mengerti, Ubah Pilihan
          </button>
        </div>
      </div>
    </div>
  );
}
