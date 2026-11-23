'use client';

import Link from 'next/link';
import {
  Award,
  Calendar,
  LayoutDashboard,
  MapPin,
  Menu,
  PiggyBank,
  User,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

interface MobileNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface PortalMobileNavProps {
  pathname: string;
  userRoles: readonly AppRole[];
  onOpenMenu: () => void;
}

function resolveMobileNavItems(roles: readonly AppRole[]): MobileNavItem[] {
  const isSiswa = roles.includes('SISWA');
  const isOrtu = roles.includes('ORANG_TUA');
  const isGuru = roles.includes('GURU') || roles.includes('WALI_KELAS');

  if (isSiswa && !isGuru) {
    return [
      { href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      { href: '/portal/siswa/jadwal-pelajaran', label: 'Jadwal', icon: <Calendar className="w-4 h-4" /> },
      { href: '/portal/siswa/nilai', label: 'Nilai', icon: <Award className="w-4 h-4" /> },
      { href: '/portal/siswa/tabungan', label: 'Tabungan', icon: <PiggyBank className="w-4 h-4" /> },
    ];
  }

  if (isOrtu && !isGuru) {
    return [
      { href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      { href: '/portal/orang-tua/jadwal-pelajaran', label: 'Jadwal', icon: <Calendar className="w-4 h-4" /> },
      { href: '/portal/orang-tua/nilai', label: 'Nilai', icon: <Award className="w-4 h-4" /> },
      { href: '/portal/orang-tua/tabungan', label: 'Tabungan', icon: <PiggyBank className="w-4 h-4" /> },
    ];
  }

  if (isGuru) {
    return [
      { href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      { href: '/portal/akademik/presensi/gps', label: 'Presensi', icon: <MapPin className="w-4 h-4" /> },
      { href: '/portal/gtk/jadwal-mengajar', label: 'Jadwal', icon: <Calendar className="w-4 h-4" /> },
      { href: '/portal/akun/profil', label: 'Profil', icon: <User className="w-4 h-4" /> },
    ];
  }

  return [
    { href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/portal/akademik/kalender/agenda', label: 'Kalender', icon: <Calendar className="w-4 h-4" /> },
    { href: '/portal/akun/profil', label: 'Profil', icon: <User className="w-4 h-4" /> },
  ];
}

export function PortalMobileNav({ pathname, userRoles, onOpenMenu }: PortalMobileNavProps) {
  const normalized = pathname.replace(/\/$/, '') || '/portal';
  const items = resolveMobileNavItems(userRoles);

  return (
    <nav
      aria-label="Navigasi Cepat Mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/92 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-[0_-6px_24px_-12px_rgba(15,23,42,0.12)]"
    >
      <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
        {items.map((item) => {
          const active =
            item.href === '/portal'
              ? normalized === '/portal'
              : normalized === item.href || normalized.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka semua menu portal"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
