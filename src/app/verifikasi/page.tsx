import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicShell } from '@/components/layout/public-shell';
import { VerifikasiClient } from '@/components/verifikasi/verifikasi-client';

export const metadata: Metadata = {
  title: 'Verifikasi Dokumen & QR Code — SIMMS',
  description:
    'Periksa keaslian dokumen resmi lembaga (Slip Tabungan, SPP, Honorarium, Kartu Pelajar, E-Library, Rekap Absensi, Penilaian & Surat Resmi) melalui QR Code atau nomor referensi.',
};

function VerifikasiSkeleton() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-pulse"
      aria-hidden="true"
    >
      <div className="rounded-3xl bg-slate-200/80 h-44 sm:h-52 w-full" />
      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
        <div className="h-4 w-56 rounded bg-slate-200/80" />
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="h-12 flex-1 rounded-2xl bg-slate-200/70" />
          <div className="h-12 w-full sm:w-44 rounded-2xl bg-slate-200/80" />
        </div>
        <div className="pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row gap-2.5">
          <div className="h-11 w-full sm:w-44 rounded-xl bg-emerald-100/80" />
          <div className="h-11 w-full sm:w-56 rounded-xl bg-slate-200/70" />
        </div>
      </div>
    </div>
  );
}

export default function VerifikasiPage() {
  return (
    <PublicShell>
      <Suspense fallback={<VerifikasiSkeleton />}>
        <VerifikasiClient />
      </Suspense>
    </PublicShell>
  );
}
