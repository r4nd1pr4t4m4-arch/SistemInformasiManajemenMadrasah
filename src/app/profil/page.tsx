import { Suspense } from 'react';
import { Award, Building2, CheckCircle2, ExternalLink, MapPin, Users } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { FacilitiesSection } from '@/components/profil/facilities-section';
import {
  getInstitutionSettings,
  getPublicGalleryAndFacilities,
  getPublicLeadershipStructure,
} from '@/lib/data/public-queries';

async function ProfilContent() {
  await connection();
  const [school, { facilities }, leadership] = await Promise.all([
    getInstitutionSettings(),
    getPublicGalleryAndFacilities(),
    getPublicLeadershipStructure(),
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

      {leadership.length > 0 && (
        <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Struktur Organisasi &amp; Pimpinan Lembaga</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jajaran pimpinan dan koordinator tugas tambahan aktif lembaga.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {leadership.map((item) => (
              <div
                key={item.id}
                className="modular-card rounded-2xl p-4 flex items-center gap-3 border border-slate-200/80"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt={item.personName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    item.personName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 truncate">
                    {item.roleName}
                  </p>
                  <p className="text-sm font-bold text-slate-900 truncate">{item.personName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {school.geofence_lat != null && school.geofence_lng != null && (
        <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Peta Lokasi Kampus</span>
              </h2>
              {school.address && <p className="text-xs text-slate-500 mt-0.5">{school.address}</p>}
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${school.geofence_lat},${school.geofence_lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              <span>Buka di Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
            <iframe
              title={`Peta Lokasi ${school.name}`}
              width="100%"
              height="100%"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                Number(school.geofence_lng) - 0.005
              }%2C${Number(school.geofence_lat) - 0.004}%2C${
                Number(school.geofence_lng) + 0.005
              }%2C${Number(school.geofence_lat) + 0.004}&layer=mapnik&marker=${
                school.geofence_lat
              }%2C${school.geofence_lng}`}
            />
          </div>
        </div>
      )}

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
