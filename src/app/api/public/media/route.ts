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
  'video/ogg',
  'video/quicktime',
]);

const MAX_PUBLIC_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

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

  const isVideo = inferredMime.startsWith('video/');

  try {
    const bytes = await getR2ObjectBuffer(rawKey);
    const buffer = Buffer.from(bytes);
    const fileName = rawKey.split('/').pop() || 'media';

    if (isVideo) {
      if (buffer.byteLength > MAX_PUBLIC_VIDEO_BYTES) {
        return NextResponse.json(
          { error: 'Ukuran video melebihi batas yang diizinkan.' },
          { status: 413 }
        );
      }

      const rangeHeader = request.headers.get('range');
      const totalLength = buffer.byteLength;
      const baseHeaders: Record<string, string> = {
        'Content-Type': inferredMime,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      };

      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
        if (match) {
          const start = match[1] ? Number.parseInt(match[1], 10) : 0;
          const end = match[2] ? Math.min(Number.parseInt(match[2], 10), totalLength - 1) : totalLength - 1;
          if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && start <= end && end < totalLength) {
            const chunk = buffer.subarray(start, end + 1);
            return new NextResponse(new Uint8Array(chunk), {
              status: 206,
              headers: {
                ...baseHeaders,
                'Content-Range': `bytes ${start}-${end}/${totalLength}`,
                'Content-Length': String(chunk.byteLength),
              },
            });
          }
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${totalLength}` },
          });
        }
      }

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(totalLength),
        },
      });
    }

    return buildSafeFileResponse({
      buffer,
      detectedMime: inferredMime,
      fileName,
      fallbackBase: 'Media_SIMMS',
      cacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
    });
  } catch {
    return NextResponse.json({ error: 'Berkas media publik tidak ditemukan.' }, { status: 404 });
  }
}
