import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getActiveAcademicYear } from '@/lib/domain/penilaian';

export async function GET() {
  const { session, errorResponse } = await requireApiRoles(PERMISSIONS.PENILAIAN_ADMIN_READ);
  if (errorResponse || !session) return errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Konfigurasi database belum siap.' }, { status: 500 });
  }

  const db = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(db);
  if (!activeYear) {
    return NextResponse.json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 404 });
  }

  const [{ data: subjects }, { data: classrooms }, { data: schedules }] = await Promise.all([
    db.from('subjects').select('id, code, name').order('name', { ascending: true }),
    db
      .from('classrooms')
      .select('id, name, grade_level')
      .eq('academic_year_id', activeYear.id)
      .order('name', { ascending: true }),
    db
      .from('schedules')
      .select('subject_id, classroom_id, teacher:teachers_staff(full_name)')
      .eq('academic_year_id', activeYear.id),
  ]);

  const schedulePairs = (schedules || []).map((s) => {
    const t = Array.isArray(s.teacher) ? s.teacher[0] : s.teacher;
    return {
      subject_id: s.subject_id as string,
      classroom_id: s.classroom_id as string,
      teacher_name: t?.full_name ? String(t.full_name) : null,
    };
  });

  return NextResponse.json({
    academicYear: activeYear,
    isSuperadmin: session.roles.includes('SUPERADMIN'),
    subjects: subjects || [],
    classrooms: classrooms || [],
    schedulePairs,
  });
}
