import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export interface AuthenticatedSession {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  primaryRole: AppRole;
  roles: AppRole[];
}

export async function getCurrentUserWithRoles(): Promise<AuthenticatedSession | null> {
  if (!isSupabaseServerConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, primary_role, email, avatar_url, is_active, account_status')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.is_active || (profile.account_status && profile.account_status !== 'AKTIF')) {
      return null;
    }

    const { data: extraRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const primaryRole = (profile?.primary_role as AppRole) || 'UMUM';
    const rolesSet = new Set<AppRole>([primaryRole]);
    for (const row of extraRoles || []) {
      rolesSet.add(row.role as AppRole);
    }

    return {
      userId: user.id,
      email: user.email ?? profile?.email ?? null,
      fullName: profile?.full_name || user.email || 'Pengguna',
      avatarUrl: profile?.avatar_url ?? null,
      primaryRole,
      roles: Array.from(rolesSet),
    };
  } catch {
    return null;
  }
}

export function hasAnyRole(
  session: AuthenticatedSession | null,
  allowed: AppRole[]
): boolean {
  if (!session) return false;
  return session.roles.some((r) => allowed.includes(r));
}

export const CMS_MANAGER_ROLES: AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_HUMAS',
  'STAF_TU',
  'KEPALA_TU',
];
