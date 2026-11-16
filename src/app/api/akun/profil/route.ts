import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
});

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ profile: session });
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, avatar_url, primary_role, created_at')
    .eq('id', session.userId)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      ...(data || {}),
      roles: session.roles,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Layanan database belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data profil tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.userId)
      .select('id, full_name, email, phone, primary_role')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui profil akun.' }, { status: 500 });
  }
}
