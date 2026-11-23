'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from '@/components/ui/state-views';

export interface ToastState {
  type: 'success' | 'error';
  text: string;
}

/**
 * Manages toast notifications with automatic cleanup of prior timers
 * so rapid consecutive actions never dismiss a newer message early.
 */
export function useAkademikToast(durationMs = 5000) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (type: 'success' | 'error', text: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setToast({ type, text });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast, dismissToast };
}

export function AkademikToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss?: () => void;
}) {
  if (!toast) return null;
  if (toast.type === 'success') {
    return (
      <SuccessState
        variant="banner"
        title="Berhasil"
        description={toast.text}
        onDismiss={onDismiss}
      />
    );
  }
  return (
    <ErrorState
      compact
      title="Perhatian"
      message={toast.text}
    />
  );
}

export function AkademikLoading({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="max-w-7xl mx-auto">
      <LoadingState
        variant="card"
        title={label}
        description="Sistem sedang menyiapkan data akademik terbaru."
      />
    </div>
  );
}

export function AkademikErrorBanner({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry?: () => void;
}) {
  if (!error) return null;
  return (
    <ErrorState
      compact
      title="Gagal Memuat Data"
      message={error}
      onRetry={onRetry}
    />
  );
}

export function AkademikEmptyState({
  icon,
  message,
  compact = false,
}: {
  icon?: React.ReactNode;
  message: string;
  compact?: boolean;
}) {
  return (
    <EmptyState
      icon={icon}
      title="Belum Ada Data"
      description={message}
      compact={compact}
    />
  );
}

export function AkademikModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0 transition"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type AttendanceStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA';

export interface BatchStudentItem {
  id: string;
  full_name: string;
  nis?: string | null;
}

const ATTENDANCE_OPTS: { value: AttendanceStatus; short: string; activeClass: string }[] = [
  { value: 'HADIR', short: 'H', activeClass: 'bg-emerald-600 text-white' },
  { value: 'SAKIT', short: 'S', activeClass: 'bg-amber-500 text-white' },
  { value: 'IZIN', short: 'I', activeClass: 'bg-sky-600 text-white' },
  { value: 'ALPA', short: 'A', activeClass: 'bg-rose-600 text-white' },
];

export function BatchStudentAttendanceList({
  students,
  statuses,
  onChangeStatus,
}: {
  students: BatchStudentItem[];
  statuses: Record<string, AttendanceStatus>;
  onChangeStatus: (studentId: string, status: AttendanceStatus) => void;
}) {
  return (
    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
      {students.map((st) => {
        const current = statuses[st.id] || 'HADIR';
        return (
          <div
            key={st.id}
            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">{st.full_name}</p>
              {st.nis && <p className="text-[11px] text-slate-400">NIS: {st.nis}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ATTENDANCE_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeStatus(st.id, opt.value)}
                  title={opt.value}
                  aria-label={`${st.full_name}: ${opt.value}`}
                  className={`min-w-[28px] min-h-[28px] px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                    current === opt.value
                      ? opt.activeClass
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.short}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
