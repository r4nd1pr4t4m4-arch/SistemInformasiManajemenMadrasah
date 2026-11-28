import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

type ActivityStatus = 'ACTIVE' | 'IDLE' | 'STALE' | 'NOT_INSTALLED';

interface RawProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  primary_role: string | null;
  account_status?: string | null;
}

interface RawInstallRow {
  id: string;
  user_id: string;
  device_id: string;
  platform: string;
  device_label: string;
  install_source: string;
  display_mode: string;
  launch_count: number;
  installed_at: string;
  last_seen_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function safeTimeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function computeActivityStatus(lastSeenAt: string | null, nowMs: number): ActivityStatus {
  const seenMs = safeTimeMs(lastSeenAt);
  if (!seenMs) return 'NOT_INSTALLED';
  const diffDays = (nowMs - seenMs) / DAY_MS;
  if (diffDays <= 14) return 'ACTIVE';
  if (diffDays <= 30) return 'IDLE';
  return 'STALE';
}

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.PWA_MONITORING_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const sp = request.nextUrl.searchParams;
    const statusFilter = (sp.get('status') || 'ALL').toUpperCase();
    const roleFilter = (sp.get('role') || 'ALL').toUpperCase();
    const platformFilter = sp.get('platform') || 'ALL';
    const q = (sp.get('q') || '').trim().toLowerCase();
    const exportAll = sp.get('exportAll') === '1';
    const page = Math.max(1, Number(sp.get('page') || 1) || 1);
    const pageSize = exportAll
      ? 5000
      : Math.min(100, Math.max(10, Number(sp.get('pageSize') || 25) || 25));

    const [profilesRes, installsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, primary_role, account_status')
        .order('full_name', { ascending: true }),
      supabase
        .from('pwa_installations')
        .select(
          'id, user_id, device_id, platform, device_label, install_source, display_mode, launch_count, installed_at, last_seen_at'
        )
        .order('last_seen_at', { ascending: false }),
    ]);

    if (profilesRes.error) {
      return NextResponse.json({ error: sanitizeApiError(profilesRes.error) }, { status: 500 });
    }
    if (installsRes.error) {
      return NextResponse.json({ error: sanitizeApiError(installsRes.error) }, { status: 500 });
    }

    const profiles = ((profilesRes.data || []) as RawProfileRow[]).filter(
      (p) => (p.account_status || 'APPROVED') !== 'REJECTED'
    );
    const validProfileIds = new Set(profiles.map((p) => p.id));
    const installs = ((installsRes.data || []) as RawInstallRow[]).filter((row) =>
      validProfileIds.has(row.user_id)
    );

    const installsByUser = new Map<string, RawInstallRow[]>();
    const platformBreakdown: Record<string, number> = {
      'android-chrome': 0,
      'ios-safari': 0,
      'desktop-chromium': 0,
      'desktop-safari': 0,
      other: 0,
    };

    for (const row of installs) {
      const list = installsByUser.get(row.user_id) || [];
      list.push(row);
      installsByUser.set(row.user_id, list);
      platformBreakdown[row.platform] = (platformBreakdown[row.platform] || 0) + 1;
    }

    const nowMs = Date.now();
    const roleStatsMap = new Map<string, { role: string; total: number; installed: number }>();

    const allAggregated = profiles.map((p) => {
      const userDevices = installsByUser.get(p.id) || [];
      const isInstalled = userDevices.length > 0;
      const sortedByInstalled = [...userDevices].sort(
        (a, b) => safeTimeMs(a.installed_at) - safeTimeMs(b.installed_at)
      );
      const firstInstalledAt = sortedByInstalled[0]?.installed_at || null;
      const lastSeenAt = userDevices[0]?.last_seen_at || null;
      const totalLaunches = userDevices.reduce((sum, d) => sum + Number(d.launch_count || 0), 0);
      const platforms = Array.from(new Set(userDevices.map((d) => d.platform)));
      const activityStatus = computeActivityStatus(lastSeenAt, nowMs);
      const roleKey = (p.primary_role || 'UMUM').toUpperCase();

      const roleStat = roleStatsMap.get(roleKey) || { role: roleKey, total: 0, installed: 0 };
      roleStat.total += 1;
      if (isInstalled) roleStat.installed += 1;
      roleStatsMap.set(roleKey, roleStat);

      return {
        user_id: p.id,
        full_name: p.full_name || 'Tanpa Nama',
        email: p.email || null,
        phone: p.phone || null,
        primary_role: roleKey,
        is_installed: isInstalled,
        device_count: userDevices.length,
        platforms,
        devices: userDevices,
        first_installed_at: firstInstalledAt,
        last_seen_at: lastSeenAt,
        total_launches: totalLaunches,
        activity_status: activityStatus,
      };
    });

    const totalUsers = allAggregated.length;
    const installedUsers = allAggregated.filter((u) => u.is_installed).length;
    const notInstalledUsers = totalUsers - installedUsers;
    const activeLast14Days = allAggregated.filter((u) => u.activity_status === 'ACTIVE').length;
    const staleOver30Days = allAggregated.filter((u) => u.activity_status === 'STALE').length;
    const adoptionRatePercent =
      totalUsers > 0 ? Math.round((installedUsers / totalUsers) * 1000) / 10 : 0;

    const roleBreakdown = Array.from(roleStatsMap.values())
      .map((r) => ({
        ...r,
        percentage: r.total > 0 ? Math.round((r.installed / r.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const filtered = allAggregated.filter((u) => {
      if (statusFilter === 'INSTALLED' && !u.is_installed) return false;
      if (statusFilter === 'NOT_INSTALLED' && u.is_installed) return false;
      if (statusFilter === 'ACTIVE_14D' && u.activity_status !== 'ACTIVE') return false;
      if (statusFilter === 'INACTIVE_30D' && u.activity_status !== 'STALE') return false;

      if (roleFilter !== 'ALL' && u.primary_role !== roleFilter) return false;
      if (platformFilter !== 'ALL' && !u.platforms.includes(platformFilter)) return false;

      if (q) {
        const hay = `${u.full_name} ${u.email || ''} ${u.phone || ''} ${u.primary_role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Urutkan: yang sudah install & terbaru aktif di atas, lalu alfabetis
    filtered.sort((a, b) => {
      if (a.is_installed !== b.is_installed) return a.is_installed ? -1 : 1;
      if (a.last_seen_at && b.last_seen_at) {
        const diff = safeTimeMs(b.last_seen_at) - safeTimeMs(a.last_seen_at);
        if (diff !== 0) return diff;
      }
      return a.full_name.localeCompare(b.full_name, 'id-ID');
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const items = filtered.slice(startIdx, startIdx + pageSize);

    return NextResponse.json({
      summary: {
        totalUsers,
        installedUsers,
        notInstalledUsers,
        adoptionRatePercent,
        activeLast14Days,
        staleOver30Days,
        totalDevices: installs.length,
        platformBreakdown,
        roleBreakdown,
      },
      pagination: {
        page: safePage,
        pageSize,
        totalItems: totalFiltered,
        totalPages,
      },
      items,
    });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeApiError(err, 'Gagal memuat data monitoring instalasi PWA.') },
      { status: 500 }
    );
  }
}
