'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  Calendar,
  ChevronUp,
  ClipboardCheck,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Menu,
  PiggyBank,
  ShieldCheck,
  User,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

interface DropdownOption {
  href: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
}

type MobileNavSlot =
  | {
      type: 'link';
      key: string;
      href: string;
      label: string;
      icon: React.ReactNode;
    }
  | {
      type: 'dropdown';
      key: 'jurnal' | 'tugas';
      label: string;
      headerBadge?: string;
      icon: React.ReactNode;
      options: DropdownOption[];
    };

export interface PortalMobileNavProps {
  pathname: string;
  userRoles: readonly AppRole[];
  isPicketToday?: boolean;
  hasActiveExamPeriodToday?: boolean;
  onOpenMenu: () => void;
}

const JURNAL_OPTIONS: DropdownOption[] = [
  {
    href: '/portal/akademik/presensi/jurnal',
    label: 'KBM',
    description: 'Jurnal pembelajaran tatap muka',
    icon: <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />,
  },
  {
    href: '/portal/akademik/jurnal-acara',
    label: 'Acara',
    description: 'Jurnal kegiatan & acara lembaga',
    icon: <FileText className="w-4 h-4 text-sky-600 shrink-0" />,
  },
  {
    href: '/portal/akademik/ujian/bap',
    label: 'BAP',
    description: 'Berita Acara Pelaksanaan Ujian',
    icon: <FileCheck2 className="w-4 h-4 text-amber-600 shrink-0" />,
  },
];

function getTugasOptions(hasActiveExamPeriodToday: boolean): DropdownOption[] {
  if (hasActiveExamPeriodToday) {
    return [
      {
        href: '/portal/akademik/ujian/absensi-siswa',
        label: 'Absensi Siswa',
        description: 'Kehadiran peserta ujian',
        icon: <Users className="w-4 h-4 text-emerald-600 shrink-0" />,
      },
      {
        href: '/portal/akademik/presensi/jam-manual',
        label: 'Absensi Guru',
        description: 'Catat jam masuk & pulang GTK',
        icon: <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />,
      },
      {
        href: '/portal/akademik/ujian/konfirmasi-pengawas',
        label: 'Konfirmasi Kehadiran',
        description: 'Konfirmasi pengawas ruang ujian',
        icon: <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />,
      },
      {
        href: '/portal/akademik/ujian/pengganti',
        label: 'Pengawas Pengganti',
        description: 'Atur pengawas & panitia pengganti',
        icon: <UserCog className="w-4 h-4 text-rose-600 shrink-0" />,
      },
      {
        href: '/portal/akademik/ujian/lpj-panitia',
        label: 'LPJ Panitia',
        description: 'Laporan pertanggungjawaban harian panitia',
        icon: <FileText className="w-4 h-4 text-violet-600 shrink-0" />,
      },
    ];
  }

  return [
    {
      href: '/portal/akademik/presensi/absensi-siswa',
      label: 'Absensi Siswa',
      description: 'Kehadiran siswa reguler harian',
      icon: <Users className="w-4 h-4 text-emerald-600 shrink-0" />,
    },
    {
      href: '/portal/akademik/presensi/jam-manual',
      label: 'Absensi Guru',
      description: 'Catat jam masuk & pulang GTK',
      icon: <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />,
    },
    {
      href: '/portal/akademik/presensi/konfirmasi',
      label: 'Konfirmasi Kehadiran',
      description: 'Konfirmasi kehadiran mengajar guru',
      icon: <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />,
    },
    {
      href: '/portal/akademik/presensi/pengganti',
      label: 'Guru Pengganti',
      description: 'Atur delegasi & guru pengganti',
      icon: <UserCog className="w-4 h-4 text-rose-600 shrink-0" />,
    },
    {
      href: '/portal/akademik/presensi/laporan-piket',
      label: 'Laporan Piket',
      description: 'Laporan harian guru piket',
      icon: <FileText className="w-4 h-4 text-violet-600 shrink-0" />,
    },
  ];
}

function resolveMobileNavSlots(
  roles: readonly AppRole[],
  isPicketToday: boolean,
  hasActiveExamPeriodToday: boolean
): MobileNavSlot[] {
  const isSiswa = roles.includes('SISWA');
  const isOrtu = roles.includes('ORANG_TUA');
  const isGuru = roles.includes('GURU') || roles.includes('WALI_KELAS');

  if (isSiswa && !isGuru) {
    return [
      { type: 'link', key: 'beranda', href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      { type: 'link', key: 'jadwal', href: '/portal/siswa/jadwal-pelajaran', label: 'Jadwal', icon: <Calendar className="w-4 h-4" /> },
      { type: 'link', key: 'nilai', href: '/portal/siswa/nilai', label: 'Nilai', icon: <Award className="w-4 h-4" /> },
      { type: 'link', key: 'tabungan', href: '/portal/siswa/tabungan', label: 'Tabungan', icon: <PiggyBank className="w-4 h-4" /> },
    ];
  }

  if (isOrtu && !isGuru) {
    return [
      { type: 'link', key: 'beranda', href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      { type: 'link', key: 'jadwal', href: '/portal/orang-tua/jadwal-pelajaran', label: 'Jadwal', icon: <Calendar className="w-4 h-4" /> },
      { type: 'link', key: 'nilai', href: '/portal/orang-tua/nilai', label: 'Nilai', icon: <Award className="w-4 h-4" /> },
      { type: 'link', key: 'tabungan', href: '/portal/orang-tua/tabungan', label: 'Tabungan', icon: <PiggyBank className="w-4 h-4" /> },
    ];
  }

  if (isGuru) {
    const thirdSlot: MobileNavSlot = isPicketToday
      ? {
          type: 'dropdown',
          key: 'tugas',
          label: 'Tugas',
          headerBadge: hasActiveExamPeriodToday ? 'Periode Ujian Aktif' : 'Piket Hari Ini',
          icon: <ClipboardCheck className="w-4 h-4" />,
          options: getTugasOptions(hasActiveExamPeriodToday),
        }
      : {
          type: 'link',
          key: 'jadwal',
          href: '/portal/gtk/jadwal-mengajar',
          label: 'Jadwal',
          icon: <Calendar className="w-4 h-4" />,
        };

    return [
      { type: 'link', key: 'beranda', href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      {
        type: 'dropdown',
        key: 'jurnal',
        label: 'Jurnal',
        headerBadge: 'Input Jurnal',
        icon: <BookOpen className="w-4 h-4" />,
        options: JURNAL_OPTIONS,
      },
      thirdSlot,
      { type: 'link', key: 'profil', href: '/portal/akun/profil', label: 'Profil', icon: <User className="w-4 h-4" /> },
    ];
  }

  return [
    { type: 'link', key: 'beranda', href: '/portal', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
    { type: 'link', key: 'kalender', href: '/portal/akademik/kalender/agenda', label: 'Kalender', icon: <Calendar className="w-4 h-4" /> },
    { type: 'link', key: 'profil', href: '/portal/akun/profil', label: 'Profil', icon: <User className="w-4 h-4" /> },
  ];
}

export function PortalMobileNav({
  pathname,
  userRoles,
  isPicketToday = false,
  hasActiveExamPeriodToday = false,
  onOpenMenu,
}: PortalMobileNavProps) {
  const normalized = pathname.replace(/\/$/, '') || '/portal';
  const slots = resolveMobileNavSlots(userRoles, isPicketToday, hasActiveExamPeriodToday);
  const [openDropdown, setOpenDropdown] = useState<'jurnal' | 'tugas' | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdown]);

  const activeDropdownSlot = slots.find(
    (s): s is Extract<MobileNavSlot, { type: 'dropdown' }> =>
      s.type === 'dropdown' && s.key === openDropdown
  );

  const gridColsClass = slots.length === 3 ? 'grid-cols-4' : 'grid-cols-5';

  return (
    <nav
      ref={navRef}
      aria-label="Navigasi Cepat Mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_-12px_rgba(15,23,42,0.12)]"
    >
      {/* Dropdown Popover di atas Bottom Navbar */}
      {activeDropdownSlot && (
        <div
          role="menu"
          aria-label={`Opsi ${activeDropdownSlot.label}`}
          className="absolute bottom-[calc(100%+8px)] left-3 right-3 max-w-md max-h-[65dvh] overflow-y-auto mx-auto rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 space-y-1"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900">
              Menu {activeDropdownSlot.label}
            </span>
            {activeDropdownSlot.headerBadge && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[10px] font-semibold">
                {activeDropdownSlot.headerBadge}
              </span>
            )}
          </div>
          {activeDropdownSlot.options.map((opt) => {
            const isOptActive =
              normalized === opt.href || normalized.startsWith(`${opt.href}/`);
            return (
              <Link
                key={opt.href}
                href={opt.href}
                role="menuitem"
                onClick={() => setOpenDropdown(null)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                  isOptActive
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                {opt.icon}
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                  {opt.description && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {opt.description}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className={`grid ${gridColsClass} gap-1 max-w-lg mx-auto`}>
        {slots.map((slot) => {
          if (slot.type === 'dropdown') {
            const isOpen = openDropdown === slot.key;
            const hasActiveChild = slot.options.some(
              (opt) => normalized === opt.href || normalized.startsWith(`${opt.href}/`)
            );
            return (
              <button
                key={slot.key}
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setOpenDropdown((prev) => (prev === slot.key ? null : slot.key))}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
                  isOpen || hasActiveChild
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="relative inline-flex items-center">
                  {slot.icon}
                  <ChevronUp
                    className={`w-2.5 h-2.5 ml-0.5 transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </span>
                <span className="truncate max-w-full">{slot.label}</span>
              </button>
            );
          }

          const active =
            slot.href === '/portal'
              ? normalized === '/portal'
              : normalized === slot.href || normalized.startsWith(`${slot.href}/`);
          return (
            <Link
              key={slot.key}
              href={slot.href}
              onClick={() => setOpenDropdown(null)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {slot.icon}
              <span className="truncate max-w-full">{slot.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setOpenDropdown(null);
            onOpenMenu();
          }}
          aria-label="Buka semua menu portal"
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
