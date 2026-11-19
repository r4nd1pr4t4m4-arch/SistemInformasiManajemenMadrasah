'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  BookOpenCheck,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
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
  Percent,
  PiggyBank,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { AppRole } from '@/types/database';
import { PERMISSIONS, canAccessPortalPath, hasRolePermission } from '@/lib/auth/rbac';
import { clearPortalSessionCache } from '@/lib/hooks/use-portal-session';

interface TeacherOperationalAssignments {
  teacherId: string;
  dutyCodes: string[];
  dutyNames: string[];
  isHomeroomTeacher: boolean;
  isGuruWali: boolean;
  isPicketTeacher: boolean;
  isExamSupervisor: boolean;
  isExamCommittee: boolean;
}

interface UserInfo {
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  primaryRole: AppRole;
  roles?: AppRole[];
  teacherAssignments?: TeacherOperationalAssignments | null;
}

type TeacherDutyRequirement =
  | 'PICKET'
  | 'EXAM_SUPERVISOR'
  | 'EXAM_COMMITTEE'
  | 'PICKET_OR_COMMITTEE'
  | 'SUPERVISOR_OR_COMMITTEE';

interface NavItem {
  id?: string;
  href?: string;
  path?: string;
  tab?: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles?: AppRole[];
  requireTeacherDuty?: TeacherDutyRequirement;
  children?: NavItem[];
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
        allowedRoles: PERMISSIONS.CMS_PPDB_VIEW,
      },
      {
        href: '/portal/cms/manajemen-ppdb',
        path: '/portal/cms/manajemen-ppdb',
        label: 'Manajemen PPDB',
        icon: <CalendarRange className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.CMS_PPDB_VIEW,
      },
      {
        href: '/portal/cms/sarana-prasarana',
        path: '/portal/cms/sarana-prasarana',
        label: 'Sarana & Prasarana',
        icon: <Building2 className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.CMS_SARPRAS_VIEW,
      },
    ],
  },
  {
    id: 'akademik',
    label: 'Akademik',
    icon: <BookOpenCheck className="w-4 h-4" />,
    items: [
      {
        id: 'akademik-buku-induk',
        label: 'Buku Induk Digital',
        icon: <Users className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.BUKU_INDUK_PAGE_VIEW,
        children: [
          {
            href: '/portal/akademik/buku-induk/siswa',
            path: '/portal/akademik/buku-induk/siswa',
            label: 'Daftar Siswa',
            icon: <Users className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.BUKU_INDUK_SISWA_VIEW,
          },
          {
            href: '/portal/akademik/buku-induk/gtk',
            path: '/portal/akademik/buku-induk/gtk',
            label: 'Daftar GTK',
            icon: <User className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.BUKU_INDUK_GTK_VIEW,
          },
          {
            href: '/portal/akademik/buku-induk/penempatan-akun',
            path: '/portal/akademik/buku-induk/penempatan-akun',
            label: 'Penempatan Akun Aktif',
            icon: <User className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.BUKU_INDUK_MANAGE,
          },
        ],
      },
      {
        id: 'akademik-kelas-jadwal',
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
        children: [
          {
            href: '/portal/akademik/kelas-jadwal/rombel',
            path: '/portal/akademik/kelas-jadwal/rombel',
            label: 'Rombel & Wali Kelas',
            icon: <Users className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/kelas-jadwal/mapel',
            path: '/portal/akademik/kelas-jadwal/mapel',
            label: 'Mata Pelajaran',
            icon: <BookOpen className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/kelas-jadwal/jadwal',
            path: '/portal/akademik/kelas-jadwal/jadwal',
            label: 'Jadwal Pelajaran',
            icon: <Calendar className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/kelas-jadwal/piket-kelas',
            path: '/portal/akademik/kelas-jadwal/piket-kelas',
            label: 'Jadwal Piket Kelas',
            icon: <ClipboardCheck className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.PIKET_KELAS_MANAGE,
          },
        ],
      },
      {
        id: 'akademik-presensi',
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
        children: [
          {
            href: '/portal/akademik/presensi/gps',
            path: '/portal/akademik/presensi/gps',
            label: 'Presensi Guru (GPS)',
            icon: <MapPin className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/presensi/jurnal',
            path: '/portal/akademik/presensi/jurnal',
            label: 'Jurnal Pembelajaran',
            icon: <BookOpen className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/presensi/konfirmasi',
            path: '/portal/akademik/presensi/konfirmasi',
            label: 'Konfirmasi Kehadiran',
            icon: <ShieldCheck className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'PICKET',
          },
          {
            href: '/portal/akademik/presensi/pengganti',
            path: '/portal/akademik/presensi/pengganti',
            label: 'Guru Pengganti',
            icon: <Users className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'PICKET',
          },
          {
            href: '/portal/akademik/presensi/absensi-siswa',
            path: '/portal/akademik/presensi/absensi-siswa',
            label: 'Absensi Siswa Reguler',
            icon: <ClipboardCheck className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
              'WALI_KELAS',
            ],
            requireTeacherDuty: 'PICKET',
          },
          {
            href: '/portal/akademik/presensi/laporan-piket',
            path: '/portal/akademik/presensi/laporan-piket',
            label: 'Laporan Harian Piket',
            icon: <FileText className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'PICKET',
          },
          {
            href: '/portal/akademik/presensi/jam-manual',
            path: '/portal/akademik/presensi/jam-manual',
            label: 'Jam Masuk & Pulang',
            icon: <Calendar className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'PICKET_OR_COMMITTEE',
          },
          {
            href: '/portal/akademik/presensi/izin-keluar',
            path: '/portal/akademik/presensi/izin-keluar',
            label: 'Izin Keluar Sebentar',
            icon: <LogOut className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'PICKET_OR_COMMITTEE',
          },
        ],
      },
      {
        id: 'akademik-ujian',
        label: 'Periode Ujian (JTM)',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
        ],
        children: [
          {
            href: '/portal/akademik/ujian/periode',
            path: '/portal/akademik/ujian/periode',
            label: 'Periode Ujian',
            icon: <CalendarRange className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/ujian/pengawas',
            path: '/portal/akademik/ujian/pengawas',
            label: 'Pengawas Ruang',
            icon: <Users className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/ujian/panitia',
            path: '/portal/akademik/ujian/panitia',
            label: 'Panitia Ujian',
            icon: <Users className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/ujian/konfirmasi-pengawas',
            path: '/portal/akademik/ujian/konfirmasi-pengawas',
            label: 'Konfirmasi Pengawas',
            icon: <ShieldCheck className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'EXAM_COMMITTEE',
          },
          {
            href: '/portal/akademik/ujian/bap',
            path: '/portal/akademik/ujian/bap',
            label: 'Berita Acara (BAP)',
            icon: <ClipboardCheck className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'SUPERVISOR_OR_COMMITTEE',
          },
          {
            href: '/portal/akademik/ujian/pengganti',
            path: '/portal/akademik/ujian/pengganti',
            label: 'Pengawas & Panitia Pengganti',
            icon: <User className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'EXAM_COMMITTEE',
          },
          {
            href: '/portal/akademik/ujian/absensi-siswa',
            path: '/portal/akademik/ujian/absensi-siswa',
            label: 'Absensi Siswa Ujian',
            icon: <ClipboardCheck className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
              'WALI_KELAS',
            ],
            requireTeacherDuty: 'SUPERVISOR_OR_COMMITTEE',
          },
          {
            href: '/portal/akademik/ujian/lpj-panitia',
            path: '/portal/akademik/ujian/lpj-panitia',
            label: 'LPJ Harian Panitia',
            icon: <FileText className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
            ],
            requireTeacherDuty: 'EXAM_COMMITTEE',
          },
        ],
      },
      {
        id: 'akademik-acara',
        label: 'Manajemen Acara & Kegiatan',
        icon: <CalendarRange className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.ACARA_VIEW,
        children: [
          {
            href: '/portal/akademik/acara/kegiatan',
            path: '/portal/akademik/acara/kegiatan',
            label: 'Daftar & Tambah Acara',
            icon: <CalendarRange className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/acara/konfirmasi',
            path: '/portal/akademik/acara/konfirmasi',
            label: 'Konfirmasi Kehadiran',
            icon: <ShieldCheck className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
              'PEMBINA_OSIM',
              'PEMBINA_EKSTRAKURIKULER',
            ],
            requireTeacherDuty: 'PICKET',
          },
          {
            href: '/portal/akademik/acara/upacara',
            path: '/portal/akademik/acara/upacara',
            label: 'Upacara Bendera Senin',
            icon: <Users className="w-3 h-3" />,
          },
        ],
      },
      {
        href: '/portal/akademik/jurnal-acara',
        path: '/portal/akademik/jurnal-acara',
        label: 'Input Jurnal Acara',
        icon: <FileText className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.JURNAL_ACARA_VIEW,
      },
      {
        id: 'akademik-rekap-absensi',
        label: 'Rekapitulasi Absensi',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.REKAP_ABSENSI_VIEW,
        children: [
          {
            href: '/portal/akademik/rekap-absensi/guru',
            path: '/portal/akademik/rekap-absensi/guru',
            label: 'Rekap Absensi Guru',
            icon: <User className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/rekap-absensi/siswa-harian',
            path: '/portal/akademik/rekap-absensi/siswa-harian',
            label: 'Rekap Siswa Harian',
            icon: <Users className="w-3 h-3" />,
            allowedRoles: [
              'SUPERADMIN',
              'OPERATOR',
              'KEPALA_LEMBAGA',
              'WAKA_KURIKULUM',
              'WAKA_KESISWAAN',
              'KEPALA_TU',
              'STAF_TU',
              'WALI_KELAS',
              'GURU_BK',
              'GURU_WALI',
            ],
            requireTeacherDuty: 'PICKET',
          },
          {
            href: '/portal/akademik/rekap-absensi/siswa-mapel',
            path: '/portal/akademik/rekap-absensi/siswa-mapel',
            label: 'Rekap Siswa per Mapel',
            icon: <BookOpenCheck className="w-3 h-3" />,
          },
        ],
      },
      {
        id: 'akademik-kalender',
        label: 'Kalender Pendidikan',
        icon: <Calendar className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.KALENDER_VIEW,
        children: [
          {
            href: '/portal/akademik/kalender/agenda',
            path: '/portal/akademik/kalender/agenda',
            label: 'Agenda Kalender',
            icon: <Calendar className="w-3 h-3" />,
          },
          {
            href: '/portal/akademik/kalender/log-jtm',
            path: '/portal/akademik/kalender/log-jtm',
            label: 'Log JTM Libur Berbayar',
            icon: <Calculator className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.KALENDER_LOG_JTM_VIEW,
          },
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
        allowedRoles: PERMISSIONS.SDM_GTK_VIEW,
      },
      {
        label: 'Manajemen Siswa',
        href: '/portal/sdm/siswa',
        path: '/portal/sdm/siswa',
        icon: <Users className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.SDM_SISWA_VIEW,
      },
      {
        label: 'Manajemen Orang Tua/Wali Siswa',
        href: '/portal/sdm/orang-tua',
        path: '/portal/sdm/orang-tua',
        icon: <HeartHandshake className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.SDM_ORTU_VIEW,
      },
      {
        id: 'sdm-alumni',
        label: 'Manajemen Alumni',
        icon: <GraduationCap className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.SDM_ALUMNI_VIEW,
        children: [
          {
            href: '/portal/sdm/alumni/lulusan',
            path: '/portal/sdm/alumni/lulusan',
            label: 'Daftar Lulusan',
            icon: <GraduationCap className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.SDM_ALUMNI_VIEW,
          },
          {
            href: '/portal/sdm/alumni/tracer',
            path: '/portal/sdm/alumni/tracer',
            label: 'Tracer Study',
            icon: <FileText className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.SDM_ALUMNI_VIEW,
          },
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
        id: 'keuangan-spp',
        label: 'SPP & Iuran Komite',
        icon: <Receipt className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.SPP_VIEW,
        children: [
          {
            href: '/portal/keuangan/spp/jenis-biaya',
            path: '/portal/keuangan/spp/jenis-biaya',
            label: 'Jenis Biaya',
            icon: <Settings className="w-3 h-3" />,
          },
          {
            href: '/portal/keuangan/spp/terbitkan',
            path: '/portal/keuangan/spp/terbitkan',
            label: 'Terbitkan Tagihan',
            icon: <FileText className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.SPP_MANAGE,
          },
          {
            href: '/portal/keuangan/spp/pembayaran',
            path: '/portal/keuangan/spp/pembayaran',
            label: 'Pembayaran & Tagihan',
            icon: <Receipt className="w-3 h-3" />,
          },
          {
            href: '/portal/keuangan/spp/kelompok-saudara',
            path: '/portal/keuangan/spp/kelompok-saudara',
            label: 'Kelompok Saudara',
            icon: <Users className="w-3 h-3" />,
          },
        ],
      },
      {
        id: 'keuangan-tabungan',
        label: 'Tabungan Digital',
        icon: <PiggyBank className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.TABUNGAN_VIEW,
        children: [
          {
            href: '/portal/keuangan/tabungan/buka-rekening',
            path: '/portal/keuangan/tabungan/buka-rekening',
            label: 'Buka Rekening',
            icon: <User className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.TABUNGAN_MANAGE,
          },
          {
            href: '/portal/keuangan/tabungan/transaksi',
            path: '/portal/keuangan/tabungan/transaksi',
            label: 'Transaksi Setor / Tarik',
            icon: <Wallet className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.TABUNGAN_MANAGE,
          },
          {
            href: '/portal/keuangan/tabungan/rekap',
            path: '/portal/keuangan/tabungan/rekap',
            label: 'Rekapitulasi Tabungan',
            icon: <PiggyBank className="w-3 h-3" />,
          },
          {
            href: '/portal/keuangan/tabungan/aturan-fee',
            path: '/portal/keuangan/tabungan/aturan-fee',
            label: 'Aturan Fee Penarikan',
            icon: <Percent className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.TABUNGAN_MANAGE,
          },
        ],
      },
      {
        id: 'keuangan-honorarium',
        label: 'Honorarium Guru',
        icon: <Calculator className="w-3.5 h-3.5" />,
        allowedRoles: ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'BENDAHARA', 'KEPALA_TU'],
        children: [
          {
            href: '/portal/keuangan/honorarium/tarif-jam',
            path: '/portal/keuangan/honorarium/tarif-jam',
            label: 'Tarif JTM & Jam Sekolah',
            icon: <Settings className="w-3 h-3" />,
          },
          {
            href: '/portal/keuangan/honorarium/jarak-guru',
            path: '/portal/keuangan/honorarium/jarak-guru',
            label: 'Jarak Rumah Guru',
            icon: <MapPin className="w-3 h-3" />,
          },
          {
            href: '/portal/keuangan/honorarium/tugas-tambahan',
            path: '/portal/keuangan/honorarium/tugas-tambahan',
            label: 'Tugas Tambahan & Tunjangan',
            icon: <Users className="w-3 h-3" />,
          },
          {
            href: '/portal/keuangan/honorarium/rekap',
            path: '/portal/keuangan/honorarium/rekap',
            label: 'Generate & Rekap Slip',
            icon: <Calculator className="w-3 h-3" />,
          },
        ],
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
        id: 'layanan-perpustakaan',
        label: 'E-Library',
        icon: <BookOpen className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.PERPUSTAKAAN_VIEW,
        children: [
          {
            href: '/portal/layanan/perpustakaan/katalog',
            path: '/portal/layanan/perpustakaan/katalog',
            label: 'Katalog & Tambah Buku',
            icon: <BookOpen className="w-3 h-3" />,
          },
          {
            href: '/portal/layanan/perpustakaan/anggota',
            path: '/portal/layanan/perpustakaan/anggota',
            label: 'Anggota & Kartu E-Library',
            icon: <Users className="w-3 h-3" />,
            allowedRoles: PERMISSIONS.PERPUSTAKAAN_ANGGOTA_VIEW,
          },
        ],
      },
      {
        href: '/portal/layanan/bk',
        path: '/portal/layanan/bk',
        label: 'Bimbingan Konseling (BK)',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.BK_VIEW,
      },
      {
        href: '/portal/layanan/guru-wali',
        path: '/portal/layanan/guru-wali',
        label: 'Manajemen Guru Wali',
        icon: <HeartHandshake className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.GURU_WALI_VIEW,
      },
      {
        href: '/portal/layanan/alumni',
        path: '/portal/layanan/alumni',
        label: 'Tracer Study Alumni',
        icon: <GraduationCap className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.ALUMNI_VIEW,
      },
      {
        href: '/portal/tabungan-saya',
        path: '/portal/tabungan-saya',
        label: 'Tabungan Digital Saya',
        icon: <PiggyBank className="w-3.5 h-3.5" />,
        allowedRoles: ['UMUM', 'ALUMNI'],
      },
    ],
  },
  {
    id: 'portal-siswa',
    label: 'Menu Siswa',
    icon: <GraduationCap className="w-4 h-4" />,
    items: [
      {
        href: '/portal/siswa/jadwal-pelajaran',
        path: '/portal/siswa/jadwal-pelajaran',
        label: 'Jadwal Pelajaran',
        icon: <Calendar className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
      {
        href: '/portal/siswa/jadwal-piket',
        path: '/portal/siswa/jadwal-piket',
        label: 'Jadwal Piket Kelas',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
      {
        href: '/portal/siswa/tabungan',
        path: '/portal/siswa/tabungan',
        label: 'Tabungan Digital',
        icon: <PiggyBank className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
      {
        href: '/portal/siswa/absensi',
        path: '/portal/siswa/absensi',
        label: 'Riwayat Absensi',
        icon: <UserCheck className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
      {
        href: '/portal/siswa/spp',
        path: '/portal/siswa/spp',
        label: 'Tagihan & SPP',
        icon: <Receipt className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
      {
        href: '/portal/siswa/ujian',
        path: '/portal/siswa/ujian',
        label: 'Jadwal & Ruang Ujian',
        icon: <FileCheck2 className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
      {
        href: '/portal/siswa/bk',
        path: '/portal/siswa/bk',
        label: 'Catatan BK',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        allowedRoles: ['SISWA'],
      },
    ],
  },
  {
    id: 'portal-orang-tua',
    label: 'Menu Orang Tua / Wali',
    icon: <HeartHandshake className="w-4 h-4" />,
    items: [
      {
        href: '/portal/orang-tua/jadwal-pelajaran',
        path: '/portal/orang-tua/jadwal-pelajaran',
        label: 'Jadwal Pelajaran Anak',
        icon: <Calendar className="w-3.5 h-3.5" />,
        allowedRoles: ['ORANG_TUA'],
      },
      {
        href: '/portal/orang-tua/jadwal-piket',
        path: '/portal/orang-tua/jadwal-piket',
        label: 'Jadwal Piket Kelas Anak',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        allowedRoles: ['ORANG_TUA'],
      },
      {
        href: '/portal/orang-tua/tabungan',
        path: '/portal/orang-tua/tabungan',
        label: 'Tabungan Digital Anak',
        icon: <PiggyBank className="w-3.5 h-3.5" />,
        allowedRoles: ['ORANG_TUA'],
      },
      {
        href: '/portal/orang-tua/absensi',
        path: '/portal/orang-tua/absensi',
        label: 'Riwayat Absensi Anak',
        icon: <UserCheck className="w-3.5 h-3.5" />,
        allowedRoles: ['ORANG_TUA'],
      },
      {
        href: '/portal/orang-tua/spp',
        path: '/portal/orang-tua/spp',
        label: 'Tagihan & SPP Anak',
        icon: <Receipt className="w-3.5 h-3.5" />,
        allowedRoles: ['ORANG_TUA'],
      },
      {
        href: '/portal/orang-tua/bk',
        path: '/portal/orang-tua/bk',
        label: 'Catatan BK Anak',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        allowedRoles: ['ORANG_TUA'],
      },
    ],
  },
  {
    id: 'portal-gtk',
    label: 'Aktivitas & Hak GTK',
    icon: <Briefcase className="w-4 h-4" />,
    items: [
      {
        href: '/portal/gtk/jadwal-mengajar',
        path: '/portal/gtk/jadwal-mengajar',
        label: 'Jadwal Mengajar Saya',
        icon: <Calendar className="w-3.5 h-3.5" />,
        allowedRoles: [
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
          'WAKA_SARPRAS',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
          'GURU_WALI',
          'GURU_BK',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
          'PENGELOLA_TABUNGAN',
          'PUSTAKAWAN',
          'PEMBINA_OSIM',
          'PEMBINA_EKSTRAKURIKULER',
        ],
      },
      {
        href: '/portal/gtk/jadwal-piket',
        path: '/portal/gtk/jadwal-piket',
        label: 'Jadwal Piket GTK Saya',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        allowedRoles: [
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
          'WAKA_SARPRAS',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
          'GURU_WALI',
          'GURU_BK',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
          'PENGELOLA_TABUNGAN',
          'PUSTAKAWAN',
          'PEMBINA_OSIM',
          'PEMBINA_EKSTRAKURIKULER',
        ],
      },
      {
        href: '/portal/gtk/presensi-saya',
        path: '/portal/gtk/presensi-saya',
        label: 'Riwayat Presensi Saya',
        icon: <MapPin className="w-3.5 h-3.5" />,
        allowedRoles: [
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
          'WAKA_SARPRAS',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
          'GURU_WALI',
          'GURU_BK',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
          'PENGELOLA_TABUNGAN',
          'PUSTAKAWAN',
          'PEMBINA_OSIM',
          'PEMBINA_EKSTRAKURIKULER',
        ],
      },
      {
        href: '/portal/gtk/tabungan',
        path: '/portal/gtk/tabungan',
        label: 'Tabungan Digital Saya',
        icon: <PiggyBank className="w-3.5 h-3.5" />,
        allowedRoles: [
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
          'WAKA_SARPRAS',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
          'GURU_WALI',
          'GURU_BK',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
          'PENGELOLA_TABUNGAN',
          'PUSTAKAWAN',
          'PEMBINA_OSIM',
          'PEMBINA_EKSTRAKURIKULER',
        ],
      },
      {
        href: '/portal/gtk/honorarium',
        path: '/portal/gtk/honorarium',
        label: 'Slip Honorarium Saya',
        icon: <Wallet className="w-3.5 h-3.5" />,
        allowedRoles: [
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS',
          'WAKA_SARPRAS',
          'KEPALA_TU',
          'STAF_TU',
          'GURU',
          'WALI_KELAS',
          'GURU_WALI',
          'GURU_BK',
          'BENDAHARA',
          'BENDAHARA_KOMITE',
          'PENGELOLA_TABUNGAN',
          'PUSTAKAWAN',
          'PEMBINA_OSIM',
          'PEMBINA_EKSTRAKURIKULER',
        ],
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
        id: 'gtk-biodata-dokumen',
        label: 'Biodata & Dokumen GTK',
        icon: <UserCheck className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.GTK_BIODATA_VIEW,
        children: [
          {
            href: '/portal/gtk/biodata-dokumen/biodata',
            path: '/portal/gtk/biodata-dokumen/biodata',
            label: 'Biodata Lengkap',
            icon: <User className="w-3 h-3" />,
          },
          {
            href: '/portal/gtk/biodata-dokumen/dokumen',
            path: '/portal/gtk/biodata-dokumen/dokumen',
            label: 'Scan Dokumen Pribadi',
            icon: <FileText className="w-3 h-3" />,
          },
        ],
      },
      {
        id: 'siswa-biodata-dokumen',
        label: 'Biodata & Dokumen Siswa',
        icon: <GraduationCap className="w-3.5 h-3.5" />,
        allowedRoles: [
          'SISWA',
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KESISWAAN',
        ],
        children: [
          {
            href: '/portal/siswa/biodata-dokumen/biodata',
            path: '/portal/siswa/biodata-dokumen/biodata',
            label: 'Biodata Lengkap',
            icon: <User className="w-3 h-3" />,
          },
          {
            href: '/portal/siswa/biodata-dokumen/dokumen',
            path: '/portal/siswa/biodata-dokumen/dokumen',
            label: 'Scan Dokumen Pribadi',
            icon: <FileText className="w-3 h-3" />,
          },
        ],
      },
      {
        id: 'ortu-biodata-dokumen',
        label: 'Biodata & Dokumen Wali',
        icon: <HeartHandshake className="w-3.5 h-3.5" />,
        allowedRoles: PERMISSIONS.ORTU_BIODATA_VIEW,
        children: [
          {
            href: '/portal/orang-tua/biodata-dokumen/biodata',
            path: '/portal/orang-tua/biodata-dokumen/biodata',
            label: 'Biodata Lengkap',
            icon: <User className="w-3 h-3" />,
          },
          {
            href: '/portal/orang-tua/biodata-dokumen/dokumen',
            path: '/portal/orang-tua/biodata-dokumen/dokumen',
            label: 'Scan Dokumen Pribadi',
            icon: <FileText className="w-3 h-3" />,
          },
        ],
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
  '/portal/cms/sarana-prasarana': 'Manajemen Sarana & Prasarana',
  '/portal/akademik/buku-induk': 'Buku Induk Digital (Siswa & GTK)',
  '/portal/akademik/buku-induk/siswa': 'Buku Induk Digital — Daftar Siswa',
  '/portal/akademik/buku-induk/gtk': 'Buku Induk Digital — Daftar GTK',
  '/portal/akademik/buku-induk/penempatan-akun': 'Buku Induk Digital — Penempatan Akun Aktif',
  '/portal/akademik/kelas-jadwal': 'Manajemen Kelas & Jadwal Pelajaran',
  '/portal/akademik/kelas-jadwal/rombel': 'Kelas & Jadwal — Rombel & Wali Kelas',
  '/portal/akademik/kelas-jadwal/mapel': 'Kelas & Jadwal — Mata Pelajaran',
  '/portal/akademik/kelas-jadwal/jadwal': 'Kelas & Jadwal — Jadwal Pelajaran',
  '/portal/akademik/presensi': 'Presensi GPS & Delegasi Guru Pengganti',
  '/portal/akademik/presensi/gps': 'Presensi Guru (GPS Geofencing)',
  '/portal/akademik/presensi/jurnal': 'Jurnal Pembelajaran (Hitung JTM)',
  '/portal/akademik/presensi/konfirmasi': 'Konfirmasi Kehadiran (Admin / Guru Piket)',
  '/portal/akademik/presensi/pengganti': 'Penunjukkan Guru Pengganti',
  '/portal/akademik/presensi/absensi-siswa': 'Absensi Siswa Reguler (Guru Piket)',
  '/portal/akademik/presensi/laporan-piket': 'Laporan Harian Guru Piket',
  '/portal/akademik/presensi/jam-manual': 'Input Manual Jam Masuk & Pulang',
  '/portal/akademik/presensi/izin-keluar': 'Izin Keluar Sebentar',
  '/portal/akademik/ujian': 'Periode Ujian (Pengawas & Panitia JTM)',
  '/portal/akademik/ujian/periode': 'Ujian — Periode Ujian',
  '/portal/akademik/ujian/pengawas': 'Ujian — Pengawas Ruang Ujian',
  '/portal/akademik/ujian/panitia': 'Ujian — Panitia Ujian',
  '/portal/akademik/ujian/konfirmasi-pengawas': 'Ujian — Konfirmasi Kehadiran Pengawas',
  '/portal/akademik/ujian/bap': 'Ujian — Berita Acara Pengawasan (BAP)',
  '/portal/akademik/ujian/pengganti': 'Ujian — Pengawas & Panitia Pengganti',
  '/portal/akademik/ujian/absensi-siswa': 'Ujian — Absensi Siswa Ujian',
  '/portal/akademik/ujian/lpj-panitia': 'Ujian — LPJ Harian Panitia Ujian',
  '/portal/akademik/acara': 'Manajemen Acara & Kegiatan Lembaga',
  '/portal/akademik/acara/kegiatan': 'Acara & Kegiatan — Daftar & Tambah',
  '/portal/akademik/acara/konfirmasi': 'Acara & Kegiatan — Konfirmasi Kehadiran',
  '/portal/akademik/acara/upacara': 'Acara & Kegiatan — Upacara Bendera Senin',
  '/portal/akademik/jurnal-acara': 'Input Jurnal Acara Guru',
  '/portal/akademik/kalender': 'Kalender Pendidikan & Libur Berbayar',
  '/portal/akademik/kalender/agenda': 'Kalender Pendidikan — Agenda & Tanggal',
  '/portal/akademik/kalender/log-jtm': 'Kalender Pendidikan — Log JTM Libur Berbayar',
  '/portal/akademik/rekap-absensi': 'Rekapitulasi Absensi Guru & Siswa',
  '/portal/akademik/rekap-absensi/guru': 'Rekapitulasi Absensi Guru',
  '/portal/akademik/rekap-absensi/siswa-harian': 'Rekapitulasi Absensi Siswa Harian',
  '/portal/akademik/rekap-absensi/siswa-mapel': 'Rekapitulasi Absensi Siswa per Mapel',
  '/portal/sdm/gtk': 'Manajemen GTK',
  '/portal/sdm/siswa': 'Manajemen Siswa',
  '/portal/sdm/orang-tua': 'Manajemen Orang Tua / Wali Siswa',
  '/portal/sdm/alumni': 'Manajemen Alumni',
  '/portal/sdm/alumni/lulusan': 'Manajemen Alumni — Daftar Lulusan',
  '/portal/sdm/alumni/tracer': 'Manajemen Alumni — Tracer Study',
  '/portal/keuangan/spp': 'Keuangan SPP & Iuran Komite',
  '/portal/keuangan/spp/jenis-biaya': 'SPP & Komite — Jenis Biaya',
  '/portal/keuangan/spp/terbitkan': 'SPP & Komite — Terbitkan Tagihan',
  '/portal/keuangan/spp/pembayaran': 'SPP & Komite — Pembayaran & Daftar Tagihan',
  '/portal/keuangan/spp/kelompok-saudara': 'SPP & Komite — Kelompok Saudara',
  '/portal/keuangan/tabungan': 'Tabungan Digital Warga & Umum',
  '/portal/keuangan/tabungan/buka-rekening': 'Tabungan Digital — Buka Rekening',
  '/portal/keuangan/tabungan/transaksi': 'Tabungan Digital — Transaksi Setor / Tarik',
  '/portal/keuangan/tabungan/rekap': 'Tabungan Digital — Rekapitulasi Buku',
  '/portal/keuangan/tabungan/aturan-fee': 'Tabungan Digital — Aturan Fee Penarikan',
  '/portal/keuangan/honorarium': 'Manajemen Honorarium Guru',
  '/portal/keuangan/honorarium/tarif-jam': 'Honorarium — Tarif JTM & Jam Sekolah',
  '/portal/keuangan/honorarium/jarak-guru': 'Honorarium — Jarak Rumah Guru',
  '/portal/keuangan/honorarium/tugas-tambahan': 'Honorarium — Tugas Tambahan & Tunjangan',
  '/portal/keuangan/honorarium/rekap': 'Honorarium — Generate & Rekap Slip',
  '/portal/layanan/persuratan': 'Persuratan, Arsip Digital & Kartu Pelajar',
  '/portal/layanan/perpustakaan': 'Perpustakaan Digital (E-Library)',
  '/portal/layanan/perpustakaan/katalog': 'E-Library — Katalog & Tambah Buku',
  '/portal/layanan/perpustakaan/anggota': 'E-Library — Anggota & Kartu Perpustakaan',
  '/portal/layanan/bk': 'Bimbingan Konseling (BK) & Poin Siswa',
  '/portal/layanan/guru-wali': 'Manajemen Guru Wali',
  '/portal/layanan/alumni': 'Tracer Study / Portal Alumni',
  '/portal/siswa/biodata-dokumen': 'Biodata & Dokumen Siswa',
  '/portal/siswa/biodata-dokumen/biodata': 'Biodata Lengkap Siswa',
  '/portal/siswa/biodata-dokumen/dokumen': 'Scan Dokumen Pribadi Siswa',
  '/portal/siswa/jadwal-pelajaran': 'Jadwal Pelajaran Sepekan',
  '/portal/siswa/jadwal-piket': 'Jadwal Piket Kelas',
  '/portal/siswa/tabungan': 'Tabungan Digital Siswa',
  '/portal/siswa/absensi': 'Riwayat Absensi Siswa',
  '/portal/siswa/spp': 'Tagihan & Pembayaran SPP',
  '/portal/siswa/ujian': 'Jadwal & Ruang Ujian',
  '/portal/siswa/bk': 'Catatan Bimbingan Konseling (BK)',
  '/portal/gtk/biodata-dokumen': 'Biodata & Dokumen GTK',
  '/portal/gtk/biodata-dokumen/biodata': 'Biodata Lengkap GTK',
  '/portal/gtk/biodata-dokumen/dokumen': 'Scan Dokumen Pribadi GTK',
  '/portal/gtk/jadwal-mengajar': 'Jadwal Mengajar Saya',
  '/portal/gtk/jadwal-piket': 'Jadwal Piket GTK Saya',
  '/portal/gtk/presensi-saya': 'Riwayat Presensi GTK Saya',
  '/portal/gtk/tabungan': 'Tabungan Digital GTK',
  '/portal/gtk/honorarium': 'Slip Honorarium Saya',
  '/portal/orang-tua/biodata-dokumen': 'Biodata & Dokumen Orang Tua/Wali',
  '/portal/orang-tua/biodata-dokumen/biodata': 'Biodata Lengkap Orang Tua/Wali',
  '/portal/orang-tua/biodata-dokumen/dokumen': 'Scan Dokumen Pribadi Orang Tua/Wali',
  '/portal/orang-tua/jadwal-pelajaran': 'Jadwal Pelajaran Anak',
  '/portal/orang-tua/jadwal-piket': 'Jadwal Piket Kelas Anak',
  '/portal/orang-tua/tabungan': 'Tabungan Digital Anak',
  '/portal/orang-tua/absensi': 'Riwayat Absensi Anak',
  '/portal/orang-tua/spp': 'Tagihan & Pembayaran SPP Anak',
  '/portal/orang-tua/bk': 'Catatan BK Anak',
  '/portal/akademik/kelas-jadwal/piket-kelas': 'Manajemen Jadwal Piket Kelas',
  '/portal/tabungan-saya': 'Tabungan Digital Saya',
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
  const [authLoaded, setAuthLoaded] = useState(false);
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
      .catch(() => {})
      .finally(() => setAuthLoaded(true));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      clearPortalSessionCache();
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

  function matchesTeacherDuty(req?: TeacherDutyRequirement): boolean {
    if (!req) return false;
    const ta = user?.teacherAssignments;
    if (!ta) return false;
    switch (req) {
      case 'PICKET':
        return ta.isPicketTeacher;
      case 'EXAM_SUPERVISOR':
        return ta.isExamSupervisor;
      case 'EXAM_COMMITTEE':
        return ta.isExamCommittee;
      case 'PICKET_OR_COMMITTEE':
        return ta.isPicketTeacher || ta.isExamCommittee;
      case 'SUPERVISOR_OR_COMMITTEE':
        return ta.isExamSupervisor || ta.isExamCommittee;
      default:
        return false;
    }
  }

  function hasRoleAccess(item: NavItem): boolean {
    if (!authLoaded || userRoles.length === 0) return false;
    if (!item.allowedRoles && !item.requireTeacherDuty) return true;
    if (item.allowedRoles && hasRolePermission(userRoles, item.allowedRoles)) {
      return true;
    }
    if (item.requireTeacherDuty && matchesTeacherDuty(item.requireTeacherDuty)) {
      return true;
    }
    return false;
  }

  function canAccessCurrentView(targetPath: string): boolean {
    if (!canAccessPortalPath(targetPath, userRoles)) return false;
    for (const grp of ACCORDION_GROUPS) {
      for (const it of grp.items) {
        if (it.path === targetPath) {
          return hasRoleAccess(it);
        }
        if (it.children) {
          for (const ch of it.children) {
            if (ch.path === targetPath) {
              return hasRoleAccess(it) && hasRoleAccess(ch);
            }
          }
        }
      }
    }
    return true;
  }

  function isItemActive(item: NavItem): boolean {
    if (item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`))) {
      return true;
    }
    if (item.children) {
      return item.children.some((child) => isItemActive(child));
    }
    return false;
  }

  const visibleGroups = ACCORDION_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter(hasRoleAccess)
      .map((item) =>
        item.children
          ? { ...item, children: item.children.filter(hasRoleAccess) }
          : item
      )
      .filter((item) => !item.children || item.children.length > 0),
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
            const hasActiveChild = group.items.some((item) => isItemActive(item));

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
                      if (item.children && item.children.length > 0) {
                        const subId = item.id || item.label;
                        const isSubOpen = Boolean(openGroups[subId]);
                        const hasActiveSubChild = item.children.some((c) => isItemActive(c));

                        return (
                          <div key={subId} className="rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleGroup(subId)}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                                hasActiveSubChild
                                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                  : 'text-slate-600 hover:bg-white/80 hover:text-emerald-700'
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                {item.icon}
                                <span className="truncate">{item.label}</span>
                              </span>
                              {isSubOpen ? (
                                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                              )}
                            </button>

                            {isSubOpen && (
                              <div className="mt-1 ml-2.5 pl-2.5 border-l border-slate-200/80 space-y-0.5">
                                {item.children.map((subItem) => {
                                  const isSubActive = pathname === subItem.path;
                                  return (
                                    <Link
                                      key={subItem.href}
                                      href={subItem.href || '#'}
                                      onClick={() => setSidebarOpen(false)}
                                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition ${
                                        isSubActive
                                          ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                                          : 'text-slate-600 hover:bg-white/80 hover:text-emerald-700'
                                      }`}
                                    >
                                      {subItem.icon}
                                      <span className="truncate">{subItem.label}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const isActive = pathname === item.path;
                      return (
                        <Link
                          key={item.href}
                          href={item.href || '#'}
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
        <main className="flex-1 p-4 sm:p-6">
          {authLoaded && !canAccessCurrentView(normalizedPath) ? (
            <div className="max-w-xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4 mt-8">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-bold text-slate-900">Akses Halaman Ditolak</h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Peran akun Anda ({userRoles.join(', ') || 'Tidak ada peran'}) tidak memiliki izin
                  untuk mengakses halaman ini.
                </p>
              </div>
              <div>
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                >
                  Kembali ke Dashboard Portal
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>

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
