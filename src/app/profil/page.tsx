import { Suspense } from 'react';
import { Award, Building2, CheckCircle2, MapPin } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { FacilitiesSection } from '@/components/profil/facilities-section';
import {
  getInstitutionSettings,
  getPublicGalleryAndFacilities,
} from '@/lib/data/public-queries';

async function ProfilContent() {
  await connection();
  const [school, { facilities }] = await Promise.all([
    getInstitutionSettings(),
    getPublicGalleryAndFacilities(),
  ]);

  const missions = Array.isArray(school.mission)
    ? school.mission.map((m) => m.trim()).filter(Boolean)
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
          Profil Lembaga ({school.institution_type || 'SEKOLAH'})
        </span>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-10 space-y-6">
        <div className="space-y-2.5 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
            {school.name || 'Lembaga Pendidikan'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500">
            <span>NPSN: {school.npsn || '-'}</span>
            {school.nsm && (
              <>
                <span className="text-slate-300">•</span>
                <span>NSM: {school.nsm}</span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span>
              Akreditasi {school.accreditation || '-'}
              {school.accreditation_year ? ` (${school.accreditation_year})` : ''}
            </span>
          </div>
          {school.address && (
            <p className="text-xs text-slate-500 flex items-start gap-1.5 pt-0.5 break-words">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span>{school.address}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-2 border-t border-slate-200/70">
          <div className="space-y-3 min-w-0">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700 shrink-0" /> Sejarah Singkat
            </h2>
            {school.history?.trim() ? (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">
                {school.history}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Sejarah singkat lembaga belum ditambahkan.
              </p>
            )}
          </div>

          <div className="space-y-4 min-w-0">
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Visi</p>
              {school.vision?.trim() ? (
                <p className="text-sm font-medium text-slate-800 leading-relaxed break-words">
                  {school.vision}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">Visi lembaga belum ditambahkan.</p>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Misi</p>
              {missions.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Misi lembaga belum ditambahkan.</p>
              ) : (
                <ul className="space-y-2">
                  {missions.map((m, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed min-w-0"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="break-words">{m}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>Sambutan {school.head_title_label || 'Kepala Lembaga'}</span>
        </h2>
        {school.headmaster_greeting?.trim() ? (
          <p className="text-sm text-slate-600 leading-relaxed italic whitespace-pre-line break-words">
            &ldquo;{school.headmaster_greeting}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            Sambutan kepala lembaga belum ditambahkan.
          </p>
        )}
        <p className="text-sm font-bold text-slate-900">
          — {school.headmaster_name || 'Kepala Lembaga'}
        </p>
      </div>

      <FacilitiesSection facilities={facilities} />
    </>
  );
}

function ProfilSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-44 rounded-full bg-slate-200/80" />
      <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-10 space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-2/3 rounded-xl bg-slate-200/80" />
          <div className="h-4 w-1/2 rounded-lg bg-slate-200/70" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/60">
          <div className="space-y-2.5">
            <div className="h-4 w-32 rounded bg-slate-200/80" />
            <div className="h-24 w-full rounded-xl bg-slate-200/60" />
          </div>
          <div className="space-y-3">
            <div className="h-20 w-full rounded-2xl bg-emerald-100/60" />
            <div className="h-16 w-full rounded-xl bg-slate-200/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
        <Suspense fallback={<ProfilSkeleton />}>
          <ProfilContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
