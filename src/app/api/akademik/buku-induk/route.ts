import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { hasAnyRole } from '@/lib/auth/session';

const CreateStudentSchema = z.object({
  type: z.literal('STUDENT'),
  profile_id: z.string().uuid().optional().nullable(),
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
  profile_id: z.string().uuid().optional().nullable(),
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

const AssignLibraryOnlySchema = z.object({
  type: z.literal('LIBRARY_ONLY'),
  profile_id: z.string().uuid(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.BUKU_INDUK_API_READ);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ students: [], teachers: [], activeAccounts: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: students }, { data: teachers }, { data: activeProfiles }, { data: libMembers }] =
    await Promise.all([
      supabase.from('students').select('*').order('full_name').limit(200),
      supabase
        .from('teachers_staff')
        .select('*, employment_histories(*)')
        .order('full_name')
        .limit(200),
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, primary_role, is_active, account_status')
        .eq('is_active', true)
        .order('full_name')
        .limit(300),
      supabase
        .from('library_members')
        .select('id, profile_id, student_id, teacher_id, member_code, member_type')
        .limit(500),
    ]);

  const studentProfileIds = new Set(
    (students || []).map((s) => s.profile_id).filter(Boolean) as string[]
  );
  const teacherProfileIds = new Set(
    (teachers || []).map((t) => t.profile_id).filter(Boolean) as string[]
  );
  const libraryProfileIds = new Set(
    (libMembers || []).map((l) => l.profile_id).filter(Boolean) as string[]
  );

  const activeAccounts = (activeProfiles || [])
    .filter((p) => !p.account_status || p.account_status === 'AKTIF')
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      primary_role: p.primary_role,
      is_student: studentProfileIds.has(p.id),
      is_teacher: teacherProfileIds.has(p.id),
      is_library_member: libraryProfileIds.has(p.id),
    }));

  const isGlobalReader = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_HUMAS',
    'KEPALA_TU',
    'STAF_TU',
    'BENDAHARA',
    'BENDAHARA_KOMITE',
    'PENGELOLA_TABUNGAN',
    'GURU_BK',
    'PUSTAKAWAN',
  ]);
  const ta = guard.session.teacherAssignments;

  if (!isGlobalReader) {
    if (!ta) {
      return NextResponse.json({
        students: [],
        teachers: [],
        activeAccounts: [],
      });
    }
    const canSeeAllTeachers = ta.isPicketTeacher || ta.isExamCommittee;
    const scopedTeachers = canSeeAllTeachers
      ? teachers || []
      : (teachers || []).filter((t) => t.id === ta.teacherId);

    const allowedClassIds = new Set([
      ...(ta.homeroomClassroomIds || []),
      ...(ta.taughtClassroomIds || []),
    ]);
    const allowedStudentIds = new Set<string>(ta.guruWaliStudentIds || []);

    if (allowedClassIds.size > 0) {
      const { data: enrollRows } = await supabase
        .from('student_enrollments')
        .select('student_id')
        .in('classroom_id', Array.from(allowedClassIds));
      for (const e of enrollRows || []) {
        if (e.student_id) allowedStudentIds.add(e.student_id as string);
      }
    }

    const scopedStudents =
      ta.isPicketTeacher || ta.isExamCommittee || ta.isExamSupervisor
        ? students || []
        : (students || []).filter((s) => allowedStudentIds.has(s.id));

    return NextResponse.json({
      students: scopedStudents,
      teachers: scopedTeachers,
      activeAccounts: [],
    });
  }

  return NextResponse.json({
    students: students || [],
    teachers: teachers || [],
    activeAccounts: hasAnyRole(guard.session, PERMISSIONS.BUKU_INDUK_PAGE_VIEW)
      ? activeAccounts
      : [],
  });
}

async function verifyActiveProfile(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profileId: string
) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, primary_role, is_active, account_status')
    .eq('id', profileId)
    .maybeSingle();

  if (error || !profile) {
    return { error: 'Akun pengguna tidak ditemukan.' };
  }
  if (!profile.is_active || (profile.account_status && profile.account_status !== 'AKTIF')) {
    return { error: 'Akun pengguna belum aktif. Aktifkan akun terlebih dahulu di Manajemen Pengguna.' };
  }
  return { profile };
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.BUKU_INDUK_MANAGE);
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

      let linkedProfile: Awaited<ReturnType<typeof verifyActiveProfile>>['profile'] | undefined;
      if (parsed.data.profile_id) {
        const check = await verifyActiveProfile(supabase, parsed.data.profile_id);
        if (check.error) {
          return NextResponse.json({ error: check.error }, { status: 400 });
        }
        linkedProfile = check.profile;
      }

      const studentPayload = { ...parsed.data } as Record<string, unknown>;
      delete studentPayload.type;
      const { data: student, error } = await supabase
        .from('students')
        .insert({
          ...studentPayload,
          profile_id: parsed.data.profile_id || null,
          nis: parsed.data.nis || null,
          nisn: parsed.data.nisn || null,
          email: linkedProfile?.email || null,
          status: 'AKTIF',
        })
        .select('*')
        .single();

      if (error || !student) {
        return NextResponse.json({ error: error?.message || 'Gagal menyimpan siswa.' }, { status: 500 });
      }

      if (linkedProfile && linkedProfile.primary_role === 'UMUM') {
        await supabase.from('profiles').update({ primary_role: 'SISWA' }).eq('id', linkedProfile.id);
        await supabase
          .from('user_roles')
          .upsert({ user_id: linkedProfile.id, role: 'SISWA' }, { onConflict: 'user_id,role' });
      }

      // Warga lembaga otomatis menjadi anggota E-Library beserta kartu anggota
      await supabase.from('library_members').insert({
        member_code: `LIB-S-${Date.now().toString().slice(-6)}`,
        member_type: 'SISWA',
        profile_id: student.profile_id || null,
        student_id: student.id,
        full_name: student.full_name,
        phone: student.phone,
        email: student.email,
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

      let linkedProfile: Awaited<ReturnType<typeof verifyActiveProfile>>['profile'] | undefined;
      if (parsed.data.profile_id) {
        const check = await verifyActiveProfile(supabase, parsed.data.profile_id);
        if (check.error) {
          return NextResponse.json({ error: check.error }, { status: 400 });
        }
        linkedProfile = check.profile;
      }

      const initial_position = parsed.data.initial_position;
      const teacherPayload = { ...parsed.data } as Record<string, unknown>;
      delete teacherPayload.type;
      delete teacherPayload.initial_position;
      const { data: teacher, error } = await supabase
        .from('teachers_staff')
        .insert({
          ...teacherPayload,
          profile_id: parsed.data.profile_id || null,
          email: parsed.data.email || linkedProfile?.email || null,
        })
        .select('*')
        .single();

      if (error || !teacher) {
        return NextResponse.json({ error: error?.message || 'Gagal menyimpan GTK.' }, { status: 500 });
      }

      if (linkedProfile && linkedProfile.primary_role === 'UMUM') {
        const nextRole = teacherPayload.staff_type === 'TATA_USAHA' ? 'STAF_TU' : 'GURU';
        await supabase.from('profiles').update({ primary_role: nextRole }).eq('id', linkedProfile.id);
        await supabase
          .from('user_roles')
          .upsert({ user_id: linkedProfile.id, role: nextRole }, { onConflict: 'user_id,role' });
      }

      if (initial_position) {
        await supabase.from('employment_histories').insert({
          teacher_id: teacher.id,
          position_title: initial_position,
          start_date: getWibTodayDateString(),
        });
      }

      // Warga lembaga (GTK) otomatis menjadi anggota E-Library beserta kartu anggota
      await supabase.from('library_members').insert({
        member_code: `LIB-G-${Date.now().toString().slice(-6)}`,
        member_type: 'GTK',
        profile_id: teacher.profile_id || null,
        teacher_id: teacher.id,
        full_name: teacher.full_name,
        phone: teacher.phone,
        email: teacher.email,
        is_auto_registered: true,
        status: 'AKTIF',
      });

      return NextResponse.json({ teacher });
    }

    if (body.type === 'LIBRARY_ONLY') {
      const parsed = AssignLibraryOnlySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Data anggota perpustakaan tidak valid.', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const check = await verifyActiveProfile(supabase, parsed.data.profile_id);
      if (check.error || !check.profile) {
        return NextResponse.json({ error: check.error || 'Akun tidak valid.' }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from('library_members')
        .select('id, member_code')
        .eq('profile_id', check.profile.id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `Akun ini sudah terdaftar sebagai anggota E-Library (${existing.member_code}).` },
          { status: 400 }
        );
      }

      const { data: member, error } = await supabase
        .from('library_members')
        .insert({
          member_code: `LIB-U-${Date.now().toString().slice(-6)}`,
          member_type: 'UMUM',
          profile_id: check.profile.id,
          full_name: check.profile.full_name,
          phone: parsed.data.phone || check.profile.phone || null,
          email: check.profile.email || null,
          address: parsed.data.address || null,
          is_auto_registered: false,
          status: 'AKTIF',
        })
        .select('*')
        .single();

      if (error || !member) {
        return NextResponse.json(
          { error: error?.message || 'Gagal mendaftarkan anggota perpustakaan.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ member });
    }

    return NextResponse.json({ error: 'Tipe entitas tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses Buku Induk.' }, { status: 500 });
  }
}
