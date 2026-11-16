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

export default function ResetKataSandiPage() {
  const [method, setMethod] = useState<'otp' | 'mfa'>('otp');
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [selectedFactorId, setSelectedFactorId] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    async function checkSessionMfa() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);
        const { data: mfaData } = await supabase.auth.mfa.listFactors();
        const verified = (mfaData?.totp || []).filter((f) => f.status === 'verified');
        setFactors(verified);
        if (verified.length > 0) setSelectedFactorId(verified[0].id);
      } catch {
        // User belum login, gunakan OTP Email
      }
    }
    checkSessionMfa();
  }, []);

  async function handleSendOtp() {
    if (!email.trim()) {
      setFeedback({ type: 'error', text: 'Masukkan alamat email akun Anda terlebih dahulu.' });
      return;
    }
    setFeedback(null);
    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/reset-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mengirim OTP.' });
      } else {
        setOtpSent(true);
        setFeedback({
          type: 'success',
          text: data.message || `Kode OTP 6 digit telah dikirim ke ${email}.`,
        });
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const policy = validatePasswordStrength(newPassword);
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
    if (!verificationCode.trim()) {
      setFeedback({ type: 'error', text: 'Masukkan kode verifikasi terlebih dahulu.' });
      return;
    }

    setSubmitting(true);
    try {
      if (method === 'otp') {
        const res = await fetch('/api/auth/reset-password/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            otpCode: verificationCode.trim(),
            newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', text: data.error || 'Reset kata sandi gagal.' });
          return;
        }
        setNewPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setFeedback({
          type: 'success',
          text: data.message || 'Kata sandi berhasil direset. Silakan masuk.',
        });
      } else {
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
          code: verificationCode.trim(),
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
        setFeedback({
          type: 'success',
          text: 'Kata sandi berhasil direset melalui verifikasi MFA.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen simms-ambient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-5">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Masuk
        </Link>

        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700" /> Reset Kata Sandi
            </h1>
            <p className="text-xs text-slate-600">
              Pilih metode verifikasi menggunakan <strong>Kode OTP Email</strong> atau{' '}
              <strong>MFA Authenticator</strong> untuk mengatur ulang kata sandi Anda.
            </p>
          </div>

          {/* Pilihan Metode */}
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMethod('otp');
                setVerificationCode('');
                setFeedback(null);
              }}
              className={`modular-card rounded-2xl p-4 text-left space-y-1 border-2 transition ${
                method === 'otp' ? 'border-emerald-600 bg-emerald-50/40' : 'border-transparent'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-700" /> Kode OTP Email
              </p>
              <p className="text-[11px] text-slate-500">Kirim kode 6 digit ke email terdaftar.</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('mfa');
                setVerificationCode('');
                setFeedback(null);
              }}
              className={`modular-card rounded-2xl p-4 text-left space-y-1 border-2 transition ${
                method === 'mfa' ? 'border-emerald-600 bg-emerald-50/40' : 'border-transparent'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" /> Verifikasi MFA
              </p>
              <p className="text-[11px] text-slate-500">
                {factors.length > 0
                  ? `${factors.length} perangkat MFA terdeteksi.`
                  : 'Membutuhkan sesi aktif dengan MFA.'}
              </p>
            </button>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Akun
              </label>
              <div className="flex gap-2">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@lembaga.sch.id"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                />
                {method === 'otp' && (
                  <button
                    type="button"
                    disabled={sendingOtp}
                    onClick={handleSendOtp}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white px-4 rounded-xl text-xs font-semibold transition shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingOtp ? 'Mengirim...' : otpSent ? 'Kirim Ulang' : 'Kirim OTP'}
                  </button>
                )}
              </div>
            </div>

            {method === 'mfa' && factors.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Sesi MFA tidak terdeteksi pada perangkat ini. Silakan pilih metode{' '}
                <strong>Kode OTP Email</strong> di atas untuk mereset kata sandi.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {method === 'otp' ? 'Kode OTP Email (6 Digit)' : 'Kode 6 Digit Authenticator MFA'}
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest"
                />
              </div>
            )}

            <PasswordInput
              label="Kata Sandi Baru"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Minimal 8 karakter kuat"
              showStrength={true}
            />

            <PasswordInput
              label="Konfirmasi Kata Sandi Baru"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Ulangi kata sandi baru"
            />

            <button
              type="submit"
              disabled={submitting || (method === 'mfa' && factors.length === 0)}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl text-sm transition"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Memproses...' : 'Reset Kata Sandi'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
