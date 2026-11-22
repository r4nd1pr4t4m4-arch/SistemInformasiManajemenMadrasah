import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import type { AuthenticatedSession } from '@/lib/auth/session';
import type { AppRole } from '@/types/database';
import { isR2Configured } from '@/lib/storage/r2-config';
import {
  syncBasicProfileFields,
  syncStudentDocToGuardians,
  syncStudentToGuardians,
} from '@/lib/sdm/sync';
import { nikSchema, kkSchema, phoneSchema } from '@/lib/validation/identity';

const STAFF_ROLES: AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'KEPALA_TU',
  'STAF_TU',
  'WAKA_KESISWAAN',
];

async function getAllowedStudentIdsForScopedRole(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  session: AuthenticatedSession
): Promise<string[] | null> {
  if (session.roles.some((r) => STAFF_ROLES.includes(r))) {
    return null; // full access
  }

  const allowedIds = new Set<string>();
  const ta = session.teacherAssignments;
  if (ta?.guruWaliStudentIds?.length) {
    ta.guruWaliStudentIds.forEach((id) => allowedIds.add(id));
  }
  if (ta?.homeroomClassroomIds?.length) {
    const { data: homeroomEnr } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .in('classroom_id', ta.homeroomClassroomIds);
    (homeroomEnr || []).forEach((r) => allowedIds.add(r.student_id));
  }
  if (session.roles.includes('ORANG_TUA')) {
    const { data: guardRows } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('profile_id', session.userId)
      .eq('is_active', true);
    (guardRows || []).forEach((g) => allowedIds.add(g.student_id));
  }

  return allowedIds.size > 0 ? Array.from(allowedIds) : [];
}

const DOCUMENT_TYPES = [
  'KK',
  'AKTA_KELAHIRAN',
  'IJAZAH_MI_SD',
  'IJAZAH_RA_TK',
  'KTP_AYAH',
  'KTP_IBU',
  'KTP_WALI',
  'KIP',
  'BPJS_KIS',
  'KKS',
  'PKH',
  'LAINNYA',
] as const;

const BiodataSchema = z.object({
  student_id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(2),
  nis: z.string().optional().nullable(),
  nisn: z.string().optional().nullable(),
  nik: nikSchema,
  kk_number: kkSchema,
  birth_certificate_number: z.string().optional().nullable(),
  gender: z.enum(['L', 'P']).optional().nullable(),
  birth_place: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  child_order: z.coerce.number().int().min(1).max(99).optional().nullable(),
  siblings_count: z.coerce.number().int().min(0).max(99).optional().nullable(),
  phone: phoneSchema,
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  rt_rw: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  previous_school: z.string().optional().nullable(),
  previous_school_npsn: z.string().optional().nullable(),
  kip_number: z.string().optional().nullable(),
  kis_number: z.string().optional().nullable(),
  kks_number: z.string().optional().nullable(),
  pkh_number: z.string().optional().nullable(),
  father_name: z.string().optional().nullable(),
  father_nik: nikSchema,
  father_job: z.string().optional().nullable(),
  father_phone: phoneSchema,
  mother_name: z.string().optional().nullable(),
  mother_nik: nikSchema,
  mother_job: z.string().optional().nullable(),
  mother_phone: phoneSchema,
  guardian_name: z.string().optional().nullable(),
  guardian_nik: nikSchema,
  guardian_job: z.string().optional().nullable(),
  guardian_phone: phoneSchema,
});

const DocumentSaveSchema = z.object({
  student_id: z.string().uuid().optional().nullable(),
  document_type: z.enum(DOCUMENT_TYPES),
  document_title: z.string().optional().nullable(),
  document_number: z.string().optional().nullable(),
  file_name: z.string().min(1),
  file_url: z.string().min(1),
  object_key: z.string().optional().nullable(),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().optional().nullable(),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === '' ? null : v;
  }
  return out as T;
}

async function resolveTargetStudent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  session: AuthenticatedSession,
  requestedStudentId?: string | null
) {
  const isStaff = session.roles.some((r) => STAFF_ROLES.includes(r));

  if (requestedStudentId && isStaff) {
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('id', requestedStudentId)
      .maybeSingle();
    return data;
  }

  const scopedStudentIds = await getAllowedStudentIdsForScopedRole(supabase, session);
  if (scopedStudentIds && scopedStudentIds.length > 0) {
    const targetId =
      requestedStudentId && scopedStudentIds.includes(requestedStudentId)
        ? requestedStudentId
        : scopedStudentIds[0];
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();
    if (data) return data;
  }

  const { data: byProfile } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', session.userId)
    .maybeSingle();
  if (byProfile) return byProfile;

  if (session.email) {
    const { data: byEmail } = await supabase
      .from('students')
      .select('*')
      .ilike('email', session.email)
      .is('profile_id', null)
      .maybeSingle();
    if (byEmail) {
      await supabase
        .from('students')
        .update({ profile_id: session.userId, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id);
      return { ...byEmail, profile_id: session.userId };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SISWA_BIODATA_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const requestedStudentId = request.nextUrl.searchParams.get('studentId');
  const session = guard.session;
  const isStaff = session.roles.some((r) => STAFF_ROLES.includes(r));
  const scopedStudentIds = await getAllowedStudentIdsForScopedRole(supabase, session);

  const student = await resolveTargetStudent(supabase, session, requestedStudentId);

  let documents: unknown[] = [];
  if (student) {
    const { data: docs } = await supabase
      .from('student_documents')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    documents = docs || [];
  }

  let studentsList: unknown[] = [];
  if (isStaff) {
    const { data: list } = await supabase
      .from('students')
      .select('id, full_name, nis, nisn, status')
      .order('full_name', { ascending: true });
    studentsList = list || [];
  } else if (scopedStudentIds && scopedStudentIds.length > 0) {
    const { data: list } = await supabase
      .from('students')
      .select('id, full_name, nis, nisn, status')
      .in('id', scopedStudentIds)
      .order('full_name', { ascending: true });
    studentsList = list || [];
  }

  return NextResponse.json({
    student,
    documents,
    isStaff: isStaff || Boolean(scopedStudentIds && scopedStudentIds.length > 0),
    isOfficialEditor: isStaff,
    studentsList,
    profile: {
      id: session.userId,
      full_name: session.fullName,
      email: session.email,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SISWA_BIODATA_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const raw = await request.json();
    const parsed = BiodataSchema.safeParse(emptyToNull(raw));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data biodata tidak valid.' },
        { status: 400 }
      );
    }

    const { student_id, ...rawFields } = parsed.data;
    const supabase = createSupabaseAdminClient();
    const session = guard.session;
    const isStaff = session.roles.some((r) => STAFF_ROLES.includes(r));
    const existing = await resolveTargetStudent(supabase, session, student_id);

    const fields = isStaff
      ? rawFields
      : (() => {
          const allowed = { ...rawFields } as Record<string, unknown>;
          delete allowed.nis;
          delete allowed.nisn;
          delete allowed.phone;
          delete allowed.email;
          delete allowed.full_name;
          return allowed;
        })();

    if (existing) {
      const { data, error } = await supabase
        .from('students')
        .update({
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await Promise.all([
        isStaff && data.full_name
          ? syncBasicProfileFields(supabase, data.profile_id, {
              full_name: data.full_name,
              phone: data.phone,
            })
          : syncBasicProfileFields(supabase, data.profile_id, {
              phone: data.phone,
            }),
        syncStudentToGuardians(supabase, data.id, fields),
      ]);

      return NextResponse.json({ student: data });
    }

    if (!isStaff) {
      return NextResponse.json(
        {
          error:
            'Data siswa belum tertaut dengan akun Anda. Hubungi Admin/TU untuk menautkan akun ke Buku Induk.',
        },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        ...fields,
        profile_id: null,
        email: rawFields.email || null,
        status: 'AKTIF',
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ student: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan biodata siswa.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SISWA_BIODATA_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const raw = await request.json();
    const parsed = DocumentSaveSchema.safeParse(emptyToNull(raw));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Metadata dokumen tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const session = guard.session;
    const student = await resolveTargetStudent(supabase, session, parsed.data.student_id);

    if (!student) {
      return NextResponse.json(
        { error: 'Silakan simpan Biodata Siswa terlebih dahulu sebelum mengunggah dokumen.' },
        { status: 400 }
      );
    }

    const payload = {
      student_id: student.id,
      document_type: parsed.data.document_type,
      document_title: parsed.data.document_title || null,
      document_number: parsed.data.document_number || null,
      file_name: parsed.data.file_name,
      file_url: parsed.data.file_url,
      object_key: parsed.data.object_key || null,
      mime_type: parsed.data.mime_type || null,
      file_size: parsed.data.file_size || null,
      verification_status: 'MENUNGGU',
      uploaded_by: session.userId,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.document_type !== 'LAINNYA') {
      const { data: existingDoc } = await supabase
        .from('student_documents')
        .select('id')
        .eq('student_id', student.id)
        .eq('document_type', parsed.data.document_type)
        .maybeSingle();

      if (existingDoc) {
        const { data, error } = await supabase
          .from('student_documents')
          .update(payload)
          .eq('id', existingDoc.id)
          .select('*')
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await syncStudentDocToGuardians(supabase, {
          studentId: student.id,
          documentType: parsed.data.document_type,
          documentTitle: parsed.data.document_title || null,
          documentNumber: parsed.data.document_number || null,
          fileName: parsed.data.file_name,
          fileUrl: parsed.data.file_url,
          objectKey: parsed.data.object_key || null,
          mimeType: parsed.data.mime_type || null,
          fileSize: parsed.data.file_size || null,
          uploadedBy: session.userId,
        });
        return NextResponse.json({ document: data });
      }
    }

    const { data, error } = await supabase
      .from('student_documents')
      .insert(payload)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await syncStudentDocToGuardians(supabase, {
      studentId: student.id,
      documentType: parsed.data.document_type,
      documentTitle: parsed.data.document_title || null,
      documentNumber: parsed.data.document_number || null,
      fileName: parsed.data.file_name,
      fileUrl: parsed.data.file_url,
      objectKey: parsed.data.object_key || null,
      mimeType: parsed.data.mime_type || null,
      fileSize: parsed.data.file_size || null,
      uploadedBy: session.userId,
    });
    return NextResponse.json({ document: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan dokumen siswa.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SISWA_BIODATA_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID dokumen wajib diisi.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const session = guard.session;
  const isStaff = session.roles.some((r) => STAFF_ROLES.includes(r));

  const { data: targetDoc } = await supabase
    .from('student_documents')
    .select('id, student_id, object_key')
    .eq('id', id)
    .maybeSingle();

  if (!isStaff) {
    const student = await resolveTargetStudent(supabase, session, targetDoc?.student_id);
    if (!student || !targetDoc || targetDoc.student_id !== student.id) {
      return NextResponse.json({ error: 'Data siswa atau dokumen tidak ditemukan.' }, { status: 404 });
    }
    const { error } = await supabase
      .from('student_documents')
      .delete()
      .eq('id', id)
      .eq('student_id', student.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from('student_documents').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (targetDoc?.object_key) {
    const [{ count: sdmRefCount }, { count: studentRefCount }] = await Promise.all([
      supabase
        .from('sdm_documents')
        .select('id', { count: 'exact', head: true })
        .eq('object_key', targetDoc.object_key),
      supabase
        .from('student_documents')
        .select('id', { count: 'exact', head: true })
        .eq('object_key', targetDoc.object_key),
    ]);
    if ((sdmRefCount || 0) === 0 && (studentRefCount || 0) === 0 && !isR2Configured()) {
      await supabase.storage.from('student-documents').remove([targetDoc.object_key]);
    }
  }
  return NextResponse.json({ ok: true });
}
