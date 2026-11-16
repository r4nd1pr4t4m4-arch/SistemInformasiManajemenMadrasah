import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'MENUNGGU_VERIFIKASI',
    'TERVERIFIKASI',
    'PERLU_PERBAIKAN',
    'LULUS',
    'CADANGAN',
    'TIDAK_LULUS',
  ]),
  admin_notes: z.string().optional().nullable(),
});

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ registrations: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ppdb_registrations')
    .select('*, ppdb_documents(id, document_type, file_url, file_name, is_verified)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ registrations: data || [] });
}

export async function PATCH(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data status PPDB tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('ppdb_registrations')
      .update({
        status: parsed.data.status,
        admin_notes: parsed.data.admin_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ registration: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status PPDB.' }, { status: 500 });
  }
}
