import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  UUID_REGEX,
  enforceProxyRateLimit,
  proxyStoredFile,
} from '@/lib/storage/safe-file-proxy';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceProxyRateLimit(request, 'pub-letter-att', {
    ttlSeconds: 60,
    maxRequests: 60,
    lockoutMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const letterId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!UUID_REGEX.test(letterId)) {
    return NextResponse.json({ error: 'ID surat edaran tidak valid.' }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    let letterRow: {
      file_url?: string | null;
      attachment_name?: string | null;
      status?: string | null;
    } | null = null;

    const primaryRes = await supabase
      .from('letters')
      .select('file_url, attachment_name, status')
      .eq('id', letterId)
      .eq('direction', 'KELUAR')
      .eq('category', 'SURAT_EDARAN')
      .maybeSingle();

    if (!primaryRes.error && primaryRes.data) {
      letterRow = primaryRes.data;
    } else if (primaryRes.error) {
      const fallbackRes = await supabase
        .from('letters')
        .select('file_url')
        .eq('id', letterId)
        .eq('direction', 'KELUAR')
        .eq('category', 'SURAT_EDARAN')
        .maybeSingle();
      if (fallbackRes.data) {
        letterRow = fallbackRes.data;
      }
    }

    if (!letterRow?.file_url) {
      return NextResponse.json({ error: 'Lampiran surat edaran tidak ditemukan.' }, { status: 404 });
    }

    const status = String(letterRow.status || 'TERBIT').toUpperCase();
    if (status === 'DRAFT' || status === 'DIBATALKAN') {
      return NextResponse.json({ error: 'Lampiran surat edaran tidak tersedia.' }, { status: 404 });
    }

    return await proxyStoredFile({
      rawUrl: letterRow.file_url,
      fileName: letterRow.attachment_name,
      fallbackBase: 'Lampiran_Surat_Edaran',
      allowedPrefixes: ['letters/'],
      cacheControl: 'public, max-age=300, stale-while-revalidate=3600',
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memuat berkas lampiran surat edaran.' },
      { status: 500 }
    );
  }
}
