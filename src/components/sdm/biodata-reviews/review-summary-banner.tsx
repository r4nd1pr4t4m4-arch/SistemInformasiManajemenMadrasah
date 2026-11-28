'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  getReviewTargetMeta,
  type ReviewEntityType,
} from '@/lib/sdm/biodata-review-registry';
import type { BiodataReviewItem } from './types';

interface ReviewSummaryBannerProps {
  entityType: ReviewEntityType;
  entityId: string | null;
  activeSection: 'biodata' | 'dokumen';
  otherSectionHref: string;
  reviews: BiodataReviewItem[];
  canReview: boolean;
  unsentCount?: number;
  onNotified?: () => void;
  onNotifyToast?: (type: 'ok' | 'err', text: string) => void;
}

export function ReviewSummaryBanner({
  entityType,
  entityId,
  activeSection,
  otherSectionHref,
  reviews,
  canReview,
  unsentCount = 0,
  onNotified,
  onNotifyToast,
}: ReviewSummaryBannerProps) {
  const [sendingNotify, setSendingNotify] = useState(false);

  if (!entityId || reviews.length === 0) return null;

  const openReviews = reviews.filter((r) => r.status === 'OPEN');
  const revisedReviews = reviews.filter((r) => r.status === 'REVISED');

  const currentKind = activeSection === 'biodata' ? 'BIODATA_FIELD' : 'DOCUMENT_TYPE';
  const currentTabReviews = reviews.filter((r) => r.target_kind === currentKind);
  const otherTabReviews = reviews.filter((r) => r.target_kind !== currentKind);

  function jumpToTarget(anchorId: string) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(anchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      el.focus({ preventScroll: true });
    }
  }

  async function handleSendBatchNotification() {
    if (!entityId || openReviews.length === 0) return;
    setSendingNotify(true);
    try {
      const res = await fetch('/api/sdm/biodata-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          entity_type: entityType,
          entity_id: entityId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim notifikasi revisi.');
      onNotified?.();
      onNotifyToast?.('ok', data.message || 'Notifikasi perbaikan berhasil dikirim.');
    } catch (err) {
      onNotifyToast?.('err', (err as Error).message);
    } finally {
      setSendingNotify(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Ringkasan catatan perbaikan biodata dan dokumen"
      className={`rounded-3xl border p-4 sm:p-5 space-y-3 shadow-xs ${
        openReviews.length > 0
          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
          : 'bg-sky-50/90 border-sky-300 text-sky-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          {openReviews.length > 0 ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold">
              {openReviews.length > 0
                ? `${openReviews.length} Catatan Perbaikan Aktif`
                : 'Semua Catatan Sudah Diperbaiki Pengguna'}
              {revisedReviews.length > 0 && openReviews.length > 0
                ? ` • ${revisedReviews.length} Menunggu Verifikasi Admin`
                : ''}
            </h2>
            <p className="text-[11px] opacity-85 leading-relaxed mt-0.5">
              {canReview
                ? 'Klik item di bawah untuk menuju kolom/dokumen terkait. Setelah selesai menandai catatan, klik tombol kirim notifikasi agar pengguna segera memperbaikinya.'
                : 'Admin/TU meminta perbaikan pada beberapa data Anda. Klik item di bawah untuk langsung menuju kolom/dokumen yang perlu diperbaiki.'}
            </p>
          </div>
        </div>

        {canReview && openReviews.length > 0 && (
          <button
            type="button"
            disabled={sendingNotify}
            onClick={() => void handleSendBatchNotification()}
            className={`shrink-0 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 ${
              unsentCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/60'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {sendingNotify ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            <span>
              Kirim Notifikasi Revisi ({openReviews.length})
              {unsentCount > 0 ? ' • Belum Dikirim' : ''}
            </span>
          </button>
        )}
      </div>

      {currentTabReviews.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentTabReviews.map((rev) => {
            const meta = getReviewTargetMeta(entityType, rev.target_kind, rev.target_key);
            const label = meta?.label || rev.target_key;
            const anchorId = meta?.anchorId || '';
            return (
              <button
                key={rev.id}
                type="button"
                onClick={() => anchorId && jumpToTarget(anchorId)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition ${
                  rev.status === 'OPEN'
                    ? 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                    : 'bg-white border-sky-300 text-sky-900 hover:bg-sky-100'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    rev.status === 'OPEN' ? 'bg-amber-500' : 'bg-sky-500'
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {otherTabReviews.length > 0 && (
        <div className="pt-1 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span>
            Terdapat <strong>{otherTabReviews.length} catatan</strong> di tab{' '}
            <strong>{activeSection === 'biodata' ? 'Scan Dokumen' : 'Biodata Lengkap'}</strong>.
          </span>
          <Link
            href={otherSectionHref}
            className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline"
          >
            <span>Lihat di {activeSection === 'biodata' ? 'Scan Dokumen' : 'Biodata Lengkap'}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
