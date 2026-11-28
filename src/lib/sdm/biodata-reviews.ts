import type { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyUserDirect } from '@/lib/notifications/event-hooks';
import {
  ADDRESS_GROUP_COLUMNS,
  getReviewTargetLabel,
  type ReviewEntityType,
  type ReviewStatus,
  type ReviewTargetKind,
} from './biodata-review-registry';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export interface BiodataReviewRecord {
  id: string;
  entity_type: ReviewEntityType;
  entity_id: string;
  target_kind: ReviewTargetKind;
  target_key: string;
  status: ReviewStatus;
  comment: string;
  previous_value: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  resolved_by: string | null;
  revised_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeComparable(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).join(', ');
  return String(val).trim();
}

export async function fetchActiveBiodataReviews(
  supabase: AdminClient,
  entityType: ReviewEntityType,
  entityId: string
): Promise<BiodataReviewRecord[]> {
  if (!entityId) return [];
  const { data, error } = await supabase
    .from('sdm_biodata_reviews')
    .select('*, creator:profiles!sdm_biodata_reviews_created_by_fkey(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .in('status', ['OPEN', 'REVISED'])
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    return {
      id: row.id as string,
      entity_type: row.entity_type as ReviewEntityType,
      entity_id: row.entity_id as string,
      target_kind: row.target_kind as ReviewTargetKind,
      target_key: row.target_key as string,
      status: row.status as ReviewStatus,
      comment: row.comment as string,
      previous_value: (row.previous_value as string | null) ?? null,
      created_by: (row.created_by as string | null) ?? null,
      created_by_name: (creator as { full_name?: string } | null)?.full_name ?? null,
      resolved_by: (row.resolved_by as string | null) ?? null,
      revised_at: (row.revised_at as string | null) ?? null,
      resolved_at: (row.resolved_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  });
}

export async function fetchActiveBiodataReviewsForEntities(
  supabase: AdminClient,
  entityType: ReviewEntityType,
  entityIds: string[]
): Promise<Record<string, BiodataReviewRecord[]>> {
  const uniqueIds = Array.from(new Set(entityIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('sdm_biodata_reviews')
    .select('*, creator:profiles!sdm_biodata_reviews_created_by_fkey(full_name)')
    .eq('entity_type', entityType)
    .in('entity_id', uniqueIds)
    .in('status', ['OPEN', 'REVISED'])
    .order('updated_at', { ascending: false });

  if (error || !data) return {};

  const grouped: Record<string, BiodataReviewRecord[]> = {};
  for (const row of data) {
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    const entityId = row.entity_id as string;
    if (!grouped[entityId]) grouped[entityId] = [];
    grouped[entityId].push({
      id: row.id as string,
      entity_type: row.entity_type as ReviewEntityType,
      entity_id: entityId,
      target_kind: row.target_kind as ReviewTargetKind,
      target_key: row.target_key as string,
      status: row.status as ReviewStatus,
      comment: row.comment as string,
      previous_value: (row.previous_value as string | null) ?? null,
      created_by: (row.created_by as string | null) ?? null,
      created_by_name: (creator as { full_name?: string } | null)?.full_name ?? null,
      resolved_by: (row.resolved_by as string | null) ?? null,
      revised_at: (row.revised_at as string | null) ?? null,
      resolved_at: (row.resolved_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    });
  }
  return grouped;
}

export async function markChangedFieldsAsRevised(
  supabase: AdminClient,
  entityType: ReviewEntityType,
  entityId: string,
  oldRecord: Record<string, unknown> | null | undefined,
  newRecord: Record<string, unknown> | null | undefined
): Promise<number> {
  if (!entityId || !newRecord) return 0;

  const { data: openReviews } = await supabase
    .from('sdm_biodata_reviews')
    .select('id, target_key')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('target_kind', 'BIODATA_FIELD')
    .eq('status', 'OPEN');

  if (!openReviews || openReviews.length === 0) return 0;

  const changedIds: string[] = [];
  for (const rev of openReviews) {
    const key = rev.target_key as string;
    if (key === 'address_group') {
      const anyChanged = ADDRESS_GROUP_COLUMNS.some(
        (col) => normalizeComparable(oldRecord?.[col]) !== normalizeComparable(newRecord[col])
      );
      if (anyChanged) changedIds.push(rev.id as string);
    } else if (normalizeComparable(oldRecord?.[key]) !== normalizeComparable(newRecord[key])) {
      changedIds.push(rev.id as string);
    }
  }

  if (changedIds.length === 0) return 0;

  const now = new Date().toISOString();
  await supabase
    .from('sdm_biodata_reviews')
    .update({ status: 'REVISED', revised_at: now, updated_at: now })
    .in('id', changedIds);

  return changedIds.length;
}

export async function markDocumentReviewAsRevised(
  supabase: AdminClient,
  entityType: ReviewEntityType,
  entityId: string,
  documentType: string
): Promise<number> {
  if (!entityId || !documentType) return 0;

  const now = new Date().toISOString();
  const { data } = await supabase
    .from('sdm_biodata_reviews')
    .update({ status: 'REVISED', revised_at: now, updated_at: now })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('target_kind', 'DOCUMENT_TYPE')
    .eq('target_key', documentType)
    .eq('status', 'OPEN')
    .select('id');

  return data?.length || 0;
}

export async function resolveEntityOwnerProfileId(
  supabase: AdminClient,
  entityType: ReviewEntityType,
  entityId: string
): Promise<{ profileId: string | null; displayName: string }> {
  if (entityType === 'SISWA') {
    const { data } = await supabase
      .from('students')
      .select('profile_id, full_name')
      .eq('id', entityId)
      .maybeSingle();
    return {
      profileId: (data?.profile_id as string | null) ?? null,
      displayName: (data?.full_name as string) || 'Siswa',
    };
  }
  if (entityType === 'GTK') {
    const { data } = await supabase
      .from('teachers_staff')
      .select('profile_id, full_name')
      .eq('id', entityId)
      .maybeSingle();
    return {
      profileId: (data?.profile_id as string | null) ?? null,
      displayName: (data?.full_name as string) || 'GTK',
    };
  }
  const { data } = await supabase
    .from('student_guardians')
    .select('profile_id, full_name')
    .eq('id', entityId)
    .maybeSingle();
  return {
    profileId: (data?.profile_id as string | null) ?? null,
    displayName: (data?.full_name as string) || 'Orang Tua/Wali',
  };
}

export async function notifyBiodataReviewBatch(
  supabase: AdminClient,
  params: {
    entityType: ReviewEntityType;
    entityId: string;
    createdBy: string | null;
  }
): Promise<{ sent: boolean; reason?: string; openCount: number }> {
  const { entityType, entityId, createdBy } = params;
  const openReviews = (await fetchActiveBiodataReviews(supabase, entityType, entityId)).filter(
    (r) => r.status === 'OPEN'
  );

  if (openReviews.length === 0) {
    return { sent: false, reason: 'Tidak ada catatan perbaikan aktif (OPEN) untuk dikirim.', openCount: 0 };
  }

  const owner = await resolveEntityOwnerProfileId(supabase, entityType, entityId);
  if (!owner.profileId) {
    return {
      sent: false,
      reason: 'Akun pengguna belum tertaut (profile_id kosong), sehingga notifikasi tidak dapat dikirim.',
      openCount: openReviews.length,
    };
  }

  const hasBiodata = openReviews.some((r) => r.target_kind === 'BIODATA_FIELD');
  const hasDoc = openReviews.some((r) => r.target_kind === 'DOCUMENT_TYPE');
  const basePath =
    entityType === 'SISWA'
      ? '/portal/siswa/biodata-dokumen'
      : entityType === 'GTK'
        ? '/portal/gtk/biodata-dokumen'
        : '/portal/orang-tua/biodata-dokumen';
  const targetUrl = hasBiodata ? `${basePath}/biodata` : `${basePath}/dokumen`;

  const sampleLabels = openReviews
    .slice(0, 3)
    .map((r) => getReviewTargetLabel(entityType, r.target_kind, r.target_key));
  const extraCount = openReviews.length - sampleLabels.length;
  const summaryList =
    extraCount > 0 ? `${sampleLabels.join(', ')}, dan ${extraCount} lainnya` : sampleLabels.join(', ');

  const scopeText =
    hasBiodata && hasDoc
      ? 'biodata dan dokumen'
      : hasDoc
        ? 'dokumen'
        : 'biodata';

  await notifyUserDirect({
    userId: owner.profileId,
    categoryKey: 'KEAMANAN_AKUN',
    title: `Perbaikan ${scopeText === 'dokumen' ? 'Dokumen' : 'Biodata'} Diperlukan (${openReviews.length} catatan)`,
    body: `Admin/TU meminta perbaikan pada ${scopeText} Anda: ${summaryList}. Silakan segera periksa dan perbarui.`,
    url: targetUrl,
    dedupeKey: `biodata-review-${entityType}-${entityId}`,
    dedupeWindowMinutes: 15,
    createdBy,
  });

  return { sent: true, openCount: openReviews.length };
}
