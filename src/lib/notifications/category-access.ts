import type { AppRole } from '@/types/database';
import {
  ALL_NOTIFICATION_CATEGORY_KEYS,
  type NotificationCategoryKey,
} from '@/lib/notifications/types';

/**
 * Peran yang memiliki akses penuh ke seluruh kategori notifikasi (broadcast, analitik, kebijakan).
 */
export const FULL_NOTIFICATION_ADMIN_ROLES: readonly AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
];

/**
 * Pemetaan kategori notifikasi yang boleh dikelola penuh (broadcast, analitik, & kebijakan)
 * sesuai peran operasional dan tugas tambahan.
 * CATATAN: Tidak ada peran readonly (seperti KEPALA_LEMBAGA) pada halaman /portal/notifikasi/kelola.
 */
const ROLE_NOTIFICATION_CATEGORIES: Partial<Record<AppRole, readonly NotificationCategoryKey[]>> = {
  WAKA_HUMAS: [
    'PENGUMUMAN_BROADCAST',
    'BERITA_CMS',
    'PPDB',
    'PERPUSTAKAAN_SURAT',
  ],
  WAKA_KURIKULUM: [
    'PENGUMUMAN_BROADCAST',
    'PENILAIAN_RAPORT',
    'PENGINGAT_TERJADWAL',
  ],
  WAKA_KESISWAAN: [
    'PENGUMUMAN_BROADCAST',
    'PPDB',
    'PRESENSI_SISWA',
    'GURU_WALI_HAFALAN',
    'LAYANAN_BK',
    'PENGINGAT_TERJADWAL',
  ],
  WAKA_SARPRAS: [
    'PENGUMUMAN_BROADCAST',
    'BERITA_CMS',
  ],
  KEPALA_TU: [
    'PENGUMUMAN_BROADCAST',
    'PPDB',
    'SDM_HONORARIUM',
    'PERPUSTAKAAN_SURAT',
    'KEAMANAN_AKUN',
  ],
  STAF_TU: [
    'PPDB',
    'PERPUSTAKAAN_SURAT',
  ],
  BENDAHARA: [
    'KEUANGAN_SPP',
    'SDM_HONORARIUM',
    'PENGINGAT_TERJADWAL',
  ],
  BENDAHARA_KOMITE: [
    'KEUANGAN_SPP',
    'PENGINGAT_TERJADWAL',
  ],
  PENGELOLA_TABUNGAN: [
    'TABUNGAN',
  ],
  GURU_BK: [
    'LAYANAN_BK',
    'PRESENSI_SISWA',
  ],
  WALI_KELAS: [
    'PRESENSI_SISWA',
    'PENILAIAN_RAPORT',
  ],
  GURU_WALI: [
    'GURU_WALI_HAFALAN',
  ],
  PUSTAKAWAN: [
    'PERPUSTAKAAN_SURAT',
    'PENGINGAT_TERJADWAL',
  ],
};

/**
 * Peran yang memiliki izin mengelola halaman /portal/notifikasi/kelola.
 * Seluruh peran di daftar ini memiliki hak kelola aktif pada kategorinya (tidak ada akses readonly).
 */
export const NOTIFICATION_DASHBOARD_ROLES: readonly AppRole[] = [
  ...FULL_NOTIFICATION_ADMIN_ROLES,
  ...(Object.keys(ROLE_NOTIFICATION_CATEGORIES) as AppRole[]),
];

export function isFullNotificationAdmin(roles: readonly AppRole[]): boolean {
  return roles.some((role) => FULL_NOTIFICATION_ADMIN_ROLES.includes(role));
}

export function getAllowedNotificationCategoriesForRoles(
  roles: readonly AppRole[]
): NotificationCategoryKey[] {
  if (isFullNotificationAdmin(roles)) {
    return [...ALL_NOTIFICATION_CATEGORY_KEYS];
  }
  const allowed = new Set<NotificationCategoryKey>();
  for (const role of roles) {
    const cats = ROLE_NOTIFICATION_CATEGORIES[role];
    if (!cats) continue;
    for (const key of cats) {
      allowed.add(key);
    }
  }
  return ALL_NOTIFICATION_CATEGORY_KEYS.filter((k) => allowed.has(k));
}

export function canManageNotificationCategory(
  roles: readonly AppRole[],
  categoryKey: NotificationCategoryKey
): boolean {
  if (isFullNotificationAdmin(roles)) return true;
  return getAllowedNotificationCategoriesForRoles(roles).includes(categoryKey);
}

/**
 * Setiap peran yang memiliki izin akses kategori di /portal/notifikasi/kelola
 * memiliki izin kelola penuh atas kategori dalam wewenangnya (tidak ada peran readonly).
 */
export function canEditNotificationPolicy(
  roles: readonly AppRole[],
  categoryKey: NotificationCategoryKey
): boolean {
  return canManageNotificationCategory(roles, categoryKey);
}
