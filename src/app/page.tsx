import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  GraduationCap,
  Landmark,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { DEFAULT_INSTITUTION_SETTINGS, DEFAULT_POSTS } from '@/lib/data/demo-seed';

export default function HomePage() {
  const school = DEFAULT_INSTITUTION_SETTINGS;
  const posts = DEFAULT_POSTS;

  return (
    <div className="min-h-screen flex flex-col simms-ambient">
      {/* Subtle Top Info Strip */}
      <div className="bg-slate-900/95 text-slate-200 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" /> {school.phone}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-emerald-400" /> {school.email}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-300">NPSN {school.npsn}</span>
            {school.institution_type === 'MADRASAH' && school.nsm && (
              <span className="text-slate-300">• NSM {school.nsm}</span>
            )}
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-medium">
              Akreditasi {school.accreditation}
            </span>
          </div>
        </div>
      </div>

      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-30 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {school.short_name?.slice(0, 1) || 'S'}
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-tight tracking-tight">
                {school.name}
              </p>
              <p className="text-xs text-slate-500">
                Website Resmi &amp; Portal Terpadu ({school.institution_type})
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#profil" className="hover:text-emerald-700 transition">
              Profil
            </a>
            <a href="#berita" className="hover:text-emerald-700 transition">
              Berita &amp; Artikel
            </a>
            <a href="#layanan" className="hover:text-emerald-700 transition">
              Ekosistem
            </a>
            <Link href="/ppdb" className="hover:text-emerald-700 transition">
              PPDB Online
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              Portal Terpadu
            </Link>
          </nav>

          <Link
            href="/portal"
            className="md:hidden inline-flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-semibold"
          >
            Portal
          </Link>
        </div>
      </header>

      {/* Airy Hero Section with Light Glassmorphism */}
      <section className="relative pt-14 pb-16 md:pt-20 md:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-emerald-200/80 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Sistem Informasi Manajemen{' '}
                {school.institution_type === 'MADRASAH' ? 'Madrasah' : 'Sekolah'}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              {school.name}
            </h1>

            <p className="text-slate-600 text-base md:text-lg max-w-2xl leading-relaxed">
              {school.vision}
            </p>

            <div className="flex flex-wrap gap-3.5 pt-2">
              <Link
                href="/ppdb"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3.5 rounded-2xl transition shadow-sm"
              >
                Daftar PPDB Online
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 bg-white/85 hover:bg-white border border-slate-200/90 text-slate-800 font-semibold px-6 py-3.5 rounded-2xl transition shadow-xs"
              >
                Masuk Portal Akademik &amp; TU
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="glass-card rounded-3xl p-7 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold">
                  Sambutan {school.head_title_label}
                </span>
                <GraduationCap className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                &ldquo;{school.headmaster_greeting}&rdquo;
              </p>
              <div className="pt-4 border-t border-slate-200/70 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  AF
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{school.headmaster_name}</p>
                  <p className="text-xs text-slate-500">{school.head_title_label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Modular Cards */}
      <section id="layanan" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="max-w-2xl mb-10 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Arsitektur Terintegrasi
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Tiga Pilar Ekosistem Digital
          </h2>
          <p className="text-slate-600 text-sm md:text-base">
            Setiap modul dirancang dalam kartu-kartu terstruktur agar mudah dijelajahi tanpa terasa padat.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="modular-card rounded-3xl p-7 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center">
              <Newspaper className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Website Resmi &amp; CMS</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Profil lembaga fleksibel, Berita &amp; Artikel, Galeri Multimedia, Direktori GTK &amp; Prestasi, PPDB Online, serta Pengaduan &amp; FAQ.
            </p>
          </div>

          <div className="modular-card rounded-3xl p-7 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Portal Akademik</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Buku Induk Digital, Rombel &amp; Jadwal, Presensi Siswa, Absensi Guru GPS Geofencing, Delegasi Pengganti, dan Pengawas/Panitia Ujian.
            </p>
          </div>

          <div className="modular-card rounded-3xl p-7 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center">
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
      <section id="profil" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="glass-card rounded-3xl p-8 md:p-10 grid md:grid-cols-2 gap-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4" /> Profil &amp; Sejarah
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Mengenal {school.short_name}</h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">{school.history}</p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80">
                <p className="text-xs text-slate-500">Organisasi Siswa</p>
                <p className="font-bold text-slate-900 mt-1">{school.student_org_label}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80">
                <p className="text-xs text-slate-500">Akreditasi</p>
                <p className="font-bold text-emerald-700 mt-1">{school.accreditation}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider">
              <Award className="w-4 h-4" /> Visi &amp; Misi
            </div>
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
              <p className="text-xs font-bold uppercase text-emerald-800 mb-1">Visi</p>
              <p className="text-slate-800 font-medium text-sm md:text-base">{school.vision}</p>
            </div>
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase text-slate-500">Misi Lembaga</p>
              <ul className="space-y-2.5">
                {school.mission.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-emerald-600/10 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Berita & Pengumuman */}
      <section id="berita" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Publikasi Terkini
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Berita, Artikel &amp; Pengumuman
            </h2>
          </div>
          <Link
            href="/portal"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            Kelola di CMS <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="modular-card rounded-3xl p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {post.category.replace('_', ' ')}
                </span>
                <h3 className="font-bold text-slate-900 leading-snug">{post.title}</h3>
                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                  {post.excerpt}
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{post.author_display_name}</span>
                <span>
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString('id-ID')
                    : ''}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Quick Access Modular Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/ppdb" className="modular-card rounded-2xl p-5 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">PPDB Online</p>
              <p className="text-xs text-slate-500 mt-1">Daftar, unggah berkas &amp; cek kelulusan</p>
            </div>
          </Link>
          <Link
            href="/portal?tab=perpustakaan"
            className="modular-card rounded-2xl p-5 flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">E-Library Publik</p>
              <p className="text-xs text-slate-500 mt-1">Daftar anggota umum &amp; baca e-book</p>
            </div>
          </Link>
          <Link
            href="/portal?tab=alumni"
            className="modular-card rounded-2xl p-5 flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Tracer Study Alumni</p>
              <p className="text-xs text-slate-500 mt-1">Sebaran studi lanjut &amp; dunia kerja</p>
            </div>
          </Link>
          <Link href="/portal" className="modular-card rounded-2xl p-5 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Portal Akademik &amp; TU</p>
              <p className="text-xs text-slate-500 mt-1">Akses GTK, Siswa, Bendahara &amp; Operator</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur text-slate-500 text-xs py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p>
            © 2026 {school.name}. Dibangun dengan Next.js, Supabase &amp; Cloudflare R2.
          </p>
          <p>{school.address}</p>
        </div>
      </footer>
    </div>
  );
}
