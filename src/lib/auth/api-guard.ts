import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles, hasAnyRole, type AuthenticatedSession } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import type { AppRole } from '@/types/database';

export { PERMISSIONS };

export const ROLE_GROUPS = {
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
  ADMIN_CONFIRM: [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
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
