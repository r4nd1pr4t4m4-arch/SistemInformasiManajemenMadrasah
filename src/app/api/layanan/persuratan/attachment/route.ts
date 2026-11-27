import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  UUID_REGEX,
  enforceProxyRateLimit,
  proxyStoredFile,
} from '@/lib/storage/safe-file-proxy';

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const rateLimitResponse = await enforceProxyRateLimit(request, 'portal-letter-att', {
    ttlSeconds: 60,
    maxRequests: 120,
    lockoutMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const id = request.nextUrl.searchParams.get('id')?.trim() || '';
  const type = request.nextUrl.searchParams.get('type')?.trim().toLowerCase() || 'letter';

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID lampiran tidak valid.' }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const canViewAllPersuratan = hasAnyRole(session, PERMISSIONS.PERSURATAN_VIEW);

  try {
    if (type === 'request') {
      const { data: reqRow } = await supabase
        .from('letter_requests')
        .select('id, requester_profile_id, attachment_url, attachment_name')
        .eq('id', id)
        .maybeSingle();

      if (!reqRow?.attachment_url) {
        return NextResponse.json({ error: 'Lampiran permohonan tidak ditemukan.' }, { status: 404 });
      }

      const isOwner = reqRow.requester_profile_id === session.userId;
      if (!canViewAllPersuratan && !isOwner) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki izin mengakses lampiran ini.' },
          { status: 403 }
        );
      }

      return await proxyStoredFile({
        rawUrl: reqRow.attachment_url,
        fileName: reqRow.attachment_name,
        fallbackBase: 'Lampiran_Permohonan_Surat',
        allowedPrefixes: ['letters/'],
        cacheControl: 'private, no-store',
      });
    }

    // Default: type === 'letter'
    let letterRow: {
      id?: string;
      file_url?: string | null;
      attachment_name?: string | null;
      direction?: string | null;
      category?: string | null;
      status?: string | null;
      student_id?: string | null;
      teacher_id?: string | null;
    } | null = null;

    const primaryRes = await supabase
      .from('letters')
      .select('id, file_url, attachment_name, direction, category, status, student_id, teacher_id')
      .eq('id', id)
      .maybeSingle();

    if (!primaryRes.error && primaryRes.data) {
      letterRow = primaryRes.data;
    } else if (primaryRes.error) {
      const fallbackRes = await supabase
        .from('letters')
        .select('id, file_url, direction, category, student_id, teacher_id')
        .eq('id', id)
        .maybeSingle();
      if (fallbackRes.data) {
        letterRow = fallbackRes.data;
      }
    }

    if (!letterRow?.file_url) {
      return NextResponse.json({ error: 'Lampiran surat tidak ditemukan.' }, { status: 404 });
    }

    if (!canViewAllPersuratan) {
      const status = String(letterRow.status || 'TERBIT').toUpperCase();
      const isPublicEdaran =
        letterRow.direction === 'KELUAR' &&
        letterRow.category === 'SURAT_EDARAN' &&
        status !== 'DRAFT' &&
        status !== 'DIBATALKAN';

      let allowed = isPublicEdaran;

      if (!allowed) {
        // Cek apakah pengguna penerima disposisi surat ini
        const { data: disp } = await supabase
          .from('letter_dispositions')
          .select('id')
          .eq('letter_id', id)
          .eq('to_profile_id', session.userId)
          .limit(1)
          .maybeSingle();
        if (disp) allowed = true;
      }

      if (!allowed) {
        // Cek apakah surat diterbitkan dari permohonan milik pengguna ini
        const { data: ownReq } = await supabase
          .from('letter_requests')
          .select('id')
          .eq('issued_letter_id', id)
          .eq('requester_profile_id', session.userId)
          .limit(1)
          .maybeSingle();
        if (ownReq) allowed = true;
      }

      if (!allowed && letterRow.teacher_id) {
        const { data: ownTeacher } = await supabase
          .from('teachers_staff')
          .select('id')
          .eq('id', letterRow.teacher_id)
          .eq('profile_id', session.userId)
          .maybeSingle();
        if (ownTeacher) allowed = true;
      }

      if (!allowed && letterRow.student_id) {
        const [{ data: ownStudent }, { data: ownChild }] = await Promise.all([
          supabase
            .from('students')
            .select('id')
            .eq('id', letterRow.student_id)
            .eq('profile_id', session.userId)
            .maybeSingle(),
          supabase
            .from('student_guardians')
            .select('id')
            .eq('student_id', letterRow.student_id)
            .eq('profile_id', session.userId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),
        ]);
        if (ownStudent || ownChild) allowed = true;
      }

      if (!allowed) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki izin mengakses lampiran surat ini.' },
          { status: 403 }
        );
      }
    }

    return await proxyStoredFile({
      rawUrl: letterRow.file_url,
      fileName: letterRow.attachment_name,
      fallbackBase: 'Lampiran_Surat',
      allowedPrefixes: ['letters/'],
      cacheControl: 'private, no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memuat berkas lampiran surat.' },
      { status: 500 }
    );
  }
}
