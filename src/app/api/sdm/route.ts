import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';

const GtkCreateSchema = z.object({
  full_name: z.string().min(2),
  staff_type: z.enum(['GURU', 'TATA_USAHA', 'LAINNYA']).default('GURU'),
  nip: z.string().optional().nullable(),
  nuptk: z.string().optional().nullable(),
  nik: z.string().optional().nullable(),
  gender: z.enum(['L', 'P']).optional().nullable(),
  birth_place: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  education_level: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  employment_status: z.string().optional().nullable(),
  join_date: z.string().optional().nullable(),
  profile_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  show_in_public_directory: z.boolean().optional(),
});

const GtkUpdateSchema = GtkCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const SiswaCreateSchema = z.object({
  full_name: z.string().min(2),
  nis: z.string().optional().nullable(),
  nisn: z.string().optional().nullable(),
  nik: z.string().optional().nullable(),
  gender: z.enum(['L', 'P']).optional().nullable(),
  birth_place: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  father_name: z.string().optional().nullable(),
  father_job: z.string().optional().nullable(),
  father_phone: z.string().optional().nullable(),
  mother_name: z.string().optional().nullable(),
  mother_job: z.string().optional().nullable(),
  mother_phone: z.string().optional().nullable(),
  guardian_name: z.string().optional().nullable(),
  guardian_phone: z.string().optional().nullable(),
  entry_year: z.coerce.number().int().min(1980).max(2100).optional().nullable(),
  graduation_year: z.coerce.number().int().min(1980).max(2100).optional().nullable(),
  status: z.enum(['AKTIF', 'MUTASI', 'LULUS', 'NONAKTIF']).default('AKTIF'),
  profile_id: z.string().uuid().optional().nullable(),
});

const SiswaUpdateSchema = SiswaCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const GuardianCreateSchema = z.object({
  student_id: z.string().uuid(),
  profile_id: z.string().uuid().optional().nullable(),
  relationship: z.enum(['AYAH', 'IBU', 'WALI']).default('WALI'),
  full_name: z.string().min(2),
  nik: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  is_primary: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const GuardianUpdateSchema = GuardianCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const AlumniTracerSchema = z.object({
  student_id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(2),
  graduation_year: z.coerce.number().int().min(1980).max(2100),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  current_activity: z.enum([
    'KULIAH',
    'BEKERJA',
    'WIRAUSAHA',
    'PESANTREN',
    'MENCARI_KERJA',
    'LAINNYA',
  ]),
  institution_or_company: z.string().optional().nullable(),
  major_or_position: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  testimonial: z.string().optional().nullable(),
});

const AlumniTracerUpdateSchema = AlumniTracerSchema.partial().extend({
  id: z.string().uuid(),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = val === '' ? null : val;
  }
  return result as T;
}

async function fetchActiveAccounts(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, account_status, user_roles(role)')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  return data || [];
}

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SDM_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const scope = request.nextUrl.searchParams.get('scope') || 'gtk';
  const scopeRoleMap: Record<string, typeof PERMISSIONS.SDM_VIEW> = {
    gtk: PERMISSIONS.SDM_GTK_VIEW,
    siswa: PERMISSIONS.SDM_SISWA_VIEW,
    'orang-tua': PERMISSIONS.SDM_ORTU_VIEW,
    alumni: PERMISSIONS.SDM_ALUMNI_VIEW,
  };
  const requiredScopeRoles = scopeRoleMap[scope];
  if (requiredScopeRoles && !hasAnyRole(guard.session, requiredScopeRoles)) {
    return NextResponse.json(
      { error: 'Peran atau tugas tambahan Anda tidak memiliki akses untuk cakupan data SDM ini.' },
      { status: 403 }
    );
  }
  const supabase = createSupabaseAdminClient();

  if (scope === 'gtk') {
    const [gtkRes, activeAccounts] = await Promise.all([
      supabase
        .from('teachers_staff')
        .select('*, profile:profiles(id, full_name, email, phone)')
        .order('full_name', { ascending: true }),
      fetchActiveAccounts(supabase),
    ]);
    if (gtkRes.error) {
      return NextResponse.json({ error: gtkRes.error.message }, { status: 500 });
    }
    return NextResponse.json({ items: gtkRes.data || [], activeAccounts });
  }

  if (scope === 'siswa') {
    const [siswaRes, activeAccounts] = await Promise.all([
      supabase
        .from('students')
        .select('*, profile:profiles(id, full_name, email, phone)')
        .order('full_name', { ascending: true }),
      fetchActiveAccounts(supabase),
    ]);
    if (siswaRes.error) {
      return NextResponse.json({ error: siswaRes.error.message }, { status: 500 });
    }
    return NextResponse.json({ items: siswaRes.data || [], activeAccounts });
  }

  if (scope === 'orang-tua') {
    const [guardiansRes, studentsRes, activeAccounts] = await Promise.all([
      supabase
        .from('student_guardians')
        .select(
          '*, student:students(id, full_name, nis, nisn, status), profile:profiles(id, full_name, email, phone)'
        )
        .order('full_name', { ascending: true }),
      supabase
        .from('students')
        .select('id, full_name, nis, nisn, status')
        .order('full_name', { ascending: true }),
      fetchActiveAccounts(supabase),
    ]);

    if (guardiansRes.error) {
      return NextResponse.json({ error: guardiansRes.error.message }, { status: 500 });
    }
    return NextResponse.json({
      items: guardiansRes.data || [],
      students: studentsRes.data || [],
      activeAccounts,
    });
  }

  if (scope === 'alumni') {
    const [alumniStudentsRes, tracersRes, activeStudentsRes, activeAccounts] = await Promise.all([
      supabase
        .from('students')
        .select('*, profile:profiles(id, full_name, email, phone)')
        .eq('status', 'LULUS')
        .order('graduation_year', { ascending: false })
        .order('full_name', { ascending: true }),
      supabase
        .from('alumni_tracers')
        .select('*, student:students(id, full_name, nis, nisn)')
        .order('graduation_year', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('students')
        .select('id, full_name, nis, nisn, entry_year')
        .eq('status', 'AKTIF')
        .order('full_name', { ascending: true }),
      fetchActiveAccounts(supabase),
    ]);

    if (alumniStudentsRes.error) {
      return NextResponse.json({ error: alumniStudentsRes.error.message }, { status: 500 });
    }
    if (tracersRes.error) {
      return NextResponse.json({ error: tracersRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      alumniStudents: alumniStudentsRes.data || [],
      tracers: tracersRes.data || [],
      activeStudents: activeStudentsRes.data || [],
      activeAccounts,
    });
  }

  return NextResponse.json({ error: 'Scope SDM tidak dikenali.' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SDM_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const scope = body?.scope as string;
    const requiredRoles =
      scope === 'alumni-tracer' ? PERMISSIONS.SDM_ALUMNI_MANAGE : PERMISSIONS.SDM_MANAGE;
    if (!hasAnyRole(guard.session, requiredRoles)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Peran akun Anda tidak memiliki izin kelola untuk modul SDM ini.' },
        { status: 403 }
      );
    }
    const supabase = createSupabaseAdminClient();

    if (scope === 'gtk') {
      const parsed = GtkCreateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data GTK tidak valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('teachers_staff')
        .insert(parsed.data)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (scope === 'siswa') {
      const parsed = SiswaCreateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data siswa tidak valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('students')
        .insert(parsed.data)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (scope === 'orang-tua') {
      const parsed = GuardianCreateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data orang tua/wali tidak valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('student_guardians')
        .insert(parsed.data)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (scope === 'alumni-tracer') {
      const parsed = AlumniTracerSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data tracer alumni tidak valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('alumni_tracers')
        .insert(parsed.data)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (scope === 'alumni-graduate') {
      const studentId = body?.student_id as string | undefined;
      const graduationYear = Number(body?.graduation_year);
      if (!studentId || !Number.isFinite(graduationYear)) {
        return NextResponse.json(
          { error: 'Pilih siswa dan tahun lulus yang valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('students')
        .update({
          status: 'LULUS',
          graduation_year: graduationYear,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    return NextResponse.json({ error: 'Scope SDM tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan SDM.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SDM_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const scope = body?.scope as string;
    const requiredRoles =
      scope === 'alumni-tracer' ? PERMISSIONS.SDM_ALUMNI_MANAGE : PERMISSIONS.SDM_MANAGE;
    if (!hasAnyRole(guard.session, requiredRoles)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Peran akun Anda tidak memiliki izin kelola untuk modul SDM ini.' },
        { status: 403 }
      );
    }
    const supabase = createSupabaseAdminClient();

    if (scope === 'gtk') {
      const parsed = GtkUpdateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembaruan GTK tidak valid.' },
          { status: 400 }
        );
      }
      const { id, ...rest } = parsed.data;
      const { data, error } = await supabase
        .from('teachers_staff')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (scope === 'siswa') {
      const parsed = SiswaUpdateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembaruan siswa tidak valid.' },
          { status: 400 }
        );
      }
      const { id, ...rest } = parsed.data;
      const { data, error } = await supabase
        .from('students')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (scope === 'orang-tua') {
      const parsed = GuardianUpdateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembaruan orang tua/wali tidak valid.' },
          { status: 400 }
        );
      }
      const { id, ...rest } = parsed.data;
      const { data, error } = await supabase
        .from('student_guardians')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (scope === 'alumni-tracer') {
      const parsed = AlumniTracerUpdateSchema.safeParse(emptyToNull(body));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembaruan tracer alumni tidak valid.' },
          { status: 400 }
        );
      }
      const { id, ...rest } = parsed.data;
      const { data, error } = await supabase
        .from('alumni_tracers')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    return NextResponse.json({ error: 'Scope pembaruan SDM tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui data SDM.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SDM_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const scope = request.nextUrl.searchParams.get('scope');
  const id = request.nextUrl.searchParams.get('id');
  if (!scope || !id) {
    return NextResponse.json({ error: 'Parameter scope dan id wajib diisi.' }, { status: 400 });
  }

  const requiredRoles =
    scope === 'alumni-tracer' ? PERMISSIONS.SDM_ALUMNI_MANAGE : PERMISSIONS.SDM_MANAGE;
  if (!hasAnyRole(guard.session, requiredRoles)) {
    return NextResponse.json(
      { error: 'Akses ditolak. Peran akun Anda tidak memiliki izin kelola untuk modul SDM ini.' },
      { status: 403 }
    );
  }

  const tableMap: Record<string, string> = {
    gtk: 'teachers_staff',
    siswa: 'students',
    'orang-tua': 'student_guardians',
    'alumni-tracer': 'alumni_tracers',
  };

  const table = tableMap[scope];
  if (!table) {
    return NextResponse.json({ error: 'Scope penghapusan SDM tidak dikenali.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
