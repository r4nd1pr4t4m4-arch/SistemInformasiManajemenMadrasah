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
 * Peran yang dapat mengakses Dashboard Pengelolaan & Analitik Notifikasi (/portal/notifikasi/kelola).
 * Hak kategori di dalam dashboard otomatis disaring berdasarkan peran & tugas tambahan masing-masing.
 */
export const NOTIFICATION_DASHBOARD_ROLES: readonly AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_HUMAS',
  'WAKA_KURIKULUM',
  'WAKA_KESISWAAN',
  'WAKA_SARPRAS',
  'KEPALA_TU',
  'BENDAHARA',
  'BENDAHARA_KOMITE',
  'PENGELOLA_TABUNGAN',
  'GURU_BK',
  'PUSTAKAWAN',
];

/**
 * Pemetaan kategori notifikasi yang boleh dikelola / dikirim / dipantau
 * sesuai peran dan tugas tambahan (selain SUPERADMIN & OPERATOR yang mendapat semua kategori).
 */
const ROLE_NOTIFICATION_CATEGORIES: Partial<Record<AppRole, readonly NotificationCategoryKey[]>> = {
  KEPALA_LEMBAGA: [
    'PENGUMUMAN_BROADCAST',
    'BERITA_CMS',
    'PPDB',
    'PRESENSI_SISWA',
    'GURU_WALI_HAFALAN',
    'LAYANAN_BK',
    'PENILAIAN_RAPORT',
    'KEUANGAN_SPP',
    'TABUNGAN',
    'SDM_HONORARIUM',
    'PERPUSTAKAAN_SURAT',
    'PENGINGAT_TERJADWAL',
  ],
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
 * Siapa yang boleh mengubah kebijakan kunci kategori (allow_user_opt_out):
 * - SUPERADMIN & OPERATOR: semua kategori
 * - KEPALA_LEMBAGA, WAKA_*, KEPALA_TU: hanya kategori dalam lingkup peran/tugasnya
 */
export function canEditNotificationPolicy(
  roles: readonly AppRole[],
  categoryKey: NotificationCategoryKey
): boolean {
  if (isFullNotificationAdmin(roles)) return true;
  const policyEditorRoles: readonly AppRole[] = [
    'KEPALA_LEMBAGA',
    'WAKA_HUMAS',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_SARPRAS',
    'KEPALA_TU',
  ];
  const hasEditorRole = roles.some((r) => policyEditorRoles.includes(r));
  if (!hasEditorRole) return false;
  return canManageNotificationCategory(roles, categoryKey);
}
