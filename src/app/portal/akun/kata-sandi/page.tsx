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
} from 'lucide-react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  status: string;
}

export default function GantiKataSandiPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>('');
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [method, setMethod] = useState<'otp' | 'mfa'>('otp');

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
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);

        const { data: mfaData } = await supabase.auth.mfa.listFactors();
        const verifiedTotp = (mfaData?.totp || []).filter((f) => f.status === 'verified');
        setFactors(verifiedTotp);
        if (verifiedTotp.length > 0) {
          setSelectedFactorId(verifiedTotp[0].id);
        }
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
      const data = await res.json();
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

    if (newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }
    if (!verificationCode.trim()) {
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
      if (method === 'otp') {
        const res = await fetch('/api/akun/kata-sandi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            otpCode: verificationCode.trim(),
            newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', text: data.error || 'Verifikasi OTP gagal.' });
          return;
        }
      } else {
        const supabase = createSupabaseBrowserClient();
        if (!selectedFactorId) {
          setFeedback({
            type: 'error',
            text: 'Anda belum memiliki faktor MFA aktif. Aktifkan di menu Manajemen MFA.',
          });
          return;
        }
        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: selectedFactorId,
          code: verificationCode.trim(),
        });
        if (mfaError) {
          setFeedback({ type: 'error', text: `Verifikasi MFA gagal: ${mfaError.message}` });
          return;
        }

        const { error: updateErr } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateErr) {
          setFeedback({ type: 'error', text: updateErr.message });
          return;
        }
      }

      setNewPassword('');
      setConfirmPassword('');
      setVerificationCode('');
      setOtpSent(false);
      setFeedback({ type: 'success', text: 'Kata sandi akun berhasil diperbarui.' });
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
      <div className="glass-card rounded-3xl p-7 space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-700" /> Ganti Kata Sandi
          </h1>
          <p className="text-xs text-slate-600">
            Demi keamanan, pilih metode verifikasi wajib menggunakan <strong>OTP Email</strong> atau{' '}
            <strong>MFA Authenticator</strong> sebelum menyimpan kata sandi baru.
          </p>
        </div>

        {/* Pilihan Metode Verifikasi */}
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
              <Mail className="w-4 h-4 text-emerald-700" /> Verifikasi OTP Email
            </p>
            <p className="text-[11px] text-slate-500">
              Kirim kode verifikasi ke {email || 'email terdaftar'}.
            </p>
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
              <ShieldCheck className="w-4 h-4 text-emerald-700" /> Verifikasi MFA (Authenticator)
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

        <form onSubmit={handleChangePassword} className="space-y-4">
          {method === 'otp' ? (
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Email Tujuan OTP</p>
                  <p className="text-xs text-slate-500">{email || '-'}</p>
                </div>
                <button
                  type="button"
                  disabled={sendingOtp || !email}
                  onClick={handleSendOtp}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingOtp ? 'Mengirim...' : otpSent ? 'Kirim Ulang OTP' : 'Kirim Kode OTP'}
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode OTP Email
                </label>
                <input
                  required
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Masukkan kode OTP dari email"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Faktor MFA
                </label>
                <select
                  value={selectedFactorId}
                  onChange={(e) => setSelectedFactorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs"
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.friendly_name || 'Authenticator App (TOTP)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode 6 Digit Authenticator
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
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi Baru
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Konfirmasi Kata Sandi Baru
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

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
