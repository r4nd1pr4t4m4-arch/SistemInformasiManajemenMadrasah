import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Award, Trophy, Users } from 'lucide-react';
import { connection } from 'next/server';
import { getPublicDirectoryData } from '@/lib/data/public-queries';

async function DirektoriContent() {
  await connection();
  const { teachers, achievements } = await getPublicDirectoryData();

  return (
    <>
      {/* Direktori GTK */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-700" />
          <h1 className="text-2xl font-bold text-slate-900">
            Direktori Guru &amp; Tenaga Kependidikan (GTK)
          </h1>
        </div>

        {teachers.length === 0 ? (
          <div className="glass-card rounded-3xl p-6 text-sm text-slate-600">
            Data GTK aktif akan tampil di sini setelah ditambahkan melalui Buku Induk GTK di Portal Akademik.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => (
              <div key={t.id} className="modular-card rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                  {t.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {t.staff_type} • {t.employment_status || 'GTK'}
                  </p>
                  {t.major && <p className="text-xs text-emerald-700 mt-0.5">{t.major}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prestasi Siswa */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-600" />
          <h2 className="text-2xl font-bold text-slate-900">Prestasi Siswa &amp; Lembaga</h2>
        </div>

        {achievements.length === 0 ? (
          <div className="glass-card rounded-3xl p-6 text-sm text-slate-600">
            Catatan prestasi siswa akan tampil di sini setelah diinput melalui Portal Terpadu.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((a) => (
              <div key={a.id} className="modular-card rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {a.level}
                  </span>
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <p className="font-bold text-slate-900 text-sm">{a.title}</p>
                <p className="text-xs text-emerald-700 font-semibold">
                  {a.rank ? `${a.rank} — ` : ''}
                  {a.participant_name}
                </p>
                {a.organizer && (
                  <p className="text-xs text-slate-500">Penyelenggara: {a.organizer}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function DirektoriPage() {
  return (
    <div className="min-h-screen simms-ambient py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Beranda
          </Link>
          <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            Direktori GTK &amp; Prestasi Siswa
          </span>
        </div>

        <Suspense
          fallback={
            <div className="glass-card rounded-3xl p-8 text-center text-sm text-slate-500">
              Memuat direktori GTK &amp; prestasi...
            </div>
          }
        >
          <DirektoriContent />
        </Suspense>
      </div>
    </div>
  );
}
