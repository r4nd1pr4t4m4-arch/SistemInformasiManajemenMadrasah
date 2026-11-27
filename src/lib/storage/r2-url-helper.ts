/**
 * Helper client-safe untuk mengubah URL Cloudflare R2 langsung (mis. *.r2.dev)
 * menjadi URL proxy aplikasi internal agar tidak terkena "Privacy Error" SSL ISP.
 */

export const PUBLIC_R2_MEDIA_PREFIXES = [
  'cms-posts/',
  'gallery/',
  'institution-logos/',
  'avatars/',
] as const;

export function extractPublicMediaR2Key(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('/api/')) return null;

  const cleanDirect = trimmed.split('?')[0] || '';
  if (
    !cleanDirect.includes('..') &&
    PUBLIC_R2_MEDIA_PREFIXES.some((prefix) => cleanDirect.startsWith(prefix))
  ) {
    return cleanDirect;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    if (
      (host.endsWith('.r2.dev') || host.endsWith('.r2.cloudflarestorage.com')) &&
      !pathname.includes('..') &&
      PUBLIC_R2_MEDIA_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      return pathname;
    }
  } catch {
    // bukan URL absolut
  }

  return null;
}

/**
 * Jika URL berasal dari Cloudflare R2 untuk media publik (berita, galeri, logo, avatar),
 * arahkan melalui `/api/public/media?key=...` agar bebas SSL Privacy Error.
 */
export function toPublicMediaProxyUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  const key = extractPublicMediaR2Key(trimmed);
  if (key) {
    return `/api/public/media?key=${encodeURIComponent(key)}`;
  }
  return trimmed;
}

/**
 * Cek apakah URL mengarah ke Cloudflare R2 atau key R2 langsung (yang harus melalui proxy).
 */
export function isDirectR2OrKeyUrl(rawUrl?: string | null, prefixes?: readonly string[]): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('/api/')) return false;

  if (prefixes && prefixes.some((p) => trimmed.startsWith(p))) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith('.r2.dev') || host.endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}
