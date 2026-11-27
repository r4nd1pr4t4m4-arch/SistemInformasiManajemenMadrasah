'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Printer } from 'lucide-react';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';
import { getPathwayLabel } from '@/lib/ppdb/pathways';

export interface RegistrationCardData {
  registrationNumber: string;
  fullName: string;
  nisn?: string | null;
  pathway: string;
  previousSchool?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  status: string;
  createdAt?: string | null;
  notes?: string | null;
  documents?: { label: string; verified?: boolean }[];
}

function getStatusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized.includes('DITERIMA') || normalized.includes('LULUS') || normalized.includes('TERVERIFIKASI')) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (normalized.includes('DITOLAK') || normalized.includes('GUGUR')) {
    return 'bg-rose-100 text-rose-800 border-rose-200';
  }
  if (normalized.includes('CADANGAN')) {
    return 'bg-sky-100 text-sky-800 border-sky-200';
  }
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

function formatSafeRegistrationDate(dateStr?: string | null): string {
  if (!dateStr) return 'Terdaftar Hari Ini';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Terdaftar Hari Ini';
  return parsed.toLocaleDateString('id-ID', {
    dateStyle: 'long',
  });
}

async function copyTextSafely(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Lanjut ke fallback textarea
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function PpdbRegistrationCard({ data }: { data: RegistrationCardData }) {
  const school = useInstitutionSettings();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const formattedDate = formatSafeRegistrationDate(data.createdAt);

  async function handleCopyCode() {
    const ok = await copyTextSafely(data.registrationNumber);
    if (!ok) return;
    setCopied(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 2000);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:rounded-none print:border-slate-400">
        {/* Kop Kartu */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-emerald-200 font-semibold">
              Kartu Bukti Pendaftaran Resmi
            </p>
            <h3 className="text-base sm:text-lg font-bold mt-0.5 break-words">
              {school.name || 'Lembaga Pendidikan'}
            </h3>
            {school.address && (
              <p className="text-xs text-emerald-100 mt-0.5 break-words">{school.address}</p>
            )}
          </div>
          <div className="text-left sm:text-right shrink-0">
            <span className="inline-block text-[11px] font-bold uppercase px-3 py-1 rounded-full bg-white/15 border border-white/25">
              {getPathwayLabel(data.pathway)}
            </span>
            <div className="flex items-center sm:justify-end gap-2 mt-1.5">
              <p className="font-mono text-sm sm:text-base font-extrabold tracking-wider break-all">
                {data.registrationNumber}
              </p>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Salin Nomor Pendaftaran"
                aria-label="Salin Nomor Pendaftaran"
                className="print:hidden min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Disalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Isi Data Pendaftar */}
        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Identitas Calon Peserta Didik
              </p>
              <div className="min-w-0">
                <span className="text-slate-500">Nama Lengkap:</span>
                <p className="font-bold text-slate-900 text-sm break-words">{data.fullName}</p>
              </div>
              <div>
                <span className="text-slate-500">NISN:</span>
                <p className="font-mono font-semibold text-slate-800">{data.nisn || '-'}</p>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500">Asal Lembaga:</span>
                <p className="font-semibold text-slate-800 break-words">
                  {data.previousSchool || '-'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status &amp; Kontak
              </p>
              <div>
                <span className="text-slate-500 block mb-1">Status Seleksi:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(
                    data.status
                  )}`}
                >
                  {data.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500">Orang Tua / Wali:</span>
                <p className="font-semibold text-slate-800 break-words">
                  {data.parentName || '-'} {data.parentPhone ? `(${data.parentPhone})` : ''}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Tanggal Pendaftaran:</span>
                <p className="font-semibold text-slate-800">{formattedDate}</p>
              </div>
            </div>
          </div>

          {data.notes && (
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900 [overflow-wrap:anywhere]">
              <strong>Keterangan:</strong> {data.notes}
            </div>
          )}

          {data.documents && data.documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Berkas Persyaratan Terunggah ({data.documents.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{doc.label}</span>
                    </div>
                    {typeof doc.verified === 'boolean' && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          doc.verified
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {!doc.verified && <Clock className="w-2.5 h-2.5" />}
                        {doc.verified ? 'Terverifikasi' : 'Menunggu'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-slate-500">
            <span className="leading-relaxed">
              Simpan kartu bukti ini sebagai syarat verifikasi berkas &amp; daftar ulang di{' '}
              {school.short_name || school.name || 'sekolah/madrasah'}.
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="print:hidden w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
