'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  FileText,
  Loader2,
  MessageSquareWarning,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import {
  getReviewTargetLabel,
  type ReviewEntityType,
} from '@/lib/sdm/biodata-review-registry';
import type { BiodataReviewItem } from './types';

function storageKey(entityType: ReviewEntityType, entityId: string): string {
  return `simms:unsent-biodata-reviews:${entityType}:${entityId}`;
}

function readStoredIds(entityType: ReviewEntityType, entityId: string | null): string[] {
  if (typeof window === 'undefined' || !entityId) return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(entityType, entityId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIds(
  entityType: ReviewEntityType,
  entityId: string | null,
  ids: string[]
): void {
  if (typeof window === 'undefined' || !entityId) return;
  try {
    const key = storageKey(entityType, entityId);
    if (ids.length === 0) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(ids));
    }
  } catch {
    // Abaikan jika sessionStorage tidak tersedia
  }
}

type PendingNavigation =
  | { kind: 'href'; href: string }
  | { kind: 'callback'; run: () => void };

export function useUnsentReviewSession({
  entityType,
  entityId,
  entityLabel,
  canReview,
  allowedBasePath,
  reviews,
  onAfterCancel,
  onNotifyToast,
}: {
  entityType: ReviewEntityType;
  entityId: string | null;
  entityLabel?: string | null;
  canReview: boolean;
  allowedBasePath: string;
  reviews: BiodataReviewItem[];
  onAfterCancel?: () => Promise<void> | void;
  onNotifyToast?: (type: 'ok' | 'err', text: string) => void;
}) {
  const router = useRouter();
  const currentScopeKey = entityId ? `${entityType}:${entityId}` : '';
  const [storedState, setStoredState] = useState<{ scopeKey: string; ids: string[] }>(() => ({
    scopeKey: currentScopeKey,
    ids: readStoredIds(entityType, entityId),
  }));
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);
  const [modalBusy, setModalBusy] = useState<'notify' | 'cancel' | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const storedIds = useMemo(
    () =>
      storedState.scopeKey === currentScopeKey
        ? storedState.ids
        : readStoredIds(entityType, entityId),
    [currentScopeKey, entityId, entityType, storedState]
  );

  const unsentReviews = useMemo(() => {
    if (!canReview || !entityId || storedIds.length === 0) return [];
    const idSet = new Set(storedIds);
    return reviews.filter((r) => r.status === 'OPEN' && idSet.has(r.id));
  }, [canReview, entityId, reviews, storedIds]);

  const hasUnsent = unsentReviews.length > 0;

  const markReviewSaved = useCallback(
    (reviewId?: string) => {
      if (!canReview || !entityId || !reviewId) return;
      setStoredState((prev) => {
        const baseIds =
          prev.scopeKey === currentScopeKey ? prev.ids : readStoredIds(entityType, entityId);
        const next = baseIds.includes(reviewId) ? baseIds : [...baseIds, reviewId];
        writeStoredIds(entityType, entityId, next);
        return { scopeKey: currentScopeKey, ids: next };
      });
    },
    [canReview, currentScopeKey, entityId, entityType]
  );

  const clearUnsent = useCallback(() => {
    setStoredState({ scopeKey: currentScopeKey, ids: [] });
    writeStoredIds(entityType, entityId, []);
  }, [currentScopeKey, entityId, entityType]);

  const guardAction = useCallback(
    (action: () => void) => {
      if (hasUnsent) {
        setModalError(null);
        setPendingNav({ kind: 'callback', run: action });
      } else {
        action();
      }
    },
    [hasUnsent]
  );

  // Intercept klik tautan navigasi keluar halaman biodata/dokumen entitas ini
  useEffect(() => {
    if (!hasUnsent) return;

    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const hrefAttr = anchor.getAttribute('href') || '';
      if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) {
        return;
      }

      let destUrl: URL;
      try {
        destUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destUrl.origin !== window.location.origin) return;

      // Izinkan perpindahan tab /biodata <-> /dokumen pada workspace yang sama tanpa mengganggu
      if (destUrl.pathname.startsWith(allowedBasePath)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setModalError(null);
      setPendingNav({
        kind: 'href',
        href: `${destUrl.pathname}${destUrl.search}${destUrl.hash}`,
      });
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [allowedBasePath, hasUnsent]);

  const proceedPending = useCallback(
    (nav: PendingNavigation | null) => {
      setPendingNav(null);
      setModalError(null);
      if (!nav) return;
      if (nav.kind === 'href') {
        router.push(nav.href);
      } else {
        nav.run();
      }
    },
    [router]
  );

  const handleConfirmSendAndLeave = useCallback(async () => {
    if (!entityId) {
      proceedPending(pendingNav);
      return;
    }
    setModalBusy('notify');
    setModalError(null);
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
      clearUnsent();
      onNotifyToast?.('ok', data.message || 'Notifikasi perbaikan berhasil dikirim.');
      proceedPending(pendingNav);
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setModalBusy(null);
    }
  }, [clearUnsent, entityId, entityType, onNotifyToast, pendingNav, proceedPending]);

  const handleCancelCommentsAndLeave = useCallback(async () => {
    const idsToDelete = unsentReviews.map((r) => r.id);
    if (idsToDelete.length === 0) {
      clearUnsent();
      proceedPending(pendingNav);
      return;
    }
    setModalBusy('cancel');
    setModalError(null);
    try {
      const res = await fetch(
        `/api/sdm/biodata-reviews?ids=${encodeURIComponent(idsToDelete.join(','))}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal membatalkan komentar revisi.');
      clearUnsent();
      onNotifyToast?.('ok', `${idsToDelete.length} komentar revisi dibatalkan.`);
      await onAfterCancel?.();
      proceedPending(pendingNav);
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setModalBusy(null);
    }
  }, [clearUnsent, onAfterCancel, onNotifyToast, pendingNav, proceedPending, unsentReviews]);

  const modalProps = {
    open: Boolean(pendingNav && hasUnsent),
    entityType,
    entityLabel: entityLabel || null,
    unsentReviews,
    busy: modalBusy,
    error: modalError,
    onClose: () => {
      if (!modalBusy) {
        setPendingNav(null);
        setModalError(null);
      }
    },
    onSendAndLeave: handleConfirmSendAndLeave,
    onCancelCommentsAndLeave: handleCancelCommentsAndLeave,
  };

  return {
    unsentCount: unsentReviews.length,
    hasUnsent,
    markReviewSaved,
    clearUnsent,
    guardAction,
    modalProps,
  };
}

interface UnsentReviewLeaveModalProps {
  open: boolean;
  entityType: ReviewEntityType;
  entityLabel: string | null;
  unsentReviews: BiodataReviewItem[];
  busy: 'notify' | 'cancel' | null;
  error: string | null;
  onClose: () => void;
  onSendAndLeave: () => Promise<void> | void;
  onCancelCommentsAndLeave: () => Promise<void> | void;
}

export function UnsentReviewLeaveModal({
  open,
  entityType,
  entityLabel,
  unsentReviews,
  busy,
  error,
  onClose,
  onSendAndLeave,
  onCancelCommentsAndLeave,
}: UnsentReviewLeaveModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const roleLabel =
    entityType === 'SISWA' ? 'Siswa' : entityType === 'GTK' ? 'GTK' : 'Orang Tua / Wali';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsent-review-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-hidden shadow-2xl border border-slate-200/90 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/50 border-b border-slate-200/80 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3
                id="unsent-review-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 leading-snug"
              >
                Notifikasi Revisi Belum Dikirim
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Anda membuat{' '}
                <strong className="text-amber-800">{unsentReviews.length} catatan perbaikan</strong>{' '}
                untuk {roleLabel}
                {entityLabel ? (
                  <>
                    {' '}
                    <strong className="text-slate-900">{entityLabel}</strong>
                  </>
                ) : null}
                , namun belum mengirimkan notifikasinya.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            aria-label="Tutup dialog konfirmasi"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Daftar Komentar Belum Terkirim */}
        <div className="px-5 sm:px-6 py-4 space-y-3 overflow-y-auto">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              Ringkasan Catatan Sesi Ini ({unsentReviews.length})
            </p>
            <ul className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {unsentReviews.map((rev) => {
                const label = getReviewTargetLabel(entityType, rev.target_kind, rev.target_key);
                const isDoc = rev.target_kind === 'DOCUMENT_TYPE';
                return (
                  <li
                    key={rev.id}
                    className="rounded-xl bg-white border border-amber-200/80 px-3 py-2 text-xs space-y-0.5"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      {isDoc ? (
                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate">{label}</span>
                      <span className="ml-auto px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold shrink-0">
                        {isDoc ? 'Dokumen' : 'Biodata'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 break-words">
                      {rev.comment}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Pilih <strong>Kirim Notifikasi &amp; Lanjutkan</strong> agar pengguna segera menerima 1
            notifikasi terpadu, atau pilih <strong>Batalkan Semua Komentar</strong> untuk menghapus
            catatan yang baru dibuat pada sesi ini.
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void onSendAndLeave()}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold transition shadow-xs"
          >
            {busy === 'notify' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>Kirim Notifikasi Revisi &amp; Lanjutkan</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void onCancelCommentsAndLeave()}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-60 transition"
            >
              {busy === 'cancel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Batalkan Semua Komentar</span>
            </button>

            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={onClose}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold disabled:opacity-60 transition"
            >
              <span>Tetap di Halaman Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
