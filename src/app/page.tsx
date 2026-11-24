import { cache, Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  GraduationCap,
  Landmark,
  MapPin,
  Newspaper,
  Quote,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { connection } from 'next/server';
import {
  getInstitutionSettings,
  getPublishedPosts,
  getPublicGalleryAndFacilities,
} from '@/lib/data/public-queries';
import { PublicNavbar } from '@/components/layout/public-shell';
import { MissionList } from '@/components/home/mission-list';

const getCachedInstitutionSettings = cache(getInstitutionSettings);

const FACILITY_CONDITION_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  BAIK: {
    label: 'Baik',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  },
  RUSAK_RINGAN: {
    label: 'Rusak Ringan',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70',
  },
  RUSAK_BERAT: {
    label: 'Rusak Berat',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
  },
  DALAM_PERBAIKAN: {
    label: 'Dalam Perbaikan',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/70',
  },
};

function formatPublishedDate(value: string | null): string {
  if (!value) return '';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function HeroIntro() {
  await connection();
  const school = await getCachedInstitutionSettings();

  return (
    <>
      <div className="inline-flex items-center gap-2 bg-white/85 backdrop-blur border border-emerald-200/80 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs max-w-full">
        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="truncate">
          Sistem Informasi Manajemen{' '}
          {school.institution_type === 'MADRASAH' ? 'Madrasah' : 'Sekolah'}
        </span>
      </div>

      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15] break-words">
        {school.name || 'Lembaga Pendidikan Terpadu'}
      </h1>

      <p className="text-slate-600 text-base md:text-lg max-w-2xl leading-relaxed break-words">
        {school.vision ||
          'Mewujudkan layanan pendidikan yang modern, transparan, dan terintegrasi.'}
      </p>
    </>
  );
}

function HeroIntroSkeleton() {
  return (
    <>
      <div className="h-7 w-64 max-w-full rounded-full bg-emerald-100/70 animate-pulse" />
      <div className="space-y-2.5">
        <div className="h-10 sm:h-11 w-full max-w-lg rounded-xl bg-slate-200/80 animate-pulse" />
        <div className="h-10 sm:h-11 w-3/4 rounded-xl bg-slate-200/80 animate-pulse" />
      </div>
      <div className="space-y-2 max-w-2xl">
        <div className="h-4 w-full rounded bg-slate-200/70 animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-slate-200/70 animate-pulse" />
      </div>
    </>
  );
}

async function HeadmasterCard() {
  await connection();
  const school = await getCachedInstitutionSettings();
  const headName =
    school.headmaster_name?.trim() ||
    school.head_title_label ||
    'Pimpinan Lembaga';
  const initials =
    headName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'KS';
  const greeting =
    school.headmaster_greeting?.trim() ||
    'Selamat datang di website resmi dan portal layanan digital terpadu kami.';

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold">
          Sambutan {school.head_title_label || 'Kepala Lembaga'}
        </span>
        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
          <GraduationCap className="w-4 h-4 text-emerald-600" />
        </div>
      </div>

      <div className="relative">
        <Quote className="w-5 h-5 text-emerald-200 mb-1.5" aria-hidden="true" />
        <p className="text-sm text-slate-600 leading-relaxed break-words">
          &ldquo;{greeting}&rdquo;
        </p>
      </div>

      <div className="pt-4 border-t border-slate-200/70 flex items-center gap-3 min-w-0">
        {school.headmaster_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={school.headmaster_photo_url}
            alt={headName}
            className="w-11 h-11 rounded-full object-cover border border-emerald-200 shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">{headName}</p>
          <p className="text-xs text-slate-500 truncate">
            {school.head_title_label || 'Kepala Lembaga'}
          </p>
        </div>
      </div>
    </div>
  );
}

function HeadmasterCardSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-40 rounded bg-emerald-100 animate-pulse" />
        <div className="w-8 h-8 rounded-xl bg-emerald-100 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full rounded bg-slate-200/80 animate-pulse" />
        <div className="h-3.5 w-full rounded bg-slate-200/80 animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-slate-200/80 animate-pulse" />
      </div>
      <div className="pt-4 border-t border-slate-200/70 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-emerald-100 animate-pulse shrink-0" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-24 rounded bg-slate-200/80 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

async function ProfileVisionContent() {
  await connection();
  const school = await getCachedInstitutionSettings();
  const missions = Array.isArray(school.mission)
    ? school.mission.filter((item) => Boolean(item && item.trim()))
    : [];

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-10 grid md:grid-cols-2 gap-8 md:gap-10">
      <div className="space-y-5 min-w-0">
        <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider">
          <Building2 className="w-4 h-4 shrink-0" /> Profil &amp; Sejarah
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
          Mengenal {school.name || 'Lembaga Kami'}
        </h2>
        <p className="text-slate-600 leading-relaxed text-sm md:text-base break-words text-justify">
          {school.history || 'Informasi sejarah singkat lembaga belum ditambahkan.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-white/85 border border-slate-200/80 min-w-0">
            <p className="text-xs text-slate-500">Organisasi Siswa</p>
            <p className="font-bold text-slate-900 mt-1 break-words">
              {school.student_org_label || '-'}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/85 border border-slate-200/80 min-w-0">
            <p className="text-xs text-slate-500">Akreditasi</p>
            <p className="font-bold text-emerald-700 mt-1 break-words">
              {school.accreditation || 'Belum Terakreditasi'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 min-w-0">
        <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider">
          <Award className="w-4 h-4 shrink-0" /> Visi &amp; Misi
        </div>
        <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
          <p className="text-xs font-bold uppercase text-emerald-800 mb-1">Visi</p>
          <p className="text-slate-800 font-medium text-sm md:text-base leading-relaxed break-words text-justify">
            {school.vision || 'Visi lembaga belum ditetapkan.'}
          </p>
        </div>
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase text-slate-500">Misi Lembaga</p>
          <MissionList missions={missions} />
        </div>
      </div>
    </div>
  );
}

function ProfileVisionSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-10 grid md:grid-cols-2 gap-8 md:gap-10">
      <div className="space-y-5">
        <div className="h-4 w-32 rounded bg-emerald-100 animate-pulse" />
        <div className="h-7 w-56 max-w-full rounded bg-slate-200 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-200/80 animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-slate-200/80 animate-pulse" />
          <div className="h-4 w-4/6 rounded bg-slate-200/80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
          <div className="h-20 rounded-2xl bg-white/80 border border-slate-200/80 animate-pulse" />
          <div className="h-20 rounded-2xl bg-white/80 border border-slate-200/80 animate-pulse" />
        </div>
      </div>
      <div className="space-y-5">
        <div className="h-4 w-28 rounded bg-emerald-100 animate-pulse" />
        <div className="h-24 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 animate-pulse" />
        <div className="space-y-2.5">
          <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
          <div className="h-6 w-full rounded bg-slate-200/70 animate-pulse" />
          <div className="h-6 w-11/12 rounded bg-slate-200/70 animate-pulse" />
          <div className="h-6 w-10/12 rounded bg-slate-200/70 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

async function LatestPosts() {
  await connection();
  const posts = await getPublishedPosts(3);

  if (posts.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center space-y-2">
        <Newspaper className="w-8 h-8 text-emerald-600/80 mx-auto" />
        <p className="font-semibold text-slate-800 text-sm">
          Belum Ada Publikasi Terbaru
        </p>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Berita, artikel, dan pengumuman resmi akan tampil di sini setelah dipublikasikan melalui Portal CMS.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
      {posts.map((post) => {
        const categoryLabel = (post.category || 'BERITA').replaceAll('_', ' ');
        const excerptText =
          post.excerpt?.trim() ||
          (post.content ? `${post.content.slice(0, 140)}...` : '') ||
          'Baca informasi selengkapnya di halaman publikasi.';
        const formattedDate = formatPublishedDate(post.published_at);

        return (
          <Link
            key={post.id}
            href="/berita"
            className="modular-card rounded-3xl p-6 flex flex-col justify-between space-y-4 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <article className="space-y-3 min-w-0">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {categoryLabel}
              </span>
              <h3 className="font-bold text-slate-900 leading-snug break-words group-hover:text-emerald-700 transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed break-words">
                {excerptText}
              </p>
            </article>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="truncate">
                {post.author_display_name || 'Tim Redaksi'}
              </span>
              {formattedDate && <span className="shrink-0">{formattedDate}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

async function FacilitiesHighlightContent() {
  await connection();
  const { facilities } = await getPublicGalleryAndFacilities();

  if (facilities.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center space-y-2">
        <Building2 className="w-8 h-8 text-emerald-600/80 mx-auto" />
        <p className="font-semibold text-slate-800 text-sm">
          Data Sarana &amp; Prasarana Belum Tersedia
        </p>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Daftar fasilitas lembaga akan tampil di sini setelah ditambahkan melalui Portal CMS.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {facilities.slice(0, 6).map((f) => {
        const conditionMeta = FACILITY_CONDITION_META[f.condition || ''] || {
          label: f.condition || 'Baik',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/70',
        };

        return (
          <div key={f.id} className="modular-card rounded-2xl p-5 space-y-2.5 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm leading-snug min-w-0 break-words">
                {f.name}
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                {f.quantity ?? 0} Unit
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{f.category || 'Umum'}</span>
              <span>•</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${conditionMeta.badgeClass}`}
              >
                {conditionMeta.label}
              </span>
            </div>
            {f.description && (
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 break-words">
                {f.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FacilitiesHighlightSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {[0, 1, 2].map((item) => (
        <div key={item} className="modular-card rounded-2xl p-5 space-y-3">
          <div className="h-4 w-40 max-w-full rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-32 rounded bg-slate-200/70 animate-pulse" />
          <div className="h-3 w-full rounded bg-slate-200/70 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function LatestPostsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="modular-card rounded-3xl p-6 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="h-6 w-24 rounded-full bg-emerald-50 animate-pulse" />
            <div className="h-5 w-full rounded bg-slate-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-200/70 animate-pulse" />
              <div className="h-3.5 w-5/6 rounded bg-slate-200/70 animate-pulse" />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3 w-24 rounded bg-slate-200/80 animate-pulse" />
            <div className="h-3 w-16 rounded bg-slate-200/80 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function FooterContent() {
  await connection();
  const school = await getCachedInstitutionSettings();

  return (
    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <p className="font-semibold text-slate-700 break-words">
          © 2026 {school.name || 'SIMMS'}. Seluruh hak cipta dilindungi.
        </p>
        {school.address && (
          <p className="text-slate-500 break-words">{school.address}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600 shrink-0">
        <Link href="/profil" className="hover:text-emerald-700 transition">
          Profil
        </Link>
        <Link href="/berita" className="hover:text-emerald-700 transition">
          Berita
        </Link>
        <Link href="/e-library" className="hover:text-emerald-700 transition">
          E-Library
        </Link>
        <Link href="/ppdb" className="hover:text-emerald-700 transition">
          PPDB
        </Link>
        <Link href="/kontak" className="hover:text-emerald-700 transition">
          Kontak
        </Link>
      </div>
    </div>
  );
}

function FooterSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="h-4 w-64 max-w-full rounded bg-slate-200 animate-pulse" />
        <div className="h-3.5 w-48 max-w-full rounded bg-slate-200/70 animate-pulse" />
      </div>
      <div className="h-4 w-56 max-w-full rounded bg-slate-200 animate-pulse" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col simms-ambient">
      <PublicNavbar />

      <main className="flex-1">
        {/* Airy Hero Section with Light Glassmorphism */}
        <section className="relative pt-10 pb-12 sm:pt-14 sm:pb-16 md:pt-20 md:pb-24 px-4 sm:px-6 overflow-x-clip">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-7 space-y-5 sm:space-y-6 min-w-0">
              <Suspense fallback={<HeroIntroSkeleton />}>
                <HeroIntro />
              </Suspense>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-3.5 pt-2">
                <Link
                  href="/ppdb"
                  className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold px-6 py-3.5 rounded-2xl transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <span>Daftar PPDB Online</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </Link>
                <Link
                  href="/portal"
                  className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 bg-white/90 hover:bg-white active:bg-slate-50 border border-slate-200/90 text-slate-800 font-semibold px-6 py-3.5 rounded-2xl transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <span>Masuk Portal Akademik &amp; TU</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 min-w-0">
              <Suspense fallback={<HeadmasterCardSkeleton />}>
                <HeadmasterCard />
              </Suspense>
            </div>
          </div>
        </section>

        {/* 3 Pillars Modular Cards */}
        <section id="layanan" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 w-full">
          <div className="max-w-2xl mb-8 sm:mb-10 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Arsitektur Terintegrasi
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Tiga Pilar Ekosistem Digital
            </h2>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              Mengintegrasikan layanan publik, proses belajar-mengajar, dan administrasi keuangan dalam satu platform terpadu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            <div className="modular-card rounded-3xl p-6 sm:p-7 space-y-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Newspaper className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">1. Website Resmi &amp; CMS</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Profil lembaga fleksibel, Berita &amp; Artikel, Galeri Multimedia, Direktori GTK &amp; Prestasi, PPDB Online, serta Pengaduan &amp; FAQ.
              </p>
            </div>

            <div className="modular-card rounded-3xl p-6 sm:p-7 space-y-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">2. Portal Akademik</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Buku Induk Digital, Rombel &amp; Jadwal, Presensi Siswa, Absensi Guru GPS Geofencing, Delegasi Pengganti, dan Pengawas/Panitia Ujian.
              </p>
            </div>

            <div className="modular-card rounded-3xl p-6 sm:p-7 space-y-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">3. Administrasi &amp; Keuangan</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                SPP/Komite, Tabungan Warga &amp; Umum, Honorarium JTM, Persuratan &amp; Kartu Pelajar, E-Library, BK, Guru Wali, dan Tracer Study.
              </p>
            </div>
          </div>
        </section>

        {/* Profil & Visi Misi Modular Layout */}
        <section id="profil" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 w-full">
          <Suspense fallback={<ProfileVisionSkeleton />}>
            <ProfileVisionContent />
          </Suspense>
        </section>

        {/* Sarana & Prasarana */}
        <section id="sarana" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 w-full">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-7 sm:mb-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Fasilitas Penunjang
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Sarana &amp; Prasarana Lembaga
              </h2>
            </div>
            <Link
              href="/profil"
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 shrink-0 py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>Lihat Selengkapnya</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <Suspense fallback={<FacilitiesHighlightSkeleton />}>
            <FacilitiesHighlightContent />
          </Suspense>
        </section>

        {/* Berita & Pengumuman */}
        <section id="berita" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 w-full">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-7 sm:mb-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Publikasi Terkini
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Berita, Artikel &amp; Pengumuman
              </h2>
            </div>
            <Link
              href="/berita"
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 shrink-0 py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>Lihat Semua Berita</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <Suspense fallback={<LatestPostsSkeleton />}>
            <LatestPosts />
          </Suspense>
        </section>

        {/* Quick Access Modular Strip */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/ppdb"
              className="modular-card rounded-2xl p-5 flex items-start gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0 group-hover:bg-amber-100 transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                  PPDB Online
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Daftar, unggah berkas &amp; cek kelulusan
                </p>
              </div>
            </Link>
            <Link
              href="/e-library"
              className="modular-card rounded-2xl p-5 flex items-start gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 group-hover:bg-emerald-100 transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                  E-Library Publik
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Daftar anggota umum &amp; baca e-book
                </p>
              </div>
            </Link>
            <Link
              href="/portal/layanan/alumni"
              className="modular-card rounded-2xl p-5 flex items-start gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0 group-hover:bg-sky-100 transition-colors">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                  Tracer Study Alumni
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Sebaran studi lanjut &amp; dunia kerja
                </p>
              </div>
            </Link>
            <Link
              href="/portal"
              className="modular-card rounded-2xl p-5 flex items-start gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0 group-hover:bg-rose-100 transition-colors">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                  Portal Akademik &amp; TU
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Akses GTK, Siswa, Bendahara &amp; Operator
                </p>
              </div>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/75 backdrop-blur text-slate-500 text-xs py-6 px-4 sm:px-6 mt-auto">
        <Suspense fallback={<FooterSkeleton />}>
          <FooterContent />
        </Suspense>
      </footer>
    </div>
  );
}
