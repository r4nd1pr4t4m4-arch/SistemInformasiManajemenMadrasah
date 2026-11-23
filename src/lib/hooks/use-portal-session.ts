'use client';

import { useEffect, useState } from 'react';
import type { AppRole } from '@/types/database';
import type { TaughtSubjectMenu } from '@/lib/domain/penilaian';
import { hasRolePermission } from '@/lib/auth/rbac';

export interface PortalTeacherAssignments {
  teacherId: string;
  dutyCodes: string[];
  dutyNames: string[];
  homeroomClassroomIds?: string[];
  taughtClassroomIds?: string[];
  taughtSubjectIds?: string[];
  taughtSubjects?: TaughtSubjectMenu[];
  guruWaliStudentIds?: string[];
  isHomeroomTeacher: boolean;
  isGuruWali: boolean;
  isPicketTeacher: boolean;
  isPicketToday?: boolean;
  hasActiveExamPeriodToday?: boolean;
  isExamSupervisor: boolean;
  isExamCommittee: boolean;
}

export interface PortalSessionUser {
  userId: string;
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  primaryRole: AppRole;
  roles: AppRole[];
  teacherAssignments?: PortalTeacherAssignments | null;
}

let cachedUser: PortalSessionUser | null = null;
let inflightPromise: Promise<PortalSessionUser | null> | null = null;
let sessionVersion = 0;

export async function fetchPortalUser(): Promise<PortalSessionUser | null> {
  if (cachedUser) return cachedUser;
  if (!inflightPromise) {
    const versionAtStart = sessionVersion;
    inflightPromise = fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (versionAtStart !== sessionVersion) return null;
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
        if (versionAtStart === sessionVersion) {
          inflightPromise = null;
        }
      });
  }
  return inflightPromise;
}

export function clearPortalSessionCache() {
  sessionVersion += 1;
  cachedUser = null;
  inflightPromise = null;
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
