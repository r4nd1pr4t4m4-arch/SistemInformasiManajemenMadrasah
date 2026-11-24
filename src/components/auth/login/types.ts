export type AuthMode = 'login' | 'register';

export interface StatusMessage {
  type: 'error' | 'success';
  text: string;
}

export interface DuplicateEmailModalState {
  email: string;
  accountStatus: string;
}

export interface LoginWarningModalState {
  email: string;
  failedAttempts: number;
  maxAttempts: number;
  remainingAttempts: number;
  detectedAtWib: string;
}

export interface LoginStatusResponse {
  requireCaptcha?: boolean;
  isLocked?: boolean;
  remainingLockSeconds?: number;
}

export interface JsonResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
}

export const ACCOUNT_STATUS_MESSAGES: Record<string, string> = {
  DITOLAK_PERMANEN:
    'Pendaftaran akun Anda ditolak secara permanen oleh Admin dan alamat email ini tidak dapat digunakan untuk mendaftar ulang.',
  DITOLAK:
    'Pendaftaran akun Anda ditolak oleh Admin. Anda masih dapat mendaftar ulang menggunakan email yang sama pada tab "Daftar Akun".',
  NONAKTIF:
    'Akun Anda sedang dinonaktifkan oleh Admin. Hubungi operator lembaga.',
  PENDING:
    'Akun Anda belum aktif dan sedang menunggu persetujuan Admin.',
};

export function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getSafeRedirectPath(rawNext: string | null): string {
  if (!rawNext) return '/portal';
  if (
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\') &&
    !rawNext.startsWith('/login')
  ) {
    return rawNext;
  }
  return '/portal';
}

export function formatLockoutCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export async function postAuthJson<T = Record<string, unknown>>(
  url: string,
  payload: Record<string, unknown>
): Promise<JsonResponse<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export function getCurrentWibTime(): string {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}
