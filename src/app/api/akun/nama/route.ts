import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { NAME_CHANGE_COOLDOWN_DAYS } from '@/lib/validation/identity';
import { getNameChangeStatus } from '@/lib/akun/name-change';

const SubmitSchema = z.object({
  new_full_name: z
    .string()
    .trim()
    .min(2, 'Nama lengkap minimal 2 karakter.')
    .max(120, 'Nama lengkap maksimal 120 karakter.'),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }
  const supabase = createSupabaseAdminClient();
  return NextResponse.json(await getNameChangeStatus(supabase, session.userId));
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  try {
    const parsed = SubmitSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pengajuan tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const status = await getNameChangeStatus(supabase, session.userId);

    if (status.pendingNameRequest) {
      return NextResponse.json(
        { error: 'Anda masih memiliki pengajuan perubahan nama yang menunggu persetujuan Admin.' },
        { status: 400 }
      );
    }
    if (status.nextNameChangeAt) {
      return NextResponse.json(
        {
          error: `Nama lengkap hanya dapat diubah 1 kali setiap ${NAME_CHANGE_COOLDOWN_DAYS} hari. Silakan ajukan kembali dalam ${status.nameRemainingDays} hari.`,
        },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.userId)
      .maybeSingle();

    const oldName = (profile?.full_name || session.fullName || '').trim();
    const newName = parsed.data.new_full_name.replace(/\s+/g, ' ').trim();

    if (newName.toLowerCase() === oldName.toLowerCase()) {
      return NextResponse.json(
        { error: 'Nama lengkap baru sama dengan nama saat ini.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('profile_name_change_requests')
      .insert({
        profile_id: session.userId,
        old_full_name: oldName,
        new_full_name: newName,
        reason: parsed.data.reason || null,
        status: 'MENUNGGU',
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal mengirim pengajuan perubahan nama.' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('profile_name_change_requests')
    .delete()
    .eq('profile_id', session.userId)
    .eq('status', 'MENUNGGU');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
