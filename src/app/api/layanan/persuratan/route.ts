import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const CreateLetterSchema = z.object({
  direction: z.enum(['MASUK', 'KELUAR']),
  category: z.enum([
    'SURAT_KETERANGAN_AKTIF',
    'SURAT_MUTASI',
    'SURAT_TUGAS',
    'SURAT_UNDANGAN',
    'SURAT_EDARAN',
    'LAINNYA',
  ]),
  letter_number: z.string().min(2),
  letter_date: z.string(),
  subject: z.string().min(3),
  counterparty: z.string().optional().nullable(),
  student_id: z.string().uuid().optional().nullable(),
  teacher_id: z.string().uuid().optional().nullable(),
  summary: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
});

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ letters: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('letters')
    .select('*, student:students(full_name, nis), teacher:teachers_staff(full_name)')
    .order('letter_date', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ letters: data || [] });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreateLetterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data surat tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('letters')
      .insert({
        ...parsed.data,
        student_id: parsed.data.student_id || null,
        teacher_id: parsed.data.teacher_id || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ letter: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan arsip surat.' }, { status: 500 });
  }
}
