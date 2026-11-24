'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { validatePasswordStrength } from '@/lib/auth/password-policy';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';
import { LoginCardSkeleton, LoginFormView } from '@/components/auth/login/login-form-view';
import { DuplicateEmailModal, LoginWarningModal } from '@/components/auth/login/login-modals';
import {
  ACCOUNT_STATUS_MESSAGES,
  getCurrentWibTime,
  getSafeRedirectPath,
  isValidEmailFormat,
  postAuthJson,
  type AuthMode,
  type DuplicateEmailModalState,
  type LoginStatusResponse,
  type LoginWarningModalState,
  type StatusMessage,
} from '@/components/auth/login/types';

function LoginCardContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
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
  const [duplicateEmailModal, setDuplicateEmailModal] = useState<DuplicateEmailModalState | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [urlStatusDismissed, setUrlStatusDismissed] = useState(false);
  const [loginCaptchaRequired, setLoginCaptchaRequired] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [loginWarningModal, setLoginWarningModal] = useState<LoginWarningModalState | null>(null);

  const captcha = useSmartCaptcha(mode === 'register' || loginCaptchaRequired);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/login', { cache: 'no-store' })
      .then((res) => res.json().catch(() => null))
      .then((data: LoginStatusResponse | null) => {
        if (!active || !data) return;
        if (data.requireCaptcha) setLoginCaptchaRequired(true);
        if (data.isLocked && data.remainingLockSeconds) {
          setLockoutSeconds(data.remainingLockSeconds);
        }
      })
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
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const statusParam = searchParams.get('account_status') || '';
  const urlStatusText = ACCOUNT_STATUS_MESSAGES[statusParam] || null;
  const activeMessage: StatusMessage | null =
    message ??
    (!urlStatusDismissed && urlStatusText ? { type: 'error', text: urlStatusText } : null);
  const isBusy = loading || otpSending || otpVerifying;

  const closeDuplicateEmailModal = useCallback(() => setDuplicateEmailModal(null), []);
  const closeLoginWarningModal = useCallback(() => setLoginWarningModal(null), []);

  function resetOtpState() {
    setOtpCode('');
    setOtpSent(false);
    setOtpVerified(false);
    setResendCooldown(0);
  }

  function switchMode(nextMode: AuthMode) {
    if (isBusy || nextMode === mode) return;
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setMessage(null);
    setUrlStatusDismissed(true);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    if (mode === 'register') resetOtpState();
  }

  function handleSwitchToLoginFromDuplicateModal() {
    setDuplicateEmailModal(null);
    setMode('login');
    setPassword('');
    setConfirmPassword('');
    resetOtpState();
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
      const { ok, status, data } = await postAuthJson<{
        turnstileUnavailable?: boolean;
        code?: string;
        email?: string;
        accountStatus?: string;
        error?: string;
        message?: string;
      }>('/api/auth/register/send-otp', {
        email: trimmedEmail,
        fullName: fullName.trim(),
        captcha: captchaPayload,
      });
      if (!ok) {
        if (data.turnstileUnavailable) captcha.forceLocalFallback();
        if (status === 409 || data.code === 'EMAIL_ALREADY_REGISTERED') {
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
      const { ok, data } = await postAuthJson<{ error?: string; message?: string }>(
        '/api/auth/register/verify-otp',
        { email: trimmedEmail, otpCode: trimmedOtp }
      );
      if (!ok) {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setUrlStatusDismissed(true);

    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Masukkan alamat email yang valid.' });
      return;
    }
    if (!isSupabaseConfigured()) {
      setMessage({ type: 'error', text: 'Layanan autentikasi sedang tidak tersedia.' });
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
        setMessage({ type: 'error', text: `Kata sandi belum memenuhi syarat: ${policy.errors[0]}` });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const captchaPayload = loginCaptchaRequired ? await captcha.executeCaptcha() : undefined;
        const { ok, data } = await postAuthJson<{
          requireCaptcha?: boolean;
          turnstileUnavailable?: boolean;
          isLocked?: boolean;
          remainingLockSeconds?: number;
          showLockWarningModal?: boolean;
          failedAttempts?: number;
          maxAttempts?: number;
          remainingAttempts?: number;
          error?: string;
        }>('/api/auth/login', {
          email: trimmedEmail,
          password,
          ...(captchaPayload ? { captcha: captchaPayload } : {}),
        });
        if (!ok) {
          if (data.requireCaptcha) setLoginCaptchaRequired(true);
          if (data.turnstileUnavailable) captcha.forceLocalFallback();
          if (data.isLocked && data.remainingLockSeconds) {
            setLockoutSeconds(Number(data.remainingLockSeconds) || 900);
            setLoginWarningModal(null);
          } else if (data.showLockWarningModal) {
            setLoginWarningModal({
              email: trimmedEmail,
              failedAttempts: Number(data.failedAttempts) || 3,
              maxAttempts: Number(data.maxAttempts) || 5,
              remainingAttempts: Number(data.remainingAttempts) || 2,
              detectedAtWib: getCurrentWibTime(),
            });
          }
          setMessage({ type: 'error', text: data.error || 'Gagal masuk. Silakan coba lagi.' });
        } else {
          window.location.assign(getSafeRedirectPath(searchParams.get('next')));
          return;
        }
      } else {
        const { ok, data } = await postAuthJson<{ error?: string; message?: string }>(
          '/api/auth/register/confirm',
          { fullName: fullName.trim(), email: trimmedEmail, password }
        );
        if (!ok) {
          setMessage({ type: 'error', text: data.error || 'Gagal membuat akun.' });
        } else {
          setPassword('');
          setConfirmPassword('');
          resetOtpState();
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
      <LoginFormView
        mode={mode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        fullName={fullName}
        loading={loading}
        isBusy={isBusy}
        otpCode={otpCode}
        otpSent={otpSent}
        otpVerified={otpVerified}
        otpSending={otpSending}
        otpVerifying={otpVerifying}
        resendCooldown={resendCooldown}
        lockoutSeconds={lockoutSeconds}
        activeMessage={activeMessage}
        onSwitchMode={switchMode}
        onFullNameChange={setFullName}
        onEmailChange={handleEmailChange}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onOtpCodeChange={setOtpCode}
        onSendRegisterOtp={handleSendRegisterOtp}
        onVerifyRegisterOtp={handleVerifyRegisterOtp}
        onSubmit={handleSubmit}
      />

      {duplicateEmailModal && (
        <DuplicateEmailModal
          modal={duplicateEmailModal}
          onClose={closeDuplicateEmailModal}
          onSwitchToLogin={handleSwitchToLoginFromDuplicateModal}
        />
      )}

      {loginWarningModal && (
        <LoginWarningModal modal={loginWarningModal} onClose={closeLoginWarningModal} />
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
