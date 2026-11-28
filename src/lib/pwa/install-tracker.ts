export type PwaInstallPlatform =
  | 'android-chrome'
  | 'ios-safari'
  | 'desktop-chromium'
  | 'desktop-safari'
  | 'other';

export type PwaInstallSource =
  | 'APPINSTALLED_EVENT'
  | 'STANDALONE_LAUNCH'
  | 'DEFERRED_LINK';

const DEVICE_ID_STORAGE_KEY = 'simms_pwa_device_id';
const PENDING_INSTALL_KEY = 'simms_pwa_install_pending';
const SESSION_REPORTED_KEY = 'simms_pwa_install_reported_v1';

interface PendingInstallMarker {
  source: PwaInstallSource;
  installedAt: string;
}

function generateFallbackUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pwa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreatePwaDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
    if (existing && existing.length >= 8) return existing;
    const nextId = generateFallbackUuid();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return generateFallbackUuid();
  }
}

export function buildPwaDeviceLabel(uaInput?: string): string {
  const ua = uaInput ?? (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  if (!ua) return 'Perangkat Tidak Dikenal';

  let os = 'Perangkat Lain';
  if (/iPhone/i.test(ua)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) {
    os = 'iPad (iPadOS)';
  } else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return `${os} • ${browser}`;
}

export function markPendingPwaInstall(source: PwaInstallSource = 'APPINSTALLED_EVENT'): void {
  if (typeof window === 'undefined') return;
  try {
    const marker: PendingInstallMarker = {
      source,
      installedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(PENDING_INSTALL_KEY, JSON.stringify(marker));
  } catch {
    // Abaikan jika localStorage diblokir
  }
}

export function readPendingPwaInstall(): PendingInstallMarker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_INSTALL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingInstallMarker>;
    if (parsed && typeof parsed.installedAt === 'string') {
      return {
        source:
          parsed.source === 'APPINSTALLED_EVENT' ||
          parsed.source === 'STANDALONE_LAUNCH' ||
          parsed.source === 'DEFERRED_LINK'
            ? parsed.source
            : 'DEFERRED_LINK',
        installedAt: parsed.installedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingPwaInstall(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_INSTALL_KEY);
  } catch {
    // Abaikan
  }
}

export async function reportPwaInstallation(params: {
  platform: PwaInstallPlatform;
  installSource: PwaInstallSource;
  displayMode?: string;
  force?: boolean;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (!params.force && window.sessionStorage.getItem(SESSION_REPORTED_KEY) === '1') {
      return false;
    }
  } catch {
    // Lanjut jika sessionStorage tidak tersedia
  }

  const deviceId = getOrCreatePwaDeviceId();
  if (!deviceId) return false;

  const pending = readPendingPwaInstall();
  const effectiveSource: PwaInstallSource =
    params.installSource === 'APPINSTALLED_EVENT'
      ? 'APPINSTALLED_EVENT'
      : pending
        ? pending.source === 'APPINSTALLED_EVENT'
          ? 'DEFERRED_LINK'
          : pending.source
        : params.installSource;

  try {
    const res = await fetch('/api/pwa/installations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        device_id: deviceId,
        platform: params.platform,
        device_label: buildPwaDeviceLabel(),
        install_source: effectiveSource,
        display_mode: params.displayMode || 'standalone',
        installed_at: pending?.installedAt || null,
      }),
    });

    if (res.ok) {
      try {
        window.sessionStorage.setItem(SESSION_REPORTED_KEY, '1');
      } catch {
        // Abaikan
      }
      clearPendingPwaInstall();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
