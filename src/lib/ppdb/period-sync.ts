import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_PATHWAY_QUOTAS,
  normalizePathwayDocumentsConfig,
  type PathwayDocumentsConfig,
  type PathwayQuotas,
} from '@/lib/ppdb/pathways';

export type PpdbScheduleStatus = 'BELUM_DIBUKA' | 'DIBUKA' | 'DITUTUP';

export interface SyncedPpdbPeriod {
  id: string;
  name: string;
  open_date: string;
  close_date: string;
  announcement_date: string | null;
  quota: number | null;
  pathway_quotas: PathwayQuotas;
  is_active: boolean;
  schedule_status: PpdbScheduleStatus;
  is_announcement_open: boolean;
}

export function getWibTodayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export function computePeriodSchedule(
  period: {
    open_date: string;
    close_date: string;
    announcement_date?: string | null;
  },
  todayWib: string
): {
  schedule_status: PpdbScheduleStatus;
  shouldBeActive: boolean;
  is_announcement_open: boolean;
} {
  const open = (period.open_date || '').slice(0, 10);
  const close = (period.close_date || '').slice(0, 10);
  const announce = (period.announcement_date || '').slice(0, 10);

  let schedule_status: PpdbScheduleStatus = 'DITUTUP';
  if (open && todayWib < open) {
    schedule_status = 'BELUM_DIBUKA';
  } else if (open && close && todayWib >= open && todayWib <= close) {
    schedule_status = 'DIBUKA';
  } else {
    schedule_status = 'DITUTUP';
  }

  return {
    schedule_status,
    shouldBeActive: schedule_status === 'DIBUKA',
    is_announcement_open: Boolean(announce && todayWib >= announce),
  };
}

/**
 * Menyinkronkan status `is_active` pada tabel `ppdb_periods` secara otomatis berdasarkan
 * tanggal buka (`open_date`) dan tanggal tutup (`close_date`) terhadap tanggal hari ini (WIB).
 * Juga mengembalikan periode aktif dan periode yang sudah memasuki tanggal pengumuman.
 */
export async function syncPpdbPeriodsBySchedule(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<{
  periods: SyncedPpdbPeriod[];
  activePeriod: SyncedPpdbPeriod | null;
  announcementPeriod: SyncedPpdbPeriod | null;
  todayWib: string;
}> {
  const todayWib = getWibTodayIso();
  const { data: rawPeriods, error } = await supabase
    .from('ppdb_periods')
    .select('*')
    .order('open_date', { ascending: false });

  if (error || !rawPeriods) {
    return {
      periods: [],
      activePeriod: null,
      announcementPeriod: null,
      todayWib,
    };
  }

  // Tentukan satu periode aktif (yang terbaru jika ada rentang tanggal bertumpuk)
  let chosenActiveId: string | null = null;
  for (const row of rawPeriods) {
    const { shouldBeActive } = computePeriodSchedule(row, todayWib);
    if (shouldBeActive && !chosenActiveId) {
      chosenActiveId = row.id as string;
    }
  }

  const updatesToActivate: string[] = [];
  const updatesToDeactivate: string[] = [];

  const synced: SyncedPpdbPeriod[] = rawPeriods.map((row) => {
    const id = row.id as string;
    const { schedule_status, is_announcement_open } = computePeriodSchedule(row, todayWib);
    const targetActive = id === chosenActiveId;

    if (Boolean(row.is_active) !== targetActive) {
      if (targetActive) {
        updatesToActivate.push(id);
      } else {
        updatesToDeactivate.push(id);
      }
    }

    return {
      id,
      name: String(row.name || ''),
      open_date: String(row.open_date || ''),
      close_date: String(row.close_date || ''),
      announcement_date: row.announcement_date ? String(row.announcement_date) : null,
      quota: row.quota != null ? Number(row.quota) : null,
      pathway_quotas: (row.pathway_quotas as PathwayQuotas | null) || DEFAULT_PATHWAY_QUOTAS,
      is_active: targetActive,
      schedule_status,
      is_announcement_open,
    };
  });

  // Persist perubahan status otomatis ke DB (best-effort)
  await Promise.all([
    updatesToDeactivate.length > 0
      ? supabase
          .from('ppdb_periods')
          .update({ is_active: false })
          .in('id', updatesToDeactivate)
      : Promise.resolve(),
    updatesToActivate.length > 0
      ? supabase
          .from('ppdb_periods')
          .update({ is_active: true })
          .in('id', updatesToActivate)
      : Promise.resolve(),
  ]);

  const activePeriod = synced.find((p) => p.is_active) || null;
  // Periode pengumuman: periode terbaru yang sudah memasuki tanggal pengumuman (todayWib >= announcement_date)
  const announcementPeriod =
    synced.find((p) => p.is_announcement_open) || null;

  return {
    periods: synced,
    activePeriod,
    announcementPeriod,
    todayWib,
  };
}

/**
 * Membaca konfigurasi standar dokumen persyaratan per jalur dari `institution_settings`
 * (dengan fallback aman ke `social_links._ppdb_pathway_documents` jika kolom baru belum dimigrasi).
 */
export async function loadPpdbPathwayDocuments(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<PathwayDocumentsConfig> {
  const { data } = await supabase
    .from('institution_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!data) {
    return normalizePathwayDocumentsConfig(null);
  }

  const rawFromCol = (data as Record<string, unknown>).ppdb_pathway_documents;
  if (rawFromCol && typeof rawFromCol === 'object') {
    return normalizePathwayDocumentsConfig(rawFromCol);
  }

  const socialLinks =
    data.social_links && typeof data.social_links === 'object'
      ? (data.social_links as Record<string, unknown>)
      : null;
  if (socialLinks?._ppdb_pathway_documents) {
    return normalizePathwayDocumentsConfig(socialLinks._ppdb_pathway_documents);
  }

  return normalizePathwayDocumentsConfig(null);
}

export async function savePpdbPathwayDocuments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  config: PathwayDocumentsConfig
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizePathwayDocumentsConfig(config);
  const { data: existing } = await supabase
    .from('institution_settings')
    .select('id, social_links')
    .limit(1)
    .maybeSingle();

  if (!existing?.id) {
    return { ok: false, error: 'Pengaturan lembaga belum tersedia.' };
  }

  // Coba simpan ke kolom dedicated `ppdb_pathway_documents`
  const { error: colErr } = await supabase
    .from('institution_settings')
    .update({ ppdb_pathway_documents: normalized })
    .eq('id', existing.id);

  if (!colErr) {
    return { ok: true };
  }

  // Fallback jika kolom belum dimigrasi: simpan di social_links._ppdb_pathway_documents
  const currentSocial =
    existing.social_links && typeof existing.social_links === 'object'
      ? (existing.social_links as Record<string, unknown>)
      : {};
  const { error: fallbackErr } = await supabase
    .from('institution_settings')
    .update({
      social_links: {
        ...currentSocial,
        _ppdb_pathway_documents: normalized,
      },
    })
    .eq('id', existing.id);

  if (fallbackErr) {
    return { ok: false, error: fallbackErr.message };
  }
  return { ok: true };
}
