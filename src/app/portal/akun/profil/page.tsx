'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileSignature,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { digitsOnly, PHONE_MAX } from '@/lib/validation/identity';

interface AccountProfile {
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  primary_role: string;
  roles?: string[];
  mfaEnabled?: boolean;
  canChangeAvatar?: boolean;
  avatarUpdatedAt?: string | null;
  nextAvatarChangeAt?: string | null;
  remainingDays?: number;
  pendingAvatarRequest?: {
    id: string;
    new_avatar_url: string;
    status: string;
    created_at: string;
  } | null;
  latestAvatarRequest?: {
    id: string;
    status: string;
    review_notes?: string | null;
    reviewed_at?: string | null;
  } | null;
  pendingNameRequest?: {
    id: string;
    old_full_name: string;
    new_full_name: string;
    reason: string | null;
    created_at: string;
  } | null;
  lastRejectedNameRequest?: {
    new_full_name: string;
    review_notes: string | null;
    reviewed_at: string | null;
  } | null;
  canRequestNameChange?: boolean;
  nextNameChangeAt?: string | null;
  nameRemainingDays?: number;
}

export default function AkunProfilPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [profile, setProfile] = useState<AccountProfile>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: null,
    primary_role: '',
    roles: [],
    mfaEnabled: false,
    canChangeAvatar: true,
    remainingDays: 0,
  });

  // State Ganti Alamat Email
  const [newEmail, setNewEmail] = useState('');

  // State Pengajuan Perubahan Nama Lengkap
  const [newFullName, setNewFullName] = useState('');
  const [nameReason, setNameReason] = useState('');
  const [submittingName, setSubmittingName] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadProfile = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/akun/profil', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat profil akun.');
        return;
      }
      if (data.profile) {
        setProfile({
          full_name: data.profile.full_name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          avatar_url: data.profile.avatar_url || null,
          primary_role: data.profile.primary_role || '',
          roles: data.profile.roles || [],
          mfaEnabled: Boolean(data.profile.mfaEnabled),
          canChangeAvatar: data.profile.canChangeAvatar ?? true,
          avatarUpdatedAt: data.profile.avatarUpdatedAt || null,
          nextAvatarChangeAt: data.profile.nextAvatarChangeAt || null,
          remainingDays: data.profile.remainingDays ?? 0,
          pendingAvatarRequest: data.profile.pendingAvatarRequest || null,
          latestAvatarRequest: data.profile.latestAvatarRequest || null,
          pendingNameRequest: data.profile.pendingNameRequest || null,
          lastRejectedNameRequest: data.profile.lastRejectedNameRequest || null,
          canRequestNameChange: data.profile.canRequestNameChange ?? true,
          nextNameChangeAt: data.profile.nextNameChangeAt || null,
          nameRemainingDays: data.profile.nameRemainingDays ?? 0,
        });
      }
    } catch {
      setLoadError('Tidak dapat terhubung ke server untuk memuat profil akun.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => clearTimeout(id);
  }, [loadProfile]);

  async function handleSaveBasic(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/akun/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: profile.phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ok', 'Profil akun berhasil diperbarui.');
        await loadProfile();
      } else {
        showToast('err', data.error || 'Gagal memperbarui profil.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitNameChange(e: React.FormEvent) {
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
        await loadProfile();
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
        await loadProfile();
      } else {
        showToast('err', data.error || 'Gagal membatalkan pengajuan.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmittingName(false);
    }
  }

  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (profile.pendingAvatarRequest) {
      showToast(
        'err',
        'Pengajuan foto profil Anda sedang menunggu persetujuan Admin. Anda tidak dapat mengunggah foto kembali sebelum pengajuan diproses.'
      );
      return;
    }
    if (!profile.canChangeAvatar) {
      showToast(
        'err',
        `Foto profil hanya dapat diganti setiap 45 hari sekali (sisa ${profile.remainingDays} hari).`
      );
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('err', 'Format foto profil harus JPG, PNG, atau WebP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('err', 'Ukuran foto profil maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      showToast('err', 'Gagal membaca file foto yang dipilih.');
    };
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;

      setUploadingAvatar(true);
      try {
        const res = await fetch('/api/akun/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatar_url: dataUrl,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('ok', 'Foto profil berhasil diunggah dan menunggu persetujuan Admin.');
          await loadProfile();
        } else {
          showToast('err', data.error || 'Gagal mengunggah foto profil.');
        }
      } catch {
        showToast('err', 'Tidak dapat terhubung ke server saat mengunggah foto.');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  }

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

  async function handleConfirmEmailChange(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      showToast('err', 'Masukkan 6 digit kode OTP dari email baru.');
      return;
    }
    if (profile.mfaEnabled && mfaCode.trim().length !== 6) {
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
        await loadProfile();
      } else {
        showToast('err', data.error || 'Gagal mengganti alamat email.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setChangingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat profil akun...
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="max-w-5xl mx-auto rounded-3xl border border-rose-200 bg-rose-50 p-6 text-xs text-rose-800 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{loadError}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadProfile();
          }}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  const nextChangeFormatted = profile.nextAvatarChangeAt
    ? new Date(profile.nextAvatarChangeAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        {/* Kartu Profil & Unggah Foto */}
        <div className="md:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-5 h-fit min-w-0">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-xl font-bold shadow-sm shrink-0">
                {(profile.full_name || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">{profile.full_name}</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" /> {profile.email || '-'}
              </p>
            </div>
          </div>

          {/* Kontrol Unggah Foto Profil (Cooldown 45 Hari) */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Foto Profil</span>
              <span className="text-[11px] font-medium text-slate-500">Maks 2 MB</span>
            </div>

            <label
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                !profile.canChangeAvatar || uploadingAvatar
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
              }`}
            >
              {uploadingAvatar ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengunggah Foto...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  {profile.canChangeAvatar ? 'Unggah Foto Profil Baru' : 'Ganti Foto Terkunci'}
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!profile.canChangeAvatar || uploadingAvatar}
                onChange={handleAvatarFileSelect}
                className="sr-only"
              />
            </label>

            {profile.pendingAvatarRequest ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2 text-[11px] text-amber-900">
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Menunggu Persetujuan Admin:</strong> Foto yang Anda unggah sedang ditinjau. Anda tidak dapat mengunggah foto kembali sebelum pengajuan ini disetujui atau ditolak.
                  </span>
                </div>
                <img
                  src={profile.pendingAvatarRequest.new_avatar_url}
                  alt="Pratinjau pengajuan foto"
                  className="w-12 h-12 rounded-xl object-cover border border-amber-300"
                />
              </div>
            ) : !profile.canChangeAvatar && nextChangeFormatted ? (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Foto profil hanya dapat diganti <strong>1 kali setiap 45 hari</strong>. Dapat diganti kembali pada <strong>{nextChangeFormatted}</strong> ({profile.remainingDays} hari lagi).
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {profile.latestAvatarRequest?.status === 'DITOLAK' && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-[11px] text-rose-800">
                    Pengajuan foto profil sebelumnya <strong>ditolak</strong>
                    {profile.latestAvatarRequest.review_notes
                      ? `: ${profile.latestAvatarRequest.review_notes}`
                      : '.'}{' '}
                    Silakan unggah foto baru yang sesuai.
                  </div>
                )}
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Format JPG, PNG, atau WebP. Foto profil baru memerlukan <strong>persetujuan Admin</strong> sebelum aktif (cooldown 45 hari setelah disetujui).
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/70 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Peran Akun
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(profile.roles && profile.roles.length > 0
                ? profile.roles
                : [profile.primary_role]
              ).map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[11px] font-semibold"
                >
                  <ShieldCheck className="w-3 h-3" /> {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Informasi Dasar + Ganti Alamat Email */}
        <div className="md:col-span-7 space-y-5 sm:space-y-6 min-w-0">
          <form onSubmit={handleSaveBasic} className="glass-card rounded-3xl p-4 sm:p-6 lg:p-7 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Perbarui Informasi Profil</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola nama tampilan dan nomor kontak akun Anda.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="profil-full-name" className="block text-xs font-semibold text-slate-700">
                    Nama Lengkap
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                    <Lock className="w-3 h-3 text-slate-400" /> Terkunci (Persetujuan Admin)
                  </span>
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="profil-full-name"
                    disabled
                    type="text"
                    value={profile.full_name}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-100 text-slate-600 pl-10 pr-3.5 py-2.5 text-sm cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nama lengkap hanya dapat diubah melalui formulir pengajuan perubahan nama di bawah.
                </p>
              </div>

              <div>
                <label htmlFor="profil-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor HP / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="profil-phone"
                    type="tel"
                    inputMode="numeric"
                    value={profile.phone || ''}
                    maxLength={PHONE_MAX}
                    onChange={(e) => {
                      const cleanPhone = digitsOnly(e.target.value, PHONE_MAX);
                      setProfile((prev) => ({ ...prev, phone: cleanPhone }));
                    }}
                    placeholder="08xxxxxxxxxx (Maks. 12 digit)"
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hanya angka, maksimal 12 digit. Otomatis disinkronkan ke seluruh data peran Anda.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Simpan Nomor Kontak'}
            </button>
          </form>

          {/* Pengajuan Perubahan Nama Lengkap */}
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
                        Diajukan pada:{' '}
                        {new Date(profile.pendingNameRequest.created_at).toLocaleString('id-ID')}
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
            {!profile.pendingNameRequest && !profile.canRequestNameChange && profile.nextNameChangeAt && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 text-xs text-slate-700">
                <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">
                    Batas Waktu Perubahan Nama (Cooldown)
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Nama lengkap baru saja disetujui. Sesuai kebijakan keamanan, perubahan nama hanya dapat diajukan kembali setelah 30 hari, yaitu pada{' '}
                    <strong>
                      {new Date(profile.nextNameChangeAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>{' '}
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

          {/* Ganti Alamat Email */}
          <form onSubmit={handleConfirmEmailChange} className="glass-card rounded-3xl p-4 sm:p-6 lg:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Ganti Alamat Email</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Memerlukan verifikasi kata sandi saat ini{profile.mfaEnabled ? ', kode MFA,' : ''} dan kode OTP yang dikirim ke email baru.
                </p>
              </div>
              {profile.mfaEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" /> MFA Aktif
                </span>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600 break-all">
              Email Saat Ini: <strong className="text-slate-900">{profile.email || '-'}</strong>
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

              {profile.mfaEnabled && (
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
        </div>
      </div>
    </div>
  );
}
