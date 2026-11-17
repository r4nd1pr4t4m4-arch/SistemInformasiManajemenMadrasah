'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  BookOpenCheck,
  Building2,
  Calculator,
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Globe,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Newspaper,
  PiggyBank,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

interface UserInfo {
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  primaryRole: AppRole;
  roles?: AppRole[];
}

interface NavItem {
  href: string;
  path: string;
  tab?: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles?: AppRole[];
}

interface AccordionGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const ACCORDION_GROUPS: AccordionGroup[] = [
  {
    id: 'publikasi',
    label: 'Publikasi & PPDB',
    icon: <Newspaper className="w-4 h-4" />,
    items: [
      {
        href: '/portal/cms/profil',
        path: '/portal/cms/profil',
        label: 'Profil & Lembaga',
        icon: <Settings className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
      },
      {
        href: '/portal/cms/berita',
        path: '/portal/cms/berita',
        label: 'Berita & Artikel',
        icon: <Newspaper className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
      },
      {
        href: '/portal/cms/ppdb',
        path: '/portal/cms/ppdb',
        label: 'Verifikasi PPDB',
        icon: <Users className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
      },
      {
        href: '/portal/cms/manajemen-ppdb',
        path: '/portal/cms/manajemen-ppdb',
        label: 'Manajemen PPDB',
        icon: <CalendarRange className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
      },
      {
        href: '/portal/cms/sarana-prasarana',
        path: '/portal/cms/sarana-prasarana',
        label: 'Sarana & Prasarana',
        icon: <Building2 className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
      },
    ],
  },
  {
    id: 'akademik',
    label: 'Akademik',
    icon: <BookOpenCheck className="w-4 h-4" />,
    items: [
      {
        href: '/portal/akademik/buku-induk',
        path: '/portal/akademik/buku-induk',
        label: 'Buku Induk Digital',
        icon: <Users className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'KEPALA_TU',
          'STAF_TU',
        ],
      },
      {
        href: '/portal/akademik/kelas-jadwal',
        path: '/portal/akademik/kelas-jadwal',
        label: 'Kelas & Jadwal',
        icon: <Calendar className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'GURU',
          'WALI_KELAS',
        ],
      },
      {
        href: '/portal/akademik/presensi',
        path: '/portal/akademik/presensi',
        label: 'Presensi GPS & Delegasi',
        icon: <MapPin className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'GURU',
          'WALI_KELAS',
        ],
      },
      {
        href: '/portal/akademik/ujian',
        path: '/portal/akademik/ujian',
        label: 'Periode Ujian (JTM)',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'GURU',
          'WALI_KELAS',
        ],
      },
      {
        href: '/portal/akademik/acara',
        path: '/portal/akademik/acara',
        label: 'Manajemen Acara & Kegiatan',
        icon: <CalendarRange className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
        ],
      },
      {
        href: '/portal/akademik/jurnal-acara',
        path: '/portal/akademik/jurnal-acara',
        label: 'Input Jurnal Acara',
        icon: <FileText className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'GURU',
          'WALI_KELAS',
          'GURU_WALI',
          'GURU_BK',
        ],
      },
      {
        href: '/portal/akademik/kalender',
        path: '/portal/akademik/kalender',
        label: 'Kalender Pendidikan',
        icon: <Calendar className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
        ],
      },
    ],
  },
  {
    id: 'sdm',
    label: 'SDM',
    icon: <Users className="w-4 h-4" />,
    items: [
      {
        label: 'Manajemen GTK',
        href: '/portal/sdm/gtk',
        path: '/portal/sdm/gtk',
        icon: <User className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
        ],
      },
      {
        label: 'Manajemen Siswa',
        href: '/portal/sdm/siswa',
        path: '/portal/sdm/siswa',
        icon: <Users className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
        ],
      },
      {
        label: 'Manajemen Orang Tua/Wali Siswa',
        href: '/portal/sdm/orang-tua',
        path: '/portal/sdm/orang-tua',
        icon: <HeartHandshake className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
        ],
      },
      {
        label: 'Manajemen Alumni',
        href: '/portal/sdm/alumni',
        path: '/portal/sdm/alumni',
        icon: <GraduationCap className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
        ],
      },
    ],
  },
  {
    id: 'keuangan',
    label: 'Keuangan & Honor',
    icon: <Wallet className="w-4 h-4" />,
    items: [
      {
        href: '/portal/keuangan/spp',
        path: '/portal/keuangan/spp',
        label: 'SPP & Iuran Komite',
        icon: <Receipt className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'BENDAHARA', 'BENDAHARA_KOMITE'],
      },
      {
        href: '/portal/keuangan/tabungan',
        path: '/portal/keuangan/tabungan',
        label: 'Tabungan Digital',
        icon: <PiggyBank className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'PENGELOLA_TABUNGAN'],
      },
      {
        href: '/portal/keuangan/honorarium',
        path: '/portal/keuangan/honorarium',
        label: 'Honorarium Guru',
        icon: <Calculator className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'BENDAHARA', 'KEPALA_TU'],
      },
    ],
  },
  {
    id: 'layanan',
    label: 'Layanan & Arsip',
    icon: <FileText className="w-4 h-4" />,
    items: [
      {
        href: '/portal/layanan/persuratan',
        path: '/portal/layanan/persuratan',
        label: 'Persuratan & Kartu',
        icon: <FileText className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU'],
      },
      {
        href: '/portal/layanan/perpustakaan',
        path: '/portal/layanan/perpustakaan',
        label: 'E-Library',
        icon: <BookOpen className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'PUSTAKAWAN',
          'GURU',
          'STAF_TU',
          'SISWA',
          'UMUM',
        ],
      },
      {
        href: '/portal/layanan/bk',
        path: '/portal/layanan/bk',
        label: 'Bimbingan Konseling (BK)',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_KESISWAAN', 'GURU_BK'],
      },
      {
        href: '/portal/layanan/guru-wali',
        path: '/portal/layanan/guru-wali',
        label: 'Manajemen Guru Wali',
        icon: <HeartHandshake className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'GURU_WALI', 'WALI_KELAS', 'GURU'],
      },
      {
        href: '/portal/layanan/alumni',
        path: '/portal/layanan/alumni',
        label: 'Tracer Study Alumni',
        icon: <GraduationCap className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'WAKA_HUMAS', 'GURU_BK', 'ALUMNI', 'STAF_TU'],
      },
    ],
  },
  {
    id: 'akun',
    label: 'Akun',
    icon: <User className="w-4 h-4" />,
    items: [
      {
        href: '/portal/akun/profil',
        path: '/portal/akun/profil',
        label: 'Profil',
        icon: <User className="w-3.5 h-3.5" />,
      },
      {
        href: '/portal/akun/manajemen-pengguna',
        path: '/portal/akun/manajemen-pengguna',
        label: 'Manajemen Pengguna',
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU'],
      },
      {
        href: '/portal/akun/kata-sandi',
        path: '/portal/akun/kata-sandi',
        label: 'Ganti Kata Sandi',
        icon: <KeyRound className="w-3.5 h-3.5" />,
      },
      {
        href: '/portal/akun/mfa',
        path: '/portal/akun/mfa',
        label: 'Manajemen MFA',
        icon: <Smartphone className="w-3.5 h-3.5" />,
      },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/portal': 'Dashboard',
  '/portal/cms/profil': 'Profil & Identitas Lembaga',
  '/portal/cms/berita': 'Berita, Artikel & Pengumuman',
  '/portal/cms/ppdb': 'Verifikasi & Kelulusan PPDB Online',
  '/portal/cms/manajemen-ppdb': 'Manajemen Periode Pembukaan PPDB',
  '/portal/akademik/buku-induk': 'Buku Induk Digital (Siswa & GTK)',
  '/portal/akademik/kelas-jadwal': 'Manajemen Kelas & Jadwal Pelajaran',
  '/portal/akademik/presensi': 'Presensi GPS & Delegasi Guru Pengganti',
  '/portal/akademik/ujian': 'Periode Ujian (Pengawas & Panitia JTM)',
  '/portal/akademik/acara': 'Manajemen Acara & Kegiatan Lembaga',
  '/portal/akademik/jurnal-acara': 'Input Jurnal Acara Guru',
  '/portal/akademik/kalender': 'Kalender Pendidikan & Libur Berbayar',
  '/portal/sdm/gtk': 'Manajemen GTK',
  '/portal/sdm/siswa': 'Manajemen Siswa',
  '/portal/sdm/orang-tua': 'Manajemen Orang Tua / Wali Siswa',
  '/portal/sdm/alumni': 'Manajemen Alumni',
  '/portal/keuangan/spp': 'Keuangan SPP & Iuran Komite',
  '/portal/keuangan/tabungan': 'Tabungan Digital Warga & Umum',
  '/portal/keuangan/honorarium': 'Manajemen Honorarium Guru',
  '/portal/layanan/persuratan': 'Persuratan, Arsip Digital & Kartu Pelajar',
  '/portal/layanan/perpustakaan': 'Perpustakaan Digital (E-Library)',
  '/portal/layanan/bk': 'Bimbingan Konseling (BK) & Poin Siswa',
  '/portal/layanan/guru-wali': 'Manajemen Guru Wali',
  '/portal/layanan/alumni': 'Tracer Study / Portal Alumni',
  '/portal/akun/profil': 'Profil Akun',
  '/portal/akun/manajemen-pengguna': 'Manajemen Pengguna & Persetujuan Akun',
  '/portal/akun/kata-sandi': 'Ganti Kata Sandi',
  '/portal/akun/mfa': 'Manajemen MFA',
};

function PortalShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Default: seluruh kelompok accordion dalam keadaan collapse (tertutup)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  const userRoles: AppRole[] = user
    ? user.roles && user.roles.length > 0
      ? user.roles
      : [user.primaryRole]
    : [];

  const visibleGroups = ACCORDION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.allowedRoles || userRoles.length === 0) return true;
      return userRoles.some((r) => item.allowedRoles!.includes(r));
    }),
  })).filter((g) => g.items.length > 0);

  const currentTab = searchParams.get('tab');
  const normalizedPath = pathname.replace(/\/$/, '') || '/portal';
  const pageTitle = PAGE_TITLES[normalizedPath] || 'Portal Terpadu';

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-200/70 flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">SIMMS Portal</p>
            <p className="text-[11px] text-slate-500">Sistem Informasi Terpadu</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {/* Dashboard Link */}
        <Link
          href="/portal"
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            pathname === '/portal'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-white/80 hover:text-emerald-700'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        {/* Accordion Menu Groups */}
        <div className="pt-1 space-y-1.5">
          {visibleGroups.map((group) => {
            const isOpen = Boolean(openGroups[group.id]);
            const hasActiveChild = group.items.some((item) => item.path === pathname);

            return (
              <div key={group.id} className="rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    hasActiveChild
                      ? 'bg-emerald-50/90 text-emerald-800'
                      : 'text-slate-700 hover:bg-white/80 hover:text-emerald-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {group.icon}
                    <span>{group.label}</span>
                  </span>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-slate-200/80 space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.path;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:bg-white/80 hover:text-emerald-700'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 border-t border-slate-200/70 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white/80 hover:text-emerald-700 transition"
        >
          <Globe className="w-4 h-4" />
          <span>Lihat Website Resmi</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen simms-ambient flex">
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200/80 bg-white/75 backdrop-blur-xl sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white/95 backdrop-blur-xl h-full shadow-xl z-10">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Portal Navbar */}
        <header className="sticky top-0 z-30 glass-nav h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/80 border border-slate-200/80 text-slate-700"
              aria-label="Buka Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="truncate">
              <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
                {pageTitle}
              </p>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Portal Administrasi, Akademik &amp; Layanan Lembaga
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {user && (
              <Link
                href="/portal/akun/profil"
                className="hidden sm:flex items-center gap-2.5 bg-white/85 hover:bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 transition"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-7 h-7 rounded-full object-cover border border-emerald-200"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold">
                    {(user.fullName || 'U').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    {user.fullName}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-700">
                    {user.primaryRole}
                  </p>
                </div>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setLogoutModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/85 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/80 text-xs font-semibold text-slate-700 transition"
              title="Keluar dari Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>

        {/* Portal Footer */}
        <footer className="border-t border-slate-200/70 bg-white/60 backdrop-blur px-6 py-4 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 SIMMS — Sistem Informasi Manajemen Madrasah &amp; Sekolah</span>
          <span>Portal Resmi &amp; Sistem Informasi Terpadu</span>
        </footer>
      </div>

      {/* Modal Konfirmasi Logout */}
      {logoutModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="logout-modal-title" className="text-base font-bold text-slate-900">
                    Konfirmasi Keluar dari Portal
                  </h2>
                  <p className="text-xs text-slate-500">
                    Anda akan mengakhiri sesi login aktif saat ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Tutup modal konfirmasi keluar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Pengguna</span>
                <span className="font-semibold text-slate-900 text-right">
                  {user?.fullName || 'Pengguna Portal'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-700 text-right truncate max-w-[220px]">
                  {user?.email || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Peran Aktif</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                  {user?.primaryRole || '-'}
                  {userRoles.length > 1 ? ` (+${userRoles.length - 1})` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                <span className="text-slate-500">Halaman Aktif</span>
                <span className="font-medium text-slate-700 text-right truncate max-w-[220px]">
                  {pageTitle}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Perhatian sebelum keluar:</p>
              <p className="text-amber-800 leading-relaxed">
                Pastikan seluruh data atau formulir yang sedang Anda kerjakan sudah disimpan.
                Setelah keluar, Anda harus masuk kembali menggunakan email dan kata sandi akun
                Anda untuk mengakses portal.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                {loggingOut ? 'Mengakhiri Sesi...' : 'Ya, Keluar Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen simms-ambient" />}>
      <PortalShellInner>{children}</PortalShellInner>
    </Suspense>
  );
}
