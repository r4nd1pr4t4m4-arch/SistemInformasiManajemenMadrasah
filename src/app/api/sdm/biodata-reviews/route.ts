import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';
import {
  isValidReviewTarget,
  type ReviewEntityType,
  type ReviewTargetKind,
} from '@/lib/sdm/biodata-review-registry';
import {
  fetchActiveBiodataReviews,
  notifyBiodataReviewBatch,
  resolveEntityOwnerProfileId,
} from '@/lib/sdm/biodata-reviews';

const EntityTypeSchema = z.enum(['SISWA', 'GTK', 'ORANG_TUA']);
const TargetKindSchema = z.enum(['BIODATA_FIELD', 'DOCUMENT_TYPE']);

const CreateOrUpdateReviewSchema = z.object({
  entity_type: EntityTypeSchema,
  entity_id: z.string().uuid('ID entitas tidak valid.'),
  target_kind: TargetKindSchema,
  target_key: z.string().trim().min(1).max(100),
  comment: z.string().trim().min(2, 'Catatan perbaikan minimal 2 karakter.').max(1000),
  previous_value: z.string().max(1000).optional().nullable(),
});

const PatchReviewSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('resolve'),
    id: z.string().uuid('ID catatan tidak valid.'),
  }),
  z.object({
    action: z.literal('reopen'),
    id: z.string().uuid('ID catatan tidak valid.'),
    comment: z.string().trim().min(2, 'Catatan perbaikan minimal 2 karakter.').max(1000),
  }),
  z.object({
    action: z.literal('notify'),
    entity_type: EntityTypeSchema,
    entity_id: z.string().uuid('ID entitas tidak valid.'),
  }),
]);

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ reviews: [] });
  }

  const entityTypeParam = request.nextUrl.searchParams.get('entityType');
  const entityId = request.nextUrl.searchParams.get('entityId');
  const parsedType = EntityTypeSchema.safeParse(entityTypeParam);
  if (!parsedType.success || !entityId) {
    return NextResponse.json(
      { error: 'Parameter entityType dan entityId wajib diisi.' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const canReview = hasAnyRole(session, PERMISSIONS.BIODATA_REVIEW_MANAGE);

  if (!canReview) {
    const owner = await resolveEntityOwnerProfileId(supabase, parsedType.data, entityId);
    if (!owner.profileId || owner.profileId !== session.userId) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki izin melihat catatan revisi entitas ini.' },
        { status: 403 }
      );
    }
  }

  const reviews = await fetchActiveBiodataReviews(supabase, parsedType.data, entityId);
  return NextResponse.json({ reviews, canReview });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.BIODATA_REVIEW_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreateOrUpdateReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Payload catatan revisi tidak valid.' },
        { status: 400 }
      );
    }

    const { entity_type, entity_id, target_kind, target_key, comment, previous_value } = parsed.data;
    if (!isValidReviewTarget(entity_type, target_kind, target_key)) {
      return NextResponse.json(
        { error: 'Field atau jenis dokumen tersebut tidak dapat diberi catatan perbaikan.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: existingActive } = await supabase
      .from('sdm_biodata_reviews')
      .select('id')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .eq('target_kind', target_kind)
      .eq('target_key', target_key)
      .in('status', ['OPEN', 'REVISED'])
      .maybeSingle();

    if (existingActive) {
      const { data, error } = await supabase
        .from('sdm_biodata_reviews')
        .update({
          comment,
          status: 'OPEN',
          previous_value: previous_value ?? null,
          created_by: guard.session.userId,
          revised_at: null,
          updated_at: now,
        })
        .eq('id', existingActive.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ review: data });
    }

    const { data, error } = await supabase
      .from('sdm_biodata_reviews')
      .insert({
        entity_type,
        entity_id,
        target_kind,
        target_key,
        status: 'OPEN',
        comment,
        previous_value: previous_value ?? null,
        created_by: guard.session.userId,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ review: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeApiError(err, 'Gagal menyimpan catatan perbaikan.') },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.BIODATA_REVIEW_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = PatchReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Permintaan pembaruan catatan tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (parsed.data.action === 'notify') {
      const result = await notifyBiodataReviewBatch(supabase, {
        entityType: parsed.data.entity_type as ReviewEntityType,
        entityId: parsed.data.entity_id,
        createdBy: guard.session.userId,
      });
      if (!result.sent) {
        return NextResponse.json(
          { error: result.reason || 'Notifikasi tidak dapat dikirim.' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        openCount: result.openCount,
        message: `Notifikasi perbaikan (${result.openCount} catatan) berhasil dikirim ke pengguna.`,
      });
    }

    if (parsed.data.action === 'resolve') {
      const { data, error } = await supabase
        .from('sdm_biodata_reviews')
        .update({
          status: 'RESOLVED',
          resolved_by: guard.session.userId,
          resolved_at: now,
          updated_at: now,
        })
        .eq('id', parsed.data.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ review: data });
    }

    const { data, error } = await supabase
      .from('sdm_biodata_reviews')
      .update({
        status: 'OPEN',
        comment: parsed.data.comment,
        created_by: guard.session.userId,
        revised_at: null,
        resolved_at: null,
        resolved_by: null,
        updated_at: now,
      })
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ review: data });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeApiError(err, 'Gagal memperbarui catatan perbaikan.') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.BIODATA_REVIEW_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const idsParam = request.nextUrl.searchParams.get('ids');
  const singleId = request.nextUrl.searchParams.get('id');
  const uuidSchema = z.string().uuid();

  const rawIds = idsParam
    ? idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : singleId
      ? [singleId.trim()]
      : [];

  if (rawIds.length === 0 || rawIds.some((id) => !uuidSchema.safeParse(id).success)) {
    return NextResponse.json({ error: 'ID catatan tidak valid.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('sdm_biodata_reviews').delete().in('id', rawIds);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true, deletedCount: rawIds.length });
}

export type { ReviewEntityType, ReviewTargetKind };
