import { Suspense } from 'react';
import { Video } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { GaleriGrid } from '@/components/galeri/galeri-grid';
import {
  getInstitutionSettings,
  getPublicGalleryAndFacilities,
} from '@/lib/data/public-queries';

function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function GaleriContent() {
  await connection();
  const [school, { gallery }] = await Promise.all([
    getInstitutionSettings(),
    getPublicGalleryAndFacilities(),
  ]);

  const youtubeUrl = isSafeHttpUrl(school.social_links?.youtube)
    ? school.social_links.youtube
    : null;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
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
            className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition shrink-0"
          >
            <Video className="w-4 h-4 shrink-0" /> YouTube Resmi
          </a>
        )}
      </div>

      <GaleriGrid gallery={gallery} />
    </>
  );
}

function GaleriSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-xl bg-slate-200/80" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200/60" />
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
