import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import type { AppRole } from '@/types/database';
import {
  UUID_REGEX,
  enforceProxyRateLimit,
  proxyStoredFile,
} from '@/lib/storage/safe-file-proxy';

const STAFF_ROLES: AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'KEPALA_TU',
  'STAF_TU',
  'WAKA_KESISWAAN',
];

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SISWA_BIODATA_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  const rateLimitResponse = await enforceProxyRateLimit(request, 'siswa-doc-file', {
    ttlSeconds: 60,
    maxRequests: 120,
    lockoutMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const docId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!UUID_REGEX.test(docId)) {
    return NextResponse.json({ error: 'ID dokumen siswa tidak valid.' }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const session = guard.session;

  try {
    const { data: doc } = await supabase
      .from('student_documents')
      .select('id, student_id, file_url, object_key, file_name, mime_type')
      .eq('id', docId)
      .maybeSingle();

    if (!doc?.file_url) {
      return NextResponse.json({ error: 'Dokumen siswa tidak ditemukan.' }, { status: 404 });
    }

    const isStaff = session.roles.some((r) => STAFF_ROLES.includes(r));
    if (!isStaff) {
      let allowed = false;

      if (session.teacherAssignments?.guruWaliStudentIds?.includes(doc.student_id)) {
        allowed = true;
      }

      if (!allowed && session.teacherAssignments?.homeroomClassroomIds?.length) {
        const { data: enr } = await supabase
          .from('student_enrollments')
          .select('id')
          .eq('student_id', doc.student_id)
          .in('classroom_id', session.teacherAssignments.homeroomClassroomIds)
          .limit(1)
          .maybeSingle();
        if (enr) allowed = true;
      }

      if (!allowed) {
        const [{ data: ownStudent }, { data: ownGuardian }] = await Promise.all([
          supabase
            .from('students')
            .select('id')
            .eq('id', doc.student_id)
            .eq('profile_id', session.userId)
            .maybeSingle(),
          supabase
            .from('student_guardians')
            .select('id')
            .eq('student_id', doc.student_id)
            .eq('profile_id', session.userId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),
        ]);
        if (ownStudent || ownGuardian) allowed = true;
      }

      if (!allowed) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki izin mengakses dokumen siswa ini.' },
          { status: 403 }
        );
      }
    }

    return await proxyStoredFile({
      rawUrl: doc.file_url,
      objectKey: doc.object_key,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      fallbackBase: 'Dokumen_Siswa',
      allowedPrefixes: ['student-documents/', 'ppdb/'],
      cacheControl: 'private, no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Gagal memuat berkas dokumen siswa.' }, { status: 500 });
  }
}
