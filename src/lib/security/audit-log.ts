import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getRequestClientIp } from '@/lib/security/captcha-server';
import type { AuthenticatedSession } from '@/lib/auth/session';

export type AuditModule =
  | 'AUTH_SECURITY'
  | 'USER_MANAGEMENT'
  | 'KEUANGAN_SPP'
  | 'KEUANGAN_TABUNGAN'
  | 'KEUANGAN_HONORARIUM'
  | 'PENILAIAN'
  | 'SDM';

export interface RecordAuditLogInput {
  session: AuthenticatedSession;
  request?: Request;
  module: AuditModule;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mencatat jejak audit keamanan/finansial ke tabel immutable `security_audit_logs`.
 * Bersifat non-blocking agar kegagalan logging (mis. tabel belum dimigrasi) tidak mematahkan alur utama.
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;

  try {
    const supabase = createSupabaseAdminClient();
    const ipAddress = input.request ? getRequestClientIp(input.request) : null;
    const userAgent = input.request
      ? (input.request.headers.get('user-agent') || '').slice(0, 280) || null
      : null;

    const { error } = await supabase.from('security_audit_logs').insert({
      actor_id: input.session.userId,
      actor_email: input.session.email,
      actor_roles: input.session.roles,
      module: input.module,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error('[SIMMS AuditLog] insert failed:', error.code, error.message);
    }
  } catch (err) {
    console.error('[SIMMS AuditLog] unexpected error:', err);
  }
}
