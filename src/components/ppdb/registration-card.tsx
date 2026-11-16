'use client';

import { CheckCircle2, Printer } from 'lucide-react';
import { DEFAULT_INSTITUTION_SETTINGS } from '@/lib/data/demo-seed';
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

export function PpdbRegistrationCard({ data }: { data: RegistrationCardData }) {
  const school = DEFAULT_INSTITUTION_SETTINGS;
  const formattedDate = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('id-ID', {
        dateStyle: 'long',
      })
    : 'Terdaftar Hari Ini';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-slate-400">
        {/* Kop Kartu */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-emerald-200 font-semibold">
              Kartu Bukti Pendaftaran Resmi
            </p>
            <h3 className="text-lg font-bold mt-0.5">{school.name}</h3>
            <p className="text-xs text-emerald-100">{school.address}</p>
          </div>
          <div className="text-right">
            <span className="inline-block text-[11px] font-bold uppercase px-3 py-1 rounded-full bg-white/15 border border-white/25">
              {getPathwayLabel(data.pathway)}
            </span>
            <p className="font-mono text-base font-extrabold mt-1.5 tracking-wider">
              {data.registrationNumber}
            </p>
          </div>
        </div>

        {/* Isi Data Pendaftar */}
        <div className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Identitas Calon Peserta Didik
              </p>
              <div>
                <span className="text-slate-500">Nama Lengkap:</span>
                <p className="font-bold text-slate-900 text-sm">{data.fullName}</p>
              </div>
              <div>
                <span className="text-slate-500">NISN:</span>
                <p className="font-mono font-semibold text-slate-800">{data.nisn || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500">Asal Lembaga:</span>
                <p className="font-semibold text-slate-800">{data.previousSchool || '-'}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status &amp; Kontak
              </p>
              <div>
                <span className="text-slate-500">Status Seleksi:</span>
                <p className="font-bold text-emerald-700 mt-0.5">
                  {data.status.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Orang Tua / Wali:</span>
                <p className="font-semibold text-slate-800">
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
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900">
              <strong>Keterangan:</strong> {data.notes}
            </div>
          )}

          {data.documents && data.documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Berkas Persyaratan Terunggah ({data.documents.length})
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-slate-800"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{doc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <span>
              Simpan kartu bukti ini sebagai syarat verifikasi berkas &amp; daftar ulang di{' '}
              {school.short_name || school.name}.
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="print:hidden inline-flex items-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
