import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.USER_MANAGEMENT_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ logs: [] });
  }

  const moduleFilter = request.nextUrl.searchParams.get('module');
  const rawLimit = Number(request.nextUrl.searchParams.get('limit') || '50');
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.trunc(rawLimit))) : 50;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('security_audit_logs')
    .select(
      'id, actor_id, actor_email, actor_roles, module, action, entity_type, entity_id, summary, metadata, ip_address, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (moduleFilter && moduleFilter !== 'ALL') {
    query = query.eq('module', moduleFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: sanitizeApiError(error, 'Gagal memuat log audit keamanan.') },
      { status: 500 }
    );
  }

  return NextResponse.json({ logs: data || [] });
}
