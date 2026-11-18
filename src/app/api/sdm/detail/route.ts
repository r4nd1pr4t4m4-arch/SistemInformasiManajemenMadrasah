import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(ROLE_GROUPS.SDM);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const scope = request.nextUrl.searchParams.get('scope');
  const id = request.nextUrl.searchParams.get('id');
  if (!scope || !id) {
    return NextResponse.json({ error: 'Parameter scope dan id wajib diisi.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (scope === 'gtk') {
    const [teacherRes, historyRes, dutiesRes, docsRes] = await Promise.all([
      supabase
        .from('teachers_staff')
        .select('*, profile:profiles(id, full_name, email, phone, primary_role)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('employment_histories')
        .select('*')
        .eq('teacher_id', id)
        .order('start_date', { ascending: false }),
      supabase
        .from('teacher_additional_duties')
        .select('*, duty_type:additional_duty_types(code, name), academic_year:academic_years(name)')
        .eq('teacher_id', id)
        .order('start_date', { ascending: false }),
      supabase
        .from('sdm_documents')
        .select('*')
        .eq('entity_type', 'GTK')
        .eq('entity_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (teacherRes.error) return NextResponse.json({ error: teacherRes.error.message }, { status: 500 });
    if (!teacherRes.data) return NextResponse.json({ error: 'Data GTK tidak ditemukan.' }, { status: 404 });

    return NextResponse.json({
      teacher: teacherRes.data,
      employmentHistories: historyRes.data || [],
      additionalDuties: dutiesRes.data || [],
      documents: docsRes.data || [],
    });
  }

  if (scope === 'siswa') {
    const [studentRes, guardiansRes, enrollmentsRes, docsRes] = await Promise.all([
      supabase
        .from('students')
        .select('*, profile:profiles(id, full_name, email, phone, primary_role)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('student_guardians')
        .select('*, profile:profiles(id, full_name, email, phone)')
        .eq('student_id', id)
        .order('is_primary', { ascending: false }),
      supabase
        .from('student_enrollments')
        .select('*, classroom:classrooms(id, name, grade_level), academic_year:academic_years(name)')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (studentRes.error) return NextResponse.json({ error: studentRes.error.message }, { status: 500 });
    if (!studentRes.data) return NextResponse.json({ error: 'Data siswa tidak ditemukan.' }, { status: 404 });

    return NextResponse.json({
      student: studentRes.data,
      guardians: guardiansRes.data || [],
      enrollments: enrollmentsRes.data || [],
      documents: docsRes.data || [],
    });
  }

  if (scope === 'orang-tua') {
    const [guardianRes, docsRes] = await Promise.all([
      supabase
        .from('student_guardians')
        .select(
          '*, student:students(id, full_name, nis, nisn, status, address, phone), profile:profiles(id, full_name, email, phone, primary_role)'
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('sdm_documents')
        .select('*')
        .eq('entity_type', 'ORANG_TUA')
        .eq('entity_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (guardianRes.error) return NextResponse.json({ error: guardianRes.error.message }, { status: 500 });
    if (!guardianRes.data) return NextResponse.json({ error: 'Data orang tua/wali tidak ditemukan.' }, { status: 404 });

    return NextResponse.json({
      guardian: guardianRes.data,
      documents: docsRes.data || [],
    });
  }

  if (scope === 'alumni') {
    const [studentRes, tracersRes, docsRes] = await Promise.all([
      supabase
        .from('students')
        .select('*, profile:profiles(id, full_name, email, phone, primary_role)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('alumni_tracers')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (studentRes.error) return NextResponse.json({ error: studentRes.error.message }, { status: 500 });
    if (!studentRes.data) return NextResponse.json({ error: 'Data alumni tidak ditemukan.' }, { status: 404 });

    return NextResponse.json({
      student: studentRes.data,
      tracers: tracersRes.data || [],
      documents: docsRes.data || [],
    });
  }

  return NextResponse.json({ error: 'Scope detail SDM tidak dikenali.' }, { status: 400 });
}
