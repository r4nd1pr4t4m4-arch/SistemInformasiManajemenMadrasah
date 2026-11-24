'use client';

import type { FormEvent, RefObject } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Phone,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { IndonesianAddressFields } from '@/components/ppdb/address-fields';
import { PpdbRegistrationCard, RegistrationCardData } from '@/components/ppdb/registration-card';
import { MutasiDocumentsSection } from './mutasi-documents-section';
import {
  DocType,
  INPUT_CLASS,
  isFinalGradeLevel,
  MUTATION_REASON_GROUPS,
  MutasiDocItem,
  MutasiFormValues,
} from './types';

interface MutasiFormSectionProps {
  form: MutasiFormValues;
  gradeLevels: string[];
  todayIso: string;
  addressResetKey: number;
  docFiles: Record<string, MutasiDocItem>;
  submitting: boolean;
  errorMsg: string;
  errorBannerRef: RefObject<HTMLDivElement | null>;
  submittedCard: RegistrationCardData | null;
  onFieldChange: <K extends keyof MutasiFormValues>(field: K, value: MutasiFormValues[K]) => void;
  onTargetGradeChange: (value: string) => void;
  onAddressChange: (addr: string, complete: boolean) => void;
  onFileChange: (key: string, documentType: DocType, label: string, file: File | null) => void;
  onRemoveFile: (key: string) => void;
  onResetForm: () => void;
  onSubmit: (e: FormEvent) => void;
}

export function MutasiFormSection({
  form,
  gradeLevels,
  todayIso,
  addressResetKey,
  docFiles,
  submitting,
  errorMsg,
  errorBannerRef,
  submittedCard,
  onFieldChange,
  onTargetGradeChange,
  onAddressChange,
  onFileChange,
  onRemoveFile,
  onResetForm,
  onSubmit,
}: MutasiFormSectionProps) {
  if (submittedCard) {
    return (
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">
              <strong>Pengajuan Mutasi Berhasil!</strong> Simpan atau cetak Kartu Bukti Pendaftaran
              resmi Anda di bawah ini.
            </span>
          </div>
          <button
            type="button"
            onClick={onResetForm}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Buat Pengajuan Baru
          </button>
        </div>
        <PpdbRegistrationCard data={submittedCard} />
      </div>
    );
  }

  const isTargetFinalGrade = isFinalGradeLevel(form.targetGrade, gradeLevels);

  const handleDigitsField = (
    field: 'nisn' | 'nik' | 'parentPhone',
    value: string,
    maxLen: number
  ) => {
    onFieldChange(field, value.replace(/\D/g, '').slice(0, maxLen));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {errorMsg && (
        <div
          ref={errorBannerRef}
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Bagian 1: Biodata Siswa & Orang Tua */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles className="w-3.5 h-3.5" /> Bagian 1
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Biodata Calon Siswa Pindahan &amp; Orang Tua / Wali
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Tanda <span className="text-rose-600 font-bold">*</span> wajib diisi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Nama Lengkap Siswa <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.fullName}
              onChange={(e) => onFieldChange('fullName', e.target.value)}
              placeholder="Sesuai Akta Kelahiran / Rapor"
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
              onChange={(e) => handleDigitsField('nisn', e.target.value, 10)}
              placeholder="10 digit angka NISN"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                NIK Siswa (16 Digit Angka) <span className="text-rose-600">*</span>
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
              onChange={(e) => handleDigitsField('nik', e.target.value, 16)}
              placeholder="16 digit angka NIK"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>

          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Jenis Kelamin <span className="text-rose-600">*</span>
            </label>
            <select
              value={form.gender}
              onChange={(e) => onFieldChange('gender', e.target.value as 'L' | 'P')}
              className={INPUT_CLASS}
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Tempat Lahir <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.birthPlace}
              onChange={(e) => onFieldChange('birthPlace', e.target.value)}
              placeholder="Kota/Kabupaten tempat lahir"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Tanggal Lahir <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="date"
              max={todayIso}
              value={form.birthDate}
              onChange={(e) => onFieldChange('birthDate', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Sekolah / Madrasah Asal <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.previousSchool}
              onChange={(e) => onFieldChange('previousSchool', e.target.value)}
              placeholder="Nama sekolah/madrasah asal"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Nama Orang Tua / Wali <span className="text-rose-600">*</span>
            </label>
            <input
              required
              type="text"
              value={form.parentName}
              onChange={(e) => onFieldChange('parentName', e.target.value)}
              placeholder="Nama ayah / ibu / wali"
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-2 min-w-0">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                No. WhatsApp Orang Tua / Wali (12 Digit Angka){' '}
                <span className="text-rose-600">*</span>
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
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                required
                type="text"
                inputMode="numeric"
                minLength={12}
                maxLength={12}
                value={form.parentPhone}
                onChange={(e) => handleDigitsField('parentPhone', e.target.value, 12)}
                placeholder="08xxxxxxxxxx (12 digit angka)"
                className={`${INPUT_CLASS} pl-10 font-mono`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 2: Informasi Kepindahan & Tujuan */}
      <div className="border-t border-slate-200/80 pt-5 space-y-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            <ArrowRightLeft className="w-3.5 h-3.5" /> Bagian 2
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Kelas Tujuan &amp; Alasan Mutasi Masuk
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Kelas / Tingkat Tujuan <span className="text-rose-600">*</span>
            </label>
            <select
              required
              value={form.targetGrade}
              onChange={(e) => onTargetGradeChange(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">-- Pilih Kelas / Tingkat Tujuan --</option>
              {gradeLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  Kelas {lvl}
                </option>
              ))}
            </select>
            {isTargetFinalGrade && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Kelas tingkat akhir tidak dapat menerima mutasi masuk.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Alasan Mutasi / Pindah Sekolah <span className="text-rose-600">*</span>
            </label>
            <select
              required
              value={form.mutationReason}
              onChange={(e) => onFieldChange('mutationReason', e.target.value)}
              className={`${INPUT_CLASS} truncate`}
            >
              <option value="">-- Pilih Alasan Mutasi --</option>
              {MUTATION_REASON_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {form.mutationReason === 'Lainnya' && (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Penjelasan Alasan Mutasi Lainnya <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.otherReason}
              onChange={(e) => onFieldChange('otherReason', e.target.value)}
              placeholder="Jelaskan secara singkat alasan kepindahan siswa..."
              className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>
        )}
      </div>

      {/* Bagian 3: Alamat Emsifa API */}
      <IndonesianAddressFields key={addressResetKey} onAddressChange={onAddressChange} />

      {/* Bagian 4: Dokumen Persyaratan Mutasi */}
      <MutasiDocumentsSection
        docFiles={docFiles}
        submitting={submitting}
        onFileChange={onFileChange}
        onRemoveFile={onRemoveFile}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-5 rounded-2xl transition shadow-sm text-sm"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span>
          {submitting
            ? 'Menyimpan & Mengunggah Berkas...'
            : 'Kirim Pengajuan Mutasi Masuk & Buat Kartu Bukti'}
        </span>
      </button>
    </form>
  );
}
