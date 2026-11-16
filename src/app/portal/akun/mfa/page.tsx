'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { PasswordInput } from '@/components/auth/password-strength-input';

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at?: string;
}

export default function ManajemenMfaPage() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [friendlyName, setFriendlyName] = useState('SIMMS Authenticator');
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Reset MFA state (verifikasi password saat ini + OTP email)
  const [resetPassword, setResetPassword] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [sendingResetOtp, setSendingResetOtp] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resettingMfa, setResettingMfa] = useState(false);

  async function loadFactors() {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.mfa.listFactors();
      setFactors(data?.totp || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFactors();
  }, []);

  async function handleStartEnroll() {
    setFeedback(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendlyName.trim() || 'SIMMS Authenticator',
      });
      if (error || !data) {
        setFeedback({ type: 'error', text: error?.message || 'Gagal memulai aktivasi MFA.' });
        return;
      }
      setEnrolling({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setFeedback(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.factorId,
        code: verifyCode.trim(),
      });
      if (error) {
        setFeedback({ type: 'error', text: `Kode tidak valid: ${error.message}` });
      } else {
        setEnrolling(null);
        setVerifyCode('');
        setFeedback({ type: 'success', text: 'MFA Authenticator berhasil diaktifkan.' });
        await loadFactors();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUnenroll(factorId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        setFeedback({ type: 'error', text: error.message });
      } else {
        setFeedback({ type: 'success', text: 'Faktor MFA berhasil dihapus.' });
        await loadFactors();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSendResetOtp() {
    setFeedback(null);
    setSendingResetOtp(true);
    try {
      const res = await fetch('/api/akun/otp/send', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mengirim OTP.' });
      } else {
        setResetOtpSent(true);
        setFeedback({ type: 'success', text: data.message || 'Kode OTP dikirim ke email Anda.' });
      }
    } finally {
      setSendingResetOtp(false);
    }
  }

  async function handleResetMfa(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setResettingMfa(true);
    try {
      const res = await fetch('/api/akun/mfa/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: resetPassword,
          otpCode: resetOtp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mereset MFA.' });
      } else {
        setResetPassword('');
        setResetOtp('');
        setResetOtpSent(false);
        setFeedback({ type: 'success', text: data.message });
        await loadFactors();
      }
    } finally {
      setResettingMfa(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat pengaturan MFA...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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

      <div className="grid md:grid-cols-12 gap-6">
        {/* Tambah Faktor MFA */}
        <div className="md:col-span-6 glass-card rounded-3xl p-6 space-y-4 h-fit">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-700" /> Aktifkan Authenticator (TOTP)
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Gunakan Google Authenticator, Microsoft Authenticator, atau Authy untuk verifikasi dua langkah.
            </p>
          </div>

          {!enrolling ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Label Perangkat
                </label>
                <input
                  type="text"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleStartEnroll}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
              >
                <Plus className="w-4 h-4" />
                {busy ? 'Menyiapkan QR...' : 'Daftarkan MFA Baru'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyEnroll} className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrolling.qrCode} alt="QR Code MFA" className="w-44 h-44 rounded-lg" />
                <div className="text-center">
                  <p className="text-[11px] text-slate-500">Atau masukkan secret manual:</p>
                  <p className="font-mono text-xs font-bold text-slate-800 break-all mt-0.5">
                    {enrolling.secret}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode 6 Digit dari Aplikasi Authenticator
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs"
                >
                  {busy ? 'Memverifikasi...' : 'Verifikasi & Aktifkan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrolling(null);
                    setVerifyCode('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Daftar Faktor MFA + Reset MFA */}
        <div className="md:col-span-6 space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" /> Perangkat MFA Terdaftar (
              {factors.length})
            </h2>

            {factors.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-600">
                Belum ada perangkat MFA terdaftar pada akun Anda.
              </div>
            ) : (
              <div className="space-y-2.5">
                {factors.map((f) => (
                  <div
                    key={f.id}
                    className="modular-card rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs">
                        {f.friendly_name || 'Authenticator App'}
                      </p>
                      <span
                        className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          f.status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {f.status === 'verified' ? 'AKTIF' : 'MENUNGGU VERIFIKASI'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleUnenroll(f.id)}
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus MFA"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kartu Reset MFA */}
          <form onSubmit={handleResetMfa} className="glass-card rounded-3xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" /> Reset Semua MFA
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Kehilangan perangkat Authenticator? Verifikasi dengan{' '}
                <strong>Kata Sandi Saat Ini</strong> dan <strong>Kode OTP Email</strong> untuk mereset seluruh faktor MFA.
              </p>
            </div>

            <PasswordInput
              label="Kata Sandi Saat Ini"
              value={resetPassword}
              onChange={setResetPassword}
              placeholder="Masukkan kata sandi sekarang"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kode OTP Email
              </label>
              <div className="flex gap-2">
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  placeholder="000000"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono tracking-widest"
                />
                <button
                  type="button"
                  disabled={sendingResetOtp}
                  onClick={handleSendResetOtp}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingResetOtp ? 'Mengirim...' : resetOtpSent ? 'Kirim Ulang' : 'Kirim OTP'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={resettingMfa}
              className="w-full inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              {resettingMfa && <Loader2 className="w-4 h-4 animate-spin" />}
              {resettingMfa ? 'Mereset MFA...' : 'Reset Semua MFA'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
