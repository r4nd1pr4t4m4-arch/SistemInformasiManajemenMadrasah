'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  text: string;
}

export interface ToastContextValue {
  showToast: (type: ToastType, text: string, durationMs?: number) => void;
  success: (text: string, durationMs?: number) => void;
  warning: (text: string, durationMs?: number) => void;
  error: (text: string, durationMs?: number) => void;
  info: (text: string, durationMs?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, text: string, durationMs = 5500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    const timersMap = timersRef.current;
    return () => {
      timersMap.forEach((timer) => clearTimeout(timer));
      timersMap.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (text, ms) => showToast('success', text, ms),
      warning: (text, ms) => showToast('warning', text, ms),
      error: (text, ms) => showToast('error', text, ms),
      info: (text, ms) => showToast('info', text, ms),
      dismissToast,
    }),
    [showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-20 right-4 sm:right-6 z-[60] flex flex-col items-end gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none"
        >
          {toasts.map((item) => (
            <div
              key={item.id}
              role={item.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full rounded-2xl p-3.5 sm:p-4 border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
                item.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
                  : item.type === 'warning'
                    ? 'bg-amber-50/95 border-amber-200 text-amber-950'
                    : item.type === 'error'
                      ? 'bg-rose-50/95 border-rose-200 text-rose-950'
                      : 'bg-sky-50/95 border-sky-200 text-sky-950'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {item.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : item.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span className="leading-relaxed break-words">{item.text}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="Tutup pesan"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 shrink-0 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast harus digunakan di dalam <ToastProvider>');
  }
  return ctx;
}
