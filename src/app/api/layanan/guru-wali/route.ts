import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

async function getActiveAcademicYearId(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<string> {
  const { data } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (data) return data.id;

  const { data: created } = await supabase
    .from('academic_years')
    .insert({ name: '2026/2027', semester: 'GANJIL', is_active: true })
    .select('id')
    .single();
  return created!.id;
}

const AssignSchema = z.object({
  action: z.literal('ASSIGN_GURU_WALI'),
  teacher_id: z.string().uuid(),
  student_id: z.string().uuid(),
});

const LogSchema = z.object({
  action: z.literal('ADD_MENTORING_LOG'),
  assignment_id: z.string().uuid(),
  mentoring_date: z.string().optional(),
  topic: z.string().min(2),
  aspect: z
    .enum([
      'AKADEMIK',
      'IBADAH_KARAKTER',
      'SETORAN_HAFALAN',
      'SOSIAL',
      'KESEHATAN',
      'LAINNYA',
    ])
    .default('AKADEMIK'),
  notes: z.string().min(3),
  recommendation: z.string().optional().nullable(),
});

const AddHafalanItemSchema = z.object({
  action: z.literal('ADD_HAFALAN_ITEM'),
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(100).optional().nullable(),
});

const UpdateHafalanItemSchema = z.object({
  action: z.literal('UPDATE_HAFALAN_ITEM'),
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(100).optional().nullable(),
});

const DeleteHafalanItemSchema = z.object({
  action: z.literal('DELETE_HAFALAN_ITEM'),
  id: z.string().uuid(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.GURU_WALI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      assignments: [],
      logs: [],
      hafalanItems: [],
      menteeDirectory: [],
      canViewMenteeDirectory: false,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: assignments }, { data: logs }, { data: hafalanItems }, { data: enrollments }] =
    await Promise.all([
      supabase
        .from('guru_wali_assignments')
        .select('*, teacher:teachers_staff(id, full_name), student:students(id, full_name, nis)'),
      supabase
        .from('guru_wali_mentoring_logs')
        .select(
          '*, assignment:guru_wali_assignments(teacher:teachers_staff(full_name), student:students(full_name))'
        )
        .order('mentoring_date', { ascending: false })
        .limit(100),
      supabase
        .from('guru_wali_hafalan_items')
        .select('id, title, category, sort_order, is_active, created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true }),
      supabase
        .from('student_enrollments')
        .select('student_id, classroom:classrooms(name), academic_year:academic_years(is_active)')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

  const studentClassMap = new Map<string, string>();
  for (const enr of enrollments || []) {
    const sid = enr.student_id as string | null;
    if (!sid) continue;
    const ay = (Array.isArray(enr.academic_year) ? enr.academic_year[0] : enr.academic_year) as
      | { is_active?: boolean }
      | null
      | undefined;
    const cls = (Array.isArray(enr.classroom) ? enr.classroom[0] : enr.classroom) as
      | { name?: string | null }
      | null
      | undefined;
    if (cls?.name && (!studentClassMap.has(sid) || ay?.is_active)) {
      studentClassMap.set(sid, cls.name);
    }
  }

  const isAdminActor = hasAnyRole(guard.session, ['SUPERADMIN', 'OPERATOR']);
  const isGlobalGwViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
  ]);
  const ta = guard.session.teacherAssignments;
  const myTeacherId = ta?.teacherId || null;
  const isWaliKelas =
    guard.session.roles.includes('WALI_KELAS') || Boolean(ta?.homeroomClassroomIds?.length);
  const isGuruWali = guard.session.roles.includes('GURU_WALI') || Boolean(ta?.isGuruWali);

  let homeroomStudentIds = new Set<string>();
  if (ta?.homeroomClassroomIds && ta.homeroomClassroomIds.length > 0) {
    const { data: enrolls } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .in('classroom_id', ta.homeroomClassroomIds);
    homeroomStudentIds = new Set(
      (enrolls || []).map((e) => e.student_id as string).filter(Boolean)
    );
  }

  const enrichedAssignments = (assignments || []).map((a) => ({
    ...a,
    classroom_name: studentClassMap.get(a.student_id as string) || null,
    is_my_mentee: Boolean(myTeacherId && a.teacher_id === myTeacherId),
  }));

  // Daftar Siswa Binaan per Guru Wali: hanya untuk Admin (semua), Wali Kelas (siswa kelasnya), & Guru Wali (siswa binaannya)
  const canViewMenteeDirectory = isAdminActor || isWaliKelas || isGuruWali;
  const menteeDirectory = !canViewMenteeDirectory
    ? []
    : isAdminActor
    ? enrichedAssignments
    : enrichedAssignments.filter((a) => {
        const matchOwnMentee = isGuruWali && Boolean(myTeacherId && a.teacher_id === myTeacherId);
        const matchHomeroom = isWaliKelas && homeroomStudentIds.has(a.student_id as string);
        return matchOwnMentee || matchHomeroom;
      });

  if (!isGlobalGwViewer) {
    if (!myTeacherId) {
      return NextResponse.json({
        assignments: [],
        logs: [],
        hafalanItems: hafalanItems || [],
        menteeDirectory: [],
        canViewMenteeDirectory,
      });
    }

    const scopedAssignments = enrichedAssignments.filter(
      (a) => a.teacher_id === myTeacherId || homeroomStudentIds.has(a.student_id as string)
    );
    const allowedAssignIds = new Set(scopedAssignments.map((a) => a.id as string));
    const scopedLogs = (logs || []).filter((l) => allowedAssignIds.has(l.assignment_id));

    return NextResponse.json({
      assignments: scopedAssignments,
      logs: scopedLogs,
      hafalanItems: hafalanItems || [],
      menteeDirectory,
      canViewMenteeDirectory,
    });
  }

  return NextResponse.json({
    assignments: enrichedAssignments,
    logs: logs || [],
    hafalanItems: hafalanItems || [],
    menteeDirectory,
    canViewMenteeDirectory,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.GURU_WALI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'ASSIGN_GURU_WALI') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_ASSIGN)) {
        return NextResponse.json(
          { error: 'Peran Anda tidak memiliki izin untuk menetapkan Guru Wali.' },
          { status: 403 }
        );
      }
      const parsed = AssignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data penugasan Guru Wali tidak valid.' }, { status: 400 });
      }
      const academicYearId = await getActiveAcademicYearId(supabase);
      const { data, error } = await supabase
        .from('guru_wali_assignments')
        .upsert(
          {
            academic_year_id: academicYearId,
            teacher_id: parsed.data.teacher_id,
            student_id: parsed.data.student_id,
          },
          { onConflict: 'academic_year_id,student_id' }
        )
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ assignment: data });
    }

    if (body.action === 'ADD_MENTORING_LOG') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_LOG)) {
        return NextResponse.json(
          { error: 'Peran Anda tidak memiliki izin untuk mencatat log bimbingan Guru Wali.' },
          { status: 403 }
        );
      }
      const parsed = LogSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data bimbingan Guru Wali tidak valid.' }, { status: 400 });
      }

      const isAdminActor = hasAnyRole(guard.session, ['SUPERADMIN', 'OPERATOR']);
      const myTeacherId = guard.session.teacherAssignments?.teacherId;
      if (!isAdminActor) {
        if (!myTeacherId) {
          return NextResponse.json(
            { error: 'Akun Anda belum tertaut ke data GTK.' },
            { status: 403 }
          );
        }
        const { data: assignRow } = await supabase
          .from('guru_wali_assignments')
          .select('teacher_id')
          .eq('id', parsed.data.assignment_id)
          .maybeSingle();
        if (!assignRow || assignRow.teacher_id !== myTeacherId) {
          return NextResponse.json(
            { error: 'Anda hanya dapat mencatat bimbingan untuk siswa binaan Anda sendiri.' },
            { status: 403 }
          );
        }
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const wibToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const { data, error } = await supabase
        .from('guru_wali_mentoring_logs')
        .insert({
          ...payload,
          mentoring_date: parsed.data.mentoring_date || wibToday,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      const { data: assignTarget } = await supabase
        .from('guru_wali_assignments')
        .select('student_id')
        .eq('id', parsed.data.assignment_id)
        .maybeSingle();
      if (assignTarget?.student_id) {
        await notifyStudentFamilyEvent({
          studentId: assignTarget.student_id,
          categoryKey: 'GURU_WALI_HAFALAN',
          title: 'Catatan Baru Guru Wali & Hafalan',
          body: `Guru Wali menambahkan catatan bimbingan/hafalan untuk {studentName}.`,
          url: '/portal/orang-tua',
          dedupeKey: `gw-log-${data.id}`,
          createdBy: guard.session.userId,
        });
      }
      return NextResponse.json({ log: data });
    }

    if (body.action === 'ADD_HAFALAN_ITEM') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_ASSIGN)) {
        return NextResponse.json(
          { error: 'Hanya Admin yang memiliki izin untuk menambah daftar hafalan.' },
          { status: 403 }
        );
      }
      const parsed = AddHafalanItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Nama hafalan minimal 2 karakter.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('guru_wali_hafalan_items')
        .insert({
          title: parsed.data.title,
          category: parsed.data.category?.trim() || null,
          created_by: guard.session.userId,
        })
        .select('id, title, category, sort_order, is_active, created_at')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (body.action === 'UPDATE_HAFALAN_ITEM') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_ASSIGN)) {
        return NextResponse.json(
          { error: 'Hanya Admin yang memiliki izin untuk mengubah daftar hafalan.' },
          { status: 403 }
        );
      }
      const parsed = UpdateHafalanItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembaruan hafalan tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('guru_wali_hafalan_items')
        .update({
          title: parsed.data.title,
          category: parsed.data.category?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.id)
        .select('id, title, category, sort_order, is_active, created_at')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (body.action === 'DELETE_HAFALAN_ITEM') {
      if (!hasAnyRole(guard.session, PERMISSIONS.GURU_WALI_ASSIGN)) {
        return NextResponse.json(
          { error: 'Hanya Admin yang memiliki izin untuk menghapus daftar hafalan.' },
          { status: 403 }
        );
      }
      const parsed = DeleteHafalanItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID hafalan tidak valid.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('guru_wali_hafalan_items')
        .delete()
        .eq('id', parsed.data.id);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ deleted: true });
    }

    return NextResponse.json({ error: 'Aksi Guru Wali tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data Guru Wali.' }, { status: 500 });
  }
}
