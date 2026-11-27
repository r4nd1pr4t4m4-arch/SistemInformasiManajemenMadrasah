'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
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
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Konfirmasi hapus faktor MFA
  const [confirmUnenroll, setConfirmUnenroll] = useState<TotpFactor | null>(null);

  // Reset MFA state (verifikasi password saat ini + OTP email)
  const [resetPassword, setResetPassword] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [sendingResetOtp, setSendingResetOtp] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpCooldown, setResetOtpCooldown] = useState(0);
  const [resettingMfa, setResettingMfa] = useState(false);

  // Backup Recovery Codes MFA
  const [recoveryStats, setRecoveryStats] = useState<{
    totalCount: number;
    remainingCount: number;
    lastGeneratedAt: string | null;
  } | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const copyCodesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resetOtpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetOtpCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetOtpCooldown]);

  const loadRecoveryStats = useCallback(async () => {
    try {
      const res = await fetch('/api/akun/mfa/recovery-codes', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setRecoveryStats({
          totalCount: Number(data.totalCount || 0),
          remainingCount: Number(data.remainingCount || 0),
          lastGeneratedAt: data.lastGeneratedAt || null,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  async function handleGenerateRecoveryCodes() {
    setGeneratingCodes(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/akun/mfa/recovery-codes', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.codes)) {
        setGeneratedCodes(data.codes);
        setRecoveryStats({
          totalCount: data.codes.length,
          remainingCount: data.codes.length,
          lastGeneratedAt: new Date().toISOString(),
        });
        setFeedback({
          type: 'success',
          text: data.message || 'Kode pemulihan cadangan MFA berhasil dibuat.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'Gagal membuat kode pemulihan cadangan MFA.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setGeneratingCodes(false);
    }
  }

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (copyCodesTimerRef.current) clearTimeout(copyCodesTimerRef.current);
    };
  }, []);

  // Tutup modal konfirmasi dengan tombol Escape
  useEffect(() => {
    if (!confirmUnenroll) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        setConfirmUnenroll(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmUnenroll, busy]);

  const loadFactors = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setFeedback({ type: 'error', text: error.message || 'Gagal memuat daftar perangkat MFA.' });
        return;
      }
      setFactors(data?.totp || []);
    } catch {
      setFeedback({ type: 'error', text: 'Terjadi kesalahan saat memuat pengaturan MFA.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadFactors();
      void loadRecoveryStats();
    }, 0);
    return () => clearTimeout(id);
  }, [loadFactors, loadRecoveryStats]);

  async function handleStartEnroll() {
    if (!isSupabaseConfigured()) {
      setFeedback({ type: 'error', text: 'Layanan autentikasi belum dikonfigurasi.' });
      return;
    }
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
      setVerifyCode('');
    } catch {
      setFeedback({ type: 'error', text: 'Terjadi kesalahan saat menyiapkan QR Code MFA.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelEnroll() {
    const current = enrolling;
    setEnrolling(null);
    setVerifyCode('');
    setCopiedSecret(false);
    if (current && isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.mfa.unenroll({ factorId: current.factorId });
      } catch {
        // Abaikan jika gagal membersihkan faktor unverified
      }
    }
  }

  async function copyTextSafely(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Lanjut ke fallback textarea
      }
    }
    if (typeof document === 'undefined') return false;
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleCopySecret() {
    if (!enrolling?.secret) return;
    const ok = await copyTextSafely(enrolling.secret);
    if (!ok) {
      setFeedback({ type: 'error', text: 'Gagal menyalin secret ke clipboard.' });
      return;
    }
    setCopiedSecret(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedSecret(false), 2000);
  }

  async function handleCopyRecoveryCodes() {
    if (generatedCodes.length === 0) return;
    const ok = await copyTextSafely(generatedCodes.join('\n'));
    if (!ok) {
      setFeedback({ type: 'error', text: 'Gagal menyalin kode pemulihan ke clipboard.' });
      return;
    }
    setCopiedCodes(true);
    if (copyCodesTimerRef.current) clearTimeout(copyCodesTimerRef.current);
    copyCodesTimerRef.current = setTimeout(() => setCopiedCodes(false), 2500);
  }

  async function handleVerifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    const cleanCode = verifyCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setFeedback({ type: 'error', text: 'Masukkan 6 digit kode verifikasi dari aplikasi Authenticator.' });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.factorId,
        code: cleanCode,
      });
      if (error) {
        setFeedback({ type: 'error', text: `Kode tidak valid: ${error.message}` });
      } else {
        setEnrolling(null);
        setVerifyCode('');
        setCopiedSecret(false);
        setFeedback({ type: 'success', text: 'MFA Authenticator berhasil diaktifkan.' });
        await loadFactors();
      }
    } catch {
      setFeedback({ type: 'error', text: 'Terjadi kesalahan saat memverifikasi kode MFA.' });
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
        setFeedback({ type: 'error', text: error.message || 'Gagal menghapus perangkat MFA.' });
      } else {
        if (enrolling?.factorId === factorId) {
          setEnrolling(null);
          setVerifyCode('');
        }
        setConfirmUnenroll(null);
        setFeedback({ type: 'success', text: 'Faktor MFA berhasil dihapus.' });
        await loadFactors();
      }
    } catch {
      setFeedback({ type: 'error', text: 'Terjadi kesalahan saat menghapus perangkat MFA.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendResetOtp() {
    if (sendingResetOtp || resettingMfa || resetOtpCooldown > 0) return;
    setFeedback(null);
    setSendingResetOtp(true);
    try {
      const res = await fetch('/api/akun/otp/send', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mengirim OTP.' });
      } else {
        setResetOtpSent(true);
        setResetOtpCooldown(60);
        setFeedback({ type: 'success', text: data.message || 'Kode OTP dikirim ke email Anda.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Koneksi gagal saat mengirim kode OTP.' });
    } finally {
      setSendingResetOtp(false);
    }
  }

  async function handleResetMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPassword) {
      setFeedback({ type: 'error', text: 'Kata sandi saat ini wajib diisi.' });
      return;
    }
    const cleanOtp = resetOtp.trim();
    if (!cleanOtp) {
      setFeedback({ type: 'error', text: 'Kode OTP email wajib diisi.' });
      return;
    }
    setFeedback(null);
    setResettingMfa(true);
    try {
      const res = await fetch('/api/akun/mfa/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: resetPassword,
          otpCode: cleanOtp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal mereset MFA.' });
      } else {
        setResetPassword('');
        setResetOtp('');
        setResetOtpSent(false);
        setEnrolling(null);
        setVerifyCode('');
        setFeedback({ type: 'success', text: data.message || 'Berhasil mereset MFA.' });
        await loadFactors();
      }
    } catch {
      setFeedback({ type: 'error', text: 'Koneksi gagal saat mereset MFA.' });
    } finally {
      setResettingMfa(false);
    }
  }

  const verifiedCount = factors.filter((f) => f.status === 'verified').length;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2.5">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
        <span>Memuat pengaturan MFA...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Status Ringkas Keamanan MFA */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${verifiedCount > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
              }`}
          >
            {verifiedCount > 0 ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Autentikasi Dua Faktor (MFA)
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {verifiedCount > 0
                ? `Akun Anda dilindungi oleh ${verifiedCount} perangkat Authenticator aktif.`
                : 'Belum ada perangkat MFA aktif. Aktifkan Authenticator untuk keamanan ekstra.'}
            </p>
          </div>
        </div>
        <span
          className={`self-start sm:self-center shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${verifiedCount > 0
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${verifiedCount > 0 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
          />
          {verifiedCount > 0 ? 'MFA Aktif' : 'MFA Nonaktif'}
        </span>
      </div>

      {feedback && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-3.5 sm:p-4 rounded-2xl text-xs font-medium flex items-start sm:items-center justify-between gap-3 ${feedback.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
        >
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="break-words">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        {/* Tambah Faktor MFA */}
        <div className="md:col-span-6 min-w-0 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Aktifkan Authenticator (TOTP)</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Gunakan Google Authenticator, Microsoft Authenticator, atau Authy untuk verifikasi dua langkah.
            </p>
          </div>

          {!enrolling ? (
            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="mfa-friendly-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Label Perangkat
                </label>
                <input
                  id="mfa-friendly-name"
                  type="text"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  placeholder="Contoh: HP Utama"
                  maxLength={50}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleStartEnroll}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{busy ? 'Menyiapkan QR...' : 'Daftarkan MFA Baru'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyEnroll} className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrolling.qrCode}
                  alt="QR Code MFA"
                  className="w-44 h-44 max-w-full rounded-lg border border-slate-100"
                />
                <div className="w-full text-center space-y-1.5">
                  <p className="text-[11px] text-slate-500">Atau masukkan secret manual:</p>
                  <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                    <p className="font-mono text-xs font-bold text-slate-800 break-all select-all">
                      {enrolling.secret}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      title="Salin secret"
                      aria-label="Salin secret MFA"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition shrink-0"
                    >
                      {copiedSecret ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="mfa-verify-code"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Kode 6 Digit dari Aplikasi Authenticator
                </label>
                <input
                  id="mfa-verify-code"
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{busy ? 'Memverifikasi...' : 'Verifikasi & Aktifkan'}</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancelEnroll}
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-semibold transition"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Daftar Faktor MFA + Reset MFA */}
        <div className="md:col-span-6 min-w-0 space-y-5 sm:space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Perangkat MFA Terdaftar ({factors.length})</span>
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
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {f.friendly_name || 'Authenticator App'}
                      </p>
                      <span
                        className={`inline-block mt-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${f.status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                          }`}
                      >
                        {f.status === 'verified' ? 'AKTIF' : 'MENUNGGU VERIFIKASI'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmUnenroll(f)}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition shrink-0"
                      title="Hapus MFA"
                      aria-label={`Hapus perangkat ${f.friendly_name || 'Authenticator App'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kartu Reset MFA */}
          <form onSubmit={handleResetMfa} className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Reset Semua MFA</span>
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
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
              <label
                htmlFor="mfa-reset-otp"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kode OTP Email
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="mfa-reset-otp"
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="flex-1 min-w-0 min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
                />
                <button
                  type="button"
                  disabled={sendingResetOtp || resettingMfa || resetOtpCooldown > 0}
                  onClick={handleSendResetOtp}
                  className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0"
                >
                  {sendingResetOtp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {sendingResetOtp
                      ? 'Mengirim...'
                      : resetOtpCooldown > 0
                        ? `Kirim Ulang (${resetOtpCooldown}d)`
                        : resetOtpSent
                          ? 'Kirim Ulang'
                          : 'Kirim OTP'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={resettingMfa}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition"
            >
              {resettingMfa && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{resettingMfa ? 'Mereset MFA...' : 'Reset Semua MFA'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Backup Recovery Codes MFA */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span>Kode Pemulihan Cadangan (Backup Recovery Codes)</span>
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl">
              Buat 8 kode pemulihan satu kali pakai sebagai cadangan apabila perangkat Authenticator
              Anda hilang atau rusak. Kode hanya ditampilkan sekali saat dibuat.
            </p>
          </div>
          <button
            type="button"
            disabled={generatingCodes}
            onClick={handleGenerateRecoveryCodes}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {generatingCodes ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>
              {recoveryStats && recoveryStats.totalCount > 0
                ? 'Buat Ulang 8 Kode Cadangan'
                : 'Buat 8 Kode Cadangan'}
            </span>
          </button>
        </div>

        {recoveryStats && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3">
            <span>
              Sisa kode aktif:{' '}
              <strong className="text-emerald-700">
                {recoveryStats.remainingCount} / {recoveryStats.totalCount}
              </strong>
            </span>
            {recoveryStats.lastGeneratedAt &&
              !Number.isNaN(new Date(recoveryStats.lastGeneratedAt).getTime()) && (
                <span>
                  • Terakhir dibuat:{' '}
                  <strong>
                    {new Date(recoveryStats.lastGeneratedAt).toLocaleString('id-ID')}
                  </strong>
                </span>
              )}
          </div>
        )}

        {generatedCodes.length > 0 && (
          <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-900">
                Simpan kode ini sekarang — tidak akan ditampilkan kembali setelah halaman ditutup:
              </p>
              <button
                type="button"
                onClick={() => void handleCopyRecoveryCodes()}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold hover:bg-amber-100/50 transition"
              >
                {copiedCodes ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodes ? 'Tersalin!' : 'Salin Semua Kode'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {generatedCodes.map((code) => (
                <div
                  key={code}
                  className="px-3 py-2 rounded-xl bg-white border border-amber-200 font-mono text-xs font-bold text-center text-slate-900 tracking-wider"
                >
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Faktor MFA */}
      {confirmUnenroll && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-unenroll-title"
          onClick={() => {
            if (!busy) setConfirmUnenroll(null);
          }}
        >
          <div
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id="confirm-unenroll-title" className="text-base font-bold text-slate-900">
                  Hapus Perangkat MFA?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Perangkat <strong>{confirmUnenroll.friendly_name || 'Authenticator App'}</strong>{' '}
                  akan dihapus dari akun Anda dan tidak dapat lagi digunakan untuk verifikasi login.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmUnenroll(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleUnenroll(confirmUnenroll.id)}
                className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{busy ? 'Menghapus...' : 'Ya, Hapus Perangkat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
