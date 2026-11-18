'use client';

import { useEffect, useState } from 'react';
import type { AppRole } from '@/types/database';
import { hasRolePermission } from '@/lib/auth/rbac';

export interface PortalSessionUser {
  userId: string;
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  primaryRole: AppRole;
  roles: AppRole[];
}

let cachedUser: PortalSessionUser | null = null;
let inflightPromise: Promise<PortalSessionUser | null> | null = null;

async function fetchPortalUser(): Promise<PortalSessionUser | null> {
  if (cachedUser) return cachedUser;
  if (!inflightPromise) {
    inflightPromise = fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const u = data?.user ?? null;
        if (u) {
          cachedUser = {
            ...u,
            roles: u.roles && u.roles.length > 0 ? u.roles : [u.primaryRole],
          };
        }
        return cachedUser;
      })
      .catch(() => null)
      .finally(() => {
        inflightPromise = null;
      });
  }
  return inflightPromise;
}

export function clearPortalSessionCache() {
  cachedUser = null;
}

export function usePortalSession() {
  const [user, setUser] = useState<PortalSessionUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    let active = true;
    fetchPortalUser().then((u) => {
      if (!active) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const roles: AppRole[] = user
    ? user.roles && user.roles.length > 0
      ? user.roles
      : [user.primaryRole]
    : [];

  function hasPermission(allowedRoles: readonly AppRole[]): boolean {
    return hasRolePermission(roles, allowedRoles);
  }

  return { user, roles, loading, hasPermission };
}
