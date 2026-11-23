'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

export interface PenilaianConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  variant?: 'danger' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function PenilaianConfirmModal({
  open,
  title,
  description,
  details = [],
  variant = 'warning',
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  loading = false,
  onConfirm,
  onCancel,
}: PenilaianConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="penilaian-confirm-title"
        aria-describedby="penilaian-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              {isDanger ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3
                id="penilaian-confirm-title"
                className="text-sm sm:text-base font-bold text-slate-900 leading-snug"
              >
                {title}
              </h3>
              <p
                id="penilaian-confirm-desc"
                className="text-xs text-slate-600 mt-1 leading-relaxed break-words"
              >
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {details.length > 0 && (
          <div
            className={`rounded-2xl p-3 text-xs space-y-1 border ${
              isDanger
                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            {details.map((item) => (
              <p key={item} className="leading-relaxed">
                • {item}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            aria-busy={loading || undefined}
            disabled={loading}
            onClick={onConfirm}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
