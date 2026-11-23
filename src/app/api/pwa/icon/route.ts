import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

type IconVariant = 'svg' | 'maskable-svg' | '192' | '512' | 'maskable' | 'apple';

const VARIANT_MAP: Record<IconVariant, { file: string; contentType: string }> = {
  svg: { file: 'icon.svg', contentType: 'image/svg+xml' },
  'maskable-svg': { file: 'icon-maskable.svg', contentType: 'image/svg+xml' },
  '192': { file: 'icon-192x192.png', contentType: 'image/png' },
  '512': { file: 'icon-512x512.png', contentType: 'image/png' },
  maskable: { file: 'icon-maskable-512x512.png', contentType: 'image/png' },
  apple: { file: 'apple-touch-icon.png', contentType: 'image/png' },
};

function parseVariant(raw: string | null): IconVariant {
  if (raw && raw in VARIANT_MAP) {
    return raw as IconVariant;
  }
  return 'svg';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const variant = parseVariant(url.searchParams.get('size'));
  const cfg = VARIANT_MAP[variant];
  const filePath = path.join(process.cwd(), 'public', 'icons', cfg.file);
  const bytes = await readFile(filePath);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': cfg.contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
