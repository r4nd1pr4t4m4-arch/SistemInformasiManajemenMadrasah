'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { InstitutionLogo } from '@/components/ui/institution-logo';
import { LoadingState, PermissionDeniedState } from '@/components/ui/state-views';
import {
  PortalCommandPalette,
  type CommandPaletteItem,
} from '@/components/layout/portal-command-palette';
import { PortalMobileNav } from '@/components/layout/portal-mobile-nav';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Globe,
  LayoutDashboard,
  Loader2,
  LogOut,
  Search,
  X,
} from 'lucide-react';
import type { AppRole } from '@/types/database';
import { PERMISSIONS, canAccessPortalPath, hasRolePermission } from '@/lib/auth/rbac';
import {
  clearPortalSessionCache,
  fetchPortalUser,
  type PortalSessionUser,
} from '@/lib/hooks/use-portal-session';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';
import { usePwa } from '@/components/providers/pwa-provider';
import { InstallPwaModal } from '@/components/pwa/install-pwa-modal';
import {
  clearOfflineQueue,
  clearServiceWorkerAuthCaches,
} from '@/lib/pwa/offline-sync';
import { deactivateCurrentDevicePush } from '@/lib/pwa/push-client';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MandatoryPushModal } from '@/components/notifications/mandatory-push-modal';
import {
  ACCORDION_GROUPS,
  MANDATORY_MOBILE_PWA_ROLES,
  PAGE_TITLES,
  buildDynamicPenilaianGroups,
  type AccordionGroup,
  type NavItem,
  type TeacherDutyRequirement,
} from '@/config/portal-navigation';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [queryParams, setQueryParams] = useState<{
    chapterId: string | null;
    classroomId: string | null;
  }>({ chapterId: null, classroomId: null });

  // Sinkronkan query chapterId & classroomId di klien tanpa useSearchParams/Suspense SSR bailout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncParams = () => {
      const sp = new URLSearchParams(window.location.search);
      const nextChapterId = sp.get('chapterId');
      const nextClassroomId = sp.get('classroomId');
      setQueryParams((prev) =>
        prev.chapterId === nextChapterId && prev.classroomId === nextClassroomId
          ? prev
          : { chapterId: nextChapterId, classroomId: nextClassroomId }
      );
    };
    syncParams();
    window.addEventListener('popstate', syncParams);
    return () => window.removeEventListener('popstate', syncParams);
  }, [pathname]);
  const school = useInstitutionSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<PortalSessionUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null);
  const logoutDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(logoutDialogRef, logoutModalOpen);

  // Pintasan keyboard global Ctrl+K / Cmd+K untuk Command Palette
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const loadMe = () => {
      fetchPortalUser()
        .then((u) => {
          if (active && u) setUser(u);
        })
        .finally(() => {
          if (active) setAuthLoaded(true);
        });
    };
    loadMe();

    const onChaptersUpdated = () => {
      clearPortalSessionCache();
      loadMe();
    };
    window.addEventListener('penilaian-chapters-updated', onChaptersUpdated);
    return () => {
      active = false;
      window.removeEventListener('penilaian-chapters-updated', onChaptersUpdated);
    };
  }, []);

  // Close mobile drawer / logout modal on Escape (scroll lock is managed globally via CSS :has)
  useEffect(() => {
    if (!sidebarOpen && !logoutModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (logoutModalOpen && !loggingOut) {
          setLogoutModalOpen(false);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sidebarOpen, logoutModalOpen, loggingOut]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      clearPortalSessionCache();
      await Promise.all([
        clearOfflineQueue(),
        clearServiceWorkerAuthCaches(),
        deactivateCurrentDevicePush('LOGOUT'),
      ]);
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  const userRoles = useMemo<AppRole[]>(
    () =>
      user
        ? user.roles && user.roles.length > 0
          ? user.roles
          : [user.primaryRole]
        : [],
    [user]
  );

  const pwa = usePwa();
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  const needsMandatoryMobilePwa =
    authLoaded &&
    pwa.ready &&
    Boolean(user) &&
    pwa.isMobileDevice &&
    !pwa.isStandalone &&
    userRoles.some((role) => MANDATORY_MOBILE_PWA_ROLES.includes(role));

  async function handleDesktopFooterInstall() {
    if (pwa.canInstallPrompt) {
      const outcome = await pwa.triggerInstallPrompt();
      if (outcome !== 'unavailable') return;
    }
    setInstallGuideOpen(true);
  }

  const matchesTeacherDuty = useCallback(
    (req?: TeacherDutyRequirement): boolean => {
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
    },
    [user?.teacherAssignments]
  );

  const hasRoleAccess = useCallback(
    (item: NavItem): boolean => {
      if (!authLoaded || userRoles.length === 0) return false;
      if (!item.allowedRoles && !item.requireTeacherDuty) return true;
      if (item.allowedRoles && hasRolePermission(userRoles, item.allowedRoles)) {
        return true;
      }
      if (item.requireTeacherDuty && matchesTeacherDuty(item.requireTeacherDuty)) {
        return true;
      }
      return false;
    },
    [authLoaded, userRoles, matchesTeacherDuty]
  );

  const canAccessCurrentView = useCallback(
    (targetPath: string): boolean => {
      const ta = user?.teacherAssignments;
      const taughtSubjectIds = (ta?.taughtSubjects || []).map((s) => s.subjectId);
      if (
        !canAccessPortalPath(targetPath, userRoles, {
          isPicketTeacher: Boolean(ta?.isPicketTeacher),
          isExamSupervisor: Boolean(ta?.isExamSupervisor),
          isExamCommittee: Boolean(ta?.isExamCommittee),
          taughtSubjectIds,
        })
      ) {
        return false;
      }
      let matchedAnyNavRule = false;
      for (const grp of ACCORDION_GROUPS) {
        for (const it of grp.items) {
          if (it.path === targetPath) {
            matchedAnyNavRule = true;
            if (hasRoleAccess(it)) return true;
          }
          if (it.children) {
            for (const ch of it.children) {
              if (ch.path === targetPath) {
                matchedAnyNavRule = true;
                if (hasRoleAccess(it) && hasRoleAccess(ch)) return true;
              }
            }
          }
        }
      }
      return !matchedAnyNavRule;
    },
    [user?.teacherAssignments, userRoles, hasRoleAccess]
  );

  function isItemActive(item: NavItem): boolean {
    if (item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`))) {
      return true;
    }
    if (item.children) {
      return item.children.some((child) => isItemActive(child));
    }
    return false;
  }

  const dynamicPenilaianGroups = useMemo(
    () => buildDynamicPenilaianGroups(user?.teacherAssignments?.taughtSubjects || []),
    [user?.teacherAssignments?.taughtSubjects]
  );

  const canAccessMenuHref = useCallback(
    (href?: string): boolean => {
      if (!authLoaded || !user || userRoles.length === 0 || !href) return false;
      const cleanPath = href.split('?')[0].replace(/\/$/, '') || '/portal';
      return canAccessCurrentView(cleanPath);
    },
    [authLoaded, user, userRoles.length, canAccessCurrentView]
  );

  const visibleGroups = useMemo(
    () => [
      ...ACCORDION_GROUPS.map((group) => ({
        ...group,
        items: group.items
          .filter((item) => hasRoleAccess(item) && (!item.href || canAccessMenuHref(item.href)))
          .map((item) =>
            item.children
              ? {
                  ...item,
                  children: item.children.filter(
                    (ch) => hasRoleAccess(ch) && (!ch.href || canAccessMenuHref(ch.href))
                  ),
                }
              : item
          )
          .filter((item) => !item.children || item.children.length > 0),
      })).filter((g) => g.items.length > 0),
      ...dynamicPenilaianGroups,
    ],
    [hasRoleAccess, canAccessMenuHref, dynamicPenilaianGroups]
  );

  const commandItems: CommandPaletteItem[] = (() => {
    if (!authLoaded || !user || userRoles.length === 0) return [];
    const seen = new Set<string>();
    const raw: CommandPaletteItem[] = [
      {
        href: '/portal',
        label: 'Dashboard Portal',
        group: 'Utama',
        keywords: 'beranda home ringkasan',
      },
      ...visibleGroups.flatMap((grp) =>
        grp.items.flatMap((it) => {
          if (it.children && it.children.length > 0) {
            return it.children
              .filter((ch) => Boolean(ch.href) && canAccessMenuHref(ch.href))
              .map((ch) => ({
                href: ch.href!,
                label: ch.label,
                group: `${grp.label} • ${it.label}`,
                keywords: `${grp.label} ${it.label} ${ch.label}`,
              }));
          }
          return it.href && canAccessMenuHref(it.href)
            ? [
              {
                href: it.href,
                label: it.label,
                group: grp.label,
                keywords: `${grp.label} ${it.label}`,
              },
            ]
            : [];
        })
      ),
    ];

    return raw.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  })();

  const normalizedSearch = menuSearch.trim().toLowerCase();
  const filteredVisibleGroups = useMemo(() => {
    if (!normalizedSearch) return visibleGroups;
    return visibleGroups
      .map((group) => {
        const groupMatches = group.label.toLowerCase().includes(normalizedSearch);
        if (groupMatches) return group;
        const matchedItems = group.items
          .map((item) => {
            const itemMatches = item.label.toLowerCase().includes(normalizedSearch);
            if (itemMatches) return item;
            if (item.children) {
              const matchedChildren = item.children.filter((ch) =>
                ch.label.toLowerCase().includes(normalizedSearch)
              );
              if (matchedChildren.length > 0) {
                return { ...item, children: matchedChildren };
              }
            }
            return null;
          })
          .filter((item): item is NavItem => item !== null);
        return matchedItems.length > 0 ? { ...group, items: matchedItems } : null;
      })
      .filter((g): g is AccordionGroup => g !== null);
  }, [visibleGroups, normalizedSearch]);

  const currentChapterId = queryParams.chapterId;
  const currentClassroomId = queryParams.classroomId;
  const normalizedPath = pathname.replace(/\/$/, '') || '/portal';
  const pageTitle =
    PAGE_TITLES[normalizedPath] ||
    (normalizedPath.startsWith('/portal/penilaian/') ? 'Penilaian Mata Pelajaran' : 'Portal Terpadu');
  const [currentYear, setCurrentYear] = useState(2026);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCurrentYear(new Date().getFullYear());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-200/70 flex items-center justify-between gap-2">
        <Link href="/portal" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 min-w-0">
          <InstitutionLogo
            logoUrl={school.logo_url}
            alt={school.name || 'Logo Lembaga'}
            className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200/80 p-0.5 shadow-sm shrink-0"
            fallback={
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            }
          />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm leading-tight truncate">
              {school.short_name || school.name || 'SiM-M Portal'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">Sistem Informasi Terpadu</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup Menu Sidebar"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Menu Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Cari menu cepat..."
            aria-label="Cari menu portal"
            className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200/80 bg-white/85 text-sm lg:text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {menuSearch && (
            <button
              type="button"
              onClick={() => setMenuSearch('')}
              aria-label="Hapus pencarian menu"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {/* Dashboard Link */}
        {(!normalizedSearch || 'dashboard'.includes(normalizedSearch)) && (
          <Link
            href="/portal"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${pathname === '/portal'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-white/80 hover:text-emerald-700'
              }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </Link>
        )}

        {/* Accordion Menu Groups */}
        <div className="pt-1 space-y-1.5">
          {filteredVisibleGroups.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-slate-400">
              Menu tidak ditemukan.
            </p>
          ) : (
            filteredVisibleGroups.map((group) => {
              const hasActiveChild = group.items.some((item) => isItemActive(item));
              const isOpen = normalizedSearch
                ? true
                : openGroups[group.id] ?? hasActiveChild;

              return (
                <div key={group.id} className="rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition ${hasActiveChild
                      ? 'bg-emerald-50/90 text-emerald-800'
                      : 'text-slate-700 hover:bg-white/80 hover:text-emerald-700'
                      }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 text-left">
                      <span className="shrink-0">{group.icon}</span>
                      <span className="text-left leading-snug">{group.label}</span>
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l border-slate-200/80 space-y-1">
                      {group.items.map((item) => {
                        if (item.children && item.children.length > 0) {
                          const subId = item.id || item.label;
                          const hasActiveSubChild = item.children.some((c) => isItemActive(c));
                          const isSubOpen = normalizedSearch
                            ? true
                            : openGroups[subId] ?? hasActiveSubChild;

                          return (
                            <div key={subId} className="rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleGroup(subId)}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${hasActiveSubChild
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
                                    const subParams = subItem.href?.includes('?')
                                      ? new URLSearchParams(subItem.href.split('?')[1])
                                      : null;
                                    const subHrefChapter = subParams?.get('chapterId') ?? null;
                                    const subHrefClassroom = subParams?.get('classroomId') ?? null;
                                    const isSubActive = subHrefChapter
                                      ? pathname === subItem.path &&
                                      currentChapterId === subHrefChapter &&
                                      (!subHrefClassroom ||
                                        !currentClassroomId ||
                                        currentClassroomId === subHrefClassroom)
                                      : pathname === subItem.path;
                                    return (
                                      <Link
                                        key={subItem.href}
                                        href={subItem.href || '#'}
                                        onClick={() => setSidebarOpen(false)}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition ${isSubActive
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
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition ${isActive
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
            })
          )}
        </div>
      </div>

      <div className="p-3 border-t border-slate-200/70 space-y-1.5">
        {user && (
          <Link
            href="/portal/akun/profil"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold shrink-0">
              {(user.fullName || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{user.fullName}</p>
              <p className="text-[10px] font-semibold text-emerald-700 truncate">
                {user.primaryRole}
              </p>
            </div>
          </Link>
        )}
        <Link
          href="/"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white/80 hover:text-emerald-700 transition"
        >
          <Globe className="w-4 h-4 shrink-0" />
          <span>Lihat Website Resmi</span>
        </Link>
      </div>
    </div>
  );

  if (needsMandatoryMobilePwa) {
    return (
      <div className="min-h-screen simms-ambient">
        <InstallPwaModal
          open
          mode="mandatory"
          platform={pwa.platform}
          canInstallPrompt={pwa.canInstallPrompt}
          institutionName="SiM-M"
          onTriggerInstall={pwa.triggerInstallPrompt}
          onLogout={() => void handleLogout()}
        />
      </div>
    );
  }

  const isPortalReady = authLoaded && pwa.ready;
  const isAuthorizedView = isPortalReady && canAccessCurrentView(normalizedPath);

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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-emerald-700 focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
        >
          Lewati ke konten utama
        </a>
        {/* Top Portal Navbar */}
        <header className="sticky top-0 z-30 glass-nav h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="truncate">
              <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
                {pageTitle}
              </p>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Portal Administrasi, Akademik &amp; Layanan Lembaga
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Buka pencarian cepat menu (Ctrl+K)"
              title="Pencarian Cepat Menu (Ctrl+K)"
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/85 hover:bg-white border border-slate-200/80 text-xs font-medium text-slate-600 transition"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Cari menu...</span>
              <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
                Ctrl K
              </kbd>
            </button>
            {user && (
              <NotificationBell
                userId={user.userId}
                canManageDashboard={hasRolePermission(
                  userRoles,
                  PERMISSIONS.NOTIFIKASI_DASHBOARD
                )}
              />
            )}
            {user && (
              <Link
                href="/portal/akun/profil"
                aria-label="Profil Akun"
                className="flex items-center gap-2.5 bg-white/85 hover:bg-white border border-slate-200/80 rounded-xl p-1.5 sm:px-3 sm:py-1.5 transition"
              >
                {user.avatarUrl &&
                brokenAvatarUrl !== user.avatarUrl &&
                /^(https?:\/\/|\/|data:image\/)/i.test(user.avatarUrl.trim()) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.avatarUrl.trim()}
                    alt={user.fullName}
                    width={28}
                    height={28}
                    onError={() => setBrokenAvatarUrl(user.avatarUrl || null)}
                    className="w-7 h-7 rounded-full object-cover border border-emerald-200 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold shrink-0">
                    {(user.fullName || 'U').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight max-w-[160px] truncate">
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
        <main id="main-content" className="flex-1 p-4 sm:p-6">
          {!isPortalReady && (
            <LoadingState
              variant="page"
              title="Memverifikasi Hak Akses..."
              description="Sistem sedang memeriksa sesi dan izin peran akun Anda."
            />
          )}
          {isPortalReady && !canAccessCurrentView(normalizedPath) && (
            <div className="mt-6">
              <PermissionDeniedState currentRoles={userRoles} />
            </div>
          )}
          {isAuthorizedView && user && (
            <MandatoryPushModal
              audienceType="USER"
              institutionName={school.short_name || school.name || 'SiM-M'}
              onLogout={() => void handleLogout()}
            />
          )}
          <div
            className={isAuthorizedView ? undefined : 'hidden'}
            aria-hidden={!isAuthorizedView || undefined}
          >
            {children}
          </div>
        </main>

        {/* Portal Footer */}
        <footer className="border-t border-slate-200/70 bg-white/70 backdrop-blur px-4 sm:px-6 pt-4 pb-20 lg:pb-4 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>© {currentYear} SiM-M — Sistem Informasi Manajemen Madrasah &amp; Sekolah</span>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-medium">
            <Link href="/" className="hover:text-emerald-700 transition">
              Website Resmi
            </Link>
            <Link href="/verifikasi" className="hover:text-emerald-700 transition">
              Verifikasi QR
            </Link>
            <Link href="/portal/akun/profil" className="hover:text-emerald-700 transition">
              Profil Akun
            </Link>
            {!pwa.isStandalone && (
              <button
                type="button"
                onClick={() => void handleDesktopFooterInstall()}
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 font-semibold transition"
              >
                <Download className="w-3 h-3" />
                <span>Install Aplikasi</span>
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Command Palette (Ctrl+K / Cmd+K) */}
      <PortalCommandPalette
        open={commandOpen && authLoaded && Boolean(user)}
        onClose={() => setCommandOpen(false)}
        items={commandItems}
      />

      {/* Mobile Bottom Navigation Bar */}
      {authLoaded && (
        <PortalMobileNav
          pathname={normalizedPath}
          userRoles={userRoles}
          isPicketToday={Boolean(user?.teacherAssignments?.isPicketToday)}
          hasActiveExamPeriodToday={Boolean(user?.teacherAssignments?.hasActiveExamPeriodToday)}
          onOpenMenu={() => setSidebarOpen(true)}
        />
      )}

      {/* Modal Panduan Install PWA Desktop */}
      <InstallPwaModal
        open={installGuideOpen}
        mode="guide"
        platform={pwa.platform}
        canInstallPrompt={pwa.canInstallPrompt}
        institutionName="SiM-M"
        onTriggerInstall={pwa.triggerInstallPrompt}
        onClose={() => setInstallGuideOpen(false)}
      />

      {/* Modal Konfirmasi Logout */}
      {logoutModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
          onClick={() => {
            if (!loggingOut) setLogoutModalOpen(false);
          }}
        >
          <div
            ref={logoutDialogRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90dvh] overflow-y-auto"
          >
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
                aria-busy={loggingOut || undefined}
                disabled={loggingOut}
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 transition"
              >
                {loggingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{loggingOut ? 'Mengakhiri Sesi...' : 'Ya, Keluar Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
