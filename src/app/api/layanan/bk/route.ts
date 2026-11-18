import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';

const CreateBkSchema = z.object({
  student_id: z.string().uuid(),
  counselor_id: z.string().uuid().optional().nullable(),
  record_type: z.enum(['PELANGGARAN', 'PRESTASI', 'KONSULTASI']),
  title: z.string().min(2),
  points: z.number().default(0),
  incident_date: z.string().optional(),
  description: z.string().min(3),
  follow_up: z.string().optional().nullable(),
  is_confidential: z.boolean().default(false),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.BK_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ records: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('bk_records')
    .select('*, student:students(full_name, nis), counselor:teachers_staff(full_name)')
    .order('incident_date', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.BK_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreateBkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data BK tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('bk_records')
      .insert({
        ...parsed.data,
        counselor_id: parsed.data.counselor_id || null,
        incident_date: parsed.data.incident_date || new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ record: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan catatan BK.' }, { status: 500 });
  }
}
