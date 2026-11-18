import type { AppRole } from '@/types/database';

export const PERMISSIONS = {
  // CMS & Publikasi
  CMS_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_HUMAS',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  CMS_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_HUMAS',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  CMS_PPDB_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_HUMAS',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  CMS_PPDB_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_HUMAS',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  CMS_SARPRAS_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_SARPRAS',
    'WAKA_HUMAS',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  CMS_SARPRAS_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_SARPRAS',
    'WAKA_HUMAS',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],

  // Buku Induk
  BUKU_INDUK_PAGE_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  BUKU_INDUK_API_READ: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'GURU',
    'WALI_KELAS',
    'GURU_WALI',
    'GURU_BK',
    'BENDAHARA',
    'BENDAHARA_KOMITE',
    'PENGELOLA_TABUNGAN',
    'KEPALA_TU',
    'STAF_TU',
    'PUSTAKAWAN',
  ] as AppRole[],
  BUKU_INDUK_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],

  // Kelas & Jadwal
  KELAS_JADWAL_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
    'STAF_TU',
    'GURU',
    'WALI_KELAS',
  ] as AppRole[],
  KELAS_JADWAL_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],

  // Presensi & Konfirmasi
  PRESENSI_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
    'GURU',
    'WALI_KELAS',
  ] as AppRole[],
  PRESENSI_SUBMIT: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'GURU',
    'WALI_KELAS',
  ] as AppRole[],
  ADMIN_CONFIRM: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],

  // Ujian
  UJIAN_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
    'STAF_TU',
    'GURU',
    'WALI_KELAS',
  ] as AppRole[],
  UJIAN_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],

  // Acara & Jurnal Acara
  ACARA_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
    'GURU',
    'WALI_KELAS',
  ] as AppRole[],
  ACARA_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  JURNAL_ACARA_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'GURU',
    'WALI_KELAS',
    'GURU_WALI',
    'GURU_BK',
  ] as AppRole[],
  JURNAL_ACARA_SUBMIT: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'GURU',
    'WALI_KELAS',
    'GURU_WALI',
    'GURU_BK',
  ] as AppRole[],

  // Kalender & Rekap Absensi
  KALENDER_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
    'GURU',
    'WALI_KELAS',
  ] as AppRole[],
  KALENDER_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  REKAP_ABSENSI_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
    'GURU',
    'WALI_KELAS',
    'GURU_BK',
  ] as AppRole[],

  // SDM
  SDM_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'STAF_TU',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_HUMAS',
  ] as AppRole[],
  SDM_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  SDM_ALUMNI_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_TU',
    'STAF_TU',
    'WAKA_HUMAS',
  ] as AppRole[],

  // Keuangan
  SPP_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'BENDAHARA',
    'BENDAHARA_KOMITE',
  ] as AppRole[],
  SPP_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'BENDAHARA',
    'BENDAHARA_KOMITE',
  ] as AppRole[],
  TABUNGAN_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'BENDAHARA',
    'PENGELOLA_TABUNGAN',
  ] as AppRole[],
  TABUNGAN_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'PENGELOLA_TABUNGAN',
  ] as AppRole[],
  HONORARIUM_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'BENDAHARA',
    'KEPALA_TU',
  ] as AppRole[],
  HONORARIUM_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'BENDAHARA',
    'KEPALA_TU',
  ] as AppRole[],

  // Layanan & Arsip
  PERSURATAN_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  PERSURATAN_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  PERPUSTAKAAN_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'PUSTAKAWAN',
    'GURU',
    'WALI_KELAS',
    'STAF_TU',
    'KEPALA_TU',
    'SISWA',
    'UMUM',
  ] as AppRole[],
  PERPUSTAKAAN_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'PUSTAKAWAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  PERPUSTAKAAN_ANGGOTA_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'PUSTAKAWAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  BK_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'GURU_BK',
    'WALI_KELAS',
  ] as AppRole[],
  BK_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KESISWAAN',
    'GURU_BK',
  ] as AppRole[],
  GURU_WALI_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'GURU_WALI',
    'WALI_KELAS',
    'GURU',
  ] as AppRole[],
  GURU_WALI_ASSIGN: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  GURU_WALI_LOG: [
    'SUPERADMIN',
    'OPERATOR',
    'GURU_WALI',
    'WALI_KELAS',
    'GURU',
  ] as AppRole[],
  ALUMNI_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_HUMAS',
    'GURU_BK',
    'ALUMNI',
    'STAF_TU',
    'KEPALA_TU',
  ] as AppRole[],
  ALUMNI_SUBMIT: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_HUMAS',
    'GURU_BK',
    'ALUMNI',
    'STAF_TU',
    'KEPALA_TU',
  ] as AppRole[],

  // Portal Siswa
  SISWA_BIODATA_VIEW: [
    'SISWA',
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'STAF_TU',
    'WAKA_KESISWAAN',
  ] as AppRole[],
  SISWA_BIODATA_MANAGE: [
    'SISWA',
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],

  // Manajemen Pengguna
  USER_MANAGEMENT_VIEW: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
  ] as AppRole[],
  USER_MANAGEMENT_MANAGE: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_TU',
  ] as AppRole[],
};

export function hasRolePermission(
  userRoles: readonly AppRole[],
  allowedRoles: readonly AppRole[]
): boolean {
  if (userRoles.length === 0) return false;
  return userRoles.some((role) => allowedRoles.includes(role));
}

const EXACT_ROUTE_RULES: Record<string, AppRole[]> = {
  '/portal/akademik/buku-induk/penempatan-akun': PERMISSIONS.BUKU_INDUK_MANAGE,
  '/portal/keuangan/spp/terbitkan': PERMISSIONS.SPP_MANAGE,
  '/portal/keuangan/tabungan/buka-rekening': PERMISSIONS.TABUNGAN_MANAGE,
  '/portal/keuangan/tabungan/transaksi': PERMISSIONS.TABUNGAN_MANAGE,
  '/portal/layanan/perpustakaan/anggota': PERMISSIONS.PERPUSTAKAAN_ANGGOTA_VIEW,
  '/portal/cms/ppdb': PERMISSIONS.CMS_PPDB_VIEW,
  '/portal/cms/sarana-prasarana': PERMISSIONS.CMS_SARPRAS_VIEW,
  '/portal/akun/manajemen-pengguna': PERMISSIONS.USER_MANAGEMENT_VIEW,
};

const PREFIX_ROUTE_RULES: Array<[string, AppRole[]]> = [
  ['/portal/cms', PERMISSIONS.CMS_VIEW],
  ['/portal/akademik/buku-induk', PERMISSIONS.BUKU_INDUK_PAGE_VIEW],
  ['/portal/akademik/kelas-jadwal', PERMISSIONS.KELAS_JADWAL_VIEW],
  ['/portal/akademik/presensi', PERMISSIONS.PRESENSI_VIEW],
  ['/portal/akademik/ujian', PERMISSIONS.UJIAN_VIEW],
  ['/portal/akademik/acara', PERMISSIONS.ACARA_VIEW],
  ['/portal/akademik/jurnal-acara', PERMISSIONS.JURNAL_ACARA_VIEW],
  ['/portal/akademik/rekap-absensi', PERMISSIONS.REKAP_ABSENSI_VIEW],
  ['/portal/akademik/kalender', PERMISSIONS.KALENDER_VIEW],
  ['/portal/akademik', PERMISSIONS.PRESENSI_VIEW],
  ['/portal/sdm', PERMISSIONS.SDM_VIEW],
  ['/portal/keuangan/spp', PERMISSIONS.SPP_VIEW],
  ['/portal/keuangan/tabungan', PERMISSIONS.TABUNGAN_VIEW],
  ['/portal/keuangan/honorarium', PERMISSIONS.HONORARIUM_VIEW],
  ['/portal/keuangan', PERMISSIONS.SPP_VIEW],
  ['/portal/layanan/persuratan', PERMISSIONS.PERSURATAN_VIEW],
  ['/portal/layanan/perpustakaan', PERMISSIONS.PERPUSTAKAAN_VIEW],
  ['/portal/layanan/bk', PERMISSIONS.BK_VIEW],
  ['/portal/layanan/guru-wali', PERMISSIONS.GURU_WALI_VIEW],
  ['/portal/layanan/alumni', PERMISSIONS.ALUMNI_VIEW],
  ['/portal/layanan', PERMISSIONS.PERPUSTAKAAN_VIEW],
  ['/portal/siswa/biodata-dokumen', PERMISSIONS.SISWA_BIODATA_VIEW],
  ['/portal/siswa', PERMISSIONS.SISWA_BIODATA_VIEW],
];

export function canAccessPortalPath(pathname: string, userRoles: readonly AppRole[]): boolean {
  if (userRoles.length === 0) return false;
  const normalized = pathname.replace(/\/$/, '') || '/portal';

  if (
    normalized === '/portal' ||
    normalized === '/portal/akun' ||
    normalized === '/portal/akun/profil' ||
    normalized === '/portal/akun/kata-sandi' ||
    normalized === '/portal/akun/mfa'
  ) {
    return true;
  }

  if (EXACT_ROUTE_RULES[normalized]) {
    return hasRolePermission(userRoles, EXACT_ROUTE_RULES[normalized]);
  }

  for (const [prefix, allowedRoles] of PREFIX_ROUTE_RULES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return hasRolePermission(userRoles, allowedRoles);
    }
  }

  return false;
}
