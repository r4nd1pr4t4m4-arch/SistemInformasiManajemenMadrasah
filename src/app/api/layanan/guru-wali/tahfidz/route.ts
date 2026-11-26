import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const UpsertTahfidzSchema = z.object({
  student_id: z.string().uuid(),
  surah_or_juz: z.string().trim().min(2),
  target_semester: z.string().optional().nullable(),
  status: z.enum(['BELUM', 'PROSES', 'TUNTAS']).default('PROSES'),
  fluency: z.enum(['LANCAR', 'CUKUP', 'MURAJAAH']).default('LANCAR'),
  tajwid_score: z.number().int().min(0).max(100).optional().nullable(),
  tasmi_score: z.number().int().min(0).max(100).optional().nullable(),
  tasmi_date: z.string().optional().nullable(),
  examiner_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const guard = await requireApiRoles([...PERMISSIONS.GURU_WALI_VIEW, 'SISWA', 'ORANG_TUA']);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ progress: [], students: [] });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('tahfidz_progress')
    .select('*, student:students(id, full_name, nis)')
    .order('updated_at', { ascending: false })
    .limit(300);

  if (studentId) query = query.eq('student_id', studentId);

  const [{ data, error }, { data: students }] = await Promise.all([
    query,
    supabase.from('students').select('id, full_name, nis').eq('status', 'AKTIF').order('full_name').limit(300),
  ]);

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ progress: [], students: students || [] });
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  }
  return NextResponse.json({ progress: data || [], students: students || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.GURU_WALI_LOG);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpsertTahfidzSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data progres tahfidz tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tahfidz_progress')
      .upsert(
        {
          ...parsed.data,
          updated_by: guard.session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,surah_or_juz' }
      )
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan progres tahfidz.' }, { status: 500 });
  }
}
