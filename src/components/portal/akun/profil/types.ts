export interface PendingAvatarRequest {
  id: string;
  new_avatar_url: string;
  status: string;
  created_at: string;
}

export interface LatestAvatarRequest {
  id: string;
  status: string;
  review_notes?: string | null;
  reviewed_at?: string | null;
}

export interface PendingNameRequest {
  id: string;
  old_full_name: string;
  new_full_name: string;
  reason: string | null;
  created_at: string;
}

export interface LastRejectedNameRequest {
  new_full_name: string;
  review_notes: string | null;
  reviewed_at: string | null;
}

export interface AccountProfile {
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
  pendingAvatarRequest?: PendingAvatarRequest | null;
  latestAvatarRequest?: LatestAvatarRequest | null;
  pendingNameRequest?: PendingNameRequest | null;
  lastRejectedNameRequest?: LastRejectedNameRequest | null;
  canRequestNameChange?: boolean;
  nextNameChangeAt?: string | null;
  nameRemainingDays?: number;
}

export interface ToastState {
  type: 'ok' | 'err';
  msg: string;
}

export type ShowToastFn = (type: 'ok' | 'err', msg: string) => void;

export const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  full_name: '',
  email: '',
  phone: '',
  avatar_url: null,
  primary_role: '',
  roles: [],
  mfaEnabled: false,
  canChangeAvatar: true,
  remainingDays: 0,
};

export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function normalizeAccountProfile(raw: Partial<AccountProfile>): AccountProfile {
  return {
    full_name: raw.full_name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    avatar_url: raw.avatar_url || null,
    primary_role: raw.primary_role || '',
    roles: raw.roles || [],
    mfaEnabled: Boolean(raw.mfaEnabled),
    canChangeAvatar: raw.canChangeAvatar ?? true,
    avatarUpdatedAt: raw.avatarUpdatedAt || null,
    nextAvatarChangeAt: raw.nextAvatarChangeAt || null,
    remainingDays: raw.remainingDays ?? 0,
    pendingAvatarRequest: raw.pendingAvatarRequest || null,
    latestAvatarRequest: raw.latestAvatarRequest || null,
    pendingNameRequest: raw.pendingNameRequest || null,
    lastRejectedNameRequest: raw.lastRejectedNameRequest || null,
    canRequestNameChange: raw.canRequestNameChange ?? true,
    nextNameChangeAt: raw.nextNameChangeAt || null,
    nameRemainingDays: raw.nameRemainingDays ?? 0,
  };
}

export function formatIndonesianDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatIndonesianDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('id-ID');
}

export function validateAvatarFile(file: File, profile: AccountProfile): string | null {
  if (profile.pendingAvatarRequest) {
    return 'Pengajuan foto profil Anda sedang menunggu persetujuan Admin. Anda tidak dapat mengunggah foto kembali sebelum pengajuan diproses.';
  }
  if (!profile.canChangeAvatar) {
    return `Foto profil hanya dapat diganti setiap 45 hari sekali (sisa ${profile.remainingDays} hari).`;
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    return 'Format foto profil harus JPG, PNG, atau WebP.';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Ukuran foto profil maksimal 2 MB.';
  }
  return null;
}
