import type {
  ReviewEntityType,
  ReviewStatus,
  ReviewTargetKind,
} from '@/lib/sdm/biodata-review-registry';

export type { ReviewEntityType, ReviewStatus, ReviewTargetKind };

export interface BiodataReviewItem {
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

export function reviewMapKey(targetKind: ReviewTargetKind, targetKey: string): string {
  return `${targetKind}:${targetKey}`;
}

export function buildReviewMap(
  reviews: BiodataReviewItem[]
): Map<string, BiodataReviewItem> {
  const map = new Map<string, BiodataReviewItem>();
  for (const r of reviews) {
    map.set(reviewMapKey(r.target_kind, r.target_key), r);
  }
  return map;
}

export function getReviewBorderClass(review?: BiodataReviewItem | null): string {
  if (!review) return '';
  if (review.status === 'OPEN') {
    return 'border-amber-400 ring-1 ring-amber-300/60 bg-amber-50/30';
  }
  if (review.status === 'REVISED') {
    return 'border-sky-400 ring-1 ring-sky-300/60 bg-sky-50/20';
  }
  return '';
}
