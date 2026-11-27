'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { PasswordInput } from '@/components/auth/password-strength-input';
import { RegisterOtpView } from '@/components/auth/login/register-otp-view';
import {
  formatLockoutCountdown,
  type AuthMode,
  type StatusMessage,
} from '@/components/auth/login/types';

export function LoginCardSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-xl bg-slate-200" />
        <div className="h-4 w-64 max-w-full rounded bg-slate-200/80" />
      </div>
      <div className="h-11 rounded-2xl bg-slate-200/70" />
      <div className="space-y-4">
        <div className="h-11 rounded-xl bg-slate-200/70" />
        <div className="h-11 rounded-xl bg-slate-200/70" />
        <div className="h-12 rounded-2xl bg-emerald-200/70" />
      </div>
    </div>
  );
}

interface LoginFormViewProps {
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  loading: boolean;
  isBusy: boolean;
  otpCode: string;
  otpSent: boolean;
  otpVerified: boolean;
  otpSending: boolean;
  otpVerifying: boolean;
  resendCooldown: number;
  lockoutSeconds: number;
  activeMessage: StatusMessage | null;
  onSwitchMode: (nextMode: AuthMode) => void;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onSendRegisterOtp: (isResend?: boolean) => void;
  onVerifyRegisterOtp: () => void;
  onSubmit: (e: FormEvent) => void;
}

export function LoginFormView({
  mode,
  email,
  password,
  confirmPassword,
  fullName,
  loading,
  isBusy,
  otpCode,
  otpSent,
  otpVerified,
  otpSending,
  otpVerifying,
  resendCooldown,
  lockoutSeconds,
  activeMessage,
  onSwitchMode,
  onFullNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onOtpCodeChange,
  onSendRegisterOtp,
  onVerifyRegisterOtp,
  onSubmit,
}: LoginFormViewProps) {
  return (
    <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'login' ? 'Masuk Portal SIMMS' : 'Daftar Akun Baru'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {mode === 'login'
              ? 'Akses CMS Website, Portal Akademik, Keuangan & Layanan.'
              : 'Registrasi akun untuk anggota perpustakaan umum atau warga lembaga.'}
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/60"
        role="tablist"
        aria-label="Mode Autentikasi"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          disabled={isBusy}
          onClick={() => onSwitchMode('login')}
          className={`min-h-[40px] py-2 px-3 rounded-xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60 ${
            mode === 'login'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Masuk
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          disabled={isBusy}
          onClick={() => onSwitchMode('register')}
          className={`min-h-[40px] py-2 px-3 rounded-xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60 ${
            mode === 'register'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Daftar Akun
        </button>
      </div>

      {mode === 'login' && lockoutSeconds > 0 && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2"
        >
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                Akses masuk dibekukan sementara ({formatLockoutCountdown(lockoutSeconds)})
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Demi keamanan akun, tunggu hingga waktu pembekuan berakhir atau segera perbarui
                kata sandi Anda.
              </p>
            </div>
          </div>
          <Link
            href="/reset-kata-sandi"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Reset Kata Sandi Sekarang</span>
          </Link>
        </div>
      )}

      {activeMessage && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 leading-relaxed break-words ${
            activeMessage.type === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {activeMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          )}
          <span className="min-w-0 flex-1">{activeMessage.text}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label
              htmlFor="login-fullname"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nama Lengkap
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-fullname"
                required
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => onFullNameChange(e.target.value)}
                placeholder="Nama lengkap Anda"
                className="w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Email
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                required
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="nama@lembaga.sch.id"
                className="w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
              />
            </div>
            {mode === 'register' && (
              <button
                type="button"
                aria-busy={otpSending || undefined}
                disabled={otpSending || !email.trim() || (otpSent && resendCooldown > 0)}
                onClick={() => onSendRegisterOtp(otpSent)}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {otpSending && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                <span>
                  {otpSending
                    ? 'Mengirim...'
                    : otpSent
                    ? resendCooldown > 0
                      ? `Kirim Ulang (${resendCooldown}d)`
                      : 'Kirim Ulang OTP'
                    : 'Kirim OTP'}
                </span>
              </button>
            )}
          </div>
        </div>

        {mode === 'register' && (
          <RegisterOtpView
            email={email}
            otpCode={otpCode}
            otpSent={otpSent}
            otpVerified={otpVerified}
            otpSending={otpSending}
            otpVerifying={otpVerifying}
            resendCooldown={resendCooldown}
            onOtpCodeChange={onOtpCodeChange}
            onVerifyOtp={onVerifyRegisterOtp}
            onResendOtp={() => onSendRegisterOtp(true)}
          />
        )}

        <PasswordInput
          id="login-password"
          label="Kata Sandi"
          value={password}
          onChange={onPasswordChange}
          placeholder={mode === 'register' ? 'Minimal 8 karakter kuat' : 'Masukkan kata sandi'}
          showStrength={mode === 'register'}
          userName={fullName}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />

        {mode === 'register' && (
          <div className="space-y-1.5">
            <PasswordInput
              id="login-confirm-password"
              label="Konfirmasi Kata Sandi"
              value={confirmPassword}
              onChange={onConfirmPasswordChange}
              placeholder="Ulangi kata sandi"
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && (
              <p
                className={`text-[11px] font-medium flex items-center gap-1 ${
                  password === confirmPassword ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {password === confirmPassword ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Konfirmasi kata sandi cocok.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Konfirmasi kata sandi belum cocok.</span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {mode === 'login' && (
          <div className="flex justify-end">
            <Link
              href="/reset-kata-sandi"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline py-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Lupa kata sandi? Reset di sini
            </Link>
          </div>
        )}

        <button
          type="submit"
          aria-busy={loading || undefined}
          disabled={
            isBusy ||
            !email.trim() ||
            !password.trim() ||
            (mode === 'register' && (!otpVerified || !fullName.trim() || !confirmPassword.trim())) ||
            (mode === 'login' && lockoutSeconds > 0)
          }
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-2xl transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : mode === 'login' && lockoutSeconds > 0 ? (
            <Lock className="w-4 h-4 shrink-0" />
          ) : mode === 'login' ? (
            <LogIn className="w-4 h-4 shrink-0" />
          ) : (
            <UserPlus className="w-4 h-4 shrink-0" />
          )}
          <span>
            {mode === 'login'
              ? loading
                ? 'Memproses...'
                : lockoutSeconds > 0
                ? `Akses Dibekukan (${formatLockoutCountdown(lockoutSeconds)})`
                : 'Masuk ke Portal'
              : loading
              ? 'Mendaftarkan...'
              : 'Buat Akun'}
          </span>
        </button>
      </form>
    </div>
  );
}
