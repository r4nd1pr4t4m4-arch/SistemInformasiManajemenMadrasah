'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'warning'
  | 'ghost';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500/60',
  secondary:
    'bg-slate-900 text-white shadow-xs hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-slate-500/60',
  outline:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:ring-emerald-500/60',
  danger:
    'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500/60',
  warning:
    'bg-amber-600 text-white shadow-xs hover:bg-amber-700 active:bg-amber-800 focus-visible:ring-amber-500/60',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/80 focus-visible:ring-emerald-500/60',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] gap-1',
  sm: 'min-h-[36px] px-3 py-1.5 rounded-xl text-xs gap-1.5',
  md: 'min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm gap-2',
  lg: 'min-h-[46px] px-6 py-3 rounded-2xl text-sm gap-2',
  icon: 'min-h-[36px] min-w-[36px] p-2 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    disabled,
    type = 'button',
    className = '',
    children,
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      className={[
        'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none',
        'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:grayscale-[40%] disabled:active:scale-100',
        loading ? 'data-[loading=true]:cursor-wait data-[loading=true]:opacity-80 data-[loading=true]:grayscale-0' : '',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      {loading && loadingText ? <span>{loadingText}</span> : children}
      {!loading && rightIcon}
    </button>
  );
});
