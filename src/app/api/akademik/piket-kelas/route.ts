import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';

const AddPicketSchema = z.object({
  action: z.literal('ADD'),
  classroom_id: z.string().uuid(),
  student_id: z.string().uuid(),
  day_of_week: z.number().int().min(1).max(7),
  task_notes: z.string().optional().nullable(),
});

const DeletePicketSchema = z.object({
  action: z.literal('DELETE'),
  id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      classrooms: [],
      students: [],
      pickets: [],
      myStudentIds: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const canManage = hasAnyRole(session, PERMISSIONS.PIKET_KELAS_MANAGE);
  const requestedClassroomId = request.nextUrl.searchParams.get('classroom_id');

  // Resolve academic year
  const { data: activeYear } = await supabase
    .from('academic_years')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle();

  let targetClassroomId = requestedClassroomId || null;
  const myStudentIds: string[] = [];

  if (!canManage || !targetClassroomId) {
    if (session.roles.includes('SISWA')) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', session.userId)
        .maybeSingle();
      if (student?.id) {
        myStudentIds.push(student.id);
        const { data: enr } = await supabase
          .from('student_enrollments')
          .select('classroom_id')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enr?.classroom_id && !targetClassroomId) {
          targetClassroomId = enr.classroom_id;
        }
      }
    }

    if (session.roles.includes('ORANG_TUA')) {
      const { data: guards } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('profile_id', session.userId)
        .eq('is_active', true);
      const childIds = (guards || []).map((g) => g.student_id as string);
      childIds.forEach((id) => myStudentIds.push(id));

      const requestedStudentId = request.nextUrl.searchParams.get('student_id');
      const activeChildId =
        requestedStudentId && childIds.includes(requestedStudentId)
          ? requestedStudentId
          : childIds[0];

      if (activeChildId && !targetClassroomId) {
        const { data: enr } = await supabase
          .from('student_enrollments')
          .select('classroom_id')
          .eq('student_id', activeChildId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enr?.classroom_id) {
          targetClassroomId = enr.classroom_id;
        }
      }
    }
  }

  let classrooms: Array<Record<string, unknown>> = [];
  let enrolledStudents: Array<Record<string, unknown>> = [];

  if (canManage) {
    const { data: clsData } = await supabase
      .from('classrooms')
      .select('id, name, grade_level, homeroom_teacher_id')
      .order('name', { ascending: true });
    classrooms = clsData || [];
    if (!targetClassroomId && classrooms.length > 0) {
      // Prioritize homeroom if teacher is wali kelas
      const homeroomIds = session.teacherAssignments?.homeroomClassroomIds || [];
      const preferred = classrooms.find((c) => homeroomIds.includes(c.id as string));
      targetClassroomId = ((preferred?.id || classrooms[0].id) as string) || null;
    }

    if (targetClassroomId) {
      const { data: enrData } = await supabase
        .from('student_enrollments')
        .select('student_id, student:students(id, full_name, nis, gender)')
        .eq('classroom_id', targetClassroomId);
      enrolledStudents = (enrData || [])
        .map((e) => e.student as unknown as Record<string, unknown> | null)
        .filter((s): s is Record<string, unknown> => Boolean(s));
    }
  }

  let pickets: Array<Record<string, unknown>> = [];
  if (targetClassroomId) {
    const { data: picketData } = await supabase
      .from('student_picket_schedules')
      .select(
        'id, classroom_id, student_id, day_of_week, task_notes, student:students(id, full_name, nis, gender), classroom:classrooms(id, name, grade_level)'
      )
      .eq('classroom_id', targetClassroomId)
      .order('day_of_week', { ascending: true });
    pickets = picketData || [];
  }

  return NextResponse.json({
    activeYear: activeYear || null,
    classroomId: targetClassroomId,
    classrooms,
    students: enrolledStudents,
    pickets,
    myStudentIds,
    canManage,
  });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }
  if (!hasAnyRole(session, PERMISSIONS.PIKET_KELAS_MANAGE)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki izin mengelola jadwal piket kelas.' },
      { status: 403 }
    );
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'ADD') {
      const parsed = AddPicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jadwal piket tidak valid.' }, { status: 400 });
      }

      const { data: activeYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      const { data, error } = await supabase
        .from('student_picket_schedules')
        .upsert(
          {
            academic_year_id: activeYear?.id || null,
            classroom_id: parsed.data.classroom_id,
            student_id: parsed.data.student_id,
            day_of_week: parsed.data.day_of_week,
            task_notes: parsed.data.task_notes?.trim() || null,
            created_by: session.userId,
          },
          { onConflict: 'classroom_id,student_id,day_of_week' }
        )
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ picket: data });
    }

    if (body.action === 'DELETE') {
      const parsed = DeletePicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID jadwal piket tidak valid.' }, { status: 400 });
      }

      const { error } = await supabase
        .from('student_picket_schedules')
        .delete()
        .eq('id', parsed.data.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}
