'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';

const PUBLIC_NAV_LINKS = [
  { href: '/', label: 'Beranda' },
  { href: '/profil', label: 'Profil' },
  { href: '/berita', label: 'Berita' },
  { href: '/galeri', label: 'Galeri' },
  { href: '/direktori', label: 'Direktori' },
  { href: '/ppdb', label: 'PPDB Online' },
  { href: '/kontak', label: 'Kontak & FAQ' },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const school = useInstitutionSettings();

  return (
    <>
      {/* Top Info Strip */}
      <div className="bg-slate-900/95 text-slate-200 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" /> {school.phone}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-emerald-400" /> {school.email}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {school.npsn && <span className="text-slate-300">NPSN {school.npsn}</span>}
            {school.institution_type === 'MADRASAH' && school.nsm && (
              <span className="text-slate-300">• NSM {school.nsm}</span>
            )}
            {school.accreditation && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-medium">
                Akreditasi {school.accreditation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Glassmorphic Navbar */}
      <header className="sticky top-0 z-30 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {(school.short_name || school.name || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight tracking-tight">
                {school.name || school.short_name || 'Memuat...'}
              </p>
              <p className="text-[11px] text-slate-500">
                Website Resmi &amp; Portal Terpadu ({school.institution_type})
              </p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1.5 text-sm font-medium">
            {PUBLIC_NAV_LINKS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-emerald-700 hover:bg-white/70'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/portal"
              className="ml-2 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              Portal Terpadu
            </Link>
          </nav>

          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-semibold"
            >
              Portal
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2 rounded-xl bg-white/80 border border-slate-200/80 text-slate-700"
              aria-label="Toggle Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200/70 bg-white/95 backdrop-blur px-4 py-3 space-y-1">
            {PUBLIC_NAV_LINKS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-xl text-sm font-medium ${
                    active ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>
    </>
  );
}

export function PublicFooter() {
  const school = useInstitutionSettings();

  return (
    <footer className="border-t border-slate-200/80 bg-white/75 backdrop-blur mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-slate-600">
        <div className="space-y-2.5">
          <p className="font-bold text-slate-900 text-sm">{school.name}</p>
          <p className="leading-relaxed">{school.vision}</p>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Informasi Publik
          </p>
          <ul className="space-y-1.5">
            <li><Link href="/profil" className="hover:text-emerald-700">Profil &amp; Fasilitas</Link></li>
            <li><Link href="/berita" className="hover:text-emerald-700">Berita &amp; Artikel</Link></li>
            <li><Link href="/galeri" className="hover:text-emerald-700">Galeri &amp; Multimedia</Link></li>
            <li><Link href="/direktori" className="hover:text-emerald-700">Direktori GTK &amp; Prestasi</Link></li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Layanan Digital
          </p>
          <ul className="space-y-1.5">
            <li><Link href="/ppdb" className="hover:text-emerald-700">PPDB Siswa Baru</Link></li>
            <li><Link href="/ppdb/mutasi" className="hover:text-emerald-700">PPDB Mutasi Masuk</Link></li>
            <li><Link href="/kontak" className="hover:text-emerald-700">Pengaduan &amp; FAQ</Link></li>
            <li><Link href="/portal" className="hover:text-emerald-700">Portal Akademik &amp; TU</Link></li>
            <li><Link href="/login" className="hover:text-emerald-700">Login Akun</Link></li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Kontak Resmi
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
            <span>{school.address}</span>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{school.phone}</span>
          </p>
          <p className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{school.email}</span>
          </p>
          {(school.social_links?.facebook ||
            school.social_links?.instagram ||
            school.social_links?.youtube) && (
            <div className="flex flex-wrap gap-2 pt-1.5">
              {school.social_links?.facebook && (
                <a
                  href={school.social_links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium transition"
                >
                  Facebook
                </a>
              )}
              {school.social_links?.instagram && (
                <a
                  href={school.social_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium transition"
                >
                  Instagram
                </a>
              )}
              {school.social_links?.youtube && (
                <a
                  href={school.social_links.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium transition"
                >
                  YouTube
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200/70 py-4 px-4 text-center text-[11px] text-slate-500">
        © 2026 {school.name}. SIMMS — Sistem Informasi Manajemen Madrasah &amp; Sekolah.
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col simms-ambient">
      <PublicNavbar />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
