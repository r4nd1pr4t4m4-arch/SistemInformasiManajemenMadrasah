import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Quote,
  Users,
} from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { FacilitiesSection } from '@/components/profil/facilities-section';
import { HeadmasterAvatar } from '@/components/home/safe-media';
import {
  getInstitutionSettings,
  getPublicFacilities,
  getPublicLeadershipStructure,
} from '@/lib/data/public-queries';

export const metadata: Metadata = {
  title: 'Profil Lembaga — SIMMS',
  description:
    'Profil lengkap, sejarah, visi dan misi, sambutan pimpinan, struktur organisasi, peta lokasi, serta sarana dan prasarana lembaga.',
};

function getInitials(name: string, fallback = 'PL'): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return initials || fallback;
}

function getValidCoordinates(
  latRaw: number | null | undefined,
  lngRaw: number | null | undefined
): { lat: number; lng: number } | null {
  if (latRaw == null || lngRaw == null) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function getSafeExternalUrl(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null;
  } catch {
    return null;
  }
}

async function ProfilContent() {
  await connection();
  const [school, facilities, leadership] = await Promise.all([
    getInstitutionSettings(),
    getPublicFacilities(),
    getPublicLeadershipStructure(),
  ]);

  const missions = Array.isArray(school.mission)
    ? school.mission.map((m) => (typeof m === 'string' ? m.trim() : '')).filter(Boolean)
    : [];

  const institutionLabel = school.institution_type === 'MADRASAH' ? 'Madrasah' : 'Sekolah';
  const headName =
    school.headmaster_name?.trim() || school.head_title_label || 'Kepala Lembaga';
  const coords = getValidCoordinates(school.geofence_lat, school.geofence_lng);
  const orgStructureUrl = getSafeExternalUrl(school.org_structure_url);

  const quickNavItems = [
    { href: '#tentang', label: 'Tentang & Visi Misi' },
    { href: '#sambutan', label: 'Sambutan' },
    ...(leadership.length > 0 || orgStructureUrl
      ? [{ href: '#struktur', label: 'Struktur Pimpinan' }]
      : []),
    ...(coords ? [{ href: '#lokasi', label: 'Lokasi Kampus' }] : []),
    { href: '#sarana', label: 'Sarana & Prasarana' },
  ];

  return (
    <>
      {/* Top Badge & Quick Jump Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="inline-flex items-center gap-2 w-fit text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
          <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Profil Lembaga ({institutionLabel})</span>
        </span>

        <nav
          aria-label="Navigasi Bagian Profil"
          className="flex flex-wrap items-center gap-1.5"
        >
          {quickNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="min-h-[34px] inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-slate-600 bg-white/80 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 hover:border-emerald-200 transition"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Identitas, Sejarah, Visi & Misi */}
      <section
        id="tentang"
        className="scroll-mt-20 sm:scroll-mt-24 glass-card rounded-3xl p-5 sm:p-8 md:p-10 space-y-6"
      >
        <div className="space-y-3 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight [overflow-wrap:anywhere]">
            {school.name || 'Lembaga Pendidikan'}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
              NPSN: {school.npsn || '-'}
            </span>
            {school.institution_type === 'MADRASAH' && school.nsm && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                NSM: {school.nsm}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-semibold">
              Akreditasi {school.accreditation || 'Belum Terakreditasi'}
              {school.accreditation && school.accreditation_year
                ? ` (${school.accreditation_year})`
                : ''}
            </span>
            {school.student_org_label && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                Organisasi Siswa: {school.student_org_label}
              </span>
            )}
          </div>

          {school.address && (
            <p className="text-xs sm:text-sm text-slate-500 flex items-start gap-2 pt-0.5 [overflow-wrap:anywhere]">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{school.address}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-4 border-t border-slate-200/70">
          <div className="space-y-3 min-w-0">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Sejarah Singkat</span>
            </h2>
            {school.history?.trim() ? (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] text-left sm:text-justify">
                {school.history}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Sejarah singkat lembaga belum ditambahkan.
              </p>
            )}
          </div>

          <div className="space-y-4 min-w-0">
            <div className="p-5 rounded-2xl bg-emerald-50/75 border border-emerald-200/60 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Visi
              </p>
              {school.vision?.trim() ? (
                <p className="text-sm font-medium text-slate-800 leading-relaxed [overflow-wrap:anywhere] text-left sm:text-justify">
                  {school.vision}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">Visi lembaga belum ditambahkan.</p>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Misi Lembaga
              </p>
              {missions.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Misi lembaga belum ditambahkan.</p>
              ) : (
                <ul className="space-y-2.5">
                  {missions.map((m, i) => (
                    <li
                      key={`${i}-${m.slice(0, 24)}`}
                      className="text-sm text-slate-700 flex items-start gap-2.5 leading-relaxed min-w-0"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="[overflow-wrap:anywhere] text-left sm:text-justify">
                        {m}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sambutan Kepala Lembaga */}
      <section
        id="sambutan"
        className="scroll-mt-20 sm:scroll-mt-24 glass-card rounded-3xl p-5 sm:p-8 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 min-w-0">
            <Award className="w-5 h-5 text-emerald-700 shrink-0" />
            <span className="[overflow-wrap:anywhere]">
              Sambutan {school.head_title_label || 'Kepala Lembaga'}
            </span>
          </h2>
          <Quote className="w-5 h-5 text-emerald-200 shrink-0" aria-hidden="true" />
        </div>

        {school.headmaster_greeting?.trim() ? (
          <p className="text-sm text-slate-600 leading-relaxed italic whitespace-pre-line [overflow-wrap:anywhere]">
            &ldquo;{school.headmaster_greeting}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            Sambutan kepala lembaga belum ditambahkan.
          </p>
        )}

        <div className="pt-3 border-t border-slate-200/70 flex items-center gap-3 min-w-0">
          <HeadmasterAvatar
            photoUrl={school.headmaster_photo_url}
            name={headName}
            initials={getInitials(headName, 'KS')}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{headName}</p>
            <p className="text-xs text-slate-500 truncate">
              {school.head_title_label || 'Kepala Lembaga'}
            </p>
          </div>
        </div>
      </section>

      {/* Struktur Organisasi & Pimpinan */}
      {(leadership.length > 0 || orgStructureUrl) && (
        <section
          id="struktur"
          className="scroll-mt-20 sm:scroll-mt-24 glass-card rounded-3xl p-5 sm:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Struktur Organisasi &amp; Pimpinan Lembaga</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Jajaran pimpinan dan koordinator tugas tambahan aktif lembaga.
              </p>
            </div>
            {orgStructureUrl && (
              <a
                href={orgStructureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition shrink-0"
              >
                <span>Lihat Bagan Organisasi</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            )}
          </div>

          {leadership.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {leadership.map((item) => (
                <div
                  key={item.id}
                  className="modular-card rounded-2xl p-4 flex items-center gap-3 border border-slate-200/80 min-w-0"
                >
                  <HeadmasterAvatar
                    photoUrl={item.photoUrl}
                    name={item.personName}
                    initials={getInitials(item.personName, 'GT')}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 truncate">
                      {item.roleName}
                    </p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {item.personName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Peta Lokasi Kampus */}
      {coords && (
        <section
          id="lokasi"
          className="scroll-mt-20 sm:scroll-mt-24 glass-card rounded-3xl p-5 sm:p-8 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Peta Lokasi Kampus</span>
              </h2>
              {school.address && (
                <p className="text-xs text-slate-500 mt-0.5 [overflow-wrap:anywhere]">
                  {school.address}
                </p>
              )}
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${coords.lat},${coords.lng}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shrink-0 w-full sm:w-auto"
            >
              <span>Buka di Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>
          <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
            <iframe
              title={`Peta Lokasi ${school.name || 'Kampus'}`}
              width="100%"
              height="100%"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                coords.lng - 0.005
              }%2C${coords.lat - 0.004}%2C${coords.lng + 0.005}%2C${
                coords.lat + 0.004
              }&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
            />
          </div>
        </section>
      )}

      {/* Sarana & Prasarana */}
      <FacilitiesSection facilities={facilities} />
    </>
  );
}

function ProfilSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-44 rounded-full bg-slate-200/80" />
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-full bg-slate-200/70" />
          <div className="h-8 w-24 rounded-full bg-slate-200/70" />
          <div className="h-8 w-32 rounded-full bg-slate-200/70" />
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-10 space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-2/3 max-w-md rounded-xl bg-slate-200/80" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-28 rounded-lg bg-slate-200/70" />
            <div className="h-6 w-36 rounded-lg bg-emerald-100/70" />
          </div>
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

      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-4">
        <div className="h-5 w-48 rounded bg-slate-200/80" />
        <div className="h-16 w-full rounded-xl bg-slate-200/60" />
        <div className="flex items-center gap-3 pt-2">
          <div className="w-11 h-11 rounded-full bg-emerald-100/70 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 rounded bg-slate-200/80" />
            <div className="h-3 w-24 rounded bg-slate-200/70" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="modular-card rounded-2xl p-5 space-y-3">
            <div className="h-4 w-36 rounded bg-slate-200/80" />
            <div className="h-3 w-24 rounded bg-slate-200/60" />
            <div className="h-10 w-full rounded bg-slate-200/50" />
          </div>
        ))}
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
