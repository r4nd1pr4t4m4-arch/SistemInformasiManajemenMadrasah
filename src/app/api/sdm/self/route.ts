import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  escapeLikePattern,
  FAMILY_SHARED_STUDENT_DOC_TYPES,
  resolveTeacherForProfile,
  syncGuardianToStudent,
  syncSharedBiodataAcrossSelfEntities,
} from '@/lib/sdm/sync';
import {
  nikSchema,
  normalizeThesisKeywords,
  thesisArticleUrlSchema,
} from '@/lib/validation/identity';

const UpdateSelfGtkSchema = z.object({
  scope: z.literal('gtk'),
  id: z.string().uuid(),
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
  last_campus: z.string().optional().nullable(),
  graduation_year: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.coerce
      .number()
      .int('Tahun lulus harus berupa bilangan bulat.')
      .min(1950, 'Tahun lulus minimal 1950.')
      .max(2100, 'Tahun lulus maksimal 2100.')
      .nullable()
  ),
  thesis_title: z.string().optional().nullable(),
  thesis_abstract: z.string().optional().nullable(),
  thesis_keywords: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  thesis_article_url: thesisArticleUrlSchema,
});

const UpdateSelfGuardianSchema = z.object({
  scope: z.literal('orang-tua'),
  id: z.string().uuid(),
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

  const [profileRes, teacherRes, guardiansRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', session.userId)
      .maybeSingle(),
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

  const canonicalFullName = profileRes.data?.full_name || session.fullName;
  const canonicalPhone = profileRes.data?.phone ?? null;
  const canonicalEmail = profileRes.data?.email ?? session.email ?? null;

  const canViewGtk = hasAnyRole(session, PERMISSIONS.GTK_BIODATA_VIEW);
  const canViewOrtu = hasAnyRole(session, PERMISSIONS.ORTU_BIODATA_VIEW);

  const resolvedTeacher = canViewGtk
    ? teacherRes.data ||
    (await resolveTeacherForProfile(supabase, {
      userId: session.userId,
      email: canonicalEmail,
      fullName: canonicalFullName,
      phone: canonicalPhone,
    }))
    : null;

  let gtkPayload: Record<string, unknown> | null = null;
  if (resolvedTeacher) {
    const teacherId = resolvedTeacher.id as string;
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
      teacher: resolvedTeacher,
      employmentHistories: historyRes.data || [],
      additionalDuties: dutiesRes.data || [],
      documents: docsRes.data || [],
    };
  }

  let guardianRows = canViewOrtu ? guardiansRes.data || [] : [];

  // Fallback: jika profile_id belum tertaut pada baris student_guardians tetapi email cocok
  if (canViewOrtu && guardianRows.length === 0 && session.email) {
    const { data: byEmailGuards } = await supabase
      .from('student_guardians')
      .select('*, student:students(id, full_name, nis, nisn, status)')
      .ilike('email', escapeLikePattern(session.email.trim()))
      .is('profile_id', null)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    if (byEmailGuards && byEmailGuards.length > 0) {
      await supabase
        .from('student_guardians')
        .update({ profile_id: session.userId, updated_at: new Date().toISOString() })
        .in(
          'id',
          byEmailGuards.map((g) => g.id as string)
        )
        .is('profile_id', null);
      guardianRows = byEmailGuards;
    }
  }
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

    const sharedSource = [resolvedTeacher, ...guardianRows].filter(Boolean) as Record<
      string,
      unknown
    >[];
    const pickShared = (key: string) => {
      for (const row of sharedSource) {
        const v = row[key];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return null;
    };
    const sharedBiodata = {
      nik: pickShared('nik'),
      address: pickShared('address'),
      rt_rw: pickShared('rt_rw'),
      village: pickShared('village'),
      district: pickShared('district'),
      city: pickShared('city'),
      province: pickShared('province'),
    };

    if (gtkPayload && resolvedTeacher) {
      const tRow = resolvedTeacher as Record<string, unknown>;
      gtkPayload.teacher = {
        ...tRow,
        full_name: canonicalFullName,
        phone: canonicalPhone ?? tRow.phone ?? null,
        email: canonicalEmail ?? tRow.email ?? null,
        nik: tRow.nik || sharedBiodata.nik,
        address: tRow.address || sharedBiodata.address,
        rt_rw: tRow.rt_rw || sharedBiodata.rt_rw,
        village: tRow.village || sharedBiodata.village,
        district: tRow.district || sharedBiodata.district,
        city: tRow.city || sharedBiodata.city,
        province: tRow.province || sharedBiodata.province,
      };
    }

    guardiansPayload = guardianRows.map((g) => ({
      ...g,
      full_name: canonicalFullName,
      phone: canonicalPhone ?? g.phone ?? null,
      email: canonicalEmail ?? g.email ?? null,
      nik: g.nik || sharedBiodata.nik,
      address: g.address || sharedBiodata.address,
      rt_rw: g.rt_rw || sharedBiodata.rt_rw,
      village: g.village || sharedBiodata.village,
      district: g.district || sharedBiodata.district,
      city: g.city || sharedBiodata.city,
      province: g.province || sharedBiodata.province,
      documents: (allGuardianDocs || []).filter((d) => d.entity_id === g.id),
      sharedStudentDocuments: (sharedStudentDocs || []).filter(
        (d) => d.student_id === g.student_id
      ),
    }));
  } else if (gtkPayload && resolvedTeacher) {
    const tRow = resolvedTeacher as Record<string, unknown>;
    gtkPayload.teacher = {
      ...tRow,
      full_name: canonicalFullName,
      phone: canonicalPhone ?? tRow.phone ?? null,
      email: canonicalEmail ?? tRow.email ?? null,
    };
  }

  return NextResponse.json({
    gtk: gtkPayload,
    guardians: guardiansPayload,
    hasDualRole: Boolean(gtkPayload && guardiansPayload.length > 0),
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
          last_campus: cleanStr(parsed.data.last_campus),
          graduation_year: parsed.data.graduation_year ?? null,
          thesis_title: cleanStr(parsed.data.thesis_title),
          thesis_abstract: cleanStr(parsed.data.thesis_abstract),
          ...(parsed.data.thesis_keywords !== undefined
            ? { thesis_keywords: normalizeThesisKeywords(parsed.data.thesis_keywords) }
            : {}),
          thesis_article_url: cleanStr(parsed.data.thesis_article_url),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.id)
        .eq('profile_id', session.userId)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await syncSharedBiodataAcrossSelfEntities(
        supabase,
        session.userId,
        {
          nik: data.nik,
          address: data.address,
          rt_rw: data.rt_rw,
          village: data.village,
          district: data.district,
          city: data.city,
          province: data.province,
        },
        { entityType: 'GTK', entityId: data.id }
      );

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

      await syncSharedBiodataAcrossSelfEntities(
        supabase,
        session.userId,
        {
          nik: data.nik,
          address: data.address,
          rt_rw: data.rt_rw,
          village: data.village,
          district: data.district,
          city: data.city,
          province: data.province,
        },
        { entityType: 'ORANG_TUA', entityId: data.id }
      );

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
