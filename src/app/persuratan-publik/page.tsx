import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicShell } from '@/components/layout/public-shell';
import { PersuratanPublikClient } from '@/components/persuratan/persuratan-publik-client';

export const metadata: Metadata = {
  title: 'Drop-Box Surat Masuk & Papan Edaran — SIMMS',
  description:
    'Layanan pengiriman surat masuk eksternal daring, pelacakan resi & disposisi real-time, serta papan unduhan Surat Edaran resmi lembaga.',
};

function PersuratanSkeleton() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-pulse"
      aria-hidden="true"
    >
      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
        <div className="space-y-2.5">
          <div className="h-6 w-56 rounded-full bg-emerald-100/70" />
          <div className="h-8 w-3/4 max-w-lg rounded-xl bg-slate-200/80" />
          <div className="h-4 w-full max-w-2xl rounded bg-slate-200/60" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-4 border-t border-slate-200/80">
          <div className="h-11 rounded-xl bg-emerald-100/80" />
          <div className="h-11 rounded-xl bg-slate-200/70" />
          <div className="h-11 rounded-xl bg-slate-200/70" />
        </div>
      </div>
      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-4">
        <div className="h-6 w-64 rounded-lg bg-slate-200/80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-11 rounded-xl bg-slate-200/60" />
          <div className="h-11 rounded-xl bg-slate-200/60" />
        </div>
        <div className="h-24 rounded-xl bg-slate-200/60" />
      </div>
    </div>
  );
}

export default function PersuratanPublikPage() {
  return (
    <PublicShell>
      <Suspense fallback={<PersuratanSkeleton />}>
        <PersuratanPublikClient />
      </Suspense>
    </PublicShell>
  );
}
