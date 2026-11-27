import { NextRequest, NextResponse } from 'next/server';
import { getR2ObjectBuffer, isR2Configured } from '@/lib/storage/r2';
import { getRateLimitState, incrementRateLimit } from '@/lib/security/rate-limit';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const INLINE_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

export const DEFAULT_MAX_PROXY_BYTES = 15 * 1024 * 1024; // 15 MB

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  return 'unknown';
}

export async function enforceProxyRateLimit(
  request: NextRequest,
  bucketPrefix: string,
  options?: {
    ttlSeconds?: number;
    maxRequests?: number;
    lockoutMs?: number;
  }
): Promise<NextResponse | null> {
  const ttlSeconds = options?.ttlSeconds ?? 60;
  const maxRequests = options?.maxRequests ?? 60;
  const lockoutMs = options?.lockoutMs ?? 60_000;

  const clientIp = getClientIp(request);
  const rateKey = `${bucketPrefix}:${clientIp}`;
  const currentLimit = await getRateLimitState(rateKey);
  if (currentLimit.lockedUntil && currentLimit.lockedUntil > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((currentLimit.lockedUntil - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan berkas. Silakan coba beberapa saat lagi.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const nextLimit = await incrementRateLimit(rateKey, {
    ttlSeconds,
    lockoutThreshold: maxRequests,
    lockoutDurationMs: lockoutMs,
  });
  if (nextLimit.lockedUntil && nextLimit.lockedUntil > Date.now()) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan berkas. Silakan coba beberapa saat lagi.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(lockoutMs / 1000)) } }
    );
  }

  return null;
}

export function normalizeMime(rawMime?: string | null): string {
  const cleaned = (rawMime || '').split(';')[0]?.trim().toLowerCase() || '';
  if (cleaned === 'image/jpg') return 'image/jpeg';
  return cleaned;
}

export function inferMimeType(keyOrUrl: string, fileName?: string | null): string {
  const nameExt = fileName?.split('.').pop()?.toLowerCase() || '';
  if (nameExt && EXT_TO_MIME[nameExt]) return EXT_TO_MIME[nameExt];

  const cleanPath = keyOrUrl.split('?')[0] || '';
  const pathExt = cleanPath.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[pathExt] || 'application/octet-stream';
}

export function sanitizeDownloadFilename(
  raw?: string | null,
  mime = 'application/pdf',
  fallbackBase = 'Dokumen'
): string {
  const fallbackExt =
    Object.entries(EXT_TO_MIME).find(([, value]) => value === mime)?.[0] || 'bin';
  const cleaned = (raw || '')
    .replace(/[\r\n"\\]/g, '')
    .replace(/[^a-zA-Z0-9._\s-]/g, '_')
    .trim();
  return cleaned || `${fallbackBase}.${fallbackExt}`;
}

export function isDisallowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)
  );
}

export function isSafeR2Key(key: string, allowedPrefixes: readonly string[]): boolean {
  if (!key || key.includes('..') || key.includes('\\') || key.includes('\0') || key.startsWith('/')) {
    return false;
  }
  return allowedPrefixes.some((prefix) => key.startsWith(prefix));
}

export function extractR2KeyFromUrl(
  rawUrl: string,
  allowedPrefixes: readonly string[]
): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const cleanDirect = trimmed.split('?')[0] || '';
  if (isSafeR2Key(cleanDirect, allowedPrefixes)) {
    return cleanDirect;
  }

  const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
  if (r2PublicBase && trimmed.startsWith(`${r2PublicBase}/`)) {
    const candidate = trimmed.slice(r2PublicBase.length + 1).split('?')[0] || '';
    if (isSafeR2Key(candidate, allowedPrefixes)) return candidate;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    const host = parsed.hostname.toLowerCase();
    if (
      (host.endsWith('.r2.dev') || host.endsWith('.r2.cloudflarestorage.com')) &&
      isSafeR2Key(pathname, allowedPrefixes)
    ) {
      return pathname;
    }
  } catch {
    // bukan URL absolut
  }

  return null;
}

export function buildSafeFileResponse(params: {
  buffer: Buffer;
  detectedMime: string;
  fileName?: string | null;
  fallbackBase?: string;
  cacheControl?: string;
  maxBytes?: number;
  forceDownload?: boolean;
}): NextResponse {
  const maxBytes = params.maxBytes ?? DEFAULT_MAX_PROXY_BYTES;
  if (params.buffer.byteLength > maxBytes) {
    return NextResponse.json(
      { error: 'Ukuran berkas melebihi batas yang diizinkan.' },
      { status: 413 }
    );
  }

  const normalizedMime = normalizeMime(params.detectedMime);
  const isSafeInline = !params.forceDownload && INLINE_ALLOWED_MIMES.has(normalizedMime);
  const finalMime = INLINE_ALLOWED_MIMES.has(normalizedMime)
    ? normalizedMime
    : 'application/octet-stream';
  const disposition = isSafeInline ? 'inline' : 'attachment';
  const fileName = sanitizeDownloadFilename(
    params.fileName,
    finalMime,
    params.fallbackBase || 'Dokumen'
  );

  // Untuk gambar & attachment non-whitelist, aktifkan CSP sandbox ketat;
  // Untuk PDF inline, izinkan object-src 'self' agar PDF viewer bawaan browser tetap berfungsi tanpa skrip.
  const cspHeader =
    isSafeInline && finalMime === 'application/pdf'
      ? "default-src 'none'; object-src 'self'; frame-ancestors 'self'"
      : "sandbox; default-src 'none'";

  return new NextResponse(new Uint8Array(params.buffer), {
    headers: {
      'Content-Type': finalMime,
      'Content-Disposition': `${disposition}; filename="${fileName}"`,
      'Content-Security-Policy': cspHeader,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': params.cacheControl || 'private, no-store',
    },
  });
}

export async function proxyStoredFile(params: {
  rawUrl: string;
  objectKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fallbackBase?: string;
  allowedPrefixes: readonly string[];
  cacheControl?: string;
  maxBytes?: number;
  forceDownload?: boolean;
}): Promise<NextResponse> {
  const rawUrl = params.rawUrl.trim();
  const maxBytes = params.maxBytes ?? DEFAULT_MAX_PROXY_BYTES;

  // 1. Data URL (Base64 tersimpan langsung di DB)
  if (rawUrl.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(rawUrl);
    if (!match) {
      return NextResponse.json({ error: 'Format berkas tidak valid.' }, { status: 404 });
    }
    const buffer = Buffer.from(match[2], 'base64');
    return buildSafeFileResponse({
      buffer,
      detectedMime: params.mimeType || match[1],
      fileName: params.fileName,
      fallbackBase: params.fallbackBase,
      cacheControl: params.cacheControl,
      maxBytes,
      forceDownload: params.forceDownload,
    });
  }

  // 2. Cloudflare R2 Object via authenticated S3 API (bebas SSL/Privacy Error r2.dev)
  const explicitKey =
    params.objectKey && isSafeR2Key(params.objectKey.trim(), params.allowedPrefixes)
      ? params.objectKey.trim()
      : null;
  const r2Key = explicitKey || extractR2KeyFromUrl(rawUrl, params.allowedPrefixes);
  if (r2Key && isR2Configured()) {
    const bytes = await getR2ObjectBuffer(r2Key);
    const mime = params.mimeType || inferMimeType(r2Key, params.fileName);
    return buildSafeFileResponse({
      buffer: Buffer.from(bytes),
      detectedMime: mime,
      fileName: params.fileName,
      fallbackBase: params.fallbackBase,
      cacheControl: params.cacheControl,
      maxBytes,
      forceDownload: params.forceDownload,
    });
  }

  // 3. Fallback URL HTTPS eksternal (misalnya Supabase Storage) — blokir redirect & SSRF
  if (/^https?:\/\//i.test(rawUrl)) {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'https:' || isDisallowedHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Tautan berkas tidak diizinkan.' }, { status: 400 });
    }

    const upstream = await fetch(rawUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Berkas tidak dapat diakses dari server penyimpanan.' },
        { status: 502 }
      );
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > maxBytes) {
      return NextResponse.json(
        { error: 'Ukuran berkas melebihi batas yang diizinkan.' },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const mime =
      upstream.headers.get('content-type') ||
      params.mimeType ||
      inferMimeType(rawUrl, params.fileName);
    return buildSafeFileResponse({
      buffer,
      detectedMime: mime,
      fileName: params.fileName,
      fallbackBase: params.fallbackBase,
      cacheControl: params.cacheControl,
      maxBytes,
      forceDownload: params.forceDownload,
    });
  }

  return NextResponse.json({ error: 'Berkas tidak valid atau tidak ditemukan.' }, { status: 404 });
}
