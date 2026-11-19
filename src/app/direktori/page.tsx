import { Suspense } from 'react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { DirektoriView } from '@/components/direktori/direktori-view';
import { getPublicDirectoryData } from '@/lib/data/public-queries';

async function DirektoriContent() {
  await connection();
  const { teachers, achievements } = await getPublicDirectoryData();

  return <DirektoriView teachers={teachers} achievements={achievements} />;
}

function DirektoriSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="glass-card rounded-3xl p-5 h-20" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="modular-card rounded-2xl p-5 flex items-center gap-4 h-24">
            <div className="w-12 h-12 rounded-2xl bg-slate-200/80 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200/80" />
              <div className="h-3 w-1/2 rounded bg-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DirektoriPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-8 sm:space-y-10">
        <Suspense fallback={<DirektoriSkeleton />}>
          <DirektoriContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
