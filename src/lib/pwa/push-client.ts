'use client';

export const PUSH_RECEIVED_EVENT = 'simms-push-received';
export const PUSH_STATE_CHANGED_EVENT = 'simms-push-state-changed';
export const NOTIF_READ_SYNC_EVENT = 'simms-notif-read-sync';
export const PUSH_OPT_IN_DISMISSED_KEY = 'simms_push_optin_dismissed_at';
export const PUSH_LAST_ENDPOINT_KEY = 'simms_push_last_endpoint';
export const NOTIF_BROADCAST_CHANNEL_NAME = 'simms_notif_sync_channel';

export type PushSubscribeErrorCode =
  | 'UNSUPPORTED'
  | 'INSECURE_CONTEXT'
  | 'OFFLINE'
  | 'VAPID_MISSING'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_DISMISSED'
  | 'BRAVE_BLOCKED'
  | 'PUSH_SERVICE_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

let cachedServerVapidKey: string | null = null;

export function notifyPushStateChanged(active: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PUSH_STATE_CHANGED_EVENT, { detail: { active } })
  );
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(NOTIF_BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: PUSH_STATE_CHANGED_EVENT, active });
      bc.close();
    } catch {
      // abaikan
    }
  }
}

export function notifyNotificationReadSync() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIF_READ_SYNC_EVENT));
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(NOTIF_BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: NOTIF_READ_SYNC_EVENT });
      bc.close();
    } catch {
      // abaikan
    }
  }
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function sanitizeVapidKey(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

export function getClientVapidPublicKey(): string {
  return sanitizeVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '');
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const clean = sanitizeVapidKey(base64String);
  const padding = '='.repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function decodeAndValidateVapidKey(rawKey: string): Uint8Array<ArrayBuffer> | null {
  try {
    const clean = sanitizeVapidKey(rawKey);
    if (!clean) return null;
    const bytes = urlBase64ToUint8Array(clean);
    // Uncompressed P-256 public key wajib 65 byte diawali 0x04
    if (bytes.length !== 65 || bytes[0] !== 0x04) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

async function resolveVapidKeyBytes(): Promise<Uint8Array<ArrayBuffer> | null> {
  const envKey = getClientVapidPublicKey();
  const fromEnv = decodeAndValidateVapidKey(envKey);
  if (fromEnv) return fromEnv;

  if (cachedServerVapidKey) {
    const fromCache = decodeAndValidateVapidKey(cachedServerVapidKey);
    if (fromCache) return fromCache;
  }

  try {
    const res = await fetch('/api/push/public-key', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    const serverKey = typeof data?.publicKey === 'string' ? sanitizeVapidKey(data.publicKey) : '';
    if (serverKey) {
      const fromServer = decodeAndValidateVapidKey(serverKey);
      if (fromServer) {
        cachedServerVapidKey = serverKey;
        return fromServer;
      }
    }
  } catch {
    // abaikan
  }
  return null;
}

function areKeyBytesEqual(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const viewA = new Uint8Array(a);
  for (let i = 0; i < b.length; i += 1) {
    if (viewA[i] !== b[i]) return false;
  }
  return true;
}

async function isBraveBrowser(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    const nav = navigator as Navigator & {
      brave?: { isBrave?: () => Promise<boolean> };
    };
    if (nav.brave && typeof nav.brave.isBrave === 'function') {
      return await nav.brave.isBrave();
    }
  } catch {
    // abaikan
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureActiveServiceWorker(timeoutMs = 10_000): Promise<ServiceWorkerRegistration> {
  let reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  const readyPromise = navigator.serviceWorker.ready;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Service Worker belum siap. Muat ulang halaman lalu coba lagi.')),
      timeoutMs
    )
  );
  const readyReg = await Promise.race([readyPromise, timeoutPromise]);
  return readyReg || reg;
}

function isPushServiceAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.name} ${err.message}`.toLowerCase();
  return (
    msg.includes('push service error') ||
    msg.includes('registration failed') ||
    msg.includes('aborterror') ||
    msg.includes('invalidstateerror')
  );
}

async function formatPushSubscribeError(err: unknown): Promise<{
  code: PushSubscribeErrorCode;
  message: string;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      code: 'OFFLINE',
      message: 'Perangkat sedang offline. Sambungkan ke internet lalu coba aktifkan kembali.',
    };
  }

  if (isPushServiceAbortError(err)) {
    const brave = await isBraveBrowser();
    if (brave) {
      return {
        code: 'BRAVE_BLOCKED',
        message:
          'Browser Brave memblokir layanan Push secara bawaan. Buka brave://settings/privacy lalu aktifkan "Use Google services for push messaging", atau gunakan Chrome/Edge.',
      };
    }
    return {
      code: 'PUSH_SERVICE_ERROR',
      message:
        'Gagal mendaftar ke layanan push browser (FCM). Pastikan tidak dalam mode Incognito, koneksi internet stabil, serta nonaktifkan sementara VPN, Private DNS, atau AdBlocker yang memblokir layanan Google, lalu klik Coba Lagi.',
    };
  }

  return {
    code: 'UNKNOWN',
    message:
      err instanceof Error && err.message
        ? err.message
        : 'Terjadi kesalahan saat mengaktifkan notifikasi.',
  };
}

export function detectDeviceLabel(platform: string): string {
  if (typeof navigator === 'undefined') return 'Perangkat Web';
  const ua = navigator.userAgent || '';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  let os = 'Perangkat';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  if (platform === 'ios-safari') return `Safari PWA di ${os}`;
  return `${browser} di ${os}`;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export interface SubscribePushResult {
  ok: boolean;
  endpoint?: string;
  permission?: NotificationPermission | 'unsupported';
  code?: PushSubscribeErrorCode;
  error?: string;
}

async function subscribeWithRecovery(
  reg: ServiceWorkerRegistration,
  appServerKey: Uint8Array<ArrayBuffer>
): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const existingKey = existing.options?.applicationServerKey;
    if (!existingKey || areKeyBytesEqual(existingKey, appServerKey)) {
      return existing;
    }
    // Kunci VAPID berubah -> hapus subscription lama agar tidak memicu push service error
    await existing.unsubscribe().catch(() => {});
  }

  const delays = [0, 700, 1500];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await sleep(delays[attempt]);
    }

    try {
      return await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    } catch (err) {
      lastError = err;
      if (!isPushServiceAbortError(err) || attempt === delays.length - 1) {
        break;
      }
      // Bersihkan sisa subscription rusak/gantung dan segarkan registrasi SW sebelum retry
      try {
        const staleSub = await reg.pushManager.getSubscription();
        if (staleSub) await staleSub.unsubscribe();
      } catch {
        // abaikan
      }
      await reg.update().catch(() => {});
    }
  }

  throw lastError;
}

export async function subscribeCurrentDevice(options: {
  audienceType: 'USER' | 'PUBLIC';
  platform: string;
}): Promise<SubscribePushResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      code: 'UNSUPPORTED',
      permission: 'unsupported',
      error: 'Browser atau perangkat ini belum mendukung Web Push Notification.',
    };
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      ok: false,
      code: 'INSECURE_CONTEXT',
      error: 'Web Push Notification hanya dapat diaktifkan melalui koneksi HTTPS yang aman.',
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      code: 'OFFLINE',
      error: 'Perangkat sedang offline. Sambungkan ke internet lalu coba aktifkan kembali.',
    };
  }

  const appServerKey = await resolveVapidKeyBytes();
  if (!appServerKey) {
    return {
      ok: false,
      code: 'VAPID_MISSING',
      error: 'Kunci VAPID Web Push belum dikonfigurasi atau formatnya tidak valid di server.',
    };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return {
      ok: false,
      permission,
      code: permission === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_DISMISSED',
      error:
        permission === 'denied'
          ? 'Izin notifikasi diblokir di browser. Aktifkan melalui pengaturan situs browser Anda.'
          : 'Izin notifikasi belum diberikan.',
    };
  }

  try {
    const reg = await ensureActiveServiceWorker();
    const subscription = await subscribeWithRecovery(reg, appServerKey);

    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh || '';
    const auth = json.keys?.auth || '';

    if (!endpoint || !p256dh || !auth) {
      return {
        ok: false,
        code: 'UNKNOWN',
        error: 'Gagal membaca kunci enkripsi langganan push.',
      };
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        p256dh,
        auth,
        audienceType: options.audienceType,
        platform: options.platform,
        deviceLabel: detectDeviceLabel(options.platform),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        code: 'SERVER_ERROR',
        error: data?.error || 'Gagal menyimpan langganan notifikasi ke server.',
      };
    }

    try {
      window.localStorage.setItem(PUSH_LAST_ENDPOINT_KEY, endpoint);
    } catch {
      // abaikan
    }

    notifyPushStateChanged(true);
    return { ok: true, endpoint, permission: 'granted' };
  } catch (err) {
    const formatted = await formatPushSubscribeError(err);
    return {
      ok: false,
      code: formatted.code,
      error: formatted.message,
    };
  }
}

/**
 * Menonaktifkan subscription perangkat ini di database (TANPA menghapus row & tanpa memutus izin browser).
 * Digunakan saat logout (reason = 'LOGOUT') atau saat user menonaktifkan perangkat ini ('USER_DISABLED').
 */
export async function deactivateCurrentDevicePush(
  reason: 'LOGOUT' | 'USER_DISABLED'
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const sub = await getExistingPushSubscription();
    const endpoint =
      sub?.endpoint || window.localStorage.getItem(PUSH_LAST_ENDPOINT_KEY) || '';
    if (!endpoint) return false;

    const res = await fetch('/api/push/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, reason }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Jika izin sudah granted dan browser sudah punya subscription aktif,
 * sinkronkan ulang ke akun yang sedang login (otomatis mereaktivasi subscription yang sebelumnya dinonaktifkan saat logout).
 */
export async function resyncPushSubscriptionOnPortalLoad(platform: string): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  const appServerKey = await resolveVapidKeyBytes();
  if (!appServerKey) return false;
  try {
    const sub = await getExistingPushSubscription();
    if (!sub) return false;
    // Jika subscription lama memakai VAPID key berbeda, lewati resync agar didaftarkan ulang saat subscribe
    if (
      sub.options?.applicationServerKey &&
      !areKeyBytesEqual(sub.options.applicationServerKey, appServerKey)
    ) {
      await sub.unsubscribe().catch(() => {});
      return false;
    }
    const json = sub.toJSON();
    const endpoint = json.endpoint || sub.endpoint;
    const p256dh = json.keys?.p256dh || '';
    const auth = json.keys?.auth || '';
    if (!endpoint || !p256dh || !auth) return false;

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        p256dh,
        auth,
        audienceType: 'USER',
        platform,
        deviceLabel: detectDeviceLabel(platform),
        resyncOnly: true,
      }),
    });
    if (res.ok) {
      try {
        window.localStorage.setItem(PUSH_LAST_ENDPOINT_KEY, endpoint);
      } catch {
        // abaikan
      }
      notifyPushStateChanged(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
