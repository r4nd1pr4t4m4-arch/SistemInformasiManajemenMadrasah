'use client';

export const PUSH_RECEIVED_EVENT = 'simms-push-received';
export const PUSH_OPT_IN_DISMISSED_KEY = 'simms_push_optin_dismissed_at';
export const PUSH_LAST_ENDPOINT_KEY = 'simms_push_last_endpoint';

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

export function getClientVapidPublicKey(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectDeviceLabel(platform: string): string {
  if (typeof navigator === 'undefined') return 'Perangkat Web';
  const ua = navigator.userAgent || '';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
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
  error?: string;
}

export async function subscribeCurrentDevice(options: {
  audienceType: 'USER' | 'PUBLIC';
  platform: string;
}): Promise<SubscribePushResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      permission: 'unsupported',
      error: 'Browser atau perangkat ini belum mendukung Web Push Notification.',
    };
  }

  const vapidPublicKey = getClientVapidPublicKey();
  if (!vapidPublicKey) {
    return {
      ok: false,
      error: 'Kunci VAPID Web Push belum dikonfigurasi di server.',
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
      error:
        permission === 'denied'
          ? 'Izin notifikasi diblokir di browser. Aktifkan melalui pengaturan situs browser Anda.'
          : 'Izin notifikasi belum diberikan.',
    };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh || '';
    const auth = json.keys?.auth || '';

    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: 'Gagal membaca kunci enkripsi langganan push.' };
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
        error: data?.error || 'Gagal menyimpan langganan notifikasi ke server.',
      };
    }

    try {
      window.localStorage.setItem(PUSH_LAST_ENDPOINT_KEY, endpoint);
    } catch {
      // abaikan
    }

    return { ok: true, endpoint, permission: 'granted' };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengaktifkan notifikasi.',
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
  if (!getClientVapidPublicKey()) return false;
  try {
    const sub = await getExistingPushSubscription();
    if (!sub) return false;
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
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
