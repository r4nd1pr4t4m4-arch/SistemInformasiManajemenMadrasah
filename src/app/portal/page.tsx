'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  Calculator,
  FileText,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MapPin,
  Newspaper,
  PiggyBank,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

interface UserInfo {
  userId: string;
  fullName: string;
  email: string | null;
  primaryRole: AppRole;
  roles: AppRole[];
}

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  icon: React.ReactNode;
  accentClass: string;
  allowedRoles: AppRole[];
}

const DASHBOARD_CARDS: DashboardCard[] = [
  {
    id: 'cms',
    title: 'Website Resmi & Verifikasi PPDB',
    description:
      'Kelola profil lembaga, publikasi berita/artikel, pengumuman, serta verifikasi berkas & kelulusan PPDB Online.',
    href: '/portal/cms',
    badge: 'Publikasi & PPDB',
    icon: <Newspaper className="w-5 h-5" />,
    accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_HUMAS', 'KEPALA_TU', 'STAF_TU'],
  },
  {
    id: 'akademik-buku-induk',
    title: 'Buku Induk & Manajemen Kelas',
    description:
      'Database siswa (NIS/NISN/NIK), data kepegawaian GTK, rombongan belajar, wali kelas, jadwal pelajaran, dan piket.',
    href: '/portal/akademik',
    badge: 'Akademik',
    icon: <BookOpenCheck className="w-5 h-5" />,
    accentClass: 'bg-sky-50 text-sky-700 border-sky-100',
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
    id: 'presensi-gps',
    title: 'Presensi GPS, Delegasi & Ujian',
    description:
      'Absensi mengajar & piket berbasis GPS geofencing, delegasi guru pengganti, serta jadwal & JTM pengawas/panitia ujian.',
    href: '/portal/akademik',
    badge: 'Kehadiran & Ujian',
    icon: <MapPin className="w-5 h-5" />,
    accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
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
    id: 'spp-komite',
    title: 'Keuangan SPP & Iuran Komite',
    description:
      'Penerbitan tagihan SPP/Komite/Uang Gedung, pencatatan pembayaran tunai/transfer/QRIS, dan laporan tunggakan siswa.',
    href: '/portal/keuangan',
    badge: 'Bendahara Komite',
    icon: <Receipt className="w-5 h-5" />,
    accentClass: 'bg-amber-50 text-amber-700 border-amber-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'BENDAHARA', 'BENDAHARA_KOMITE'],
  },
  {
    id: 'tabungan',
    title: 'Tabungan Digital Warga & Umum',
    description:
      'Pengelolaan buku tabungan digital dan transaksi setor/tarik untuk siswa, guru, tata usaha, serta masyarakat umum.',
    href: '/portal/keuangan',
    badge: 'Pengelola Tabungan',
    icon: <PiggyBank className="w-5 h-5" />,
    accentClass: 'bg-teal-50 text-teal-700 border-teal-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'PENGELOLA_TABUNGAN'],
  },
  {
    id: 'honorarium',
    title: 'Manajemen Honorarium Guru',
    description:
      'Pengaturan tarif per JTM, tunjangan tugas tambahan, dan pembuatan slip honorarium bulanan guru.',
    href: '/portal/keuangan',
    badge: 'Keuangan & TU',
    icon: <Calculator className="w-5 h-5" />,
    accentClass: 'bg-orange-50 text-orange-700 border-orange-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'BENDAHARA', 'KEPALA_TU'],
  },
  {
    id: 'persuratan',
    title: 'Persuratan, Arsip & Kartu Pelajar',
    description:
      'Pencatatan surat masuk/keluar, surat keterangan aktif, surat mutasi, surat tugas, dan kartu pelajar digital.',
    href: '/portal/layanan',
    badge: 'Tata Usaha',
    icon: <FileText className="w-5 h-5" />,
    accentClass: 'bg-slate-100 text-slate-700 border-slate-200',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU'],
  },
  {
    id: 'elibrary',
    title: 'Perpustakaan Digital (E-Library)',
    description:
      'Katalog buku fisik & koleksi e-book, kartu anggota otomatis warga lembaga, registrasi umum, peminjaman & denda.',
    href: '/portal/layanan',
    badge: 'E-Library',
    icon: <BookOpen className="w-5 h-5" />,
    accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
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
    id: 'bk',
    title: 'Bimbingan Konseling (BK) & Poin',
    description:
      'Rekam jejak pelanggaran kedisiplinan, poin prestasi siswa, serta catatan konsultasi bersama Guru BK.',
    href: '/portal/layanan',
    badge: 'Guru BK',
    icon: <ShieldAlert className="w-5 h-5" />,
    accentClass: 'bg-rose-50 text-rose-700 border-rose-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'WAKA_KESISWAAN', 'GURU_BK'],
  },
  {
    id: 'guru-wali',
    title: 'Manajemen Guru Wali',
    description:
      'Pemetaan siswa binaan dan rekam jejak pendampingan personal bersama Guru Wali (terpisah dari BK).',
    href: '/portal/layanan',
    badge: 'Guru Wali',
    icon: <HeartHandshake className="w-5 h-5" />,
    accentClass: 'bg-violet-50 text-violet-700 border-violet-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'GURU_WALI', 'WALI_KELAS', 'GURU'],
  },
  {
    id: 'alumni',
    title: 'Tracer Study / Portal Alumni',
    description:
      'Pendataan sebaran lulusan di perguruan tinggi, pesantren, maupun dunia kerja dan wirausaha.',
    href: '/portal/layanan',
    badge: 'Alumni',
    icon: <GraduationCap className="w-5 h-5" />,
    accentClass: 'bg-sky-50 text-sky-700 border-sky-100',
    allowedRoles: ['SUPERADMIN', 'OPERATOR', 'WAKA_HUMAS', 'GURU_BK', 'ALUMNI', 'STAF_TU'],
  },
];

const ROLE_SUMMARIES: Partial<Record<AppRole, string>> = {
  SUPERADMIN: 'Anda memiliki akses penuh ke seluruh modul manajemen website, akademik, keuangan, dan layanan.',
  OPERATOR: 'Anda mengelola data induk lembaga, CMS, jadwal akademik, presensi, dan konfigurasi sistem.',
  KEPALA_LEMBAGA: 'Anda dapat memantau seluruh aktivitas akademik, keuangan, kepegawaian, dan publikasi lembaga.',
  BENDAHARA_KOMITE:
    'Fokus tugas Anda adalah pengelolaan tagihan & pembayaran SPP/Iuran Komite serta laporan tunggakan siswa.',
  PENGELOLA_TABUNGAN:
    'Fokus tugas Anda adalah pengelolaan buku tabungan digital dan transaksi setor/tarik siswa, GTK, dan masyarakat umum.',
  GURU_BK: 'Fokus tugas Anda adalah Bimbingan Konseling, kedisiplinan, poin pelanggaran/prestasi, dan konsultasi siswa.',
  GURU_WALI: 'Fokus tugas Anda adalah pendampingan personal dan rekam jejak bimbingan siswa binaan.',
  GURU: 'Anda dapat melakukan presensi GPS, melihat jadwal, mengelola bimbingan Guru Wali, dan mengakses E-Library.',
  PUSTAKAWAN: 'Anda mengelola katalog buku fisik & e-book, keanggotaan, serta sirkulasi peminjaman perpustakaan.',
  SISWA: 'Anda dapat mengakses koleksi E-Library dan informasi layanan siswa.',
  UMUM: 'Anda terdaftar sebagai pengguna publik untuk akses E-Library dan informasi lembaga.',
};

export default function PortalDashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat dashboard...
        </div>
      </div>
    );
  }

  const activeRoles: AppRole[] = user
    ? user.roles && user.roles.length > 0
      ? user.roles
      : [user.primaryRole]
    : ['UMUM'];

  const visibleCards = DASHBOARD_CARDS.filter((card) =>
    activeRoles.some((role) => card.allowedRoles.includes(role))
  );

  const primaryRole = user?.primaryRole ?? 'UMUM';
  const summaryText =
    ROLE_SUMMARIES[primaryRole] ||
    'Gunakan kartu modul di bawah ini untuk mengakses layanan sesuai peran Anda.';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome & Role Card */}
      <section className="glass-card rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Peran Aktif: {activeRoles.join(' • ')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Selamat Datang, {user?.fullName || 'Pengguna'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">{summaryText}</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-emerald-700 transition shadow-xs"
          >
            <Users className="w-4 h-4" /> Website Resmi
          </Link>
          <Link
            href="/ppdb"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition shadow-sm"
          >
            Halaman PPDB <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Role-Based Modular Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Modul Sesuai Peran Anda ({visibleCards.length})
          </h2>
        </div>

        {visibleCards.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center space-y-2">
            <p className="font-bold text-slate-900">Belum Ada Modul Khusus untuk Peran Anda</p>
            <p className="text-sm text-slate-600">
              Hubungi Operator / Administrator lembaga jika Anda memerlukan akses tambahan.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleCards.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className="modular-card rounded-3xl p-6 flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${card.accentClass}`}
                    >
                      {card.icon}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>Buka Modul</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
