import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { recordAuditLog } from '@/lib/security/audit-log';

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Layanan autentikasi belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: 'others' });

  if (error) {
    console.error('[SIMMS RevokeOtherSessions] error:', error);
    return NextResponse.json(
      { error: 'Gagal mengakhiri sesi di perangkat lain. Silakan coba lagi.' },
      { status: 500 }
    );
  }

  await recordAuditLog({
    session,
    request,
    module: 'AUTH_SECURITY',
    action: 'REVOKE_OTHER_SESSIONS',
    entityType: 'profile',
    entityId: session.userId,
    summary: 'Pengguna mengakhiri seluruh sesi login aktif di perangkat lain.',
  });

  return NextResponse.json({
    success: true,
    message: 'Seluruh sesi login di perangkat lain telah berhasil diakhiri.',
  });
}
