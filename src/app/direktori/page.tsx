import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { DirektoriView } from '@/components/direktori/direktori-view';
import { getPublicDirectoryData } from '@/lib/data/public-queries';

export const metadata: Metadata = {
  title: 'Direktori GTK & Prestasi — SIMMS',
  description:
    'Direktori resmi Guru & Tenaga Kependidikan (GTK), profil akademik, karya ilmiah, serta daftar prestasi siswa dan lembaga.',
};

async function DirektoriContent() {
  await connection();
  const { teachers, achievements } = await getPublicDirectoryData();

  return <DirektoriView teachers={teachers} achievements={achievements} />;
}

function DirektoriSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-11 flex-1 rounded-xl bg-slate-200/70" />
          <div className="flex gap-2">
            <div className="h-10 w-20 rounded-xl bg-emerald-100/70" />
            <div className="h-10 w-24 rounded-xl bg-slate-200/70" />
            <div className="h-10 w-28 rounded-xl bg-slate-200/70" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="modular-card rounded-2xl p-5 space-y-4 h-56">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-slate-200/80 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200/80" />
                <div className="h-3 w-1/2 rounded bg-slate-200/60" />
              </div>
            </div>
            <div className="h-16 w-full rounded-xl bg-slate-200/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DirektoriPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight [overflow-wrap:anywhere]">
            Direktori GTK &amp; Prestasi Lembaga
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Profil pendidik dan tenaga kependidikan aktif, karya ilmiah, serta rekam jejak
            prestasi siswa dan lembaga.
          </p>
        </div>

        <Suspense fallback={<DirektoriSkeleton />}>
          <DirektoriContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
