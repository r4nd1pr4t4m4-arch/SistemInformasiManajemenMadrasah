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

const BatchPlaceAccountsSchema = z.object({
  type: z.literal('BATCH_PLACE_ACCOUNTS'),
  target_category: z.enum(['STUDENT', 'TEACHER', 'LIBRARY_ONLY']),
  profile_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 akun.').max(200),
  gender: z.enum(['L', 'P']).default('L'),
  staff_type: z.enum(['GURU', 'TATA_USAHA', 'LAINNYA']).default('GURU'),
});

const BulkImportStudentsSchema = z.object({
  type: z.literal('BULK_IMPORT_STUDENTS'),
  records: z
    .array(
      z.object({
        full_name: z.string().min(2),
        nis: z.string().optional().nullable(),
        nisn: z.string().optional().nullable(),
        nik: z.string().optional().nullable(),
        gender: z.enum(['L', 'P']).default('L'),
        birth_place: z.string().optional().nullable(),
        birth_date: z.string().optional().nullable(),
        father_name: z.string().optional().nullable(),
        mother_name: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(500),
});

const BulkImportTeachersSchema = z.object({
  type: z.literal('BULK_IMPORT_TEACHERS'),
  records: z
    .array(
      z.object({
        full_name: z.string().min(2),
        staff_type: z.enum(['GURU', 'TATA_USAHA', 'LAINNYA']).default('GURU'),
        nip: z.string().optional().nullable(),
        nuptk: z.string().optional().nullable(),
        nik: z.string().optional().nullable(),
        gender: z.enum(['L', 'P']).default('L'),
        employment_status: z.string().optional().default('GTY'),
        education_level: z.string().optional().nullable(),
        major: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        initial_position: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(500),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.BUKU_INDUK_API_READ);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ students: [], teachers: [], activeAccounts: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: rawStudents }, { data: teachers }, { data: activeProfiles }, { data: libMembers }] =
    await Promise.all([
      supabase
        .from('students')
        .select('*, profile:profiles(avatar_url)')
        .order('full_name')
        .limit(200),
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

  const students = (rawStudents || []).map((s) => {
    const prof = Array.isArray(s.profile) ? s.profile[0] : s.profile;
    const avatarUrl = (prof as { avatar_url?: string | null } | null)?.avatar_url || null;
    return {
      ...s,
      photo_url: avatarUrl || s.photo_url || null,
    };
  });

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

    if (body.type === 'BATCH_PLACE_ACCOUNTS') {
      const parsed = BatchPlaceAccountsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data penempatan batch tidak valid.' },
          { status: 400 }
        );
      }

      const uniqueIds = Array.from(new Set(parsed.data.profile_ids));
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, primary_role, is_active, account_status')
        .in('id', uniqueIds);

      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
      }

      const activeList = (profiles || []).filter(
        (p) => p.is_active && (!p.account_status || p.account_status === 'AKTIF')
      );
      if (activeList.length === 0) {
        return NextResponse.json(
          { error: 'Tidak ada akun aktif yang valid untuk ditempatkan.' },
          { status: 400 }
        );
      }

      const activeIds = activeList.map((p) => p.id);
      const [{ data: existingStudents }, { data: existingTeachers }, { data: existingLibs }] =
        await Promise.all([
          supabase.from('students').select('profile_id').in('profile_id', activeIds),
          supabase.from('teachers_staff').select('profile_id').in('profile_id', activeIds),
          supabase.from('library_members').select('profile_id').in('profile_id', activeIds),
        ]);

      const existingStudentSet = new Set(
        (existingStudents || []).map((r) => r.profile_id).filter(Boolean) as string[]
      );
      const existingTeacherSet = new Set(
        (existingTeachers || []).map((r) => r.profile_id).filter(Boolean) as string[]
      );
      const existingLibSet = new Set(
        (existingLibs || []).map((r) => r.profile_id).filter(Boolean) as string[]
      );

      let placedCount = 0;
      let skippedCount = 0;
      const baseStamp = Date.now().toString().slice(-6);

      if (parsed.data.target_category === 'STUDENT') {
        for (let i = 0; i < activeList.length; i++) {
          const prof = activeList[i];
          if (existingStudentSet.has(prof.id) || (prof.full_name || '').trim().length < 2) {
            skippedCount += 1;
            continue;
          }
          const { data: student, error: sErr } = await supabase
            .from('students')
            .insert({
              profile_id: prof.id,
              full_name: prof.full_name.trim(),
              gender: parsed.data.gender,
              phone: prof.phone || null,
              email: prof.email || null,
              status: 'AKTIF',
            })
            .select('id, profile_id, full_name, phone, email')
            .single();

          if (sErr || !student) {
            skippedCount += 1;
            continue;
          }

          if (prof.primary_role === 'UMUM') {
            await supabase.from('profiles').update({ primary_role: 'SISWA' }).eq('id', prof.id);
            await supabase
              .from('user_roles')
              .upsert({ user_id: prof.id, role: 'SISWA' }, { onConflict: 'user_id,role' });
          }

          if (!existingLibSet.has(prof.id)) {
            await supabase.from('library_members').insert({
              member_code: `LIB-S-${baseStamp}-${i + 1}`,
              member_type: 'SISWA',
              profile_id: student.profile_id,
              student_id: student.id,
              full_name: student.full_name,
              phone: student.phone,
              email: student.email,
              is_auto_registered: true,
              status: 'AKTIF',
            });
          }
          placedCount += 1;
        }
      } else if (parsed.data.target_category === 'TEACHER') {
        const initialPosition =
          parsed.data.staff_type === 'TATA_USAHA'
            ? 'Staf Tata Usaha'
            : parsed.data.staff_type === 'LAINNYA'
            ? 'Tenaga Kependidikan'
            : 'Guru Mata Pelajaran';
        const today = getWibTodayDateString();

        for (let i = 0; i < activeList.length; i++) {
          const prof = activeList[i];
          if (existingTeacherSet.has(prof.id) || (prof.full_name || '').trim().length < 2) {
            skippedCount += 1;
            continue;
          }
          const { data: teacher, error: tErr } = await supabase
            .from('teachers_staff')
            .insert({
              profile_id: prof.id,
              full_name: prof.full_name.trim(),
              staff_type: parsed.data.staff_type,
              gender: parsed.data.gender,
              employment_status: 'GTY',
              phone: prof.phone || null,
              email: prof.email || null,
            })
            .select('id, profile_id, full_name, phone, email')
            .single();

          if (tErr || !teacher) {
            skippedCount += 1;
            continue;
          }

          if (prof.primary_role === 'UMUM') {
            const nextRole = parsed.data.staff_type === 'TATA_USAHA' ? 'STAF_TU' : 'GURU';
            await supabase.from('profiles').update({ primary_role: nextRole }).eq('id', prof.id);
            await supabase
              .from('user_roles')
              .upsert({ user_id: prof.id, role: nextRole }, { onConflict: 'user_id,role' });
          }

          await supabase.from('employment_histories').insert({
            teacher_id: teacher.id,
            position_title: initialPosition,
            start_date: today,
          });

          if (!existingLibSet.has(prof.id)) {
            await supabase.from('library_members').insert({
              member_code: `LIB-G-${baseStamp}-${i + 1}`,
              member_type: 'GTK',
              profile_id: teacher.profile_id,
              teacher_id: teacher.id,
              full_name: teacher.full_name,
              phone: teacher.phone,
              email: teacher.email,
              is_auto_registered: true,
              status: 'AKTIF',
            });
          }
          placedCount += 1;
        }
      } else {
        for (let i = 0; i < activeList.length; i++) {
          const prof = activeList[i];
          if (existingLibSet.has(prof.id)) {
            skippedCount += 1;
            continue;
          }
          const { error: lErr } = await supabase.from('library_members').insert({
            member_code: `LIB-U-${baseStamp}-${i + 1}`,
            member_type: 'UMUM',
            profile_id: prof.id,
            full_name: prof.full_name,
            phone: prof.phone || null,
            email: prof.email || null,
            is_auto_registered: false,
            status: 'AKTIF',
          });
          if (lErr) {
            skippedCount += 1;
            continue;
          }
          placedCount += 1;
        }
      }

      if (placedCount === 0) {
        return NextResponse.json(
          {
            error:
              'Semua akun yang dipilih sudah terdaftar pada kategori tujuan tersebut atau tidak memenuhi syarat.',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        placedCount,
        skippedCount,
        targetCategory: parsed.data.target_category,
      });
    }

    if (body.type === 'BULK_IMPORT_STUDENTS') {
      const parsed = BulkImportStudentsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Format data impor siswa tidak valid.', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const payloadRows = parsed.data.records.map((r) => ({
        full_name: r.full_name.trim(),
        nis: r.nis?.trim() || null,
        nisn: r.nisn?.trim() || null,
        nik: r.nik?.trim() || null,
        gender: r.gender,
        birth_place: r.birth_place?.trim() || null,
        birth_date: r.birth_date?.trim() || null,
        father_name: r.father_name?.trim() || null,
        mother_name: r.mother_name?.trim() || null,
        phone: r.phone?.trim() || null,
        address: r.address?.trim() || null,
        status: 'AKTIF',
      }));

      const { data: insertedStudents, error: bulkStudentErr } = await supabase
        .from('students')
        .insert(payloadRows)
        .select('id, full_name, phone, email');

      if (bulkStudentErr || !insertedStudents) {
        return NextResponse.json(
          { error: bulkStudentErr?.message || 'Gagal mengimpor data siswa secara massal.' },
          { status: 500 }
        );
      }

      const tsBase = Date.now();
      const libRows = insertedStudents.map((s, idx) => ({
        member_code: `LIB-S-${String(tsBase + idx).slice(-6)}-${idx + 1}`,
        member_type: 'SISWA',
        student_id: s.id,
        full_name: s.full_name,
        phone: s.phone || null,
        email: s.email || null,
        is_auto_registered: true,
        status: 'AKTIF',
      }));

      await supabase.from('library_members').insert(libRows);

      return NextResponse.json({
        importedCount: insertedStudents.length,
      });
    }

    if (body.type === 'BULK_IMPORT_TEACHERS') {
      const parsed = BulkImportTeachersSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Format data impor GTK tidak valid.', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const payloadRows = parsed.data.records.map((r) => ({
        full_name: r.full_name.trim(),
        staff_type: r.staff_type,
        nip: r.nip?.trim() || null,
        nuptk: r.nuptk?.trim() || null,
        nik: r.nik?.trim() || null,
        gender: r.gender,
        employment_status: r.employment_status?.trim() || 'GTY',
        education_level: r.education_level?.trim() || null,
        major: r.major?.trim() || null,
        phone: r.phone?.trim() || null,
        email: r.email?.trim() || null,
      }));

      const { data: insertedTeachers, error: bulkTeacherErr } = await supabase
        .from('teachers_staff')
        .insert(payloadRows)
        .select('id, full_name, phone, email');

      if (bulkTeacherErr || !insertedTeachers) {
        return NextResponse.json(
          { error: bulkTeacherErr?.message || 'Gagal mengimpor data GTK secara massal.' },
          { status: 500 }
        );
      }

      const todayStr = getWibTodayDateString();
      const historyRows = insertedTeachers
        .map((t, idx) => {
          const pos = parsed.data.records[idx]?.initial_position?.trim();
          if (!pos) return null;
          return {
            teacher_id: t.id,
            position_title: pos,
            start_date: todayStr,
          };
        })
        .filter((item): item is { teacher_id: string; position_title: string; start_date: string } =>
          Boolean(item)
        );

      if (historyRows.length > 0) {
        await supabase.from('employment_histories').insert(historyRows);
      }

      const tsBase = Date.now();
      const libRows = insertedTeachers.map((t, idx) => ({
        member_code: `LIB-G-${String(tsBase + idx).slice(-6)}-${idx + 1}`,
        member_type: 'GTK',
        teacher_id: t.id,
        full_name: t.full_name,
        phone: t.phone || null,
        email: t.email || null,
        is_auto_registered: true,
        status: 'AKTIF',
      }));

      await supabase.from('library_members').insert(libRows);

      return NextResponse.json({
        importedCount: insertedTeachers.length,
      });
    }

    return NextResponse.json({ error: 'Tipe entitas tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses Buku Induk.' }, { status: 500 });
  }
}
