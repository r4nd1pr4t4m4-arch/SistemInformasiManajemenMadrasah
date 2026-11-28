'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  getReviewTargetMeta,
  type ReviewEntityType,
  type ReviewTargetKind,
} from '@/lib/sdm/biodata-review-registry';
import type { BiodataReviewItem } from './types';

interface FieldReviewActionProps {
  entityType: ReviewEntityType;
  entityId: string | null;
  targetKind: ReviewTargetKind;
  targetKey: string;
  review?: BiodataReviewItem | null;
  canReview: boolean;
  currentValue?: string | null;
  onChanged: () => Promise<void> | void;
  onReviewSaved?: (reviewId?: string) => void;
  onNotifyToast?: (type: 'ok' | 'err', text: string) => void;
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function FieldReviewControl({
  entityType,
  entityId,
  targetKind,
  targetKey,
  review,
  canReview,
  currentValue,
  onChanged,
  onReviewSaved,
  onNotifyToast,
}: FieldReviewActionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review?.comment || '');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const meta = getReviewTargetMeta(entityType, targetKind, targetKey);
  if (!meta) return null;

  const openEditor = () => {
    setDraft(review?.comment || '');
    setLocalError(null);
    setEditing(true);
  };

  async function handleSave() {
    if (!entityId) return;
    const trimmed = draft.trim();
    if (trimmed.length < 2) {
      setLocalError('Catatan perbaikan minimal 2 karakter.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/sdm/biodata-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          target_kind: targetKind,
          target_key: targetKey,
          comment: trimmed,
          previous_value: currentValue ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan catatan perbaikan.');
      setEditing(false);
      onReviewSaved?.(data.review?.id as string | undefined);
      onNotifyToast?.('ok', `Catatan perbaikan untuk "${meta?.label}" disimpan.`);
      await onChanged();
    } catch (err) {
      const msg = (err as Error).message;
      setLocalError(msg);
      onNotifyToast?.('err', msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve() {
    if (!review) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/sdm/biodata-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id: review.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menandai selesai.');
      setEditing(false);
      onNotifyToast?.('ok', `Catatan "${meta?.label}" ditandai selesai.`);
      await onChanged();
    } catch (err) {
      const msg = (err as Error).message;
      setLocalError(msg);
      onNotifyToast?.('err', msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!review) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/sdm/biodata-reviews?id=${encodeURIComponent(review.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus catatan.');
      setEditing(false);
      onNotifyToast?.('ok', `Catatan "${meta?.label}" dihapus.`);
      await onChanged();
    } catch (err) {
      const msg = (err as Error).message;
      setLocalError(msg);
      onNotifyToast?.('err', msg);
    } finally {
      setBusy(false);
    }
  }

  if (!canReview && !review) return null;

  return (
    <div className="mt-1.5 space-y-1.5">
      {canReview && entityId && !editing && !review && (
        <button
          type="button"
          onClick={openEditor}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-amber-700 transition"
          title={`Beri catatan perbaikan untuk ${meta.label}`}
        >
          <MessageSquarePlus className="w-3 h-3 shrink-0" />
          <span>Beri Catatan</span>
        </button>
      )}

      {review && !editing && (
        <div
          className={`rounded-xl border p-2.5 text-[11px] leading-relaxed space-y-1.5 ${
            review.status === 'OPEN'
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-sky-50/90 border-sky-300 text-sky-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 font-bold text-[10px]">
              {review.status === 'OPEN' ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Perlu Perbaikan (Admin/TU)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-sky-600 shrink-0" />
                  <span>Sudah Diperbaiki — Menunggu Verifikasi</span>
                </>
              )}
            </span>
            <span className="text-[10px] opacity-75">
              {formatShortDate(review.updated_at)}
            </span>
          </div>

          <p className="whitespace-pre-wrap break-words">{review.comment}</p>

          {meta.editHint === 'ACCOUNT_PROFILE' && review.status === 'OPEN' && (
            <Link
              href="/portal/akun/profil"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:underline"
            >
              <span>Perbaiki melalui Halaman Profil Akun</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}

          {canReview && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/10">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResolve()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-semibold transition"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                <span>Tandai Selesai</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={openEditor}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[10px] font-semibold transition"
              >
                <Pencil className="w-3 h-3" />
                <span>Ubah</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-[10px] font-semibold transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus</span>
              </button>
            </div>
          )}
        </div>
      )}

      {canReview && editing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-amber-900">
              Catatan Perbaikan: {meta.label}
            </span>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              aria-label="Tutup form catatan"
              className="p-0.5 rounded text-slate-500 hover:text-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tulis bagian yang perlu diperbaiki pengguna..."
            className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
          {localError && <p className="text-[10px] font-semibold text-rose-700">{localError}</p>}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[10px] font-semibold hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-semibold transition"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Simpan Catatan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
