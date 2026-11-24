'use client';

import type { ChangeEvent, FormEvent } from 'react';
import {
  Camera,
  Clock,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { digitsOnly, PHONE_MAX } from '@/lib/validation/identity';
import {
  formatIndonesianDate,
  type AccountProfile,
} from '@/components/portal/akun/profil/types';

interface ProfileOverviewAndAvatarSectionProps {
  profile: AccountProfile;
  uploadingAvatar: boolean;
  onAvatarFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function ProfileOverviewAndAvatarSection({
  profile,
  uploadingAvatar,
  onAvatarFileSelect,
}: ProfileOverviewAndAvatarSectionProps) {
  const nextChangeFormatted = formatIndonesianDate(profile.nextAvatarChangeAt);

  return (
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
            onChange={onAvatarFileSelect}
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
  );
}

interface BasicContactFormCardProps {
  fullName: string;
  phone: string | null;
  saving: boolean;
  onPhoneChange: (cleanPhone: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function BasicContactFormCard({
  fullName,
  phone,
  saving,
  onPhoneChange,
  onSubmit,
}: BasicContactFormCardProps) {
  return (
    <form onSubmit={onSubmit} className="glass-card rounded-3xl p-4 sm:p-6 lg:p-7 space-y-5">
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
              value={fullName}
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
              value={phone || ''}
              maxLength={PHONE_MAX}
              onChange={(e) => {
                const cleanPhone = digitsOnly(e.target.value, PHONE_MAX);
                onPhoneChange(cleanPhone);
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
  );
}
