'use client';

import { CheckCircle2, KeyRound, Loader2, RefreshCw } from 'lucide-react';

interface RegisterOtpViewProps {
  email: string;
  otpCode: string;
  otpSent: boolean;
  otpVerified: boolean;
  otpSending: boolean;
  otpVerifying: boolean;
  resendCooldown: number;
  onOtpCodeChange: (value: string) => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
}

export function RegisterOtpView({
  email,
  otpCode,
  otpSent,
  otpVerified,
  otpSending,
  otpVerifying,
  resendCooldown,
  onOtpCodeChange,
  onVerifyOtp,
  onResendOtp,
}: RegisterOtpViewProps) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="login-otp"
          className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>Kode OTP Verifikasi Email</span>
        </label>
        {otpVerified && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Email Terverifikasi
          </span>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="login-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otpCode}
          disabled={otpVerified}
          onChange={(e) => onOtpCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Masukkan 6 digit OTP"
          className="flex-1 min-w-0 rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm tracking-widest font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 disabled:bg-slate-100 transition"
        />
        <button
          type="button"
          aria-busy={otpVerifying || undefined}
          disabled={otpVerifying || otpVerified || otpCode.trim().length !== 6}
          onClick={onVerifyOtp}
          className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          {otpVerifying && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
          <span>
            {otpVerified
              ? 'Terverifikasi'
              : otpVerifying
              ? 'Memeriksa...'
              : 'Verifikasi OTP'}
          </span>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <p className="text-[11px] text-slate-500 flex-1 min-w-0 leading-relaxed">
          {otpSent
            ? 'Belum menerima email atau kode OTP kedaluwarsa? Anda dapat meminta kode OTP baru.'
            : 'Klik "Kirim OTP", masukkan kode 6 digit dari email Anda, lalu klik "Verifikasi OTP".'}
        </p>
        {otpSent && !otpVerified && (
          <button
            type="button"
            disabled={otpSending || !email.trim() || resendCooldown > 0}
            onClick={onResendOtp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-300 text-emerald-700 disabled:text-slate-400 disabled:hover:bg-white disabled:hover:border-slate-300 text-[11px] font-semibold transition shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${otpSending ? 'animate-spin' : ''}`} />
            {otpSending
              ? 'Mengirim Ulang...'
              : resendCooldown > 0
              ? `Request Ulang OTP (${resendCooldown}d)`
              : 'Request Ulang Kode OTP'}
          </button>
        )}
      </div>
    </div>
  );
}
