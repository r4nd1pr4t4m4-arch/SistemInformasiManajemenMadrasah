import { NextRequest, NextResponse } from 'next/server';
import { getR2ObjectBuffer, isR2Configured } from '@/lib/storage/r2';
import {
  buildSafeFileResponse,
  enforceProxyRateLimit,
  inferMimeType,
  isSafeR2Key,
} from '@/lib/storage/safe-file-proxy';
import { PUBLIC_R2_MEDIA_PREFIXES } from '@/lib/storage/r2-url-helper';

const PUBLIC_MEDIA_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceProxyRateLimit(request, 'pub-media', {
    ttlSeconds: 60,
    maxRequests: 240,
    lockoutMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const rawKey = request.nextUrl.searchParams.get('key')?.trim() || '';
  if (!isSafeR2Key(rawKey, PUBLIC_R2_MEDIA_PREFIXES)) {
    return NextResponse.json({ error: 'Kunci media publik tidak valid.' }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'Penyimpanan media belum dikonfigurasi.' }, { status: 503 });
  }

  const inferredMime = inferMimeType(rawKey);
  if (!PUBLIC_MEDIA_ALLOWED_MIMES.has(inferredMime)) {
    return NextResponse.json({ error: 'Format media publik tidak diizinkan.' }, { status: 400 });
  }

  try {
    const bytes = await getR2ObjectBuffer(rawKey);
    const fileName = rawKey.split('/').pop() || 'media';
    return buildSafeFileResponse({
      buffer: Buffer.from(bytes),
      detectedMime: inferredMime,
      fileName,
      fallbackBase: 'Media_SIMMS',
      cacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
    });
  } catch {
    return NextResponse.json({ error: 'Berkas media publik tidak ditemukan.' }, { status: 404 });
  }
}
