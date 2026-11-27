import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  UUID_REGEX,
  enforceProxyRateLimit,
  proxyStoredFile,
} from '@/lib/storage/safe-file-proxy';

async function isSelfOwnerOfSdmEntity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  if (entityType === 'GTK') {
    const { data } = await supabase
      .from('teachers_staff')
      .select('id')
      .eq('id', entityId)
      .eq('profile_id', userId)
      .maybeSingle();
    return Boolean(data);
  }
  if (entityType === 'ORANG_TUA') {
    const { data } = await supabase
      .from('student_guardians')
      .select('id')
      .eq('id', entityId)
      .eq('profile_id', userId)
      .maybeSingle();
    return Boolean(data);
  }
  if (entityType === 'SISWA' || entityType === 'ALUMNI') {
    const [{ data: ownStudent }, { data: ownChild }] = await Promise.all([
      supabase
        .from('students')
        .select('id')
        .eq('id', entityId)
        .eq('profile_id', userId)
        .maybeSingle(),
      supabase
        .from('student_guardians')
        .select('id')
        .eq('student_id', entityId)
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ]);
    return Boolean(ownStudent || ownChild);
  }
  return false;
}

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const rateLimitResponse = await enforceProxyRateLimit(request, 'sdm-doc-file', {
    ttlSeconds: 60,
    maxRequests: 120,
    lockoutMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const docId = request.nextUrl.searchParams.get('id')?.trim() || '';
  const entityTypeParam = request.nextUrl.searchParams.get('entityType')?.trim().toUpperCase() || '';

  if (!UUID_REGEX.test(docId)) {
    return NextResponse.json({ error: 'ID dokumen tidak valid.' }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const canViewSdm =
    hasAnyRole(session, PERMISSIONS.SDM_VIEW) || hasAnyRole(session, PERMISSIONS.SDM_MANAGE);

  try {
    const preferStudentTable = entityTypeParam === 'SISWA' || entityTypeParam === 'ALUMNI';

    if (preferStudentTable) {
      const { data: stDoc } = await supabase
        .from('student_documents')
        .select('id, student_id, file_url, object_key, file_name, mime_type')
        .eq('id', docId)
        .maybeSingle();

      if (stDoc?.file_url) {
        if (!canViewSdm) {
          const isOwner = await isSelfOwnerOfSdmEntity(supabase, session.userId, 'SISWA', stDoc.student_id);
          if (!isOwner) {
            return NextResponse.json(
              { error: 'Anda tidak memiliki izin mengakses dokumen ini.' },
              { status: 403 }
            );
          }
        }
        return await proxyStoredFile({
          rawUrl: stDoc.file_url,
          objectKey: stDoc.object_key,
          fileName: stDoc.file_name,
          mimeType: stDoc.mime_type,
          fallbackBase: 'Dokumen_Siswa',
          allowedPrefixes: ['student-documents/', 'ppdb/'],
          cacheControl: 'private, no-store',
        });
      }
    }

    const { data: sdmDoc } = await supabase
      .from('sdm_documents')
      .select('id, entity_type, entity_id, file_url, object_key, file_name, mime_type')
      .eq('id', docId)
      .maybeSingle();

    if (sdmDoc?.file_url) {
      if (!canViewSdm) {
        const isOwner = await isSelfOwnerOfSdmEntity(
          supabase,
          session.userId,
          sdmDoc.entity_type,
          sdmDoc.entity_id
        );
        if (!isOwner) {
          return NextResponse.json(
            { error: 'Anda tidak memiliki izin mengakses dokumen ini.' },
            { status: 403 }
          );
        }
      }
      return await proxyStoredFile({
        rawUrl: sdmDoc.file_url,
        objectKey: sdmDoc.object_key,
        fileName: sdmDoc.file_name,
        mimeType: sdmDoc.mime_type,
        fallbackBase: 'Dokumen_SDM',
        allowedPrefixes: ['student-documents/', 'ppdb/'],
        cacheControl: 'private, no-store',
      });
    }

    if (!preferStudentTable) {
      const { data: stDoc } = await supabase
        .from('student_documents')
        .select('id, student_id, file_url, object_key, file_name, mime_type')
        .eq('id', docId)
        .maybeSingle();

      if (stDoc?.file_url) {
        if (!canViewSdm) {
          const isOwner = await isSelfOwnerOfSdmEntity(supabase, session.userId, 'SISWA', stDoc.student_id);
          if (!isOwner) {
            return NextResponse.json(
              { error: 'Anda tidak memiliki izin mengakses dokumen ini.' },
              { status: 403 }
            );
          }
        }
        return await proxyStoredFile({
          rawUrl: stDoc.file_url,
          objectKey: stDoc.object_key,
          fileName: stDoc.file_name,
          mimeType: stDoc.mime_type,
          fallbackBase: 'Dokumen_Siswa',
          allowedPrefixes: ['student-documents/', 'ppdb/'],
          cacheControl: 'private, no-store',
        });
      }
    }

    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Gagal memuat berkas dokumen SDM.' }, { status: 500 });
  }
}
