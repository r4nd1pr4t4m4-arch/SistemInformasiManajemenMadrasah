'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Compass,
  Gauge,
  Home,
  Inbox,
  Info,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldAlert,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';

/* ============================================================================
 * 1. EMPTY STATE
 * ============================================================================ */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-3xl border border-dashed border-slate-200/90 bg-white/75 backdrop-blur-sm text-center flex flex-col items-center justify-center ${
        compact ? 'px-5 py-7 gap-2.5' : 'px-6 py-12 gap-3.5'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-md scale-125"
        />
        <div
          className={`relative rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/80 border border-slate-200/80 text-emerald-700 flex items-center justify-center shadow-xs ${
            compact ? 'w-11 h-11' : 'w-14 h-14'
          }`}
        >
          {icon ?? <Inbox className={compact ? 'w-5 h-5' : 'w-6 h-6'} />}
        </div>
      </div>

      <div className="space-y-1 max-w-md">
        <h3
          className={`font-bold text-slate-900 tracking-tight ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{description}</p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 2. LOADING STATE
 * ============================================================================ */
export interface LoadingStateProps {
  title?: string;
  description?: string;
  variant?: 'card' | 'page' | 'inline' | 'skeleton';
  rows?: number;
  className?: string;
}

export function LoadingState({
  title = 'Memuat data...',
  description = 'Mohon tunggu sebentar, sistem sedang menyiapkan informasi terbaru.',
  variant = 'card',
  rows = 3,
  className = '',
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2.5 text-xs sm:text-sm text-slate-600 font-medium ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
        <span>{title}</span>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={title}
        className={`space-y-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
          <span>{title}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-3xl p-5 space-y-3.5 animate-pulse border border-slate-200/70"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-200/80 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded-lg bg-slate-200/90" />
                  <div className="h-2.5 w-1/2 rounded-lg bg-slate-200/70" />
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 w-full rounded-lg bg-slate-200/70" />
                <div className="h-3 w-5/6 rounded-lg bg-slate-200/60" />
              </div>
              <div className="h-9 w-full rounded-xl bg-slate-200/75" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isPage = variant === 'page';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${
        isPage
          ? 'min-h-[60vh] flex items-center justify-center px-4 py-12'
          : 'w-full'
      } ${className}`}
    >
      <div
        className={`glass-card rounded-3xl text-center flex flex-col items-center justify-center gap-4 border border-slate-200/80 ${
          isPage ? 'max-w-md w-full p-8 sm:p-10' : 'p-8 sm:p-10'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute w-14 h-14 rounded-full bg-emerald-400/20 animate-ping"
          />
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-sm sm:text-base font-bold text-slate-900">{title}</p>
          {description && (
            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
          )}
        </div>
        <div className="w-40 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 simms-loading-bar" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. ERROR STATE
 * ============================================================================ */
export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  retrying?: boolean;
  backHref?: string;
  backLabel?: string;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Terjadi Kendala Saat Memuat',
  message = 'Sistem mengalami gangguan sementara saat memproses permintaan Anda. Silakan coba beberapa saat lagi.',
  code,
  onRetry,
  retrying = false,
  backHref,
  backLabel = 'Kembali ke Beranda',
  compact = false,
  className = '',
}: ErrorStateProps) {
  if (compact) {
    return (
      <div
        role="alert"
        className={`rounded-2xl bg-rose-50/90 border border-rose-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 ${className}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-bold text-rose-950">{title}</p>
            <p className="text-xs text-rose-800/90 leading-relaxed break-words">{message}</p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            aria-busy={retrying || undefined}
            disabled={retrying}
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-100/70 border border-rose-200 text-rose-800 text-xs font-semibold shrink-0 transition"
          >
            {retrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{retrying ? 'Mencoba...' : 'Coba Lagi'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`glass-card rounded-3xl p-7 sm:p-10 text-center flex flex-col items-center justify-center gap-4 border border-rose-200/70 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <div className="space-y-1.5 max-w-md">
        {code && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold tracking-wide">
            Kode: {code}
          </span>
        )}
        <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">{message}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
        {onRetry && (
          <button
            type="button"
            aria-busy={retrying || undefined}
            disabled={retrying}
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            {retrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{retrying ? 'Memuat Ulang...' : 'Coba Muat Ulang'}</span>
          </button>
        )}
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition"
          >
            <Home className="w-4 h-4" />
            <span>{backLabel}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. NO INTERNET STATE
 * ============================================================================ */
export interface NoInternetStateProps {
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

export function NoInternetState({
  onRetry,
  retrying = false,
  compact = false,
  className = '',
}: NoInternetStateProps) {
  if (compact) {
    return (
      <div
        role="alert"
        className={`rounded-2xl bg-slate-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl border border-slate-700/80 ${className}`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white">Tidak Ada Koneksi Internet</p>
            <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Periksa Wi-Fi atau data seluler Anda. Halaman akan otomatis aktif kembali saat online.
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            aria-busy={retrying || undefined}
            disabled={retrying}
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold shrink-0 transition"
          >
            {retrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Cek Koneksi</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`glass-card rounded-3xl p-7 sm:p-10 text-center flex flex-col items-center justify-center gap-4 border border-slate-200/90 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-rose-50 border border-slate-200 text-rose-600 flex items-center justify-center shadow-xs">
        <WifiOff className="w-7 h-7" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Koneksi Internet Terputus
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Perangkat Anda sedang offline. Pastikan Wi-Fi atau jaringan seluler aktif, lalu coba muat
          ulang halaman ini.
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          aria-busy={retrying || undefined}
          disabled={retrying}
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition"
        >
          {retrying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>Periksa Koneksi &amp; Muat Ulang</span>
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * 5. SLOW NETWORK BANNER
 * ============================================================================ */
export interface SlowNetworkBannerProps {
  effectiveType?: string | null;
  rttMs?: number | null;
  onDismiss?: () => void;
  className?: string;
}

export function SlowNetworkBanner({
  effectiveType,
  rttMs,
  onDismiss,
  className = '',
}: SlowNetworkBannerProps) {
  const detail = [
    effectiveType ? `Jaringan ${effectiveType.toUpperCase()}` : null,
    rttMs && rttMs > 0 ? `latensi ~${Math.round(rttMs)}ms` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl bg-amber-50/95 backdrop-blur-md border border-amber-300/80 px-4 py-3 text-amber-950 shadow-lg flex items-start sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
          <Gauge className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-950">
            Koneksi Jaringan Terdeteksi Lambat
            {detail ? (
              <span className="ml-1.5 font-semibold text-amber-800">({detail})</span>
            ) : null}
          </p>
          <p className="text-[11px] text-amber-800/90 leading-relaxed">
            Beberapa data mungkin memerlukan waktu sedikit lebih lama untuk dimuat. Harap tunggu
            tanpa menutup halaman.
          </p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan jaringan lambat"
          className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-200/60 shrink-0 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * 6. NO SEARCH RESULT STATE
 * ============================================================================ */
export interface NoSearchResultStateProps {
  query?: string;
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
  compact?: boolean;
  className?: string;
}

export function NoSearchResultState({
  query,
  title = 'Hasil Pencarian Tidak Ditemukan',
  description = 'Coba periksa kembali ejaan kata kunci, gunakan istilah yang lebih umum, atau atur ulang filter yang sedang aktif.',
  onReset,
  resetLabel = 'Reset Pencarian & Filter',
  compact = false,
  className = '',
}: NoSearchResultStateProps) {
  return (
    <div
      className={`glass-card rounded-3xl border border-slate-200/80 text-center flex flex-col items-center justify-center ${
        compact ? 'px-5 py-7 gap-2.5' : 'px-6 py-11 gap-3.5'
      } ${className}`}
    >
      <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-slate-100 to-sky-50 border border-slate-200/80 text-slate-600 flex items-center justify-center shadow-xs">
        <SearchX className="w-6 h-6" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
        {query && query.trim() && (
          <p className="text-xs text-slate-600">
            Kata kunci:{' '}
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 font-semibold text-slate-800 break-all">
              &ldquo;{query.trim()}&rdquo;
            </span>
          </p>
        )}
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition mt-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetLabel}</span>
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * 7. PERMISSION DENIED STATE (403)
 * ============================================================================ */
export interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
  currentRoles?: string[];
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function PermissionDeniedState({
  title = 'Akses Halaman Dibatasi',
  description = 'Peran akun Anda saat ini belum memiliki hak akses untuk membuka atau mengelola halaman ini. Hubungi Admin atau Operator lembaga apabila Anda memerlukan izin tambahan.',
  currentRoles = [],
  backHref = '/portal',
  backLabel = 'Kembali ke Dashboard Portal',
  className = '',
}: PermissionDeniedStateProps) {
  return (
    <div
      role="alert"
      className={`max-w-xl mx-auto glass-card rounded-3xl p-7 sm:p-10 text-center flex flex-col items-center gap-4 border border-rose-200/70 ${className}`}
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm">
          <Lock className="w-3 h-3" />
        </span>
      </div>

      <div className="space-y-1.5 max-w-md">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold tracking-wide uppercase">
          403 • Akses Ditolak
        </span>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>

      {currentRoles.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Peran Akun Aktif Anda
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {currentRoles.map((role) => (
              <span
                key={role}
                className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-bold"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
        <Link
          href={backHref}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition"
        >
          <Home className="w-4 h-4" />
          <span>Ke Website Resmi</span>
        </Link>
      </div>
    </div>
  );
}

/* ============================================================================
 * 8. SESSION EXPIRED MODAL
 * ============================================================================ */
export interface SessionExpiredModalProps {
  open: boolean;
  loginHref: string;
  onDismiss?: () => void;
}

export function SessionExpiredModal({
  open,
  loginHref,
  onDismiss,
}: SessionExpiredModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-1 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              Sesi Berakhir
            </span>
            <h2
              id="session-expired-title"
              className="text-base sm:text-lg font-bold text-slate-900 leading-snug"
            >
              Sesi Login Anda Telah Kedaluwarsa
            </h2>
            <p
              id="session-expired-desc"
              className="text-xs sm:text-sm text-slate-600 leading-relaxed"
            >
              Demi keamanan akun dan data lembaga, sesi autentikasi Anda telah berakhir. Silakan
              masuk kembali untuk melanjutkan aktivitas dari halaman ini.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
            >
              Tutup
            </button>
          )}
          <Link
            href={loginHref}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            <KeyRound className="w-4 h-4" />
            <span>Masuk Kembali</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 9. FORM VALIDATION FEEDBACK
 * ============================================================================ */
export interface FormFieldFeedbackProps {
  error?: string | null;
  success?: string | null;
  hint?: string | null;
  id?: string;
}

export function FormFieldFeedback({ error, success, hint, id }: FormFieldFeedbackProps) {
  if (error) {
    return (
      <p
        id={id}
        role="alert"
        className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-rose-600 leading-snug"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{error}</span>
      </p>
    );
  }
  if (success) {
    return (
      <p
        id={id}
        className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-emerald-700 leading-snug"
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{success}</span>
      </p>
    );
  }
  if (hint) {
    return (
      <p
        id={id}
        className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug"
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
        <span>{hint}</span>
      </p>
    );
  }
  return null;
}

export interface FormValidationSummaryProps {
  errors: string[];
  title?: string;
  onDismiss?: () => void;
}

export function FormValidationSummary({
  errors,
  title = 'Mohon periksa kembali isian formulir berikut:',
  onDismiss,
}: FormValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 text-rose-900 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-rose-950">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{title}</span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup ringkasan validasi"
            className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 shrink-0 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <ul className="list-disc pl-6 space-y-1 text-xs text-rose-800">
        {errors.map((err, idx) => (
          <li key={idx} className="leading-relaxed">
            {err}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================================
 * 10. SUCCESS STATE
 * ============================================================================ */
export interface SuccessStateProps {
  title: string;
  description?: string;
  details?: { label: string; value: string }[];
  action?: ReactNode;
  onDismiss?: () => void;
  variant?: 'card' | 'banner';
  className?: string;
}

export function SuccessState({
  title,
  description,
  details = [],
  action,
  onDismiss,
  variant = 'banner',
  className = '',
}: SuccessStateProps) {
  if (variant === 'banner') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl bg-emerald-50/95 border border-emerald-200 p-4 text-emerald-950 flex items-start justify-between gap-3 shadow-xs ${className}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-bold text-emerald-950">{title}</p>
            {description && (
              <p className="text-xs text-emerald-800 leading-relaxed break-words">{description}</p>
            )}
            {action && <div className="pt-2">{action}</div>}
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup notifikasi sukses"
            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`glass-card rounded-3xl p-7 sm:p-10 text-center flex flex-col items-center justify-center gap-4 border border-emerald-200/80 ${className}`}
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-md scale-125"
        />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-7 h-7" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-md">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
          <Sparkles className="w-3 h-3" /> Berhasil Diproses
        </span>
        <h3 className="text-base sm:text-lg font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>
        )}
      </div>

      {details.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-2 text-left">
          {details.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-semibold text-slate-900 text-right break-words">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/* ============================================================================
 * 11. PAGE NOT FOUND (404) STATE
 * ============================================================================ */
export interface NotFoundStateProps {
  isPortal?: boolean;
  title?: string;
  description?: string;
}

const PUBLIC_QUICK_LINKS = [
  { href: '/', label: 'Beranda Utama', desc: 'Halaman depan website resmi' },
  { href: '/portal', label: 'Portal Terpadu', desc: 'Akses akademik & administrasi' },
  { href: '/berita', label: 'Berita & Pengumuman', desc: 'Informasi terbaru lembaga' },
  { href: '/e-library', label: 'E-Library', desc: 'Koleksi perpustakaan digital' },
  { href: '/verifikasi', label: 'Verifikasi QR', desc: 'Validasi keaslian dokumen' },
  { href: '/kontak', label: 'Kontak & FAQ', desc: 'Bantuan dan layanan informasi' },
];

const PORTAL_QUICK_LINKS = [
  { href: '/portal', label: 'Dashboard Portal', desc: 'Ringkasan aktivitas utama' },
  { href: '/portal/akun/profil', label: 'Profil Akun', desc: 'Pengaturan identitas & email' },
  { href: '/portal/akademik', label: 'Modul Akademik', desc: 'Jadwal, presensi & ujian' },
  { href: '/', label: 'Website Resmi', desc: 'Kembali ke halaman publik' },
];

export function NotFoundState({
  isPortal = false,
  title = 'Halaman Tidak Ditemukan',
  description = 'Maaf, halaman yang Anda cari mungkin telah dipindahkan, dihapus, atau alamat URL yang dimasukkan kurang tepat.',
}: NotFoundStateProps) {
  const router = useRouter();
  const quickLinks = isPortal ? PORTAL_QUICK_LINKS : PUBLIC_QUICK_LINKS;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      <div className="glass-card rounded-3xl p-6 sm:p-10 text-center space-y-6 border border-slate-200/80">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-3xl bg-emerald-500/15 blur-xl scale-125"
            />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg">
              <Compass className="w-8 h-8" />
            </div>
          </div>

          <p className="text-5xl sm:text-6xl font-black tracking-tighter bg-gradient-to-r from-slate-900 via-emerald-700 to-teal-600 bg-clip-text text-transparent">
            404
          </p>

          <div className="space-y-1.5 max-w-lg">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Halaman Sebelumnya</span>
          </button>
          <Link
            href={isPortal ? '/portal' : '/'}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition"
          >
            <Home className="w-4 h-4" />
            <span>{isPortal ? 'Ke Dashboard Portal' : 'Kembali ke Beranda'}</span>
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-200/80 space-y-3 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
            Tautan Cepat yang Mungkin Anda Cari
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="modular-card rounded-2xl p-3.5 block hover:border-emerald-300 transition"
              >
                <p className="text-xs font-bold text-slate-900">{item.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
