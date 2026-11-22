import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';

import { DEFAULT_PATHWAY_QUOTAS } from '@/lib/ppdb/pathways';

const PathwayQuotasSchema = z.object({
  DOMISILI: z.number().min(0),
  AFIRMASI: z.number().min(0),
  PRESTASI: z.number().min(0),
});

const CreatePeriodSchema = z.object({
  name: z.string().min(3),
  open_date: z.string().min(8),
  close_date: z.string().min(8),
  announcement_date: z.string().optional().nullable(),
  quota: z.number().min(1).optional().nullable(),
  pathway_quotas: PathwayQuotasSchema.optional(),
  is_active: z.boolean().default(true),
});

const UpdatePeriodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).optional(),
  open_date: z.string().optional(),
  close_date: z.string().optional(),
  announcement_date: z.string().optional().nullable(),
  quota: z.number().min(1).optional().nullable(),
  pathway_quotas: PathwayQuotasSchema.optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_VIEW);
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
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_MANAGE);
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

    const pathwayQuotas = parsed.data.pathway_quotas || DEFAULT_PATHWAY_QUOTAS;
    const totalQuota =
      parsed.data.quota ||
      pathwayQuotas.DOMISILI + pathwayQuotas.AFIRMASI + pathwayQuotas.PRESTASI;

    let { data, error } = await supabase
      .from('ppdb_periods')
      .insert({
        name: parsed.data.name,
        open_date: parsed.data.open_date,
        close_date: parsed.data.close_date,
        announcement_date: parsed.data.announcement_date || null,
        quota: totalQuota,
        pathway_quotas: pathwayQuotas,
        is_active: parsed.data.is_active,
      })
      .select('*')
      .single();

    // Fallback jika kolom pathway_quotas belum dimigrasi di Supabase
    if (error && error.message.includes('pathway_quotas')) {
      const retry = await supabase
        .from('ppdb_periods')
        .insert({
          name: parsed.data.name,
          open_date: parsed.data.open_date,
          close_date: parsed.data.close_date,
          announcement_date: parsed.data.announcement_date || null,
          quota: totalQuota,
          is_active: parsed.data.is_active,
        })
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ period: data });
  } catch {
    return NextResponse.json({ error: 'Gagal membuat periode PPDB.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_MANAGE);
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
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID periode tidak valid.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('ppdb_periods').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
