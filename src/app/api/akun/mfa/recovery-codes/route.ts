import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/security/audit-log';
import { sanitizeApiError } from '@/lib/security/api-error';

function generateRecoveryCode(): string {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function hashRecoveryCode(userId: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${code.trim().toUpperCase()}`)
    .digest('hex');
}

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ totalCount: 0, remainingCount: 0, lastGeneratedAt: null });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_mfa_recovery_codes')
    .select('id, used_at, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ totalCount: 0, remainingCount: 0, lastGeneratedAt: null });
    }
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  }

  const rows = data || [];
  return NextResponse.json({
    totalCount: rows.length,
    remainingCount: rows.filter((r) => !r.used_at).length,
    lastGeneratedAt: rows[0]?.created_at || null,
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const codes = Array.from({ length: 8 }, () => generateRecoveryCode());
  const hashedRows = codes.map((code) => ({
    user_id: session.userId,
    code_hash: hashRecoveryCode(session.userId, code),
  }));

  const { error: delErr } = await supabase
    .from('user_mfa_recovery_codes')
    .delete()
    .eq('user_id', session.userId);

  if (delErr) {
    return NextResponse.json(
      { error: sanitizeApiError(delErr, 'Gagal memperbarui kode pemulihan MFA.') },
      { status: 500 }
    );
  }

  const { error: insErr } = await supabase.from('user_mfa_recovery_codes').insert(hashedRows);
  if (insErr) {
    return NextResponse.json(
      { error: sanitizeApiError(insErr, 'Gagal menyimpan kode pemulihan MFA.') },
      { status: 500 }
    );
  }

  await recordAuditLog({
    session,
    request,
    module: 'AUTH_SECURITY',
    action: 'GENERATE_MFA_RECOVERY_CODES',
    entityType: 'profile',
    entityId: session.userId,
    summary: 'Pengguna membuat ulang 8 kode pemulihan cadangan (Backup Recovery Codes) MFA.',
  });

  return NextResponse.json({
    codes,
    remainingCount: codes.length,
    message: '8 Kode Pemulihan MFA berhasil dibuat. Simpan di tempat yang aman.',
  });
}
