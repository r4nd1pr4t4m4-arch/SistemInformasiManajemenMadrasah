import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  FAMILY_SHARED_STUDENT_DOC_TYPES,
  syncGuardianToStudent,
} from '@/lib/sdm/sync';
import { nikSchema } from '@/lib/validation/identity';

const UpdateSelfGtkSchema = z.object({
  scope: z.literal('gtk'),
  id: z.string().uuid(),
  full_name: z.string().optional().nullable(),
  nik: nikSchema,
  gender: z.enum(['L', 'P']).optional().nullable(),
  birth_place: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  rt_rw: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  education_level: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
});

const UpdateSelfGuardianSchema = z.object({
  scope: z.literal('orang-tua'),
  id: z.string().uuid(),
  full_name: z.string().optional().nullable(),
  nik: nikSchema,
  occupation: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  rt_rw: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
});

function cleanStr(val: string | null | undefined): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ gtk: null, guardians: [] });
  }

  const supabase = createSupabaseAdminClient();

  const [teacherRes, guardiansRes] = await Promise.all([
    supabase
      .from('teachers_staff')
      .select('*')
      .eq('profile_id', session.userId)
      .maybeSingle(),
    supabase
      .from('student_guardians')
      .select('*, student:students(id, full_name, nis, nisn, status)')
      .eq('profile_id', session.userId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false }),
  ]);

  let gtkPayload: Record<string, unknown> | null = null;
  if (teacherRes.data) {
    const teacherId = teacherRes.data.id as string;
    const [historyRes, dutiesRes, docsRes] = await Promise.all([
      supabase
        .from('employment_histories')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('start_date', { ascending: false }),
      supabase
        .from('teacher_additional_duties')
        .select('*, duty_type:additional_duty_types(code, name), academic_year:academic_years(name)')
        .eq('teacher_id', teacherId)
        .order('start_date', { ascending: false }),
      supabase
        .from('sdm_documents')
        .select('*')
        .eq('entity_type', 'GTK')
        .eq('entity_id', teacherId)
        .order('created_at', { ascending: false }),
    ]);

    gtkPayload = {
      teacher: teacherRes.data,
      employmentHistories: historyRes.data || [],
      additionalDuties: dutiesRes.data || [],
      documents: docsRes.data || [],
    };
  }

  const guardianRows = guardiansRes.data || [];
  let guardiansPayload: Record<string, unknown>[] = [];
  if (guardianRows.length > 0) {
    const guardianIds = guardianRows.map((g) => g.id as string);
    const studentIds = Array.from(
      new Set(guardianRows.map((g) => g.student_id as string).filter(Boolean))
    );

    const [{ data: allGuardianDocs }, { data: sharedStudentDocs }] = await Promise.all([
      supabase
        .from('sdm_documents')
        .select('*')
        .eq('entity_type', 'ORANG_TUA')
        .in('entity_id', guardianIds)
        .order('created_at', { ascending: false }),
      studentIds.length > 0
        ? supabase
            .from('student_documents')
            .select('*')
            .in('student_id', studentIds)
            .in('document_type', [...FAMILY_SHARED_STUDENT_DOC_TYPES])
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    guardiansPayload = guardianRows.map((g) => ({
      ...g,
      documents: (allGuardianDocs || []).filter((d) => d.entity_id === g.id),
      sharedStudentDocuments: (sharedStudentDocs || []).filter(
        (d) => d.student_id === g.student_id
      ),
    }));
  }

  return NextResponse.json({
    gtk: gtkPayload,
    guardians: guardiansPayload,
    canManageSdm: hasAnyRole(session, PERMISSIONS.SDM_MANAGE),
  });
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.scope === 'gtk') {
      const parsed = UpdateSelfGtkSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data biodata GTK tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existing, error: findErr } = await supabase
        .from('teachers_staff')
        .select('id, profile_id')
        .eq('id', parsed.data.id)
        .maybeSingle();

      if (findErr || !existing || existing.profile_id !== session.userId) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses untuk mengubah data GTK ini.' },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from('teachers_staff')
        .update({
          nik: cleanStr(parsed.data.nik),
          gender: parsed.data.gender || null,
          birth_place: cleanStr(parsed.data.birth_place),
          birth_date: cleanStr(parsed.data.birth_date),
          address: cleanStr(parsed.data.address),
          rt_rw: cleanStr(parsed.data.rt_rw),
          village: cleanStr(parsed.data.village),
          district: cleanStr(parsed.data.district),
          city: cleanStr(parsed.data.city),
          province: cleanStr(parsed.data.province),
          education_level: cleanStr(parsed.data.education_level),
          major: cleanStr(parsed.data.major),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.id)
        .eq('profile_id', session.userId)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ teacher: data });
    }

    if (body.scope === 'orang-tua') {
      const parsed = UpdateSelfGuardianSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data biodata orang tua/wali tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existing, error: findErr } = await supabase
        .from('student_guardians')
        .select('id, profile_id, student_id, relationship')
        .eq('id', parsed.data.id)
        .maybeSingle();

      if (findErr || !existing || existing.profile_id !== session.userId) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses untuk mengubah data orang tua/wali ini.' },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from('student_guardians')
        .update({
          nik: cleanStr(parsed.data.nik),
          occupation: cleanStr(parsed.data.occupation),
          address: cleanStr(parsed.data.address),
          rt_rw: cleanStr(parsed.data.rt_rw),
          village: cleanStr(parsed.data.village),
          district: cleanStr(parsed.data.district),
          city: cleanStr(parsed.data.city),
          province: cleanStr(parsed.data.province),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.id)
        .eq('profile_id', session.userId)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await syncGuardianToStudent(supabase, {
        student_id: data.student_id,
        relationship: data.relationship,
        full_name: data.full_name,
        nik: data.nik,
        occupation: data.occupation,
        phone: data.phone,
      });

      return NextResponse.json({ guardian: data });
    }

    return NextResponse.json({ error: 'Scope pembaruan tidak dikenal.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui biodata.' },
      { status: 500 }
    );
  }
}
