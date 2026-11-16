import Link from 'next/link';
import {
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
  Users,
  Wallet,
} from 'lucide-react';
import { DEFAULT_INSTITUTION_SETTINGS, DEFAULT_POSTS } from '@/lib/data/demo-seed';

export default function HomePage() {
  const school = DEFAULT_INSTITUTION_SETTINGS;
  const posts = DEFAULT_POSTS;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Bar */}
      <div className="bg-emerald-900 text-emerald-50 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {school.phone}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {school.email}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>NPSN: {school.npsn}</span>
            {school.institution_type === 'MADRASAH' && school.nsm && (
              <span>• NSM: {school.nsm}</span>
            )}
            <span className="bg-emerald-700 px-2 py-0.5 rounded font-medium">
              Akreditasi {school.accreditation}
            </span>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {school.short_name?.slice(0, 1) || 'S'}
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-tight">{school.name}</p>
              <p className="text-xs text-slate-500">
                Website Resmi &amp; Portal Terpadu ({school.institution_type})
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#profil" className="hover:text-emerald-700 transition">
              Profil
            </a>
            <a href="#berita" className="hover:text-emerald-700 transition">
              Berita &amp; Artikel
            </a>
            <a href="#layanan" className="hover:text-emerald-700 transition">
              Layanan Digital
            </a>
            <Link href="/ppdb" className="hover:text-emerald-700 transition">
              PPDB Online
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              Portal Terpadu
            </Link>
          </nav>

          <Link
            href="/portal"
            className="md:hidden inline-flex items-center gap-1.5 bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
          >
            Portal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-16 md:py-24 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3.5 py-1 text-xs font-medium">
              <GraduationCap className="w-4 h-4 text-emerald-300" />
              <span>
                Sistem Informasi Manajemen {school.institution_type === 'MADRASAH' ? 'Madrasah' : 'Sekolah'} (SIMMS)
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              {school.name}
            </h1>
            <p className="text-emerald-100 text-base md:text-lg max-w-2xl leading-relaxed">
              {school.vision}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/ppdb"
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-6 py-3 rounded-xl transition shadow-md"
              >
                Daftar PPDB Online
              </Link>
              <Link
                href="/portal"
                className="bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold px-6 py-3 rounded-xl transition"
              >
                Masuk Portal Akademik &amp; TU
              </Link>
            </div>
          </div>

          <div className="md:col-span-5 bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 space-y-4">
            <p className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">
              Sambutan {school.head_title_label}
            </p>
            <p className="text-sm text-emerald-50 leading-relaxed italic">
              &ldquo;{school.headmaster_greeting}&rdquo;
            </p>
            <div className="pt-2 border-t border-white/15">
              <p className="font-bold text-white">{school.headmaster_name}</p>
              <p className="text-xs text-emerald-200">{school.head_title_label}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Overview */}
      <section id="layanan" className="max-w-7xl mx-auto px-4 py-14 w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            Tiga Pilar Ekosistem Digital Terpadu
          </h2>
          <p className="text-slate-600 mt-2 text-sm md:text-base">
            Mengintegrasikan wajah publik lembaga, manajemen belajar-mengajar, dan layanan administrasi keuangan dalam satu platform.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Newspaper className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Website Resmi &amp; CMS</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Profil lembaga fleksibel (Madrasah/Sekolah), Berita &amp; Artikel, Galeri Multimedia, Direktori GTK &amp; Prestasi, PPDB Online, serta Layanan Pengaduan &amp; FAQ.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Portal Akademik</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Buku Induk Digital, Rombel &amp; Jadwal Pelajaran/Piket, Presensi Siswa, Absensi Guru berbasis GPS Geofencing, Delegasi Pengganti, serta Pengawas &amp; Panitia Ujian (JTM).
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. Administrasi &amp; Keuangan</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              SPP/Komite, Tabungan Warga &amp; Umum, Honorarium JTM &amp; Tugas Tambahan, Persuratan &amp; Kartu Pelajar, E-Library, BK, Guru Wali, dan Tracer Study Alumni.
            </p>
          </div>
        </div>
      </section>

      {/* Profil & Visi Misi */}
      <section id="profil" className="bg-white border-y border-slate-200 py-14 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Building2 className="w-4 h-4" /> Profil Singkat &amp; Sejarah
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Mengenal {school.short_name}</h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">{school.history}</p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Organisasi Siswa</p>
                <p className="font-bold text-slate-900 mt-0.5">{school.student_org_label}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Status Akreditasi</p>
                <p className="font-bold text-emerald-700 mt-0.5">{school.accreditation}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Award className="w-4 h-4" /> Visi &amp; Misi
            </div>
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs font-semibold uppercase text-emerald-800 mb-1">Visi</p>
              <p className="text-slate-800 font-medium">{school.vision}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Misi Lembaga</p>
              <ul className="space-y-2">
                {school.mission.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
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
      <section id="berita" className="max-w-7xl mx-auto px-4 py-14 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Berita, Artikel &amp; Pengumuman</h2>
            <p className="text-sm text-slate-600">
              Publikasi kegiatan, karya tulis guru/siswa, dan informasi resmi
            </p>
          </div>
          <Link
            href="/portal"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Kelola di CMS →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  {post.category.replace('_', ' ')}
                </span>
                <h3 className="font-bold text-slate-900 leading-snug">{post.title}</h3>
                <p className="text-sm text-slate-600 line-clamp-3">{post.excerpt}</p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
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

      {/* Quick Links Layanan Publik */}
      <section className="bg-slate-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/ppdb"
            className="p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-start gap-3"
          >
            <Users className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">PPDB Online</p>
              <p className="text-xs text-slate-300 mt-1">Pendaftaran, upload berkas &amp; cek kelulusan</p>
            </div>
          </Link>
          <Link
            href="/portal?tab=perpustakaan"
            className="p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-start gap-3"
          >
            <BookOpen className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">E-Library Publik</p>
              <p className="text-xs text-slate-300 mt-1">Daftar anggota umum &amp; baca koleksi e-book</p>
            </div>
          </Link>
          <Link
            href="/portal?tab=alumni"
            className="p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-start gap-3"
          >
            <Landmark className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Tracer Study Alumni</p>
              <p className="text-xs text-slate-300 mt-1">Pendataan sebaran studi lanjut &amp; dunia kerja</p>
            </div>
          </Link>
          <Link
            href="/portal"
            className="p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-start gap-3"
          >
            <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Portal Akademik &amp; TU</p>
              <p className="text-xs text-slate-300 mt-1">Login GTK, Siswa, Bendahara &amp; Operator</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-6 px-4 mt-auto">
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
