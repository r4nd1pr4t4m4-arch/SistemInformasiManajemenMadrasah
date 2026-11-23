'use client';

import {
  forwardRef,
  useEffect,
  useRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { FormFieldFeedback } from '@/components/ui/state-views';

/* ============================================================================
 * 1. INPUT / SELECT / TEXTAREA PRIMITIVES
 * ============================================================================ */
const BASE_FIELD_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string | null;
}

export const Input = forwardRef<HTMLInputElement, FormInputProps>(function Input(
  { label, error, hint, id, required, className = '', ...props },
  ref
) {
  return (
    <div className="min-w-0">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-rose-600 ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={`${BASE_FIELD_CLASS} ${className}`}
        {...props}
      />
      <FormFieldFeedback error={error} hint={!error ? hint : null} />
    </div>
  );
});

export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  hint?: string | null;
}

export const Select = forwardRef<HTMLSelectElement, FormSelectProps>(function Select(
  { label, error, hint, id, required, className = '', children, ...props },
  ref
) {
  return (
    <div className="min-w-0">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-rose-600 ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={`${BASE_FIELD_CLASS} ${className}`}
        {...props}
      >
        {children}
      </select>
      <FormFieldFeedback error={error} hint={!error ? hint : null} />
    </div>
  );
});

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(function Textarea(
  { label, error, hint, id, required, className = '', ...props },
  ref
) {
  return (
    <div className="min-w-0">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-rose-600 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={`${BASE_FIELD_CLASS} min-h-[96px] py-2.5 ${className}`}
        {...props}
      />
      <FormFieldFeedback error={error} hint={!error ? hint : null} />
    </div>
  );
});

/* ============================================================================
 * 2. BADGE PRIMITIVE (WCAG AA CONTRAST)
 * ============================================================================ */
export type BadgeTone = 'neutral' | 'emerald' | 'amber' | 'rose' | 'sky';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  amber: 'bg-amber-50 text-amber-900 border-amber-200/80',
  rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
  sky: 'bg-sky-50 text-sky-800 border-sky-200/80',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold leading-tight ${BADGE_TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

/* ============================================================================
 * 3. CARD PRIMITIVE
 * ============================================================================ */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'modular' | 'flat';
}

export function Card({ variant = 'glass', className = '', children, ...props }: CardProps) {
  const variantClass =
    variant === 'glass'
      ? 'glass-card'
      : variant === 'modular'
      ? 'modular-card'
      : 'bg-white border border-slate-200/90 shadow-xs';
  return (
    <div className={`${variantClass} rounded-3xl p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

/* ============================================================================
 * 4. TABS PRIMITIVE
 * ============================================================================ */
export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs<T extends string>({
  items,
  activeId,
  onChange,
  ariaLabel = 'Navigasi tab',
  className = '',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 ${className}`}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              active
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 5. ACCESSIBLE MODAL PRIMITIVE (WITH FOCUS TRAP & ESCAPE)
 * ============================================================================ */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidthClass?: string;
  disableClose?: boolean;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  maxWidthClass = 'max-w-lg',
  disableClose = false,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableClose) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, disableClose, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!disableClose) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl ${maxWidthClass} w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-snug">{title}</h2>
            {description && (
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            disabled={disableClose}
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
