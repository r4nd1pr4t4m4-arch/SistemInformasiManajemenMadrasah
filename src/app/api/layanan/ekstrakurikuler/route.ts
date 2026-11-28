import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { hasAnyRole, type AuthenticatedSession } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';

const VIEW_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_KESISWAAN',
  'WAKA_KURIKULUM',
  'PEMBINA_EKSTRAKURIKULER',
  'PEMBINA_OSIM',
  'WALI_KELAS',
  'GURU',
  'SISWA',
  'ORANG_TUA',
] as const;

const ADMIN_ROLES = ['SUPERADMIN', 'OPERATOR'] as const;

const PORTFOLIO_MANAGE_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'WAKA_KESISWAAN',
  'PEMBINA_EKSTRAKURIKULER',
  'PEMBINA_OSIM',
  'KEPALA_TU',
] as const;

const MEMBER_ENTRY_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'WAKA_KESISWAAN',
  'PEMBINA_EKSTRAKURIKULER',
  'PEMBINA_OSIM',
  'KEPALA_TU',
  'GURU',
  'WALI_KELAS',
] as const;

function isEkskulAdmin(session: AuthenticatedSession): boolean {
  return hasAnyRole(session, [...ADMIN_ROLES]);
}

async function canManageEkskulMembers(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  session: AuthenticatedSession,
  extracurricularId: string
): Promise<boolean> {
  if (isEkskulAdmin(session)) return true;
  const teacherId = session.teacherAssignments?.teacherId || null;
  if (!teacherId) return false;

  const { data: ekskul } = await supabase
    .from('extracurriculars')
    .select('id, coach_teacher_id')
    .eq('id', extracurricularId)
    .maybeSingle();

  return Boolean(ekskul && ekskul.coach_teacher_id === teacherId);
}

const EkskulUpsertSchema = z.object({
  name: z.string().trim().min(2, 'Nama ekstrakurikuler minimal 2 karakter.'),
  category: z.string().trim().min(2).default('UMUM'),
  coach_teacher_id: z.string().uuid().optional().nullable(),
  schedule_info: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

const MemberUpsertSchema = z.object({
  extracurricular_id: z.string().uuid('Ekstrakurikuler wajib dipilih.'),
  student_id: z.string().uuid('Siswa wajib dipilih.'),
  grade: z.string().trim().min(1).default('Baik'),
  attendance_count: z.number().int().min(0).default(0),
  notes: z.string().trim().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles([...VIEW_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;

  const isAdmin = isEkskulAdmin(guard.session);
  const currentTeacherId = guard.session.teacherAssignments?.teacherId || null;
  const canManagePortfolio = hasAnyRole(guard.session, [...PORTFOLIO_MANAGE_ROLES]);

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      isAdmin,
      canManagePortfolio,
      currentTeacherId,
      manageableEkskulIds: [],
      masterExtracurriculars: [],
      extracurriculars: [],
      members: [],
      portfolios: [],
      students: [],
      teachers: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [ekskulRes, memRes, portRes, stRes, tRes] = await Promise.all([
    supabase
      .from('extracurriculars')
      .select('*, coach:teachers_staff(id, full_name)')
      .order('name'),
    supabase
      .from('extracurricular_members')
      .select(
        '*, student:students(id, full_name, nis), extracurricular:extracurriculars(id, name, coach_teacher_id)'
      )
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('student_portfolios')
      .select('*, student:students(id, full_name, nis)')
      .order('achieved_date', { ascending: false })
      .limit(200),
    supabase
      .from('students')
      .select('id, full_name, nis')
      .eq('status', 'AKTIF')
      .order('full_name')
      .limit(300),
    isAdmin
      ? supabase.from('teachers_staff').select('id, full_name').eq('is_active', true).order('full_name')
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const allEkskuls = ekskulRes.error ? [] : ekskulRes.data || [];
  const manageableEkskuls = isAdmin
    ? allEkskuls
    : currentTeacherId
    ? allEkskuls.filter((ek) => ek.coach_teacher_id === currentTeacherId)
    : [];
  const manageableEkskulIds = manageableEkskuls.map((ek) => ek.id as string);

  return NextResponse.json({
    isAdmin,
    canManagePortfolio,
    currentTeacherId,
    manageableEkskulIds,
    // Hanya Admin (SUPERADMIN & OPERATOR) yang dapat melihat & mengelola data Master Ekstrakurikuler
    masterExtracurriculars: isAdmin ? allEkskuls : [],
    // Opsi ekstrakurikuler pada form Anggota dibatasi ke ekstrakurikuler yang boleh dikelola
    extracurriculars: manageableEkskuls,
    members: memRes.error ? [] : memRes.data || [],
    portfolios: portRes.error ? [] : portRes.data || [],
    students: stRes.data || [],
    teachers: isAdmin ? tRes.data || [] : [],
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const supabase = createSupabaseAdminClient();

    // Master Ekstrakurikuler: HANYA SUPERADMIN & OPERATOR
    if (action === 'CREATE_EKSKUL' || action === 'UPDATE_EKSKUL') {
      const guard = await requireApiRoles([...ADMIN_ROLES]);
      if (guard.errorResponse) return guard.errorResponse;

      if (action === 'CREATE_EKSKUL') {
        const p = EkskulUpsertSchema.safeParse(body);
        if (!p.success) {
          return NextResponse.json(
            { error: p.error.issues[0]?.message || 'Data master ekstrakurikuler tidak valid.' },
            { status: 400 }
          );
        }
        const { data, error } = await supabase
          .from('extracurriculars')
          .insert({
            ...p.data,
            coach_teacher_id: p.data.coach_teacher_id || null,
            schedule_info: p.data.schedule_info || null,
            description: p.data.description || null,
          })
          .select('*')
          .single();
        if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
        return NextResponse.json({ extracurricular: data });
      }

      const p = EkskulUpsertSchema.extend({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan ekstrakurikuler tidak valid.' },
          { status: 400 }
        );
      }
      const { id, ...rest } = p.data;
      const { data, error } = await supabase
        .from('extracurriculars')
        .update({
          ...rest,
          coach_teacher_id: rest.coach_teacher_id || null,
          schedule_info: rest.schedule_info || null,
          description: rest.description || null,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ extracurricular: data });
    }

    // Anggota & Nilai Ekstrakurikuler: Admin (SUPERADMIN/OPERATOR) atau Guru Pembina ekskul terkait
    if (action === 'ENROLL_MEMBER' || action === 'UPDATE_MEMBER') {
      const guard = await requireApiRoles([...MEMBER_ENTRY_ROLES]);
      if (guard.errorResponse) return guard.errorResponse;

      if (action === 'ENROLL_MEMBER') {
        const p = MemberUpsertSchema.safeParse(body);
        if (!p.success) {
          return NextResponse.json(
            { error: p.error.issues[0]?.message || 'Data anggota ekskul tidak valid.' },
            { status: 400 }
          );
        }

        const allowed = await canManageEkskulMembers(
          supabase,
          guard.session,
          p.data.extracurricular_id
        );
        if (!allowed) {
          return NextResponse.json(
            {
              error:
                'Hanya Admin (Superadmin/Operator) atau Guru Pembina ekstrakurikuler terkait yang dapat menginput anggota dan nilai.',
            },
            { status: 403 }
          );
        }

        const { data, error } = await supabase
          .from('extracurricular_members')
          .upsert(p.data, { onConflict: 'extracurricular_id,student_id' })
          .select('*')
          .single();
        if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
        return NextResponse.json({ member: data });
      }

      const p = MemberUpsertSchema.extend({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan anggota ekskul tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from('extracurricular_members')
        .select('id, extracurricular_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'Data anggota ekstrakurikuler tidak ditemukan.' }, { status: 404 });
      }

      const canManageExisting = await canManageEkskulMembers(
        supabase,
        guard.session,
        existing.extracurricular_id as string
      );
      const canManageTarget = await canManageEkskulMembers(
        supabase,
        guard.session,
        p.data.extracurricular_id
      );

      if (!canManageExisting || !canManageTarget) {
        return NextResponse.json(
          {
            error:
              'Hanya Admin (Superadmin/Operator) atau Guru Pembina ekstrakurikuler terkait yang dapat mengedit anggota dan nilai.',
          },
          { status: 403 }
        );
      }

      const { id, ...rest } = p.data;
      const { data, error } = await supabase
        .from('extracurricular_members')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ member: data });
    }

    if (action === 'CREATE_PORTFOLIO') {
      const guard = await requireApiRoles([...PORTFOLIO_MANAGE_ROLES]);
      if (guard.errorResponse) return guard.errorResponse;

      const p = z
        .object({
          student_id: z.string().uuid('Siswa wajib dipilih.'),
          title: z.string().trim().min(3, 'Judul prestasi minimal 3 karakter.'),
          category: z.string().trim().default('AKADEMIK'),
          level: z.string().trim().default('KABUPATEN'),
          achieved_date: z.string().min(8, 'Tanggal perolehan wajib diisi.'),
          organizer: z.string().optional().nullable(),
          certificate_url: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data portofolio prestasi tidak valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('student_portfolios')
        .insert({ ...p.data, created_by: guard.session.userId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ portfolio: data });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const target = searchParams.get('target') || 'ekskul';
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  if (target === 'ekskul') {
    const guard = await requireApiRoles([...ADMIN_ROLES]);
    if (guard.errorResponse) return guard.errorResponse;
    const { error } = await supabase.from('extracurriculars').delete().eq('id', id);
    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (target === 'member') {
    const guard = await requireApiRoles([...MEMBER_ENTRY_ROLES]);
    if (guard.errorResponse) return guard.errorResponse;

    const { data: existing } = await supabase
      .from('extracurricular_members')
      .select('id, extracurricular_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Data anggota ekstrakurikuler tidak ditemukan.' }, { status: 404 });
    }

    const allowed = await canManageEkskulMembers(
      supabase,
      guard.session,
      existing.extracurricular_id as string
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'Hanya Admin (Superadmin/Operator) atau Guru Pembina ekstrakurikuler terkait yang dapat menghapus anggota ini.',
        },
        { status: 403 }
      );
    }

    const { error } = await supabase.from('extracurricular_members').delete().eq('id', id);
    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (target === 'portfolio') {
    const guard = await requireApiRoles([...PORTFOLIO_MANAGE_ROLES]);
    if (guard.errorResponse) return guard.errorResponse;
    const { error } = await supabase.from('student_portfolios').delete().eq('id', id);
    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Target penghapusan tidak dikenali.' }, { status: 400 });
}
