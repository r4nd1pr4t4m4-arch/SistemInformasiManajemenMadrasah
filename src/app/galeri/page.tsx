import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Video } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { GaleriGrid } from '@/components/galeri/galeri-grid';
import { getInstitutionSettings, getPublicGallery } from '@/lib/data/public-queries';

export const metadata: Metadata = {
  title: 'Galeri & Multimedia — SIMMS',
  description:
    'Dokumentasi foto kegiatan, video profil lembaga, dan liputan multimedia resmi.',
};

function isSafeHttpUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function GaleriContent() {
  await connection();
  const [school, gallery] = await Promise.all([
    getInstitutionSettings(),
    getPublicGallery(60),
  ]);

  const youtubeUrl = isSafeHttpUrl(school.social_links?.youtube)
    ? school.social_links.youtube?.trim() || null
    : null;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight [overflow-wrap:anywhere]">
            Galeri &amp; Multimedia
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Dokumentasi foto kegiatan, video profil lembaga, dan tautan kanal media sosial resmi.
          </p>
        </div>
        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start sm:self-auto min-h-[40px] inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition shrink-0"
          >
            <Video className="w-4 h-4 shrink-0" />
            <span>YouTube Resmi</span>
          </a>
        )}
      </div>

      <GaleriGrid gallery={gallery} />
    </>
  );
}

function GaleriSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full rounded-xl bg-slate-200/80" />
          <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200/60" />
        </div>
        <div className="h-10 w-36 rounded-full bg-rose-100/70 shrink-0" />
      </div>
      <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="h-11 w-full rounded-xl bg-slate-200/70" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-full bg-emerald-100/70" />
          <div className="h-9 w-20 rounded-full bg-slate-200/70" />
          <div className="h-9 w-24 rounded-full bg-slate-200/70" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="modular-card rounded-3xl overflow-hidden h-72">
            <div className="aspect-video bg-slate-200/70" />
            <div className="p-5 space-y-2.5">
              <div className="h-4 w-20 rounded-full bg-slate-200/80" />
              <div className="h-5 w-3/4 rounded-lg bg-slate-200/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GaleriPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
        <Suspense fallback={<GaleriSkeleton />}>
          <GaleriContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
