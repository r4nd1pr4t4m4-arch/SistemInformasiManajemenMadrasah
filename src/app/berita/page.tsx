import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Newspaper } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { BeritaFeed } from '@/components/berita/berita-feed';
import { getPublishedPosts } from '@/lib/data/public-queries';

export const metadata: Metadata = {
  title: 'Berita, Artikel & Pengumuman — SIMMS',
  description:
    'Publikasi resmi lembaga: liputan kegiatan, pengumuman akademik, artikel pendidikan, serta karya tulis guru dan siswa.',
};

async function BeritaContent() {
  await connection();
  const posts = await getPublishedPosts(30);

  return <BeritaFeed posts={posts} />;
}

function BeritaSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="h-11 flex-1 rounded-xl bg-slate-200/70" />
          <div className="h-4 w-44 rounded bg-slate-200/70 shrink-0" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-24 rounded-full bg-emerald-100/80" />
          <div className="h-9 w-24 rounded-full bg-slate-200/70" />
          <div className="h-9 w-28 rounded-full bg-slate-200/70" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="modular-card rounded-3xl p-6 space-y-4 h-72 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-5 w-24 rounded-full bg-emerald-100/70" />
              <div className="h-6 w-4/5 rounded-lg bg-slate-200/80" />
              <div className="h-16 w-full rounded-xl bg-slate-200/60" />
            </div>
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex justify-between">
                <div className="h-3.5 w-24 rounded bg-slate-200/70" />
                <div className="h-3.5 w-20 rounded bg-slate-200/70" />
              </div>
              <div className="h-10 w-full rounded-xl bg-emerald-50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BeritaPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight [overflow-wrap:anywhere]">
              Publikasi &amp; Informasi Lembaga
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Liputan kegiatan, pengumuman ujian/libur, artikel pendidikan, serta karya tulis guru
              dan siswa.
            </p>
          </div>
          <span className="self-start sm:self-auto inline-flex text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 items-center gap-1.5 shrink-0">
            <Newspaper className="w-3.5 h-3.5 shrink-0" /> Berita &amp; Artikel
          </span>
        </div>

        <Suspense fallback={<BeritaSkeleton />}>
          <BeritaContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
