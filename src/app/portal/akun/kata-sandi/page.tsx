'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { PasswordInput } from '@/components/auth/password-strength-input';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  status: string;
}

export default function GantiKataSandiPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [method, setMethod] = useState<'otp' | 'mfa'>('otp');

  const [currentPassword, setCurrentPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [selectedFactorId, setSelectedFactorId] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      try {
        const [meRes, mfaResult] = await Promise.all([
          fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
          createSupabaseBrowserClient().auth.mfa.listFactors(),
        ]);

        if (meRes?.user) {
          setEmail(meRes.user.email || '');
          setFullName(meRes.user.fullName || '');
        } else {
          const {
            data: { user },
          } = await createSupabaseBrowserClient().auth.getUser();
          if (user?.email) setEmail(user.email);
        }

        const verifiedTotp = (mfaResult.data?.totp || []).filter((f) => f.status === 'verified');
        setFactors(verifiedTotp);
        if (verifiedTotp.length > 0) {
          setSelectedFactorId(verifiedTotp[0].id);
        }
      } catch {
        setFeedback({ type: 'error', text: 'Gagal memuat data keamanan akun. Silakan muat ulang halaman.' });
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleSendOtp() {
    if (!email) return;
    setFeedback(null);
    setSendingOtp(true);
    try {
      const res = await fetch('/api/akun/otp/send', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mengirim kode OTP.' });
      } else {
        setOtpSent(true);
        setFeedback({
          type: 'success',
          text:
            data.message ||
            `Kode OTP 6 digit telah dikirim ke ${email}. Periksa kotak masuk atau folder spam Anda.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Gagal terhubung ke server.' });
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword) {
      setFeedback({ type: 'error', text: 'Masukkan kata sandi saat ini terlebih dahulu.' });
      return;
    }

    if (newPassword === currentPassword) {
      setFeedback({
        type: 'error',
        text: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
      });
      return;
    }

    const policy = validatePasswordStrength(newPassword, fullName);
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
    if (verificationCode.trim().length !== 6) {
      setFeedback({
        type: 'error',
        text:
          method === 'otp'
            ? 'Masukkan kode OTP 6 digit dari email Anda terlebih dahulu.'
            : 'Masukkan kode 6 digit dari aplikasi Authenticator MFA Anda.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (method === 'mfa') {
        if (!selectedFactorId) {
          setFeedback({
            type: 'error',
            text: 'Anda belum memiliki faktor MFA aktif. Aktifkan di menu Manajemen MFA.',
          });
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: selectedFactorId,
          code: verificationCode.trim(),
        });
        if (mfaError) {
          setFeedback({ type: 'error', text: `Verifikasi MFA gagal: ${mfaError.message}` });
          return;
        }
      }

      const res = await fetch('/api/akun/kata-sandi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          currentPassword,
          otpCode: verificationCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal memperbarui kata sandi.' });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setVerificationCode('');
      setOtpSent(false);
      setFeedback({ type: 'success', text: 'Kata sandi akun berhasil diperbarui.' });
    } catch {
      setFeedback({ type: 'error', text: 'Gagal terhubung ke server. Silakan coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat keamanan akun...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-7 space-y-6 min-w-0">
        <div className="space-y-1">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Ganti Kata Sandi</span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Masukkan <strong>Kata Sandi Saat Ini</strong> dan pilih verifikasi via{' '}
            <strong>OTP Email</strong> atau <strong>MFA Authenticator</strong> sebelum menyimpan kata sandi baru.
          </p>
        </div>

        {/* Pilihan Metode Verifikasi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={method === 'otp'}
            onClick={() => {
              setMethod('otp');
              setVerificationCode('');
              setFeedback(null);
            }}
            className={`modular-card rounded-2xl p-4 text-left space-y-1 border-2 transition min-w-0 ${
              method === 'otp'
                ? 'border-emerald-600 bg-emerald-50/40'
                : 'border-transparent hover:border-slate-200'
            }`}
          >
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-emerald-700 shrink-0" /> Verifikasi OTP Email
            </p>
            <p className="text-[11px] text-slate-500 break-all">
              Kirim kode verifikasi ke {email || 'email terdaftar'}.
            </p>
          </button>

          <button
            type="button"
            aria-pressed={method === 'mfa'}
            onClick={() => {
              setMethod('mfa');
              setVerificationCode('');
              setFeedback(null);
            }}
            className={`modular-card rounded-2xl p-4 text-left space-y-1 border-2 transition min-w-0 ${
              method === 'mfa'
                ? 'border-emerald-600 bg-emerald-50/40'
                : 'border-transparent hover:border-slate-200'
            }`}
          >
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" /> Verifikasi MFA (Authenticator)
            </p>
            <p className="text-[11px] text-slate-500">
              {factors.length > 0
                ? `${factors.length} faktor MFA aktif siap digunakan.`
                : 'Belum ada MFA aktif — aktifkan terlebih dahulu.'}
            </p>
          </button>
        </div>

        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-700'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="break-words">{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Tutup pesan"
              className="p-1 rounded-lg hover:bg-black/5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordInput
            label="Kata Sandi Saat Ini"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Masukkan kata sandi Anda sekarang"
          />

          {method === 'otp' ? (
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">Email Tujuan OTP</p>
                  <p className="text-xs text-slate-500 break-all">{email || '-'}</p>
                </div>
                <button
                  type="button"
                  disabled={sendingOtp || !email}
                  onClick={handleSendOtp}
                  className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0"
                >
                  {sendingOtp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {sendingOtp ? 'Mengirim...' : otpSent ? 'Kirim Ulang OTP' : 'Kirim Kode OTP'}
                </button>
              </div>
              <div>
                <label htmlFor="pwd-otp-code" className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode OTP Email
                </label>
                <input
                  id="pwd-otp-code"
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Masukkan kode OTP 6 digit dari email"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            </div>
          ) : factors.length === 0 ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
              <p className="font-semibold">Anda belum mengaktifkan MFA Authenticator.</p>
              <Link
                href="/portal/akun/mfa"
                className="inline-block font-bold underline text-amber-900"
              >
                Buka Manajemen MFA untuk aktivasi →
              </Link>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div>
                <label htmlFor="pwd-mfa-factor" className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Faktor MFA
                </label>
                <select
                  id="pwd-mfa-factor"
                  value={selectedFactorId}
                  onChange={(e) => setSelectedFactorId(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.friendly_name || 'Authenticator App (TOTP)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pwd-mfa-code" className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode 6 Digit Authenticator
                </label>
                <input
                  id="pwd-mfa-code"
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          <PasswordInput
            label="Kata Sandi Baru"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Minimal 8 karakter kuat"
            showStrength={true}
            userName={fullName}
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-2xl text-sm transition"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Memverifikasi & Menyimpan...' : 'Verifikasi & Ganti Kata Sandi'}
          </button>
        </form>
      </div>
    </div>
  );
}
