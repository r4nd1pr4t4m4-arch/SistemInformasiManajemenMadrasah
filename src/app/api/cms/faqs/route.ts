import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const FaqCreateSchema = z.object({
  question: z.string().trim().min(5, 'Pertanyaan minimal 5 karakter.'),
  answer: z.string().trim().min(5, 'Jawaban minimal 5 karakter.'),
  sort_order: z.number().int().min(0).default(0),
  is_published: z.boolean().default(true),
});

const FaqUpdateSchema = FaqCreateSchema.extend({
  id: z.string().uuid(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.CMS_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ faqs: [] });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ faqs: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = FaqCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data FAQ tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('faqs')
      .insert(parsed.data)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ faq: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menambahkan FAQ.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = FaqUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pembaruan FAQ tidak valid.' },
        { status: 400 }
      );
    }

    const { id, ...fields } = parsed.data;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('faqs')
      .update(fields)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ faq: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui FAQ.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID FAQ wajib diisi.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('faqs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
