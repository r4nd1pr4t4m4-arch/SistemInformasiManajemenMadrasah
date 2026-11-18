import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles, hasAnyRole, type AuthenticatedSession } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import type { AppRole } from '@/types/database';

export { PERMISSIONS };

export const ROLE_GROUPS = {
  CMS: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_HUMAS',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  AKADEMIK: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'GURU',
    'WALI_KELAS',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  BUKU_INDUK_READ: [
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
  SPP_KOMITE: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'BENDAHARA',
    'BENDAHARA_KOMITE',
  ] as AppRole[],
  TABUNGAN: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'PENGELOLA_TABUNGAN',
  ] as AppRole[],
  HONORARIUM: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'BENDAHARA',
    'KEPALA_TU',
  ] as AppRole[],
  PERSURATAN: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  PERPUSTAKAAN: [
    'SUPERADMIN',
    'OPERATOR',
    'PUSTAKAWAN',
    'GURU',
    'STAF_TU',
  ] as AppRole[],
  BK: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'GURU_BK',
  ] as AppRole[],
  GURU_WALI: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'GURU_WALI',
    'WALI_KELAS',
    'GURU',
  ] as AppRole[],
  ALUMNI: [
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_HUMAS',
    'GURU_BK',
    'ALUMNI',
    'STAF_TU',
  ] as AppRole[],
  USER_MANAGEMENT: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
  ] as AppRole[],
  ADMIN_CONFIRM: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ] as AppRole[],
  SDM: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'KEPALA_TU',
    'STAF_TU',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_HUMAS',
  ] as AppRole[],
};

export async function requireApiRoles(allowedRoles: readonly AppRole[]): Promise<
  | { session: AuthenticatedSession; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Silakan login terlebih dahulu untuk mengakses fitur ini.' },
        { status: 401 }
      ),
    };
  }

  if (!hasAnyRole(session, allowedRoles)) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Akses ditolak. Peran akun Anda tidak memiliki izin untuk modul ini.' },
        { status: 403 }
      ),
    };
  }

  return { session, errorResponse: null };
}
