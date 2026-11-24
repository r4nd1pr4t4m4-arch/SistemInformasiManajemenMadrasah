'use client';

import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
import {
  AlertCircle,
  FileCheck2,
  FileUp,
  Loader2,
  Phone,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import type { PathwayDefinition, PathwayDocRequirement } from '@/lib/ppdb/pathways';
import { IndonesianAddressFields } from '@/components/ppdb/address-fields';
import { formatFileSize, INPUT_CLASS, type PpdbFormState } from './types';

interface PpdbDocUploadCardProps {
  doc: PathwayDocRequirement;
  variant: 'general' | 'special';
  selectedFile: File | undefined;
  disabled: boolean;
  onFileSelect: (doc: PathwayDocRequirement, file: File | undefined) => void;
  onRemoveFile: (docKey: string) => void;
}

function PpdbDocUploadCard({
  doc,
  variant,
  selectedFile,
  disabled,
  onFileSelect,
  onRemoveFile,
}: PpdbDocUploadCardProps) {
  const isSpecial = variant === 'special';

  return (
    <div
      className={`modular-card rounded-2xl p-4 text-xs flex flex-col justify-between gap-3 min-w-0 ${
        isSpecial ? 'border-emerald-200 bg-emerald-50/30' : ''
      } ${disabled ? 'opacity-65' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p
            className={`font-semibold text-sm leading-snug break-words ${
              isSpecial ? 'text-emerald-900' : 'text-slate-800'
            }`}
          >
            {doc.label} {doc.required && <span className="text-rose-600">*</span>}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {doc.required ? 'Wajib diunggah' : 'Opsional'} • PDF, JPG, PNG (Maks. 5 MB)
          </p>
        </div>
        {selectedFile && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            <FileCheck2 className="w-3 h-3" /> Siap
          </span>
        )}
      </div>

      {selectedFile ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-800 truncate">{selectedFile.name}</p>
            <p className="text-[10px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemoveFile(doc.key)}
              title="Hapus berkas"
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={`flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-dashed transition text-xs font-semibold ${
            disabled
              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
              : isSpecial
              ? 'border-emerald-300 bg-white/80 text-emerald-800 hover:bg-emerald-50 cursor-pointer'
              : 'border-slate-300 bg-slate-50/70 text-slate-700 hover:bg-emerald-50/50 hover:border-emerald-400 cursor-pointer'
          }`}
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span>Pilih Berkas</span>
          <input
            type="file"
            disabled={disabled}
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              onFileSelect(doc, e.target.files?.[0]);
              e.target.value = '';
            }}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}

interface PpdbFormSectionProps {
  activePathwayDef: PathwayDefinition;
  form: PpdbFormState;
  setForm: Dispatch<SetStateAction<PpdbFormState>>;
  files: Record<string, File | undefined>;
  addressResetKey: number;
  todayIso: string;
  loadingPeriod: boolean;
  hasActivePeriod: boolean;
  submitting: boolean;
  submitProgress: string | null;
  errorMsg: string | null;
  errorBannerRef: RefObject<HTMLDivElement | null>;
  onAddressChange: (fullAddress: string, isComplete: boolean) => void;
  onFileSelect: (doc: PathwayDocRequirement, file: File | undefined) => void;
  onRemoveFile: (docKey: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function PpdbFormSection({
  activePathwayDef,
  form,
  setForm,
  files,
  addressResetKey,
  todayIso,
  loadingPeriod,
  hasActivePeriod,
  submitting,
  submitProgress,
  errorMsg,
  errorBannerRef,
  onAddressChange,
  onFileSelect,
  onRemoveFile,
  onSubmit,
}: PpdbFormSectionProps) {
  const docUploadDisabled = !hasActivePeriod || submitting;

  return (
    <form onSubmit={onSubmit} className="space-y-6 pt-5 border-t border-slate-200/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Langkah 2
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Lengkapi Biodata &amp; Berkas — {activePathwayDef.title}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500">
          Tanda <span className="text-rose-600 font-bold">*</span> wajib diisi
        </span>
      </div>

      {errorMsg && (
        <div
          ref={errorBannerRef}
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" /> Data Diri Calon Siswa
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Lengkap Calon Siswa <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Sesuai Ijazah / Akta"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                NISN (10 Digit Angka) <span className="text-rose-600">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  form.nisn.length === 10 ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                }`}
              >
                {form.nisn.length}/10
              </span>
            </div>
            <input
              required
              type="text"
              inputMode="numeric"
              minLength={10}
              maxLength={10}
              value={form.nisn}
              onChange={(e) =>
                setForm({
                  ...form,
                  nisn: e.target.value.replace(/\D/g, '').slice(0, 10),
                })
              }
              placeholder="10 digit angka NISN"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                NIK (16 Digit Angka) <span className="text-rose-600">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  form.nik.length === 16 ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                }`}
              >
                {form.nik.length}/16
              </span>
            </div>
            <input
              required
              type="text"
              inputMode="numeric"
              minLength={16}
              maxLength={16}
              value={form.nik}
              onChange={(e) =>
                setForm({
                  ...form,
                  nik: e.target.value.replace(/\D/g, '').slice(0, 16),
                })
              }
              placeholder="16 digit angka NIK"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jenis Kelamin <span className="text-rose-600">*</span>
            </label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
              className={INPUT_CLASS}
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tempat Lahir <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.birthPlace}
              onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
              placeholder="Kota / Kabupaten"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Lahir <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="date"
              max={todayIso}
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-2 min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Asal Sekolah / Madrasah <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.previousSchool}
              onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
              placeholder="Contoh: MTsN 1 / SMPN 2"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-200/70">
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-700 shrink-0" /> Data Orang Tua / Wali
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Orang Tua / Wali <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.parentName}
              onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              placeholder="Nama lengkap orang tua/wali"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                No. WhatsApp (12 Digit) <span className="text-rose-600">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  form.parentPhone.length === 12
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {form.parentPhone.length}/12
              </span>
            </div>
            <input
              required
              type="text"
              inputMode="numeric"
              minLength={12}
              maxLength={12}
              value={form.parentPhone}
              onChange={(e) =>
                setForm({
                  ...form,
                  parentPhone: e.target.value.replace(/\D/g, '').slice(0, 12),
                })
              }
              placeholder="08xxxxxxxxxx (12 digit angka)"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        </div>
      </div>

      <IndonesianAddressFields key={addressResetKey} onAddressChange={onAddressChange} />

      <div className="border-t border-slate-200/80 pt-5 space-y-5">
        <div className="space-y-3">
          <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileUp className="w-4 h-4 text-emerald-700 shrink-0" /> Dokumen Persyaratan Umum
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activePathwayDef.generalDocs.map((doc) => (
              <PpdbDocUploadCard
                key={doc.key}
                doc={doc}
                variant="general"
                selectedFile={files[doc.key]}
                disabled={docUploadDisabled}
                onFileSelect={onFileSelect}
                onRemoveFile={onRemoveFile}
              />
            ))}
          </div>
        </div>

        {activePathwayDef.specialDocs.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm font-bold text-emerald-800 flex items-center gap-2">
              <FileUp className="w-4 h-4 text-emerald-700 shrink-0" /> Dokumen Persyaratan Khusus (
              {activePathwayDef.title})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {activePathwayDef.specialDocs.map((doc) => (
                <PpdbDocUploadCard
                  key={doc.key}
                  doc={doc}
                  variant="special"
                  selectedFile={files[doc.key]}
                  disabled={docUploadDisabled}
                  onFileSelect={onFileSelect}
                  onRemoveFile={onRemoveFile}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loadingPeriod || !hasActivePeriod || submitting}
        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-5 rounded-2xl transition shadow-sm text-sm"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span>
          {loadingPeriod
            ? 'Memeriksa Periode Aktif...'
            : !hasActivePeriod
            ? 'Pendaftaran Ditutup (Tidak Ada Periode Aktif)'
            : submitting
            ? submitProgress || 'Menyimpan & Mengunggah Berkas...'
            : 'Kirim Pendaftaran & Buat Kartu Bukti'}
        </span>
      </button>
    </form>
  );
}
