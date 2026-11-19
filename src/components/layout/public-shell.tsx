'use client';

import { useEffect, useRef, useState } from 'react';
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
  { href: '/', label: 'Beranda', desc: 'Halaman utama website resmi lembaga' },
  { href: '/profil', label: 'Profil', desc: 'Visi, misi, sejarah & sarana prasarana' },
  { href: '/berita', label: 'Berita', desc: 'Berita, pengumuman & artikel terbaru' },
  { href: '/galeri', label: 'Galeri', desc: 'Dokumentasi foto & video kegiatan' },
  { href: '/direktori', label: 'Direktori', desc: 'Direktori GTK & prestasi siswa' },
  { href: '/e-library', label: 'E-Library', desc: 'Perpustakaan digital koleksi E-Book' },
  { href: '/verifikasi', label: 'Verifikasi', desc: 'Validasi dokumen & scan QR Code' },
  { href: '/ppdb', label: 'PPDB Online', desc: 'Pendaftaran peserta didik baru' },
  { href: '/kontak', label: 'Kontak & FAQ', desc: 'Alamat, kontak & pertanyaan umum' },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [menuTop, setMenuTop] = useState(64);
  const headerRef = useRef<HTMLElement | null>(null);
  const mobileOpen = openPathname === pathname;
  const school = useInstitutionSettings();

  function syncMenuTop() {
    if (!headerRef.current) return;
    const rect = headerRef.current.getBoundingClientRect();
    setMenuTop(Math.max(0, Math.round(rect.bottom)));
  }

  function handleToggleMenu() {
    if (!mobileOpen) {
      syncMenuTop();
      setOpenPathname(pathname);
    } else {
      setOpenPathname(null);
    }
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPathname(null);
      }
    };
    const handleResize = () => syncMenuTop();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileOpen]);

  const isLoadingBrand = !school.name && !school.short_name;

  return (
    <>
      {/* Top Info Strip */}
      <div className="bg-slate-900/95 text-slate-200 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 min-w-0">
            {school.phone ? (
              <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{school.phone}</span>
              </span>
            ) : isLoadingBrand ? (
              <span className="h-3.5 w-28 rounded bg-slate-800 animate-pulse" />
            ) : null}
            {school.email ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 min-w-0 truncate">
                <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{school.email}</span>
              </span>
            ) : isLoadingBrand ? (
              <span className="hidden sm:inline-block h-3.5 w-36 rounded bg-slate-800 animate-pulse" />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
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
      <header ref={headerRef} className="sticky top-0 z-40 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4 relative z-40">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              {(school.short_name || school.name || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              {isLoadingBrand ? (
                <div className="space-y-1.5">
                  <div className="h-3.5 w-36 sm:w-44 rounded bg-slate-200 animate-pulse" />
                  <div className="h-2.5 w-28 sm:w-36 rounded bg-slate-200/80 animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="font-bold text-slate-900 text-sm leading-tight tracking-tight truncate">
                    {school.name || school.short_name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Website Resmi &amp; Portal Terpadu ({school.institution_type})
                  </p>
                </>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <nav className="hidden xl:flex items-center gap-1 text-sm font-medium mr-1" aria-label="Navigasi Utama">
              {PUBLIC_NAV_LINKS.slice(0, 6).map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2.5 py-1.5 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-600 hover:text-emerald-700 hover:bg-white/70'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/portal"
              className="hidden sm:inline-flex items-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-semibold text-xs transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Portal Terpadu</span>
            </Link>

            <button
              type="button"
              onClick={handleToggleMenu}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                mobileOpen
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white/85 hover:bg-white border-slate-200/80 text-slate-700'
              }`}
              aria-label="Toggle Menu Semua Halaman Publik"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span className="hidden md:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <>
          <div
            onClick={() => setOpenPathname(null)}
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <div
            style={{ top: `${menuTop}px`, maxHeight: `calc(100dvh - ${menuTop}px)` }}
            className="fixed left-0 right-0 z-50 border-t border-slate-200/70 bg-white/95 backdrop-blur-md shadow-2xl overflow-y-auto overscroll-contain"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-8 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Semua Halaman Publik
                </p>
                <button
                  type="button"
                  onClick={() => setOpenPathname(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg"
                >
                  Tutup
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {PUBLIC_NAV_LINKS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenPathname(null)}
                      className={`block px-3.5 py-2.5 rounded-2xl border transition ${
                        active
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white border-slate-200/70 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700'
                      }`}
                    >
                      <p className="text-sm font-bold">{item.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </Link>
                  );
                })}
              </div>
              <div className="sm:hidden pt-2 border-t border-slate-200/70">
                <Link
                  href="/portal"
                  onClick={() => setOpenPathname(null)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl font-bold text-sm transition shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Masuk Portal Terpadu
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
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
