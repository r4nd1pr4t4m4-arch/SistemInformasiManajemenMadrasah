import { NextResponse } from 'next/server';
import { connection } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';

const FacilitySchema = z.object({
  name: z.string().min(2, 'Nama sarana/prasarana minimal 2 karakter.'),
  category: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Jumlah minimal 1.'),
  condition: z.enum(['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT', 'DALAM_PERBAIKAN']).default('BAIK'),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

export async function GET() {
  await connection();
  const guard = await requireApiRoles(PERMISSIONS.CMS_SARPRAS_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ facilities: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_SARPRAS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = FacilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data sarana/prasarana tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('facilities')
      .insert({
        name: parsed.data.name.trim(),
        category: parsed.data.category?.trim() || 'Umum',
        quantity: parsed.data.quantity,
        condition: parsed.data.condition,
        description: parsed.data.description?.trim() || null,
        image_url: parsed.data.image_url?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ facility: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menambahkan sarana/prasarana.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_SARPRAS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ error: 'ID sarana/prasarana wajib diisi.' }, { status: 400 });
    }

    const parsed = FacilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data pembaruan tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('facilities')
      .update({
        name: parsed.data.name.trim(),
        category: parsed.data.category?.trim() || 'Umum',
        quantity: parsed.data.quantity,
        condition: parsed.data.condition,
        description: parsed.data.description?.trim() || null,
        image_url: parsed.data.image_url?.trim() || null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ facility: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui sarana/prasarana.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_SARPRAS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Parameter id wajib diisi.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('facilities').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
