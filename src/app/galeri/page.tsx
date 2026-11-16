import { Suspense } from 'react';
import { Image as ImageIcon, PlayCircle, Video } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import {
  getInstitutionSettings,
  getPublicGalleryAndFacilities,
} from '@/lib/data/public-queries';

async function GaleriContent() {
  await connection();
  const [school, { gallery }] = await Promise.all([
    getInstitutionSettings(),
    getPublicGalleryAndFacilities(),
  ]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Galeri &amp; Multimedia
          </h1>
          <p className="text-sm text-slate-600">
            Dokumentasi foto kegiatan, video profil lembaga, dan tautan kanal media sosial resmi.
          </p>
        </div>
        {school.social_links?.youtube && (
          <a
            href={school.social_links.youtube}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0"
          >
            <Video className="w-4 h-4" /> YouTube Resmi
          </a>
        )}
      </div>

      {gallery.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center space-y-3">
          <ImageIcon className="w-10 h-10 text-emerald-600 mx-auto" />
          <p className="font-bold text-slate-900">Belum Ada Dokumentasi Terunggah</p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Admin/Humas dapat mengunggah foto kegiatan ke Cloudflare R2 atau menautkan video YouTube melalui Portal CMS.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.map((item) => (
            <div key={item.id} className="modular-card rounded-3xl overflow-hidden p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">
                  {item.media_type.replace('_', ' ')}
                </span>
                {item.media_type !== 'FOTO' && (
                  <PlayCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <h2 className="font-bold text-slate-900 text-sm">{item.title}</h2>
              {item.description && (
                <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
              )}
              <a
                href={item.media_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs font-semibold text-emerald-700 hover:underline"
              >
                Buka Media →
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function GaleriPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 space-y-8">
        <Suspense
          fallback={
            <div className="glass-card rounded-3xl p-8 text-center text-sm text-slate-500">
              Memuat galeri multimedia...
            </div>
          }
        >
          <GaleriContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
