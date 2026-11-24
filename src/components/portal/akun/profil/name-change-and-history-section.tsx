'use client';

import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  FileSignature,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  formatIndonesianDate,
  formatIndonesianDateTime,
  type AccountProfile,
  type ShowToastFn,
} from '@/components/portal/akun/profil/types';

interface NameChangeAndHistorySectionProps {
  profile: AccountProfile;
  showToast: ShowToastFn;
  onRefresh: () => Promise<void>;
}

export function NameChangeAndHistorySection({
  profile,
  showToast,
  onRefresh,
}: NameChangeAndHistorySectionProps) {
  const [newFullName, setNewFullName] = useState('');
  const [nameReason, setNameReason] = useState('');
  const [submittingName, setSubmittingName] = useState(false);

  async function handleSubmitNameChange(e: FormEvent) {
    e.preventDefault();
    if (!newFullName.trim()) {
      showToast('err', 'Masukkan nama lengkap baru terlebih dahulu.');
      return;
    }
    setSubmittingName(true);
    try {
      const res = await fetch('/api/akun/nama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_full_name: newFullName.trim(), reason: nameReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ok', 'Pengajuan perubahan nama terkirim dan menunggu persetujuan Admin.');
        setNewFullName('');
        setNameReason('');
        await onRefresh();
      } else {
        showToast('err', data.error || 'Gagal mengirim pengajuan perubahan nama.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmittingName(false);
    }
  }

  async function handleCancelNameChange() {
    setSubmittingName(true);
    try {
      const res = await fetch('/api/akun/nama', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ok', 'Pengajuan perubahan nama dibatalkan.');
        await onRefresh();
      } else {
        showToast('err', data.error || 'Gagal membatalkan pengajuan.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmittingName(false);
    }
  }

  const nextNameChangeFormatted = formatIndonesianDate(profile.nextNameChangeAt);

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-7 space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Pengajuan Perubahan Nama Lengkap</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          Perubahan nama resmi akun memerlukan persetujuan Admin Madrasah dan dibatasi 1 kali setiap 30 hari.
        </p>
      </div>

      {/* Status: Pengajuan Sedang Menunggu Persetujuan */}
      {profile.pendingNameRequest && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-bold text-amber-900">
                  Pengajuan Perubahan Nama Menunggu Persetujuan
                </p>
                <p className="text-xs text-amber-800 break-words">
                  Nama Baru:{' '}
                  <strong className="text-slate-900">
                    {profile.pendingNameRequest.new_full_name}
                  </strong>
                </p>
                {profile.pendingNameRequest.reason && (
                  <p className="text-[11px] text-amber-700 break-words">
                    Alasan: {profile.pendingNameRequest.reason}
                  </p>
                )}
                <p className="text-[10px] text-amber-600">
                  Diajukan pada: {formatIndonesianDateTime(profile.pendingNameRequest.created_at)}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={submittingName}
              onClick={handleCancelNameChange}
              className="w-full sm:w-auto min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold transition shrink-0"
            >
              {submittingName ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              )}
              Batalkan Pengajuan
            </button>
          </div>
        </div>
      )}

      {/* Status: Pengajuan Terakhir Ditolak */}
      {!profile.pendingNameRequest && profile.lastRejectedNameRequest && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-900 space-y-1.5">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Pengajuan Perubahan Nama Sebelumnya Ditolak oleh Admin</span>
          </div>
          <p className="break-words">
            Nama yang diajukan: <strong>{profile.lastRejectedNameRequest.new_full_name}</strong>
          </p>
          {profile.lastRejectedNameRequest.review_notes && (
            <p className="text-[11px] text-rose-700 bg-white/60 p-2 rounded-xl border border-rose-100 break-words">
              Catatan Admin: {profile.lastRejectedNameRequest.review_notes}
            </p>
          )}
        </div>
      )}

      {/* Status: Cooldown 30 Hari */}
      {!profile.pendingNameRequest && !profile.canRequestNameChange && nextNameChangeFormatted && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 text-xs text-slate-700">
          <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">
              Batas Waktu Perubahan Nama (Cooldown)
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Nama lengkap baru saja disetujui. Sesuai kebijakan keamanan, perubahan nama hanya dapat diajukan kembali setelah 30 hari, yaitu pada{' '}
              <strong>{nextNameChangeFormatted}</strong>{' '}
              (sisa <strong>{profile.nameRemainingDays}</strong> hari lagi).
            </p>
          </div>
        </div>
      )}

      {/* Formulir Pengajuan (bila diizinkan) */}
      {profile.canRequestNameChange && (
        <form onSubmit={handleSubmitNameChange} className="space-y-4">
          <div>
            <label htmlFor="profil-new-fullname" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Lengkap Baru Sesuai Dokumen Resmi <span className="text-rose-600">*</span>
            </label>
            <input
              id="profil-new-fullname"
              required
              type="text"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Masukkan nama lengkap baru..."
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Gunakan ejaan yang sesuai dengan KTP/Kartu Keluarga/Ijazah.
            </p>
          </div>

          <div>
            <label htmlFor="profil-name-reason" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Alasan Perubahan Nama (Opsional)
            </label>
            <textarea
              id="profil-name-reason"
              rows={2}
              value={nameReason}
              onChange={(e) => setNameReason(e.target.value)}
              placeholder="Contoh: Perbaikan ejaan sesuai Ijazah / Penambahan gelar / Pergantian nama sah..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={submittingName || !newFullName.trim()}
            className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold px-5 py-2.5 rounded-2xl text-xs transition"
          >
            {submittingName ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengirim Pengajuan...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Kirim Pengajuan Perubahan Nama
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

interface EmailChangeFormCardProps {
  currentEmail: string | null;
  mfaEnabled: boolean;
  showToast: ShowToastFn;
  onRefresh: () => Promise<void>;
}

export function EmailChangeFormCard({
  currentEmail,
  mfaEnabled,
  showToast,
  onRefresh,
}: EmailChangeFormCardProps) {
  const [newEmail, setNewEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);

  async function handleSendEmailOtp() {
    if (!newEmail.trim()) {
      showToast('err', 'Masukkan alamat email baru terlebih dahulu.');
      return;
    }
    setSendingOtp(true);
    setOtpSentMessage(null);
    try {
      const res = await fetch('/api/akun/email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpSentMessage(data.message);
        showToast('ok', data.message);
      } else {
        showToast('err', data.error || 'Gagal mengirim kode OTP ke email baru.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleConfirmEmailChange(e: FormEvent) {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      showToast('err', 'Masukkan 6 digit kode OTP dari email baru.');
      return;
    }
    if (mfaEnabled && mfaCode.trim().length !== 6) {
      showToast('err', 'Masukkan 6 digit kode MFA Authenticator.');
      return;
    }
    setChangingEmail(true);
    try {
      const res = await fetch('/api/akun/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          otpCode: otpCode.trim(),
          currentPassword,
          mfaCode: mfaCode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ok', data.message || 'Alamat email berhasil diperbarui.');
        setNewEmail('');
        setOtpCode('');
        setCurrentPassword('');
        setMfaCode('');
        setOtpSentMessage(null);
        await onRefresh();
      } else {
        showToast('err', data.error || 'Gagal mengganti alamat email.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setChangingEmail(false);
    }
  }

  return (
    <form onSubmit={handleConfirmEmailChange} className="glass-card rounded-3xl p-4 sm:p-6 lg:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Ganti Alamat Email</h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Memerlukan verifikasi kata sandi saat ini{mfaEnabled ? ', kode MFA,' : ''} dan kode OTP yang dikirim ke email baru.
          </p>
        </div>
        {mfaEnabled && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> MFA Aktif
          </span>
        )}
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600 break-all">
        Email Saat Ini: <strong className="text-slate-900">{currentEmail || '-'}</strong>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Alamat Email Baru <span className="text-rose-600">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                required
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nama@emailbaru.com"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>
            <button
              type="button"
              disabled={sendingOtp || !newEmail.trim()}
              onClick={handleSendEmailOtp}
              className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2.5 text-xs font-semibold transition shrink-0"
            >
              {sendingOtp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {sendingOtp ? 'Mengirim...' : 'Kirim OTP'}
            </button>
          </div>
          {otpSentMessage && (
            <p className="mt-1.5 text-[11px] text-emerald-700 font-medium break-words">
              {otpSentMessage}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="profil-otp-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Kode OTP dari Email Baru (6 Digit) <span className="text-rose-600">*</span>
          </label>
          <input
            id="profil-otp-code"
            required
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Masukkan 6 digit kode OTP"
            className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          />
        </div>

        <div>
          <label htmlFor="profil-current-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Kata Sandi Saat Ini <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="profil-current-password"
              required
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan kata sandi saat ini"
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600"
              aria-label="Tampilkan atau sembunyikan kata sandi"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mfaEnabled && (
          <div>
            <label htmlFor="profil-mfa-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kode MFA Authenticator (6 Digit) <span className="text-rose-600">*</span>
            </label>
            <input
              id="profil-mfa-code"
              required
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Masukkan 6 digit kode dari aplikasi authenticator"
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={changingEmail}
        className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
      >
        {changingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
        {changingEmail ? 'Memverifikasi & Mengubah Email...' : 'Verifikasi & Ganti Email'}
      </button>
    </form>
  );
}
