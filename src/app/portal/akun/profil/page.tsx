'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react';

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
}

export default function AkunProfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

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
  const [otpCode, setOtpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);

  async function loadProfile() {
    try {
      const res = await fetch('/api/akun/profil', { cache: 'no-store' });
      const data = await res.json();
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
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }

  async function handleSaveBasic(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/akun/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ok', 'Profil akun berhasil diperbarui.');
        await loadProfile();
      } else {
        showToast('err', data.error || 'Gagal memperbarui profil.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

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
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;

      setUploadingAvatar(true);
      try {
        const res = await fetch('/api/akun/profil', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: profile.full_name,
            phone: profile.phone,
            avatar_url: dataUrl,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('ok', 'Foto profil berhasil diperbarui dan disinkronkan.');
          await loadProfile();
        } else {
          showToast('err', data.error || 'Gagal mengunggah foto profil.');
        }
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
      const data = await res.json();
      if (res.ok) {
        setOtpSentMessage(data.message);
        showToast('ok', data.message);
      } else {
        showToast('err', data.error || 'Gagal mengirim kode OTP ke email baru.');
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleConfirmEmailChange(e: React.FormEvent) {
    e.preventDefault();
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
      const data = await res.json();
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
    } finally {
      setChangingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat profil akun...
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
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="grid md:grid-cols-12 gap-6">
        {/* Kartu Profil & Unggah Foto */}
        <div className="md:col-span-5 glass-card rounded-3xl p-6 space-y-5 h-fit">
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

            {!profile.canChangeAvatar && nextChangeFormatted ? (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Foto profil hanya dapat diganti <strong>1 kali setiap 45 hari</strong>. Dapat diganti kembali pada <strong>{nextChangeFormatted}</strong> ({profile.remainingDays} hari lagi).
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Format JPG, PNG, atau WebP. Setelah diganti, foto profil baru baru dapat diubah kembali setelah <strong>45 hari</strong>.
              </p>
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
        <div className="md:col-span-7 space-y-6">
          <form onSubmit={handleSaveBasic} className="glass-card rounded-3xl p-7 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Perbarui Informasi Profil</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola nama tampilan dan nomor kontak akun Anda.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    required
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor HP / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>

          {/* Ganti Alamat Email */}
          <form onSubmit={handleConfirmEmailChange} className="glass-card rounded-3xl p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Ganti Alamat Email</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Memerlukan verifikasi kata sandi saat ini{profile.mfaEnabled ? ', kode MFA,' : ''} dan kode OTP yang dikirim ke email baru.
                </p>
              </div>
              {profile.mfaEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" /> MFA Aktif
                </span>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600">
              Email Saat Ini: <strong className="text-slate-900">{profile.email || '-'}</strong>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Email Baru <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      required
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="nama@emailbaru.com"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={sendingOtp || !newEmail.trim()}
                    onClick={handleSendEmailOtp}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2.5 text-xs font-semibold transition shrink-0"
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
                  <p className="mt-1.5 text-[11px] text-emerald-700 font-medium">{otpSentMessage}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kode OTP dari Email Baru (6 Digit) <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Masukkan 6 digit kode OTP"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi Saat Ini <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi saat ini"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    aria-label="Tampilkan atau sembunyikan kata sandi"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {profile.mfaEnabled && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kode MFA Authenticator (6 Digit) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Masukkan 6 digit kode dari aplikasi authenticator"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={changingEmail}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
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
