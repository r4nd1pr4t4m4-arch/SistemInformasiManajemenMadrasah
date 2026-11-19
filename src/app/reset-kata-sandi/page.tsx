'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { PasswordInput } from '@/components/auth/password-strength-input';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  status: string;
}

function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ResetKataSandiPage() {
  const [method, setMethod] = useState<'otp' | 'mfa'>('otp');
  const [email, setEmail] = useState('');
  const [sessionUserName, setSessionUserName] = useState<string | undefined>(undefined);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');

  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [selectedFactorId, setSelectedFactorId] = useState('');
  const [checkingMfa, setCheckingMfa] = useState(true);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const isBusy = submitting || sendingOtp;

  useEffect(() => {
    let active = true;
    async function checkSessionMfa() {
      if (!isSupabaseConfigured()) {
        if (active) setCheckingMfa(false);
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;

        if (user?.email) {
          setEmail(user.email);
        }
        const metaName =
          typeof user?.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : undefined;
        if (metaName) {
          setSessionUserName(metaName);
        }

        const { data: mfaData } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        const verified = (mfaData?.totp || []).filter((f) => f.status === 'verified');
        setFactors(verified);
        if (verified.length > 0) setSelectedFactorId(verified[0].id);
      } catch {
        // User belum login, gunakan OTP Email
      } finally {
        if (active) setCheckingMfa(false);
      }
    }
    checkSessionMfa();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function handleSelectMethod(nextMethod: 'otp' | 'mfa') {
    if (isBusy || nextMethod === method) return;
    setMethod(nextMethod);
    setVerificationCode('');
    setFeedback(null);
    setResetSuccess(false);
  }

  async function handleSendOtp() {
    setFeedback(null);
    setResetSuccess(false);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setFeedback({ type: 'error', text: 'Masukkan alamat email akun Anda terlebih dahulu.' });
      return;
    }
    if (!isValidEmailFormat(trimmedEmail)) {
      setFeedback({ type: 'error', text: 'Format alamat email tidak valid.' });
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/reset-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mengirim kode OTP.' });
        return;
      }
      setOtpSent(true);
      setResendCooldown(60);
      setFeedback({
        type: 'success',
        text: data.message || `Kode OTP 6 digit telah dikirim ke ${trimmedEmail}.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Terjadi kesalahan jaringan saat mengirim OTP. Periksa koneksi Anda.',
      });
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setResetSuccess(false);

    const trimmedEmail = email.trim();
    const trimmedCode = verificationCode.trim();

    if (method === 'otp' && !isValidEmailFormat(trimmedEmail)) {
      setFeedback({ type: 'error', text: 'Masukkan alamat email yang valid.' });
      return;
    }

    if (trimmedCode.length !== 6) {
      setFeedback({
        type: 'error',
        text:
          method === 'otp'
            ? 'Masukkan 6 digit kode OTP yang dikirim ke email Anda.'
            : 'Masukkan 6 digit kode dari aplikasi Authenticator MFA Anda.',
      });
      return;
    }

    const policy = validatePasswordStrength(newPassword, sessionUserName);
    if (!policy.isValid) {
      setFeedback({
        type: 'error',
        text: `Kata sandi baru belum memenuhi syarat: ${policy.errors[0]}`,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }

    setSubmitting(true);
    try {
      if (method === 'otp') {
        const res = await fetch('/api/auth/reset-password/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            otpCode: trimmedCode,
            newPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: 'error', text: data.error || 'Reset kata sandi gagal.' });
          return;
        }
        setNewPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setOtpSent(false);
        setResendCooldown(0);
        setResetSuccess(true);
        setFeedback({
          type: 'success',
          text: data.message || 'Kata sandi berhasil direset. Silakan masuk dengan kata sandi baru.',
        });
      } else {
        if (!isSupabaseConfigured()) {
          setFeedback({
            type: 'error',
            text: 'Layanan autentikasi sedang tidak tersedia.',
          });
          return;
        }
        if (!selectedFactorId) {
          setFeedback({
            type: 'error',
            text: 'Verifikasi MFA saat reset membutuhkan sesi aktif dengan MFA terpasang. Gunakan metode Kode OTP Email.',
          });
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({
          factorId: selectedFactorId,
          code: trimmedCode,
        });
        if (mfaErr) {
          setFeedback({ type: 'error', text: `Verifikasi MFA gagal: ${mfaErr.message}` });
          return;
        }
        const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
        if (updErr) {
          setFeedback({ type: 'error', text: updErr.message });
          return;
        }
        setNewPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setResetSuccess(true);
        setFeedback({
          type: 'success',
          text: 'Kata sandi berhasil direset melalui verifikasi MFA.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Terjadi kesalahan jaringan saat memproses reset kata sandi. Silakan coba lagi.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh simms-ambient flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-lg my-auto space-y-4 sm:space-y-5">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 min-h-[40px] text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/85 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Kembali ke Halaman Masuk</span>
        </Link>

        <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Reset Kata Sandi
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Pilih metode verifikasi menggunakan <strong>Kode OTP Email</strong> atau{' '}
                <strong>MFA Authenticator</strong> untuk mengatur ulang kata sandi Anda.
              </p>
            </div>
          </div>

          {/* Pilihan Metode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Metode Verifikasi Reset Kata Sandi">
            <button
              type="button"
              role="radio"
              aria-checked={method === 'otp'}
              disabled={isBusy}
              onClick={() => handleSelectMethod('otp')}
              className={`modular-card rounded-2xl p-4 text-left space-y-1 border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60 ${
                method === 'otp'
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-slate-200/70 hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Kode OTP Email</span>
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kirim kode 6 digit ke email terdaftar.
              </p>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={method === 'mfa'}
              disabled={isBusy}
              onClick={() => handleSelectMethod('mfa')}
              className={`modular-card rounded-2xl p-4 text-left space-y-1 border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60 ${
                method === 'mfa'
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-slate-200/70 hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Verifikasi MFA</span>
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {checkingMfa
                  ? 'Memeriksa sesi perangkat...'
                  : factors.length > 0
                  ? `${factors.length} perangkat MFA terdeteksi.`
                  : 'Membutuhkan sesi aktif dengan MFA.'}
              </p>
            </button>
          </div>

          {feedback && (
            <div
              role="alert"
              aria-live="polite"
              className={`p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 leading-relaxed break-words ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p>{feedback.text}</p>
                {resetSuccess && (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                  >
                    Masuk ke Portal Sekarang →
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleResetSubmit} className="space-y-4">
            {method === 'otp' ? (
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email Akun
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-email"
                      required
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setOtpSent(false);
                        setResendCooldown(0);
                      }}
                      placeholder="nama@lembaga.sch.id"
                      className="w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={sendingOtp || !email.trim() || (otpSent && resendCooldown > 0)}
                    onClick={handleSendOtp}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    {sendingOtp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Send className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {sendingOtp
                        ? 'Mengirim...'
                        : otpSent
                        ? resendCooldown > 0
                          ? `Kirim Ulang (${resendCooldown}d)`
                          : 'Kirim Ulang OTP'
                        : 'Kirim OTP'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              email && (
                <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between gap-2">
                  <span>Akun sesi aktif:</span>
                  <strong className="text-slate-900 truncate">{email}</strong>
                </div>
              )
            )}

            {method === 'mfa' && factors.length > 1 && (
              <div>
                <label
                  htmlFor="reset-mfa-factor"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Pilih Perangkat Authenticator
                </label>
                <select
                  id="reset-mfa-factor"
                  value={selectedFactorId}
                  onChange={(e) => setSelectedFactorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                >
                  {factors.map((factor, idx) => (
                    <option key={factor.id} value={factor.id}>
                      {factor.friendly_name || `Authenticator #${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {method === 'mfa' && factors.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                {checkingMfa
                  ? 'Memeriksa status sesi MFA pada perangkat ini...'
                  : (
                    <>
                      Sesi MFA tidak terdeteksi pada perangkat ini. Silakan pilih metode{' '}
                      <strong>Kode OTP Email</strong> di atas untuk mereset kata sandi.
                    </>
                  )}
              </div>
            ) : (
              <div>
                <label
                  htmlFor="reset-verification-code"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  {method === 'otp' ? 'Kode OTP Email (6 Digit)' : 'Kode 6 Digit Authenticator MFA'}
                </label>
                <input
                  id="reset-verification-code"
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/95 px-3.5 py-2.5 text-sm font-mono tracking-widest text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                />
              </div>
            )}

            <PasswordInput
              id="reset-new-password"
              label="Kata Sandi Baru"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Minimal 8 karakter kuat"
              showStrength={true}
              userName={sessionUserName}
              autoComplete="new-password"
            />

            <PasswordInput
              id="reset-confirm-password"
              label="Konfirmasi Kata Sandi Baru"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Ulangi kata sandi baru"
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={submitting || (method === 'mfa' && factors.length === 0)}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-2xl text-sm transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{submitting ? 'Memproses...' : 'Reset Kata Sandi'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
