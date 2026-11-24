'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, Search } from 'lucide-react';
import { PpdbRegistrationCard, RegistrationCardData } from '@/components/ppdb/registration-card';
import { INPUT_CLASS } from './types';

interface MutasiStatusSectionProps {
  checkCode: string;
  onCheckCodeChange: (code: string) => void;
}

export function MutasiStatusSection({ checkCode, onCheckCodeChange }: MutasiStatusSectionProps) {
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkCard, setCheckCard] = useState<RegistrationCardData | null>(null);

  async function handleCheckStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedCode = checkCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCheckError('Masukkan nomor pendaftaran mutasi Anda terlebih dahulu.');
      setCheckCard(null);
      return;
    }

    setChecking(true);
    setCheckError(null);
    setCheckCard(null);

    try {
      const res = await fetch(`/api/ppdb?code=${encodeURIComponent(normalizedCode)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCheckError(data.error || 'Nomor pendaftaran tidak ditemukan.');
      } else {
        const reg = data.registration;
        setCheckCard({
          registrationNumber: reg.registration_number,
          fullName: reg.full_name,
          nisn: reg.nisn,
          pathway: reg.pathway,
          previousSchool: reg.previous_school,
          parentName: reg.parent_name,
          parentPhone: reg.parent_phone,
          status: reg.status,
          createdAt: reg.created_at,
          notes: reg.admin_notes,
          documents: (reg.ppdb_documents || []).map(
            (d: { document_type: string; file_name: string | null; is_verified: boolean }) => ({
              label: d.file_name || d.document_type,
              verified: d.is_verified,
            })
          ),
        });
      }
    } catch {
      setCheckError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleCheckStatus}
        className="flex flex-col sm:flex-row gap-2.5 print:hidden"
      >
        <input
          type="text"
          value={checkCode}
          onChange={(e) => onCheckCodeChange(e.target.value)}
          placeholder="Masukkan Nomor Pendaftaran (contoh: MUTASI-2026-12345)"
          className={`${INPUT_CLASS} flex-1 min-w-0 font-mono uppercase placeholder:normal-case placeholder:font-sans`}
        />
        <button
          type="submit"
          disabled={checking}
          className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition shrink-0"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
            Cek Status Pengajuan Mutasi &amp; Cetak Ulang Kartu Bukti
          </p>
          <p className="text-xs text-slate-500">
            Masukkan nomor pendaftaran mutasi (contoh: MUTASI-2026-xxxxx) untuk memantau verifikasi
            berkas.
          </p>
        </div>
      )}

      {checkCard && (
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => {
                setCheckCard(null);
                onCheckCodeChange('');
                setCheckError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Cari Nomor Lain
            </button>
          </div>
          <PpdbRegistrationCard data={checkCard} />
        </div>
      )}
    </div>
  );
}
