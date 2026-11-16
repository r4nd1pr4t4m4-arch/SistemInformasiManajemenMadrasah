import { Suspense } from 'react';
import { Award, Building2, CheckCircle2, Layers } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
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

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
          Profil Lembaga ({school.institution_type})
        </span>
      </div>

      <div className="glass-card rounded-3xl p-8 md:p-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {school.name}
          </h1>
          <p className="text-sm text-slate-500">
            NPSN: {school.npsn || '-'} {school.nsm ? `• NSM: ${school.nsm}` : ''} • Akreditasi{' '}
            {school.accreditation || '-'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 pt-2">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" /> Sejarah Singkat
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">{school.history}</p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
              <p className="text-xs font-bold uppercase text-emerald-800 mb-1">Visi</p>
              <p className="text-sm font-medium text-slate-800">{school.vision}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-slate-500">Misi</p>
              {school.mission.map((m, i) => (
                <p key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{m}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-700" /> Sambutan {school.head_title_label}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed italic">
          &ldquo;{school.headmaster_greeting}&rdquo;
        </p>
        <p className="text-sm font-bold text-slate-900">— {school.headmaster_name}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-700" /> Fasilitas Sarana &amp; Prasarana
        </h2>
        {facilities.length === 0 ? (
          <div className="modular-card rounded-2xl p-6 text-sm text-slate-600">
            Data fasilitas sarana &amp; prasarana dapat ditambahkan melalui menu CMS di Portal Terpadu.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.map((f) => {
              const condLabel =
                f.condition === 'BAIK'
                  ? 'Baik'
                  : f.condition === 'RUSAK_RINGAN'
                  ? 'Rusak Ringan'
                  : f.condition === 'RUSAK_BERAT'
                  ? 'Rusak Berat'
                  : f.condition === 'DALAM_PERBAIKAN'
                  ? 'Dalam Perbaikan'
                  : f.condition || 'Baik';
              return (
                <div key={f.id} className="modular-card rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{f.name}</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                      {f.quantity} Unit
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {f.category || 'Umum'} • Kondisi: {condLabel}
                  </p>
                  {f.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">{f.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function ProfilPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 space-y-8">
        <Suspense
          fallback={
            <div className="glass-card rounded-3xl p-8 text-center text-sm text-slate-500">
              Memuat profil lembaga...
            </div>
          }
        >
          <ProfilContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
