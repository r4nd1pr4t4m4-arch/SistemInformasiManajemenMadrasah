import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

const CreateStudentSchema = z.object({
  type: z.literal('STUDENT'),
  full_name: z.string().min(2),
  nis: z.string().optional().nullable(),
  nisn: z.string().optional().nullable(),
  nik: z.string().optional().nullable(),
  gender: z.enum(['L', 'P']),
  birth_place: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  father_name: z.string().optional().nullable(),
  mother_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const CreateTeacherSchema = z.object({
  type: z.literal('TEACHER'),
  staff_type: z.enum(['GURU', 'TATA_USAHA', 'LAINNYA']).default('GURU'),
  full_name: z.string().min(2),
  nip: z.string().optional().nullable(),
  nuptk: z.string().optional().nullable(),
  nik: z.string().optional().nullable(),
  gender: z.enum(['L', 'P']),
  employment_status: z.string().optional().default('GTY'),
  education_level: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  initial_position: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.BUKU_INDUK_READ);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ students: [], teachers: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: students }, { data: teachers }] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .order('full_name')
      .limit(200),
    supabase
      .from('teachers_staff')
      .select('*, employment_histories(*)')
      .order('full_name')
      .limit(200),
  ]);

  return NextResponse.json({
    students: students || [],
    teachers: teachers || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.AKADEMIK);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.type === 'STUDENT') {
      const parsed = CreateStudentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Data siswa tidak valid.', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { type: _, ...studentPayload } = parsed.data;
      const { data: student, error } = await supabase
        .from('students')
        .insert({
          ...studentPayload,
          nis: studentPayload.nis || null,
          nisn: studentPayload.nisn || null,
          status: 'AKTIF',
        })
        .select('*')
        .single();

      if (error || !student) {
        return NextResponse.json({ error: error?.message || 'Gagal menyimpan siswa.' }, { status: 500 });
      }

      // Warga lembaga otomatis menjadi anggota E-Library beserta kartu anggota
      await supabase.from('library_members').insert({
        member_code: `LIB-S-${Date.now().toString().slice(-6)}`,
        member_type: 'SISWA',
        student_id: student.id,
        full_name: student.full_name,
        phone: student.phone,
        is_auto_registered: true,
        status: 'AKTIF',
      });

      return NextResponse.json({ student });
    }

    if (body.type === 'TEACHER') {
      const parsed = CreateTeacherSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Data GTK tidak valid.', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { type: _, initial_position, ...teacherPayload } = parsed.data;
      const { data: teacher, error } = await supabase
        .from('teachers_staff')
        .insert(teacherPayload)
        .select('*')
        .single();

      if (error || !teacher) {
        return NextResponse.json({ error: error?.message || 'Gagal menyimpan GTK.' }, { status: 500 });
      }

      if (initial_position) {
        await supabase.from('employment_histories').insert({
          teacher_id: teacher.id,
          position_title: initial_position,
          start_date: new Date().toISOString().slice(0, 10),
        });
      }

      // Warga lembaga (GTK) otomatis menjadi anggota E-Library beserta kartu anggota
      await supabase.from('library_members').insert({
        member_code: `LIB-G-${Date.now().toString().slice(-6)}`,
        member_type: 'GTK',
        teacher_id: teacher.id,
        full_name: teacher.full_name,
        phone: teacher.phone,
        email: teacher.email,
        is_auto_registered: true,
        status: 'AKTIF',
      });

      return NextResponse.json({ teacher });
    }

    return NextResponse.json({ error: 'Tipe entitas tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses Buku Induk.' }, { status: 500 });
  }
}
