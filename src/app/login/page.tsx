'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, LogIn, Mail, UserPlus } from 'lucide-react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { PasswordInput } from '@/components/auth/password-strength-input';

export default function LoginPage() {
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
  const [duplicateEmailModal, setDuplicateEmailModal] = useState<{
    email: string;
    accountStatus: string;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('account_status');
    if (statusParam === 'DITOLAK') {
      setMessage({
        type: 'error',
        text: 'Pendaftaran akun Anda ditolak oleh Admin.',
      });
    } else if (statusParam === 'NONAKTIF') {
      setMessage({
        type: 'error',
        text: 'Akun Anda sedang dinonaktifkan oleh Admin. Hubungi operator lembaga.',
      });
    } else if (statusParam === 'PENDING') {
      setMessage({
        type: 'error',
        text: 'Akun Anda belum aktif dan sedang menunggu persetujuan Admin.',
      });
    }
  }, []);

  async function handleSendRegisterOtp() {
    setMessage(null);
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Masukkan alamat email terlebih dahulu.' });
      return;
    }

    setOtpSending(true);
    try {
      const res = await fetch('/api/auth/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 || data.code === 'EMAIL_ALREADY_REGISTERED') {
          setDuplicateEmailModal({
            email: data.email || email.trim(),
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
      setMessage({
        type: 'success',
        text: data.message || 'Kode OTP 6 digit telah dikirim ke email Anda.',
      });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan saat mengirim OTP.' });
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyRegisterOtp() {
    setMessage(null);
    if (otpCode.trim().length !== 6) {
      setMessage({ type: 'error', text: 'Masukkan 6 digit kode OTP yang dikirim ke email Anda.' });
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch('/api/auth/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otpCode: otpCode.trim() }),
      });
      const data = await res.json();
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

    if (!isSupabaseConfigured()) {
      setMessage({
        type: 'error',
        text: 'Layanan autentikasi sedang tidak tersedia.',
      });
      return;
    }

    if (mode === 'register') {
      if (!otpVerified) {
        setMessage({
          type: 'error',
          text: 'Silakan verifikasi alamat email Anda dengan kode OTP terlebih dahulu sebelum membuat akun.',
        });
        return;
      }
      const policy = validatePasswordStrength(password, fullName);
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
      const supabase = createSupabaseBrowserClient();

      if (mode === 'login') {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else if (authData.user) {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('is_active, account_status, rejection_reason')
            .eq('id', authData.user.id)
            .maybeSingle();

          const fallbackProfile = profileErr
            ? (
                await supabase
                  .from('profiles')
                  .select('is_active')
                  .eq('id', authData.user.id)
                  .maybeSingle()
              ).data
            : profile;

          const accountStatus = (profile as { account_status?: string } | null)?.account_status;
          const rejectionReason = (profile as { rejection_reason?: string | null } | null)?.rejection_reason;
          const isAllowed =
            Boolean(fallbackProfile?.is_active) && (!accountStatus || accountStatus === 'AKTIF');

          if (!isAllowed) {
            await supabase.auth.signOut();
            if (accountStatus === 'DITOLAK') {
              setMessage({
                type: 'error',
                text: rejectionReason
                  ? `Pendaftaran akun Anda ditolak oleh Admin. Alasan: ${rejectionReason}`
                  : 'Pendaftaran akun Anda ditolak oleh Admin.',
              });
            } else if (accountStatus === 'NONAKTIF') {
              setMessage({
                type: 'error',
                text: 'Akun Anda sedang dinonaktifkan oleh Admin. Silakan hubungi operator lembaga.',
              });
            } else {
              setMessage({
                type: 'error',
                text: 'Akun Anda belum aktif dan sedang menunggu persetujuan Admin. Anda akan menerima email setelah akun disetujui.',
              });
            }
          } else {
            const params = new URLSearchParams(window.location.search);
            const rawNext = params.get('next');
            const safeNext =
              rawNext && rawNext.startsWith('/') && !rawNext.startsWith('/login')
                ? rawNext
                : '/portal';
            window.location.assign(safeNext);
            return;
          }
        }
      } else {
        const res = await fetch('/api/auth/register/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            password,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: 'error', text: data.error || 'Gagal membuat akun.' });
        } else {
          setPassword('');
          setConfirmPassword('');
          setOtpCode('');
          setOtpSent(false);
          setOtpVerified(false);
          setMessage({
            type: 'success',
            text:
              data.message ||
              'Pendaftaran akun berhasil! Email Anda telah terverifikasi dan akun menunggu persetujuan Admin.',
          });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen simms-ambient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Website Resmi
        </Link>

        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {mode === 'login' ? 'Masuk Portal SIMMS' : 'Daftar Akun Baru'}
            </h1>
            <p className="text-sm text-slate-600">
              {mode === 'login'
                ? 'Akses CMS Website, Portal Akademik, Keuangan & Layanan.'
                : 'Registrasi akun untuk anggota perpustakaan umum atau warga lembaga.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setPassword('');
                setConfirmPassword('');
                setMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setPassword('');
                setConfirmPassword('');
                setMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium ${
                message.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/95 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (mode === 'register') {
                        setOtpVerified(false);
                        setOtpSent(false);
                        setOtpCode('');
                      }
                    }}
                    placeholder="nama@lembaga.sch.id"
                    className="w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                {mode === 'register' && (
                  <button
                    type="button"
                    disabled={otpSending || !email.trim()}
                    onClick={handleSendRegisterOtp}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition shrink-0"
                  >
                    {otpSending ? 'Mengirim...' : otpSent ? 'Kirim Ulang' : 'Kirim OTP'}
                  </button>
                )}
              </div>
            </div>

            {mode === 'register' && (
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                    Kode OTP Verifikasi Email
                  </label>
                  {otpVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Email Terverifikasi
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    disabled={otpVerified}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Masukkan 6 digit OTP"
                    className="flex-1 rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    disabled={otpVerifying || otpVerified || otpCode.trim().length !== 6}
                    onClick={handleVerifyRegisterOtp}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition shrink-0"
                  >
                    {otpVerified ? 'Terverifikasi' : otpVerifying ? 'Memeriksa...' : 'Verifikasi OTP'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Klik &quot;Kirim OTP&quot;, masukkan kode 6 digit dari email Anda, lalu klik &quot;Verifikasi OTP&quot; untuk mengaktifkan tombol Buat Akun.
                </p>
              </div>
            )}

            <PasswordInput
              label="Kata Sandi"
              value={password}
              onChange={setPassword}
              placeholder={mode === 'register' ? 'Minimal 8 karakter kuat' : 'Masukkan kata sandi'}
              showStrength={mode === 'register'}
              userName={fullName}
            />

            {mode === 'register' && (
              <PasswordInput
                label="Konfirmasi Kata Sandi"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Ulangi kata sandi"
              />
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <Link
                  href="/reset-kata-sandi"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Lupa kata sandi? Reset di sini
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'register' && !otpVerified)}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition shadow-sm"
            >
              {mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  {loading ? 'Memproses...' : 'Masuk ke Portal'}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Mendaftarkan...' : 'Buat Akun'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {duplicateEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">
                  Alamat Email Sudah Terdaftar
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Email <strong>{duplicateEmailModal.email}</strong> sudah digunakan pada akun lain, sehingga kode OTP pendaftaran tidak dapat dikirimkan.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
              {duplicateEmailModal.accountStatus === 'PENDING' ? (
                <span>
                  Akun dengan email ini saat ini berstatus <strong>Menunggu Persetujuan Admin</strong>. Silakan tunggu email notifikasi aktivasi dari Admin.
                </span>
              ) : duplicateEmailModal.accountStatus === 'DITOLAK' ? (
                <span>
                  Pendaftaran akun dengan email ini sebelumnya berstatus <strong>Ditolak</strong>. Silakan hubungi Admin/Operator lembaga atau gunakan alamat email lain.
                </span>
              ) : duplicateEmailModal.accountStatus === 'NONAKTIF' ? (
                <span>
                  Akun dengan email ini saat ini berstatus <strong>Nonaktif</strong>. Silakan hubungi Admin/Operator lembaga untuk pengaktifan kembali.
                </span>
              ) : (
                <span>
                  Akun dengan email ini sudah <strong>Aktif</strong>. Anda dapat langsung masuk melalui tab <strong>Masuk</strong>, atau gunakan fitur <strong>Lupa Kata Sandi</strong> jika tidak mengingat kata sandi Anda.
                </span>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDuplicateEmailModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
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
                  setMessage(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                Pindah ke Tab Masuk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
