import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { syncProfileContactToEntities } from '@/lib/sdm/sync';
import { sanitizeApiError } from '@/lib/security/api-error';

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT']),
  review_notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.USER_MANAGEMENT_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ requests: [] });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profile_name_change_requests')
    .select('*, profile:profiles!profile_name_change_requests_profile_id_fkey(id, email, primary_role)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.USER_MANAGEMENT_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const parsed = ReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data persetujuan tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: req } = await supabase
      .from('profile_name_change_requests')
      .select('*')
      .eq('id', parsed.data.id)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 });
    }
    if (req.status !== 'MENUNGGU') {
      return NextResponse.json({ error: 'Pengajuan ini sudah diproses.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const nextStatus = parsed.data.action === 'APPROVE' ? 'DISETUJUI' : 'DITOLAK';

    const { error: updErr } = await supabase
      .from('profile_name_change_requests')
      .update({
        status: nextStatus,
        reviewed_by: guard.session.userId,
        reviewed_at: nowIso,
        review_notes: parsed.data.review_notes || null,
      })
      .eq('id', req.id)
      .eq('status', 'MENUNGGU');
    if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });

    if (nextStatus === 'DISETUJUI') {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ full_name: req.new_full_name, updated_at: nowIso })
        .eq('id', req.profile_id);
      if (profErr) return NextResponse.json({ error: sanitizeApiError(profErr) }, { status: 500 });

      // Sinkronkan nama baru ke GTK, Siswa, dan Orang Tua/Wali yang tertaut
      await syncProfileContactToEntities(supabase, req.profile_id, {
        full_name: req.new_full_name,
      });
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses persetujuan perubahan nama.' }, { status: 500 });
  }
}
