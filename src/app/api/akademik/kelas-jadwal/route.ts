import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { mapDutyCodeToRole } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';

async function getOrCreateActiveAcademicYear(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<string> {
  const { data: active } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (active) return active.id;

  const { data: created, error } = await supabase
    .from('academic_years')
    .insert({
      name: '2026/2027',
      semester: 'GANJIL',
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error('Gagal menyiapkan Tahun Ajaran aktif.');
  }
  return created.id;
}

const ClassroomSchema = z.object({
  action: z.literal('CREATE_CLASSROOM'),
  name: z.string().min(1),
  grade_level: z.string().min(1),
  homeroom_teacher_id: z.string().uuid().optional().nullable(),
  room_location: z.string().optional().nullable(),
});

const UpdateClassroomSchema = z.object({
  action: z.literal('UPDATE_CLASSROOM'),
  id: z.string().uuid(),
  name: z.string().min(1),
  grade_level: z.string().min(1),
  homeroom_teacher_id: z.string().uuid().optional().nullable(),
  room_location: z.string().optional().nullable(),
});

const SubjectSchema = z.object({
  action: z.literal('CREATE_SUBJECT'),
  code: z.string().min(2),
  name: z.string().min(2),
  subject_group: z.string().optional().default('Umum'),
});

const UpdateSubjectSchema = z.object({
  action: z.literal('UPDATE_SUBJECT'),
  id: z.string().uuid(),
  code: z.string().min(2),
  name: z.string().min(2),
  subject_group: z.string().optional().default('Umum'),
});

const DeleteSubjectSchema = z.object({
  action: z.literal('DELETE_SUBJECT'),
  id: z.string().uuid(),
});

const ScheduleSchema = z.object({
  action: z.literal('CREATE_SCHEDULE'),
  classroom_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  day_of_week: z.number().min(1).max(7),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  jtm_count: z.number().min(1).max(12).default(2),
});

const UpdateScheduleSchema = z.object({
  action: z.literal('UPDATE_SCHEDULE'),
  id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  day_of_week: z.number().min(1).max(7),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  jtm_count: z.number().min(1).max(12).default(2),
});

const DeleteScheduleSchema = z.object({
  action: z.literal('DELETE_SCHEDULE'),
  id: z.string().uuid(),
});

const DeleteSchedulesBatchSchema = z.object({
  action: z.literal('DELETE_SCHEDULES_BATCH'),
  ids: z
    .array(z.string().uuid())
    .min(1, 'Pilih minimal 1 jadwal untuk dihapus.')
    .max(200, 'Maksimal 200 jadwal dapat dihapus sekaligus.'),
});

const PicketSchema = z.object({
  action: z.literal('CREATE_PICKET'),
  teacher_id: z.string().uuid(),
  day_of_week: z.number().min(1).max(7),
  notes: z.string().optional().nullable(),
});

const EnrollSchema = z.object({
  action: z.literal('ENROLL_STUDENT'),
  student_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
});

const EnrollBatchSchema = z.object({
  action: z.literal('ENROLL_STUDENTS_BATCH'),
  classroom_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 siswa.'),
});

const UnenrollSchema = z.object({
  action: z.literal('UNENROLL_STUDENT'),
  enrollment_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.KELAS_JADWAL_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      classrooms: [],
      subjects: [],
      schedules: [],
      pickets: [],
      enrollments: [],
      homeroomTeacherCandidates: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: classrooms },
    { data: subjects },
    { data: schedules },
    { data: pickets },
    { data: enrollments },
    { data: activeAcademicYear },
    { data: activeDutyRows },
  ] = await Promise.all([
    supabase
      .from('classrooms')
      .select('*, homeroom_teacher:teachers_staff(id, full_name)')
      .order('name'),
    supabase.from('subjects').select('*').order('name'),
    supabase
      .from('schedules')
      .select(
        '*, classroom:classrooms(name), subject:subjects(name, code), teacher:teachers_staff(full_name)'
      )
      .order('day_of_week')
      .order('start_time'),
    supabase
      .from('picket_schedules')
      .select('*, teacher:teachers_staff(full_name)')
      .order('day_of_week'),
    supabase
      .from('student_enrollments')
      .select('*, student:students(full_name, nis, nisn), classroom:classrooms(name)'),
    supabase
      .from('academic_years')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('teacher_additional_duties')
      .select(
        'teacher_id, academic_year_id, teacher:teachers_staff(id, full_name), duty_type:additional_duty_types(code, name)'
      )
      .eq('is_active', true),
  ]);

  const homeroomCandidateMap = new Map<string, { id: string; full_name: string }>();
  for (const row of activeDutyRows || []) {
    if (
      activeAcademicYear?.id &&
      row.academic_year_id &&
      row.academic_year_id !== activeAcademicYear.id
    ) {
      continue;
    }
    const dt = Array.isArray(row.duty_type) ? row.duty_type[0] : row.duty_type;
    if (!dt) continue;
    const mappedRole = mapDutyCodeToRole(dt.code) || mapDutyCodeToRole(dt.name);
    if (mappedRole !== 'WALI_KELAS') continue;

    const teacher = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
    if (teacher?.id && teacher.full_name && !homeroomCandidateMap.has(teacher.id)) {
      homeroomCandidateMap.set(teacher.id, {
        id: teacher.id,
        full_name: teacher.full_name,
      });
    }
  }
  const homeroomTeacherCandidates = Array.from(homeroomCandidateMap.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'id')
  );

  const isGlobalManager = hasAnyRole(guard.session, PERMISSIONS.KELAS_JADWAL_MANAGE);
  const homeroomClassroomIds = guard.session.teacherAssignments?.homeroomClassroomIds || [];
  const hasWaliKelasAccess =
    (guard.session.roles.includes('WALI_KELAS') ||
      Boolean(guard.session.teacherAssignments?.isHomeroomTeacher)) &&
    homeroomClassroomIds.length > 0;
  const canManageSchedule = isGlobalManager || hasWaliKelasAccess;

  const isGlobalViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ]);
  const ta = guard.session.teacherAssignments;

  if (!isGlobalViewer && !ta?.isPicketTeacher) {
    if (!ta) {
      return NextResponse.json({
        classrooms: [],
        subjects: [],
        schedules: [],
        pickets: [],
        enrollments: [],
        homeroomTeacherCandidates,
        canManageSchedule,
        homeroomClassroomIds,
      });
    }
    const allowedClassIds = new Set([
      ...(ta.homeroomClassroomIds || []),
      ...(ta.taughtClassroomIds || []),
    ]);
    const homeroomSet = new Set(ta.homeroomClassroomIds || []);

    const scopedSchedules = (schedules || []).filter(
      (s) => s.teacher_id === ta.teacherId || homeroomSet.has(s.classroom_id)
    );
    const allowedSubjectIds = new Set([
      ...(ta.taughtSubjectIds || []),
      ...scopedSchedules.map((s) => s.subject_id as string).filter(Boolean),
    ]);
    const scopedClassrooms = (classrooms || []).filter((c) => allowedClassIds.has(c.id));
    // Wali Kelas yang dapat mengelola jadwal membutuhkan daftar semua mapel agar bisa menyusun jadwal kelasnya
    const scopedSubjects = hasWaliKelasAccess
      ? subjects || []
      : (subjects || []).filter((sub) => allowedSubjectIds.has(sub.id));
    const scopedPickets = (pickets || []).filter((p) => p.teacher_id === ta.teacherId);
    const scopedEnrollments = (enrollments || []).filter((e) =>
      allowedClassIds.has(e.classroom_id)
    );

    return NextResponse.json({
      classrooms: scopedClassrooms,
      subjects: scopedSubjects,
      schedules: scopedSchedules,
      pickets: scopedPickets,
      enrollments: scopedEnrollments,
      homeroomTeacherCandidates,
      canManageSchedule,
      homeroomClassroomIds,
    });
  }

  return NextResponse.json({
    classrooms: classrooms || [],
    subjects: subjects || [],
    schedules: schedules || [],
    pickets: pickets || [],
    enrollments: enrollments || [],
    homeroomTeacherCandidates,
    canManageSchedule,
    homeroomClassroomIds,
  });
}

const SCHEDULE_ACTIONS = new Set([
  'CREATE_SCHEDULE',
  'UPDATE_SCHEDULE',
  'DELETE_SCHEDULE',
  'DELETE_SCHEDULES_BATCH',
]);

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.KELAS_JADWAL_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  const isGlobalManager = hasAnyRole(guard.session, PERMISSIONS.KELAS_JADWAL_MANAGE);
  const homeroomClassroomIds = guard.session.teacherAssignments?.homeroomClassroomIds || [];
  const homeroomSet = new Set(homeroomClassroomIds);
  const hasWaliKelasAccess =
    (guard.session.roles.includes('WALI_KELAS') ||
      Boolean(guard.session.teacherAssignments?.isHomeroomTeacher)) &&
    homeroomClassroomIds.length > 0;

  if (!isGlobalManager && !hasWaliKelasAccess) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki izin untuk mengelola kelas atau jadwal.' },
      { status: 403 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    if (!isGlobalManager && !SCHEDULE_ACTIONS.has(String(body?.action || ''))) {
      return NextResponse.json(
        { error: 'Wali Kelas hanya dapat mengelola jadwal pelajaran untuk kelas perwaliannya.' },
        { status: 403 }
      );
    }
    const supabase = createSupabaseAdminClient();
    const academicYearId = await getOrCreateActiveAcademicYear(supabase);

    if (body.action === 'CREATE_CLASSROOM') {
      const parsed = ClassroomSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data rombel tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('classrooms')
        .insert({
          academic_year_id: academicYearId,
          name: parsed.data.name,
          grade_level: parsed.data.grade_level,
          homeroom_teacher_id: parsed.data.homeroom_teacher_id || null,
          room_location: parsed.data.room_location || null,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ classroom: data });
    }

    if (body.action === 'UPDATE_CLASSROOM') {
      const parsed = UpdateClassroomSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembaruan rombel tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('classrooms')
        .update({
          name: parsed.data.name.trim(),
          grade_level: parsed.data.grade_level.trim(),
          homeroom_teacher_id: parsed.data.homeroom_teacher_id || null,
          room_location: parsed.data.room_location || null,
        })
        .eq('id', parsed.data.id)
        .select('*, homeroom_teacher:teachers_staff(id, full_name)')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ classroom: data });
    }

    if (body.action === 'CREATE_SUBJECT') {
      const parsed = SubjectSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data mata pelajaran tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          code: parsed.data.code.toUpperCase(),
          name: parsed.data.name,
          subject_group: parsed.data.subject_group,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ subject: data });
    }

    if (body.action === 'UPDATE_SUBJECT') {
      const parsed = UpdateSubjectSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembaruan mata pelajaran tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('subjects')
        .update({
          code: parsed.data.code.trim().toUpperCase(),
          name: parsed.data.name.trim(),
          subject_group: parsed.data.subject_group.trim() || 'Umum',
        })
        .eq('id', parsed.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ subject: data });
    }

    if (body.action === 'DELETE_SUBJECT') {
      const parsed = DeleteSubjectSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID mata pelajaran tidak valid.' }, { status: 400 });
      }
      const { count: scheduleCount, error: checkError } = await supabase
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', parsed.data.id);
      if (checkError) return NextResponse.json({ error: sanitizeApiError(checkError) }, { status: 500 });
      if ((scheduleCount || 0) > 0) {
        return NextResponse.json(
          {
            error: `Mata pelajaran tidak dapat dihapus karena masih digunakan pada ${scheduleCount} jadwal pelajaran.`,
          },
          { status: 409 }
        );
      }
      const { error } = await supabase.from('subjects').delete().eq('id', parsed.data.id);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'CREATE_SCHEDULE') {
      const parsed = ScheduleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jadwal tidak valid.' }, { status: 400 });
      }
      if (!isGlobalManager && !homeroomSet.has(parsed.data.classroom_id)) {
        return NextResponse.json(
          { error: 'Anda hanya dapat menambahkan jadwal untuk kelas perwalian Anda sendiri.' },
          { status: 403 }
        );
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('schedules')
        .insert({ ...payload, academic_year_id: academicYearId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ schedule: data });
    }

    if (body.action === 'UPDATE_SCHEDULE') {
      const parsed = UpdateScheduleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembaruan jadwal tidak valid.' }, { status: 400 });
      }
      if (!isGlobalManager) {
        const { data: existingSch } = await supabase
          .from('schedules')
          .select('classroom_id')
          .eq('id', parsed.data.id)
          .maybeSingle();
        if (
          !existingSch ||
          !homeroomSet.has(existingSch.classroom_id) ||
          !homeroomSet.has(parsed.data.classroom_id)
        ) {
          return NextResponse.json(
            { error: 'Anda hanya dapat mengubah jadwal untuk kelas perwalian Anda sendiri.' },
            { status: 403 }
          );
        }
      }
      const { action: _, id, ...payload } = parsed.data;
      void _;
      const { data, error } = await supabase
        .from('schedules')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ schedule: data });
    }

    if (body.action === 'DELETE_SCHEDULE') {
      const parsed = DeleteScheduleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID jadwal tidak valid.' }, { status: 400 });
      }
      if (!isGlobalManager) {
        const { data: existingSch } = await supabase
          .from('schedules')
          .select('classroom_id')
          .eq('id', parsed.data.id)
          .maybeSingle();
        if (!existingSch || !homeroomSet.has(existingSch.classroom_id)) {
          return NextResponse.json(
            { error: 'Anda hanya dapat menghapus jadwal untuk kelas perwalian Anda sendiri.' },
            { status: 403 }
          );
        }
      }
      const { error } = await supabase.from('schedules').delete().eq('id', parsed.data.id);
      if (error) {
        return NextResponse.json(
          {
            error:
              'Jadwal tidak dapat dihapus karena sudah terhubung dengan data presensi atau jurnal pembelajaran.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'DELETE_SCHEDULES_BATCH') {
      const parsed = DeleteSchedulesBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Daftar ID jadwal tidak valid.' },
          { status: 400 }
        );
      }
      const uniqueIds = Array.from(new Set(parsed.data.ids));
      if (!isGlobalManager) {
        const { data: targetSchedules } = await supabase
          .from('schedules')
          .select('id, classroom_id')
          .in('id', uniqueIds);
        const allOwned =
          Boolean(targetSchedules) &&
          targetSchedules!.length === uniqueIds.length &&
          targetSchedules!.every((s) => homeroomSet.has(s.classroom_id));
        if (!allOwned) {
          return NextResponse.json(
            {
              error:
                'Sebagian atau seluruh jadwal terpilih bukan milik kelas perwalian Anda.',
            },
            { status: 403 }
          );
        }
      }
      const { error } = await supabase.from('schedules').delete().in('id', uniqueIds);
      if (error) {
        return NextResponse.json(
          {
            error:
              'Sebagian atau seluruh jadwal terpilih tidak dapat dihapus karena sudah terhubung dengan data presensi atau jurnal pembelajaran.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true, deletedCount: uniqueIds.length });
    }

    if (body.action === 'CREATE_PICKET') {
      const parsed = PicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jadwal piket tidak valid.' }, { status: 400 });
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('picket_schedules')
        .insert({ ...payload, academic_year_id: academicYearId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ picket: data });
    }

    if (body.action === 'ENROLL_STUDENT') {
      const parsed = EnrollSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data penempatan siswa tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('student_enrollments')
        .upsert(
          {
            student_id: parsed.data.student_id,
            classroom_id: parsed.data.classroom_id,
            academic_year_id: academicYearId,
          },
          { onConflict: 'student_id,academic_year_id' }
        )
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ enrollment: data });
    }

    if (body.action === 'ENROLL_STUDENTS_BATCH') {
      const parsed = EnrollBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Pilih rombel dan minimal 1 siswa.' }, { status: 400 });
      }
      const uniqueStudentIds = Array.from(new Set(parsed.data.student_ids));
      const rows = uniqueStudentIds.map((student_id) => ({
        student_id,
        classroom_id: parsed.data.classroom_id,
        academic_year_id: academicYearId,
      }));
      const { data, error } = await supabase
        .from('student_enrollments')
        .upsert(rows, { onConflict: 'student_id,academic_year_id' })
        .select('*');
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ enrollments: data || [], count: rows.length });
    }

    if (body.action === 'UNENROLL_STUDENT') {
      const parsed = UnenrollSchema.safeParse(body);
      if (!parsed.success || (!parsed.data.enrollment_id && !parsed.data.student_id)) {
        return NextResponse.json({ error: 'Parameter keluarkan siswa tidak valid.' }, { status: 400 });
      }
      let query = supabase.from('student_enrollments').delete();
      if (parsed.data.enrollment_id) {
        query = query.eq('id', parsed.data.enrollment_id);
      } else if (parsed.data.student_id) {
        query = query
          .eq('student_id', parsed.data.student_id)
          .eq('academic_year_id', academicYearId);
      }
      const { error } = await query;
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeApiError(err, 'Gagal memproses kelas/jadwal.') },
      { status: 500 }
    );
  }
}
