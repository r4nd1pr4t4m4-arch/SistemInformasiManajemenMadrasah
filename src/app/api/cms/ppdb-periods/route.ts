import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

const CreatePeriodSchema = z.object({
  name: z.string().min(3),
  open_date: z.string().min(8),
  close_date: z.string().min(8),
  announcement_date: z.string().optional().nullable(),
  quota: z.number().min(1).optional().nullable(),
  is_active: z.boolean().default(true),
});

const UpdatePeriodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).optional(),
  open_date: z.string().optional(),
  close_date: z.string().optional(),
  announcement_date: z.string().optional().nullable(),
  quota: z.number().min(1).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.CMS);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ periods: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ppdb_periods')
    .select('*')
    .order('open_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ periods: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.CMS);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreatePeriodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data periode PPDB tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    if (parsed.data.is_active) {
      await supabase.from('ppdb_periods').update({ is_active: false }).eq('is_active', true);
    }

    const { data, error } = await supabase
      .from('ppdb_periods')
      .insert({
        ...parsed.data,
        announcement_date: parsed.data.announcement_date || null,
        quota: parsed.data.quota || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ period: data });
  } catch {
    return NextResponse.json({ error: 'Gagal membuat periode PPDB.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.CMS);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum siap.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdatePeriodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data pembaruan periode tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    if (parsed.data.is_active === true) {
      await supabase.from('ppdb_periods').update({ is_active: false }).eq('is_active', true);
    }

    const { id, ...updates } = parsed.data;
    const { data, error } = await supabase
      .from('ppdb_periods')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ period: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui periode PPDB.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.CMS);
  if (guard.errorResponse) return guard.errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID periode wajib diisi.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('ppdb_periods').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
