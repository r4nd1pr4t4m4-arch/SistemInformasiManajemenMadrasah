'use client';

import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Search, Upload } from 'lucide-react';
import {
  PpdbRegistrationCard,
  type RegistrationCardData,
} from '@/components/ppdb/registration-card';
import { INPUT_CLASS } from './types';

interface PpdbStatusSectionProps {
  checkCode: string;
  checking: boolean;
  checkError: string | null;
  checkCard: RegistrationCardData | null;
  onCheckCodeChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}

export function PpdbStatusSection({
  checkCode,
  checking,
  checkError,
  checkCard,
  onCheckCodeChange,
  onSubmit,
  onReset,
}: PpdbStatusSectionProps) {
  const [revNik, setRevNik] = useState('');
  const [revDocType, setRevDocType] = useState<
    'KK' | 'AKTA_KELAHIRAN' | 'IJAZAH_SKL' | 'PAS_FOTO' | 'SERTIFIKAT_PRESTASI' | 'LAINNYA'
  >('KK');
  const [revFileUrl, setRevFileUrl] = useState('');
  const [revFileName, setRevFileName] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [revFeedback, setRevFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleSubmitRevision(e: FormEvent) {
    e.preventDefault();
    if (!checkCard || revSubmitting) return;
    setRevSubmitting(true);
    setRevFeedback(null);
    try {
      const res = await fetch('/api/ppdb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationNumber: checkCard.registrationNumber,
          nik: revNik.trim(),
          documentType: revDocType,
          fileUrl: revFileUrl.trim(),
          fileName: revFileName.trim() || `${revDocType}_Revisi.pdf`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRevFeedback({ type: 'err', text: data.error || 'Gagal mengirim berkas perbaikan.' });
      } else {
        setRevFeedback({
          type: 'ok',
          text: data.message || 'Berkas perbaikan berhasil dikirim.',
        });
        setRevFileUrl('');
        setRevFileName('');
      }
    } catch {
      setRevFeedback({ type: 'err', text: 'Gagal terhubung ke server.' });
    } finally {
      setRevSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2.5 print:hidden">
        <input
          type="text"
          value={checkCode}
          onChange={(e) => onCheckCodeChange(e.target.value)}
          placeholder="Masukkan Nomor Pendaftaran (PPDB-2026-... atau MUTASI-2026-...)"
          className={`${INPUT_CLASS} flex-1 min-w-0 font-mono uppercase placeholder:normal-case placeholder:font-sans`}
        />
        <button
          type="submit"
          disabled={checking}
          className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition shrink-0"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Cek Status</span>
        </button>
      </form>

      {checkError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{checkError}</span>
        </div>
      )}

      {!checkCard && !checkError && !checking && (
        <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1.5">
          <p className="text-xs sm:text-sm font-semibold text-slate-700">
            Cek Status Seleksi &amp; Cetak Ulang Kartu Bukti
          </p>
          <p className="text-xs text-slate-500">
            Masukkan nomor pendaftaran yang Anda peroleh setelah mengisi formulir PPDB atau Mutasi
            Masuk.
          </p>
        </div>
      )}

      {checkCard && (
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Cari Nomor Lain
            </button>
          </div>
          <PpdbRegistrationCard data={checkCard} />

          {checkCard.status === 'PERLU_PERBAIKAN' && (
            <form
              onSubmit={handleSubmitRevision}
              className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 sm:p-5 space-y-3 text-xs print:hidden"
            >
              <div>
                <p className="font-bold text-amber-950 flex items-center gap-1.5 text-sm">
                  <Upload className="w-4 h-4 text-amber-700" />
                  Kirim Berkas Perbaikan PPDB
                </p>
                <p className="text-amber-900/80 mt-0.5">
                  Status pendaftaran Anda memerlukan perbaikan berkas. Masukkan 16 digit NIK siswa
                  dan tautan berkas revisi di bawah ini.
                </p>
              </div>
              {revFeedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${revFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                >
                  {revFeedback.type === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{revFeedback.text}</span>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIK Calon Siswa (16 Digit) *
                  </label>
                  <input
                    required
                    maxLength={16}
                    value={revNik}
                    onChange={(e) => setRevNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="16 digit NIK"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Berkas *</label>
                  <select
                    value={revDocType}
                    onChange={(e) => setRevDocType(e.target.value as typeof revDocType)}
                    className={INPUT_CLASS}
                  >
                    <option value="KK">Kartu Keluarga (KK)</option>
                    <option value="AKTA_KELAHIRAN">Akta Kelahiran</option>
                    <option value="IJAZAH_SKL">Ijazah / SKL</option>
                    <option value="PAS_FOTO">Pas Foto</option>
                    <option value="SERTIFIKAT_PRESTASI">Sertifikat Prestasi</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">URL Berkas Revisi *</label>
                  <input
                    required
                    type="url"
                    value={revFileUrl}
                    onChange={(e) => setRevFileUrl(e.target.value)}
                    placeholder="https://drive.google.com/... atau tautan file"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama File</label>
                  <input
                    value={revFileName}
                    onChange={(e) => setRevFileName(e.target.value)}
                    placeholder="mis. KK_Revisi.pdf"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={revSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {revSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Kirim Berkas Perbaikan
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
