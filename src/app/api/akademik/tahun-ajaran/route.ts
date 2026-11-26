import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const ALLOWED_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_KURIKULUM',
  'KEPALA_TU',
  'STAF_TU',
] as const;

const CreateYearSchema = z.object({
  action: z.literal('CREATE_YEAR'),
  name: z.string().trim().min(4, 'Nama tahun ajaran mis. 2026/2027.'),
  semester: z.enum(['GANJIL', 'GENAP']),
  is_active: z.boolean().optional().default(false),
});

const SetActiveYearSchema = z.object({
  action: z.literal('SET_ACTIVE_YEAR'),
  id: z.string().uuid(),
});

const PromoteBatchSchema = z.object({
  action: z.literal('PROMOTE_CLASS_BATCH'),
  student_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 siswa.'),
  target_classroom_id: z.string().uuid(),
  target_academic_year_id: z.string().uuid(),
});

const GraduateBatchSchema = z.object({
  action: z.literal('GRADUATE_CLASS_BATCH'),
  student_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 siswa.'),
  graduation_year: z.number().int().min(2000).max(2100),
});

const MutasiKeluarSchema = z.object({
  action: z.literal('MUTASI_KELUAR'),
  student_id: z.string().uuid(),
  destination_school: z.string().trim().min(2, 'Sekolah tujuan wajib diisi.'),
  reason: z.string().trim().min(3, 'Alasan mutasi wajib diisi.'),
  mutation_date: z.string().trim().min(8),
  create_letter: z.boolean().optional().default(true),
});

export async function GET() {
  const guard = await requireApiRoles([...ALLOWED_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ academicYears: [], classrooms: [], enrollments: [], activeStudents: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: academicYears },
    { data: classrooms },
    { data: enrollments },
    { data: activeStudents },
  ] = await Promise.all([
    supabase
      .from('academic_years')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: false }),
    supabase
      .from('classrooms')
      .select('id, name, grade_level, academic_year_id')
      .order('name'),
    supabase
      .from('student_enrollments')
      .select('id, student_id, classroom_id, academic_year_id, student:students(id, full_name, nis, nisn, status)'),
    supabase
      .from('students')
      .select('id, full_name, nis, nisn, status')
      .eq('status', 'AKTIF')
      .order('full_name')
      .limit(500),
  ]);

  return NextResponse.json({
    academicYears: academicYears || [],
    classrooms: classrooms || [],
    enrollments: enrollments || [],
    activeStudents: activeStudents || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles([
    'SUPERADMIN',
    'OPERATOR',
    'WAKA_KURIKULUM',
    'KEPALA_TU',
  ]);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_YEAR') {
      const parsed = CreateYearSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data tahun ajaran tidak valid.' },
          { status: 400 }
        );
      }
      if (parsed.data.is_active) {
        await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true);
      }
      const { data, error } = await supabase
        .from('academic_years')
        .insert({
          name: parsed.data.name,
          semester: parsed.data.semester,
          is_active: parsed.data.is_active,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ academicYear: data });
    }

    if (body.action === 'SET_ACTIVE_YEAR') {
      const parsed = SetActiveYearSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID tahun ajaran tidak valid.' }, { status: 400 });
      }
      await supabase.from('academic_years').update({ is_active: false }).neq('id', parsed.data.id);
      const { data, error } = await supabase
        .from('academic_years')
        .update({ is_active: true })
        .eq('id', parsed.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ academicYear: data });
    }

    if (body.action === 'PROMOTE_CLASS_BATCH') {
      const parsed = PromoteBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data kenaikan kelas tidak valid.' },
          { status: 400 }
        );
      }
      const rows = parsed.data.student_ids.map((studentId) => ({
        student_id: studentId,
        classroom_id: parsed.data.target_classroom_id,
        academic_year_id: parsed.data.target_academic_year_id,
      }));
      const { error } = await supabase
        .from('student_enrollments')
        .upsert(rows, { onConflict: 'student_id,academic_year_id' });
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ promotedCount: rows.length });
    }

    if (body.action === 'GRADUATE_CLASS_BATCH') {
      const parsed = GraduateBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data kelulusan tidak valid.' },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from('students')
        .update({
          status: 'LULUS',
          updated_at: new Date().toISOString(),
        })
        .in('id', parsed.data.student_ids);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({
        graduatedCount: parsed.data.student_ids.length,
        graduationYear: parsed.data.graduation_year,
      });
    }

    if (body.action === 'MUTASI_KELUAR') {
      const parsed = MutasiKeluarSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data mutasi keluar tidak valid.' },
          { status: 400 }
        );
      }

      const { data: student, error: stErr } = await supabase
        .from('students')
        .select('id, full_name, nis, nisn')
        .eq('id', parsed.data.student_id)
        .single();
      if (stErr || !student) {
        return NextResponse.json({ error: 'Data siswa tidak ditemukan.' }, { status: 404 });
      }

      const { error: updErr } = await supabase
        .from('students')
        .update({
          status: 'MUTASI',
          updated_at: new Date().toISOString(),
        })
        .eq('id', student.id);
      if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });

      let createdLetterNumber: string | null = null;
      if (parsed.data.create_letter) {
        const year = parsed.data.mutation_date.slice(0, 4);
        const letterNumber = `MUT-${year}-${Date.now().toString().slice(-4)}`;
        const { data: letterRow } = await supabase
          .from('letters')
          .insert({
            direction: 'KELUAR',
            category: 'SURAT_MUTASI',
            letter_number: letterNumber,
            letter_date: parsed.data.mutation_date,
            subject: `Surat Keterangan Pindah / Mutasi an. ${student.full_name}`,
            counterparty: parsed.data.destination_school,
            student_id: student.id,
            summary: `Mutasi keluar ke ${parsed.data.destination_school}. Alasan: ${parsed.data.reason}`,
            status: 'DRAFT',
            priority: 'BIASA',
            classification_code: 'PP.00.6',
          })
          .select('letter_number')
          .single();
        createdLetterNumber = letterRow?.letter_number || letterNumber;
      }

      return NextResponse.json({
        ok: true,
        studentName: student.full_name,
        createdLetterNumber,
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan.' }, { status: 500 });
  }
}
