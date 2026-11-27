import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  UUID_REGEX,
  enforceProxyRateLimit,
  proxyStoredFile,
} from '@/lib/storage/safe-file-proxy';

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  const rateLimitResponse = await enforceProxyRateLimit(request, 'cms-ppdb-doc', {
    ttlSeconds: 60,
    maxRequests: 120,
    lockoutMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const docId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!UUID_REGEX.test(docId)) {
    return NextResponse.json({ error: 'ID dokumen PPDB tidak valid.' }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: doc } = await supabase
      .from('ppdb_documents')
      .select('id, file_url, file_name, document_type')
      .eq('id', docId)
      .maybeSingle();

    if (!doc?.file_url) {
      return NextResponse.json({ error: 'Berkas PPDB tidak ditemukan.' }, { status: 404 });
    }

    return await proxyStoredFile({
      rawUrl: doc.file_url,
      fileName: doc.file_name || `${doc.document_type || 'Dokumen_PPDB'}.pdf`,
      fallbackBase: 'Dokumen_PPDB',
      allowedPrefixes: ['ppdb/', 'student-documents/'],
      cacheControl: 'private, no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Gagal memuat berkas dokumen PPDB.' }, { status: 500 });
  }
}
