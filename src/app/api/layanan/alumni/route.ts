import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const AlumniSchema = z.object({
  full_name: z.string().min(2),
  graduation_year: z.number().min(1980).max(2100),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  current_activity: z.enum([
    'KULIAH',
    'BEKERJA',
    'WIRAUSAHA',
    'PESANTREN',
    'MENCARI_KERJA',
    'LAINNYA',
  ]),
  institution_or_company: z.string().optional().nullable(),
  major_or_position: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  testimonial: z.string().optional().nullable(),
});

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ alumni: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('alumni_tracers')
    .select('*')
    .order('graduation_year', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alumni: data || [] });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = AlumniSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tracer study alumni tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('alumni_tracers')
      .insert(parsed.data)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ alumni: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan data alumni.' }, { status: 500 });
  }
}
