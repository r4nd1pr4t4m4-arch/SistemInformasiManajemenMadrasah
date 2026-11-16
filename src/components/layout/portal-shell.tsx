'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpenCheck,
  Building2,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

interface UserInfo {
  fullName: string;
  email: string | null;
  primaryRole: AppRole;
  roles?: AppRole[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles?: AppRole[];
}

const PORTAL_SECTIONS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Menu Utama',
    items: [
      {
        href: '/portal',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
    ],
  },
  {
    group: 'Publikasi & PPDB',
    items: [
      {
        href: '/portal/cms',
        label: 'CMS & Verifikasi PPDB',
        icon: <Newspaper className="w-4 h-4" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
      },
    ],
  },
  {
    group: 'Akademik',
    items: [
      {
        href: '/portal/akademik',
        label: 'Buku Induk, Jadwal & Ujian',
        icon: <BookOpenCheck className="w-4 h-4" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'GURU',
          'WALI_KELAS',
          'KEPALA_TU',
          'STAF_TU',
        ],
      },
    ],
  },
  {
    group: 'Keuangan & Layanan',
    items: [
      {
        href: '/portal/keuangan',
        label: 'SPP, Tabungan & Honor',
        icon: <Wallet className="w-4 h-4" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
          'PENGELOLA_TABUNGAN',
          'KEPALA_TU',
        ],
      },
      {
        href: '/portal/layanan',
        label: 'Surat, E-Library, BK & Alumni',
        icon: <FileText className="w-4 h-4" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'PUSTAKAWAN',
          'GURU_BK',
          'GURU_WALI',
          'WALI_KELAS',
          'GURU',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
          'ALUMNI',
          'SISWA',
          'UMUM',
        ],
      },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/portal': 'Dashboard',
  '/portal/cms': 'Manajemen Website CMS & PPDB Online',
  '/portal/akademik': 'Portal Akademik',
  '/portal/keuangan': 'Keuangan, Tabungan & Honorarium',
  '/portal/layanan': 'Persuratan, E-Library, BK, Guru Wali & Alumni',
};

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const userRoles: AppRole[] = user
    ? user.roles && user.roles.length > 0
      ? user.roles
      : [user.primaryRole]
    : [];

  const visibleSections = PORTAL_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.allowedRoles || userRoles.length === 0) return true;
      return userRoles.some((r) => item.allowedRoles!.includes(r));
    }),
  })).filter((s) => s.items.length > 0);

  const pageTitle = PAGE_TITLES[pathname] || 'Portal Terpadu';

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

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleSections.map((section) => (
          <div key={section.group} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.group}
            </p>
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/80 hover:text-emerald-700'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
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
              <div className="hidden sm:flex items-center gap-2 bg-white/85 border border-slate-200/80 rounded-xl px-3 py-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    {user.fullName}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-700">
                    {user.primaryRole}
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
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
    </div>
  );
}
