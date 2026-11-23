import { after } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { processPushQueueBatch } from '@/lib/notifications/queue-worker';
import { isWebPushConfigured } from '@/lib/notifications/vapid';
import type { AppRole } from '@/types/database';
import type {
  NotificationCategoryKey,
  NotificationCategoryRow,
  PushCampaignSourceType,
} from '@/lib/notifications/types';

export interface DispatchNotificationInput {
  categoryKey: NotificationCategoryKey;
  title: string;
  body: string;
  url?: string;
  iconUrl?: string | null;
  sourceType?: PushCampaignSourceType;
  createdBy?: string | null;
  scheduledAt?: string | null;
  dedupeKey?: string | null;
  dedupeWindowMinutes?: number;
  target: {
    userIds?: string[];
    roles?: AppRole[];
    classroomIds?: string[];
    includeAllUsers?: boolean;
    includePublicSubscribers?: boolean;
  };
  /** Jika true, langsung jalankan batch pertama secara sinkron (mis. untuk test push). */
  processImmediately?: boolean;
}

export interface DispatchNotificationResult {
  ok: boolean;
  campaignId: string | null;
  inAppCount: number;
  pushQueuedCount: number;
  skippedReason?: string;
}

function isWithinQuietHoursWib(quietStart: string, quietEnd: string): boolean {
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const currentMinutes = wibNow.getUTCHours() * 60 + wibNow.getUTCMinutes();

  const parseHm = (hm: string, fallback: number): number => {
    const parts = hm.split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1] ?? 0);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
    return Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m));
  };

  const startMin = parseHm(quietStart, 22 * 60);
  const endMin = parseHm(quietEnd, 5 * 60);

  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return currentMinutes >= startMin && currentMinutes < endMin;
  }
  // Melewati tengah malam (mis. 22:00 - 05:00)
  return currentMinutes >= startMin || currentMinutes < endMin;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function resolveTargetUserIds(
  target: DispatchNotificationInput['target']
): Promise<string[]> {
  const db = createSupabaseAdminClient();
  const userSet = new Set<string>();

  if (target.userIds && target.userIds.length > 0) {
    for (const uid of target.userIds) {
      if (uid) userSet.add(uid);
    }
  }

  if (target.includeAllUsers) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id')
      .eq('is_active', true);
    for (const p of profiles || []) {
      if (p.id) userSet.add(p.id as string);
    }
  }

  if (target.roles && target.roles.length > 0) {
    const [{ data: primaryRows }, { data: extraRows }] = await Promise.all([
      db
        .from('profiles')
        .select('id')
        .eq('is_active', true)
        .in('primary_role', target.roles),
      db.from('user_roles').select('user_id').in('role', target.roles),
    ]);

    for (const r of primaryRows || []) {
      if (r.id) userSet.add(r.id as string);
    }
    for (const r of extraRows || []) {
      if (r.user_id) userSet.add(r.user_id as string);
    }
  }

  if (target.classroomIds && target.classroomIds.length > 0) {
    // Ambil siswa di kelas tersebut + orang tua/wali mereka + wali kelas
    const { data: students } = await db
      .from('students')
      .select('id, profile_id')
      .in('classroom_id', target.classroomIds)
      .eq('status', 'AKTIF');

    const studentIds: string[] = [];
    for (const s of students || []) {
      if (s.id) studentIds.push(s.id as string);
      if (s.profile_id) userSet.add(s.profile_id as string);
    }

    if (studentIds.length > 0) {
      const { data: guardians } = await db
        .from('student_guardians')
        .select('profile_id')
        .in('student_id', studentIds);
      for (const g of guardians || []) {
        if (g.profile_id) userSet.add(g.profile_id as string);
      }
    }

    const { data: classrooms } = await db
      .from('classrooms')
      .select('homeroom_teacher_id')
      .in('id', target.classroomIds);
    const homeroomTeacherIds = (classrooms || [])
      .map((c) => c.homeroom_teacher_id as string | null)
      .filter((id): id is string => Boolean(id));

    if (homeroomTeacherIds.length > 0) {
      const { data: teachers } = await db
        .from('teachers_staff')
        .select('profile_id')
        .in('id', homeroomTeacherIds);
      for (const t of teachers || []) {
        if (t.profile_id) userSet.add(t.profile_id as string);
      }
    }
  }

  return Array.from(userSet);
}

/**
 * Dispatcher utama:
 * 1. Validasi kategori & kebijakan admin (allow_user_opt_out)
 * 2. Resolusi target user + pengunjung publik
 * 3. Filter preferensi user, jam tenang (WIB), dan deduplikasi
 * 4. Buat push_campaigns, bulk insert in_app_notifications & push_deliveries
 * 5. Proses batch pertama secara non-blocking via next/server after()
 */
export async function dispatchNotification(
  input: DispatchNotificationInput
): Promise<DispatchNotificationResult> {
  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      campaignId: null,
      inAppCount: 0,
      pushQueuedCount: 0,
      skippedReason: 'supabase_admin_not_configured',
    };
  }

  const db = createSupabaseAdminClient();
  const title = input.title.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 320);
  const url = (input.url || '/portal').trim() || '/portal';

  if (!title || !body) {
    return {
      ok: false,
      campaignId: null,
      inAppCount: 0,
      pushQueuedCount: 0,
      skippedReason: 'empty_title_or_body',
    };
  }

  const { data: categoryRow } = await db
    .from('notification_categories')
    .select('*')
    .eq('key', input.categoryKey)
    .maybeSingle();

  const category = (categoryRow as NotificationCategoryRow | null) ?? {
    key: input.categoryKey,
    label: input.categoryKey,
    description: '',
    default_enabled: true,
    allow_user_opt_out: true,
    is_public_eligible: false,
    sort_order: 0,
  };

  const resolvedUserIds = await resolveTargetUserIds(input.target);
  const includePublic = Boolean(
    input.target.includePublicSubscribers && category.is_public_eligible
  );

  if (resolvedUserIds.length === 0 && !includePublic) {
    return {
      ok: true,
      campaignId: null,
      inAppCount: 0,
      pushQueuedCount: 0,
      skippedReason: 'no_targets',
    };
  }

  // Ambil preferensi user, pengaturan jam tenang, dan dedupe jika perlu
  const userPrefMap = new Map<string, { push_enabled: boolean; in_app_enabled: boolean }>();
  const quietMap = new Map<string, { enabled: boolean; start: string; end: string }>();
  const dedupedUsers = new Set<string>();

  if (resolvedUserIds.length > 0) {
    const userChunks = chunkArray(resolvedUserIds, 200);
    for (const chunk of userChunks) {
      const [{ data: prefs }, { data: settings }] = await Promise.all([
        db
          .from('user_notification_preferences')
          .select('user_id, push_enabled, in_app_enabled')
          .eq('category_key', input.categoryKey)
          .in('user_id', chunk),
        db
          .from('user_notification_settings')
          .select('user_id, quiet_hours_enabled, quiet_start, quiet_end')
          .in('user_id', chunk),
      ]);

      for (const p of prefs || []) {
        userPrefMap.set(p.user_id as string, {
          push_enabled: Boolean(p.push_enabled),
          in_app_enabled: Boolean(p.in_app_enabled),
        });
      }
      for (const s of settings || []) {
        quietMap.set(s.user_id as string, {
          enabled: Boolean(s.quiet_hours_enabled),
          start: (s.quiet_start as string) || '22:00',
          end: (s.quiet_end as string) || '05:00',
        });
      }

      if (input.dedupeKey) {
        const sinceIso = new Date(
          Date.now() - (input.dedupeWindowMinutes ?? 10) * 60 * 1000
        ).toISOString();
        const { data: existing } = await db
          .from('in_app_notifications')
          .select('user_id')
          .eq('dedupe_key', input.dedupeKey)
          .gte('created_at', sinceIso)
          .in('user_id', chunk);

        for (const e of existing || []) {
          if (e.user_id) dedupedUsers.add(e.user_id as string);
        }
      }
    }
  }

  const eligibleInAppUserIds: string[] = [];
  const eligiblePushUserIds: string[] = [];

  for (const uid of resolvedUserIds) {
    if (dedupedUsers.has(uid)) continue;

    if (!category.allow_user_opt_out) {
      // Kategori dikunci admin -> selalu aktif untuk in-app & push (abaikan opt-out & jam tenang)
      eligibleInAppUserIds.push(uid);
      eligiblePushUserIds.push(uid);
      continue;
    }

    const pref = userPrefMap.get(uid);
    const inAppOn = pref ? pref.in_app_enabled : category.default_enabled;
    const pushOn = pref ? pref.push_enabled : category.default_enabled;

    if (inAppOn) eligibleInAppUserIds.push(uid);

    if (pushOn) {
      const quiet = quietMap.get(uid);
      const isQuietNow =
        quiet?.enabled && input.sourceType !== 'TEST'
          ? isWithinQuietHoursWib(quiet.start, quiet.end)
          : false;
      if (!isQuietNow) {
        eligiblePushUserIds.push(uid);
      }
    }
  }

  if (eligibleInAppUserIds.length === 0 && eligiblePushUserIds.length === 0 && !includePublic) {
    return {
      ok: true,
      campaignId: null,
      inAppCount: 0,
      pushQueuedCount: 0,
      skippedReason: 'filtered_out_by_prefs_or_dedupe',
    };
  }

  // Buat campaign induk
  const { data: campaignRow, error: campErr } = await db
    .from('push_campaigns')
    .insert({
      source_type: input.sourceType ?? 'SYSTEM_EVENT',
      category_key: input.categoryKey,
      title,
      body,
      url,
      icon_url: input.iconUrl ?? null,
      target_summary: {
        userCount: eligibleInAppUserIds.length,
        roles: input.target.roles ?? [],
        classroomIds: input.target.classroomIds ?? [],
        includeAllUsers: Boolean(input.target.includeAllUsers),
        includePublicSubscribers: includePublic,
      },
      status: 'QUEUED',
      scheduled_at: input.scheduledAt ?? null,
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single();

  if (campErr || !campaignRow?.id) {
    return {
      ok: false,
      campaignId: null,
      inAppCount: 0,
      pushQueuedCount: 0,
      skippedReason: campErr?.message || 'campaign_insert_failed',
    };
  }

  const campaignId = campaignRow.id as string;

  // Bulk insert in-app notifications & simpan peta userId -> inAppNotificationId
  const userInAppIdMap = new Map<string, string>();
  if (eligibleInAppUserIds.length > 0) {
    for (const chunk of chunkArray(eligibleInAppUserIds, 200)) {
      const rows = chunk.map((uid) => ({
        user_id: uid,
        category_key: input.categoryKey,
        campaign_id: campaignId,
        title,
        body,
        url,
        dedupe_key: input.dedupeKey ?? null,
      }));
      const { data: inserted } = await db
        .from('in_app_notifications')
        .insert(rows)
        .select('id, user_id');
      for (const item of inserted || []) {
        userInAppIdMap.set(item.user_id as string, item.id as string);
      }
    }
  }

  // Kumpulkan subscription push aktif (multi-device per user + publik jika eligible)
  const targetSubscriptions: Array<{ id: string; user_id: string | null }> = [];
  const seenSubIds = new Set<string>();

  if (eligiblePushUserIds.length > 0) {
    for (const chunk of chunkArray(eligiblePushUserIds, 200)) {
      const { data: subs } = await db
        .from('push_subscriptions')
        .select('id, user_id')
        .eq('is_active', true)
        .in('user_id', chunk);

      for (const s of subs || []) {
        const sid = s.id as string;
        if (!seenSubIds.has(sid)) {
          seenSubIds.add(sid);
          targetSubscriptions.push({ id: sid, user_id: (s.user_id as string | null) ?? null });
        }
      }
    }
  }

  if (includePublic) {
    const { data: publicSubs } = await db
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('is_active', true)
      .eq('audience_type', 'PUBLIC');

    for (const s of publicSubs || []) {
      const sid = s.id as string;
      if (!seenSubIds.has(sid)) {
        seenSubIds.add(sid);
        targetSubscriptions.push({ id: sid, user_id: null });
      }
    }
  }

  // Enqueue ke push_deliveries
  if (targetSubscriptions.length > 0) {
    for (const chunk of chunkArray(targetSubscriptions, 200)) {
      const deliveryRows = chunk.map((sub) => ({
        campaign_id: campaignId,
        subscription_id: sub.id,
        user_id: sub.user_id,
        in_app_notification_id: sub.user_id ? userInAppIdMap.get(sub.user_id) ?? null : null,
        status: 'PENDING',
      }));
      await db.from('push_deliveries').insert(deliveryRows);
    }

    await db
      .from('push_campaigns')
      .update({
        total_targets: targetSubscriptions.length,
        status: 'QUEUED',
      })
      .eq('id', campaignId);
  } else {
    await db
      .from('push_campaigns')
      .update({
        total_targets: 0,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
  }

  // Trigger batch pertama jika tidak dijadwalkan di masa depan & VAPID sudah dikonfigurasi
  const isFutureScheduled =
    input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now() + 5000;

  if (targetSubscriptions.length > 0 && !isFutureScheduled && isWebPushConfigured()) {
    const runBatch = async () => {
      try {
        await processPushQueueBatch({
          campaignId,
          batchSize: 40,
          maxBatches: 1,
          concurrency: 10,
          timeBudgetMs: 5500,
        });
      } catch {
        // Fail-safe: sisanya akan diproses oleh queue worker
      }
    };

    if (input.processImmediately) {
      await runBatch();
    } else {
      try {
        after(runBatch);
      } catch {
        // Fallback di luar request context (mis. cron)
        void runBatch();
      }
    }
  }

  return {
    ok: true,
    campaignId,
    inAppCount: userInAppIdMap.size,
    pushQueuedCount: targetSubscriptions.length,
  };
}
