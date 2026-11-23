import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
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
    .from('profile_avatar_change_requests')
    .select(
      '*, profile:profiles!profile_avatar_change_requests_profile_id_fkey(id, full_name, email, primary_role)'
    )
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
      return NextResponse.json({ error: 'Data persetujuan foto profil tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: req } = await supabase
      .from('profile_avatar_change_requests')
      .select('*')
      .eq('id', parsed.data.id)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ error: 'Pengajuan foto profil tidak ditemukan.' }, { status: 404 });
    }
    if (req.status !== 'MENUNGGU') {
      return NextResponse.json({ error: 'Pengajuan ini sudah diproses.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const nextStatus = parsed.data.action === 'APPROVE' ? 'DISETUJUI' : 'DITOLAK';

    const { error: updErr } = await supabase
      .from('profile_avatar_change_requests')
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
        .update({ avatar_url: req.new_avatar_url, updated_at: nowIso })
        .eq('id', req.profile_id);
      if (profErr) return NextResponse.json({ error: sanitizeApiError(profErr) }, { status: 500 });

      // Sinkronkan ke data siswa dan GTK (photo_url) jika tertaut
      await Promise.all([
        supabase
          .from('students')
          .update({ photo_url: req.new_avatar_url })
          .eq('profile_id', req.profile_id),
        supabase
          .from('teachers_staff')
          .update({ photo_url: req.new_avatar_url })
          .eq('profile_id', req.profile_id),
      ]);

      // Catat waktu persetujuan avatar pada auth metadata untuk cooldown 45 hari
      const { data: authUserRes } = await supabase.auth.admin.getUserById(req.profile_id);
      const currentMeta = (authUserRes?.user?.user_metadata || {}) as Record<string, unknown>;
      await supabase.auth.admin.updateUserById(req.profile_id, {
        user_metadata: {
          ...currentMeta,
          avatar_updated_at: nowIso,
        },
      });
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memproses persetujuan foto profil.' },
      { status: 500 }
    );
  }
}
