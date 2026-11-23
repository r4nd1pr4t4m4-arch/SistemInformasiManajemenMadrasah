'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { PasswordInput } from '@/components/auth/password-strength-input';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';

interface StatusMessage {
  type: 'error' | 'success';
  text: string;
}

const ACCOUNT_STATUS_MESSAGES: Record<string, string> = {
  DITOLAK_PERMANEN:
    'Pendaftaran akun Anda ditolak secara permanen oleh Admin dan alamat email ini tidak dapat digunakan untuk mendaftar ulang.',
  DITOLAK:
    'Pendaftaran akun Anda ditolak oleh Admin. Anda masih dapat mendaftar ulang menggunakan email yang sama pada tab "Daftar Akun".',
  NONAKTIF:
    'Akun Anda sedang dinonaktifkan oleh Admin. Hubungi operator lembaga.',
  PENDING:
    'Akun Anda belum aktif dan sedang menunggu persetujuan Admin.',
};

function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getSafeRedirectPath(rawNext: string | null): string {
  if (!rawNext) return '/portal';
  if (
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\') &&
    !rawNext.startsWith('/login')
  ) {
    return rawNext;
  }
  return '/portal';
}

function LoginCardSkeleton() {
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

function LoginCardContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [duplicateEmailModal, setDuplicateEmailModal] = useState<{
    email: string;
    accountStatus: string;
  } | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [urlStatusDismissed, setUrlStatusDismissed] = useState(false);
  const [loginCaptchaRequired, setLoginCaptchaRequired] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [loginWarningModal, setLoginWarningModal] = useState<{
    email: string;
    failedAttempts: number;
    maxAttempts: number;
    remainingAttempts: number;
    detectedAtWib: string;
  } | null>(null);

  const captcha = useSmartCaptcha(mode === 'register' || loginCaptchaRequired);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/login', { cache: 'no-store' })
      .then((res) => res.json().catch(() => null))
      .then(
        (
          data: {
            requireCaptcha?: boolean;
            isLocked?: boolean;
            remainingLockSeconds?: number;
          } | null
        ) => {
          if (!active || !data) return;
          if (data.requireCaptcha) {
            setLoginCaptchaRequired(true);
          }
          if (data.isLocked && data.remainingLockSeconds) {
            setLockoutSeconds(data.remainingLockSeconds);
          }
        }
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (!loginWarningModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLoginWarningModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginWarningModal]);

  const statusParam = searchParams.get('account_status') || '';
  const urlStatusText = ACCOUNT_STATUS_MESSAGES[statusParam] || null;
  const activeMessage: StatusMessage | null =
    message ??
    (!urlStatusDismissed && urlStatusText ? { type: 'error', text: urlStatusText } : null);

  const isBusy = loading || otpSending || otpVerifying;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!duplicateEmailModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDuplicateEmailModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duplicateEmailModal]);

  function switchMode(nextMode: 'login' | 'register') {
    if (isBusy || nextMode === mode) return;
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setMessage(null);
    setUrlStatusDismissed(true);
  }

  async function handleSendRegisterOtp(isResend = false) {
    setMessage(null);
    setUrlStatusDismissed(true);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage({ type: 'error', text: 'Masukkan alamat email terlebih dahulu.' });
      return;
    }
    if (!isValidEmailFormat(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Format alamat email tidak valid.' });
      return;
    }

    setOtpSending(true);
    try {
      const captchaPayload = await captcha.executeCaptcha();
      const res = await fetch('/api/auth/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          fullName: fullName.trim(),
          captcha: captchaPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.turnstileUnavailable) {
          captcha.forceLocalFallback();
        }
        if (res.status === 409 || data.code === 'EMAIL_ALREADY_REGISTERED') {
          setDuplicateEmailModal({
            email: data.email || trimmedEmail,
            accountStatus: data.accountStatus || 'AKTIF',
          });
          return;
        }
        setMessage({ type: 'error', text: data.error || 'Gagal mengirim kode OTP.' });
        return;
      }
      setOtpSent(true);
      setOtpVerified(false);
      setOtpCode('');
      setResendCooldown(60);
      setMessage({
        type: 'success',
        text: isResend
          ? `Kode OTP baru 6 digit telah dikirim ulang ke ${trimmedEmail}.`
          : data.message || 'Kode OTP 6 digit telah dikirim ke email Anda.',
      });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan saat mengirim OTP.' });
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyRegisterOtp() {
    setMessage(null);
    setUrlStatusDismissed(true);
    const trimmedEmail = email.trim();
    const trimmedOtp = otpCode.trim();

    if (!isValidEmailFormat(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Format alamat email tidak valid.' });
      return;
    }
    if (trimmedOtp.length !== 6) {
      setMessage({ type: 'error', text: 'Masukkan 6 digit kode OTP yang dikirim ke email Anda.' });
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch('/api/auth/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, otpCode: trimmedOtp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Kode OTP tidak valid.' });
        return;
      }
      setOtpVerified(true);
      setMessage({
        type: 'success',
        text: data.message || 'Email terverifikasi! Sekarang Anda dapat klik "Buat Akun".',
      });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan saat memverifikasi OTP.' });
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setUrlStatusDismissed(true);

    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Masukkan alamat email yang valid.' });
      return;
    }

    if (!isSupabaseConfigured()) {
      setMessage({
        type: 'error',
        text: 'Layanan autentikasi sedang tidak tersedia.',
      });
      return;
    }

    if (mode === 'register') {
      const trimmedName = fullName.trim();
      if (trimmedName.length < 2) {
        setMessage({ type: 'error', text: 'Nama lengkap minimal 2 karakter.' });
        return;
      }
      if (!otpVerified) {
        setMessage({
          type: 'error',
          text: 'Silakan verifikasi alamat email Anda dengan kode OTP terlebih dahulu sebelum membuat akun.',
        });
        return;
      }
      const policy = validatePasswordStrength(password, trimmedName);
      if (!policy.isValid) {
        setMessage({
          type: 'error',
          text: `Kata sandi belum memenuhi syarat: ${policy.errors[0]}`,
        });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({
          type: 'error',
          text: 'Konfirmasi kata sandi tidak cocok.',
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const captchaPayload = loginCaptchaRequired ? await captcha.executeCaptcha() : undefined;
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
            ...(captchaPayload ? { captcha: captchaPayload } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.requireCaptcha) {
            setLoginCaptchaRequired(true);
          }
          if (data.turnstileUnavailable) {
            captcha.forceLocalFallback();
          }
          if (data.isLocked && data.remainingLockSeconds) {
            setLockoutSeconds(Number(data.remainingLockSeconds) || 900);
            setLoginWarningModal(null);
          } else if (data.showLockWarningModal) {
            setLoginWarningModal({
              email: trimmedEmail,
              failedAttempts: Number(data.failedAttempts) || 3,
              maxAttempts: Number(data.maxAttempts) || 5,
              remainingAttempts: Number(data.remainingAttempts) || 2,
              detectedAtWib: new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Jakarta',
              }),
            });
          }
          setMessage({ type: 'error', text: data.error || 'Gagal masuk. Silakan coba lagi.' });
        } else {
          const safeNext = getSafeRedirectPath(searchParams.get('next'));
          window.location.assign(safeNext);
          return;
        }
      } else {
        const res = await fetch('/api/auth/register/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: trimmedEmail,
            password,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage({ type: 'error', text: data.error || 'Gagal membuat akun.' });
        } else {
          setPassword('');
          setConfirmPassword('');
          setOtpCode('');
          setOtpSent(false);
          setOtpVerified(false);
          setResendCooldown(0);
          setMessage({
            type: 'success',
            text:
              data.message ||
              'Pendaftaran akun berhasil! Email Anda telah terverifikasi dan akun menunggu persetujuan Admin.',
          });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan. Silakan coba lagi.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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
            onClick={() => switchMode('login')}
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
            onClick={() => switchMode('register')}
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
                  Akses masuk dibekukan sementara ({Math.floor(lockoutSeconds / 60)}:
                  {String(lockoutSeconds % 60).padStart(2, '0')})
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  onChange={(e) => setFullName(e.target.value)}
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (mode === 'register') {
                      setOtpVerified(false);
                      setOtpSent(false);
                      setOtpCode('');
                      setResendCooldown(0);
                    }
                  }}
                  placeholder="nama@lembaga.sch.id"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                />
              </div>
              {mode === 'register' && (
                <button
                  type="button"
                  aria-busy={otpSending || undefined}
                  disabled={otpSending || !email.trim() || (otpSent && resendCooldown > 0)}
                  onClick={() => handleSendRegisterOtp(otpSent)}
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
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Masukkan 6 digit OTP"
                  className="flex-1 min-w-0 rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm tracking-widest font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 disabled:bg-slate-100 transition"
                />
                <button
                  type="button"
                  aria-busy={otpVerifying || undefined}
                  disabled={otpVerifying || otpVerified || otpCode.trim().length !== 6}
                  onClick={handleVerifyRegisterOtp}
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
                    onClick={() => handleSendRegisterOtp(true)}
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
          )}

          <PasswordInput
            id="login-password"
            label="Kata Sandi"
            value={password}
            onChange={setPassword}
            placeholder={mode === 'register' ? 'Minimal 8 karakter kuat' : 'Masukkan kata sandi'}
            showStrength={mode === 'register'}
            userName={fullName}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />

          {mode === 'register' && (
            <PasswordInput
              id="login-confirm-password"
              label="Konfirmasi Kata Sandi"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Ulangi kata sandi"
              autoComplete="new-password"
            />
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
              loading ||
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
                  ? `Akses Dibekukan (${Math.floor(lockoutSeconds / 60)}:${String(
                      lockoutSeconds % 60
                    ).padStart(2, '0')})`
                  : 'Masuk ke Portal'
                : loading
                ? 'Mendaftarkan...'
                : 'Buat Akun'}
            </span>
          </button>
        </form>
      </div>

      {duplicateEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-email-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDuplicateEmailModal(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 id="duplicate-email-title" className="text-base font-bold text-slate-900">
                  Alamat Email Sudah Terdaftar
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  Email <strong>{duplicateEmailModal.email}</strong> sudah digunakan pada akun lain,
                  sehingga kode OTP pendaftaran tidak dapat dikirimkan.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
              {duplicateEmailModal.accountStatus === 'PENDING' ? (
                <span>
                  Akun dengan email ini saat ini berstatus{' '}
                  <strong>Menunggu Persetujuan Admin</strong>. Silakan tunggu email notifikasi
                  aktivasi dari Admin.
                </span>
              ) : duplicateEmailModal.accountStatus === 'DITOLAK_PERMANEN' ? (
                <span>
                  Pendaftaran akun dengan email ini telah berstatus{' '}
                  <strong>Ditolak Permanen</strong> oleh Admin. Alamat email ini tidak dapat
                  digunakan lagi untuk mendaftar akun baru.
                </span>
              ) : duplicateEmailModal.accountStatus === 'DITOLAK' ? (
                <span>
                  Pendaftaran akun dengan email ini sebelumnya berstatus <strong>Ditolak</strong>.
                  Silakan hubungi Admin/Operator lembaga atau gunakan alamat email lain.
                </span>
              ) : duplicateEmailModal.accountStatus === 'NONAKTIF' ? (
                <span>
                  Akun dengan email ini saat ini berstatus <strong>Nonaktif</strong>. Silakan
                  hubungi Admin/Operator lembaga untuk pengaktifan kembali.
                </span>
              ) : (
                <span>
                  Akun dengan email ini sudah <strong>Aktif</strong>. Anda dapat langsung masuk
                  melalui tab <strong>Masuk</strong>, atau gunakan fitur{' '}
                  <Link
                    href="/reset-kata-sandi"
                    onClick={() => setDuplicateEmailModal(null)}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Lupa Kata Sandi
                  </Link>{' '}
                  jika tidak mengingat kata sandi Anda.
                </span>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDuplicateEmailModal(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Ganti Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateEmailModal(null);
                  setMode('login');
                  setPassword('');
                  setConfirmPassword('');
                  setOtpCode('');
                  setOtpSent(false);
                  setOtpVerified(false);
                  setResendCooldown(0);
                  setMessage(null);
                  setUrlStatusDismissed(true);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                Pindah ke Tab Masuk
              </button>
            </div>
          </div>
        </div>
      )}
      {loginWarningModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-warning-modal-title"
          onClick={() => setLoginWarningModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/70 to-rose-50/60 border-b border-amber-200/70 px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold tracking-wide uppercase">
                    Peringatan Keamanan Akun
                  </span>
                  <h2
                    id="login-warning-modal-title"
                    className="text-base font-bold text-slate-900 leading-snug"
                  >
                    2 Kesempatan Lagi Sebelum Dibekukan
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLoginWarningModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition"
                aria-label="Tutup peringatan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-slate-700">
                    Percobaan Gagal: {loginWarningModal.failedAttempts} dari{' '}
                    {loginWarningModal.maxAttempts}
                  </span>
                  <span className="text-rose-600">
                    Sisa {loginWarningModal.remainingAttempts} kesempatan
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
                  {Array.from({ length: loginWarningModal.maxAttempts }).map((_, idx) => {
                    const isFailed = idx < loginWarningModal.failedAttempts;
                    return (
                      <div
                        key={idx}
                        className={`h-2 rounded-full transition-colors ${
                          isFailed
                            ? idx === loginWarningModal.failedAttempts - 1
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 text-xs text-slate-700 leading-relaxed space-y-2">
                <p>
                  Anda telah <strong>3 kali gagal masuk</strong> karena alamat email atau kata sandi
                  tidak sesuai. Jika terjadi <strong>2 kali kegagalan lagi</strong>, akses masuk ke
                  akun ini akan <strong>diblokir / dibekukan sementara selama 15 menit</strong>{' '}
                  untuk mencegah penyalahgunaan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5 min-w-0">
                  <span className="text-slate-500 block">Email Dicoba</span>
                  <span className="font-semibold text-slate-900 truncate block">
                    {loginWarningModal.email}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Waktu Deteksi
                  </span>
                  <span className="font-semibold text-slate-900 block">
                    {loginWarningModal.detectedAtWib} WIB
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                  <span className="text-slate-500 block">Batas Maksimal</span>
                  <span className="font-semibold text-rose-700 block">
                    {loginWarningModal.maxAttempts}x gagal berturut-turut
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                  <span className="text-slate-500 block">Durasi Pembekuan</span>
                  <span className="font-semibold text-slate-900 block">15 Menit</span>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Lupa atau Ragu dengan Kata Sandi Anda?</span>
                </p>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  Daripada akun Anda terblokir selama 15 menit, Anda dapat langsung membuat kata
                  sandi baru secara aman melalui verifikasi <strong>OTP Email</strong> atau{' '}
                  <strong>Authenticator (MFA)</strong>. Pastikan juga tombol <code>Caps Lock</code>{' '}
                  tidak aktif sebelum mencoba kembali.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLoginWarningModal(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  Coba Masuk Lagi
                </button>
                <Link
                  href="/reset-kata-sandi"
                  onClick={() => setLoginWarningModal(null)}
                  className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>Reset Kata Sandi</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <SmartCaptchaMount containerRef={captcha.containerRef} />
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh simms-ambient flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-md my-auto space-y-4 sm:space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-[40px] text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/85 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Kembali ke Website Resmi</span>
        </Link>

        <Suspense fallback={<LoginCardSkeleton />}>
          <LoginCardContent />
        </Suspense>
      </div>
    </div>
  );
}
