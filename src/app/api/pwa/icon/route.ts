import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { NextResponse, connection } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getR2ObjectBuffer, isR2Configured } from '@/lib/storage/r2';

type IconVariant = '192' | '512' | 'maskable' | 'apple';

const VARIANT_CONFIG: Record<
  IconVariant,
  { size: number; maskable: boolean; fallbackFile: string }
> = {
  '192': { size: 192, maskable: false, fallbackFile: 'icon-192x192.png' },
  '512': { size: 512, maskable: false, fallbackFile: 'icon-512x512.png' },
  maskable: { size: 512, maskable: true, fallbackFile: 'icon-maskable-512x512.png' },
  apple: { size: 180, maskable: false, fallbackFile: 'apple-touch-icon.png' },
};

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function parseVariant(raw: string | null): IconVariant {
  if (raw === '192' || raw === '512' || raw === 'maskable' || raw === 'apple') {
    return raw;
  }
  return '512';
}

function inferMimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || 'image/png';
}

function extractLogoR2Key(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('institution-logos/')) return trimmed;
  if (trimmed.startsWith('/api/cms/logo?')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const key = parsed.searchParams.get('key')?.trim() || '';
      if (key.startsWith('institution-logos/')) return key;
    } catch {
      return null;
    }
  }
  const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
  if (r2PublicBase && trimmed.startsWith(`${r2PublicBase}/`)) {
    return trimmed.slice(r2PublicBase.length + 1);
  }
  return null;
}

async function fetchInstitutionLogoDataUrl(): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('institution_settings')
      .select('logo_url')
      .limit(1)
      .maybeSingle();

    const rawLogoUrl = data?.logo_url?.trim() || '';
    if (!rawLogoUrl) return null;

    if (rawLogoUrl.startsWith('data:image/')) {
      return rawLogoUrl;
    }

    const r2Key = extractLogoR2Key(rawLogoUrl);
    if (r2Key && isR2Configured()) {
      const bytes = await getR2ObjectBuffer(r2Key);
      const mime = inferMimeFromKey(r2Key);
      return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
    }

    if (/^https:\/\//i.test(rawLogoUrl)) {
      const parsed = new URL(rawLogoUrl);
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.endsWith('.local') ||
        /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)
      ) {
        return null;
      }
      const upstream = await fetch(rawLogoUrl, {
        signal: AbortSignal.timeout(4000),
      });
      if (!upstream.ok) return null;
      const mime = upstream.headers.get('content-type') || 'image/png';
      if (!mime.startsWith('image/')) return null;
      const buf = Buffer.from(await upstream.arrayBuffer());
      return `data:${mime};base64,${buf.toString('base64')}`;
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const variant = parseVariant(url.searchParams.get('size'));
  const cfg = VARIANT_CONFIG[variant];

  try {
    const logoDataUrl = await fetchInstitutionLogoDataUrl();
    if (logoDataUrl) {
      const innerSize = cfg.maskable
        ? Math.round(cfg.size * 0.72)
        : Math.round(cfg.size * 0.84);

      const imgRes = new ImageResponse(
        {
          type: 'div',
          key: 'root',
          props: {
            style: {
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: cfg.maskable ? '#059669' : '#ffffff',
            },
            children: {
              type: 'img',
              key: 'logo',
              props: {
                src: logoDataUrl,
                width: innerSize,
                height: innerSize,
                style: {
                  objectFit: 'contain',
                },
              },
            },
          },
        },
        {
          width: cfg.size,
          height: cfg.size,
        }
      );

      const pngBytes = await imgRes.arrayBuffer();
      return new NextResponse(pngBytes, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
  } catch {
    // Fallback ke ikon statis placeholder di public/icons/
  }

  const fallbackPath = path.join(process.cwd(), 'public', 'icons', cfg.fallbackFile);
  const fallbackBytes = await readFile(fallbackPath);
  return new NextResponse(new Uint8Array(fallbackBytes), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
