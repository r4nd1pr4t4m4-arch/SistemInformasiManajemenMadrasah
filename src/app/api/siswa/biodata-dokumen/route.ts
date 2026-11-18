import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import type { AppRole } from '@/types/database';

const STAFF_ROLES: AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'KEPALA_TU',
  'STAF_TU',
  'WAKA_KESISWAAN',
];

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
  nik: z.string().optional().nullable(),
  kk_number: z.string().optional().nullable(),
  birth_certificate_number: z.string().optional().nullable(),
  gender: z.enum(['L', 'P']).optional().nullable(),
  birth_place: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  child_order: z.coerce.number().int().min(1).max(30).optional().nullable(),
  siblings_count: z.coerce.number().int().min(0).max(30).optional().nullable(),
  phone: z.string().optional().nullable(),
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
  father_nik: z.string().optional().nullable(),
  father_job: z.string().optional().nullable(),
  father_phone: z.string().optional().nullable(),
  mother_name: z.string().optional().nullable(),
  mother_nik: z.string().optional().nullable(),
  mother_job: z.string().optional().nullable(),
  mother_phone: z.string().optional().nullable(),
  guardian_name: z.string().optional().nullable(),
  guardian_nik: z.string().optional().nullable(),
  guardian_job: z.string().optional().nullable(),
  guardian_phone: z.string().optional().nullable(),
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
  userId: string,
  userEmail: string | null,
  roles: AppRole[],
  requestedStudentId?: string | null
) {
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));

  if (requestedStudentId && isStaff) {
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('id', requestedStudentId)
      .maybeSingle();
    return data;
  }

  const { data: byProfile } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle();
  if (byProfile) return byProfile;

  if (userEmail) {
    const { data: byEmail } = await supabase
      .from('students')
      .select('*')
      .ilike('email', userEmail)
      .is('profile_id', null)
      .maybeSingle();
    if (byEmail) {
      await supabase
        .from('students')
        .update({ profile_id: userId, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id);
      return { ...byEmail, profile_id: userId };
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

  const student = await resolveTargetStudent(
    supabase,
    session.userId,
    session.email,
    session.roles,
    requestedStudentId
  );

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
  }

  return NextResponse.json({
    student,
    documents,
    isStaff,
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

    const { student_id, ...fields } = parsed.data;
    const supabase = createSupabaseAdminClient();
    const session = guard.session;
    const existing = await resolveTargetStudent(
      supabase,
      session.userId,
      session.email,
      session.roles,
      student_id
    );

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
      return NextResponse.json({ student: data });
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        ...fields,
        profile_id: session.userId,
        email: fields.email || session.email,
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
    const student = await resolveTargetStudent(
      supabase,
      session.userId,
      session.email,
      session.roles,
      parsed.data.student_id
    );

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
        return NextResponse.json({ document: data });
      }
    }

    const { data, error } = await supabase
      .from('student_documents')
      .insert(payload)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  if (!isStaff) {
    const student = await resolveTargetStudent(
      supabase,
      session.userId,
      session.email,
      session.roles
    );
    if (!student) {
      return NextResponse.json({ error: 'Data siswa tidak ditemukan.' }, { status: 404 });
    }
    const { error } = await supabase
      .from('student_documents')
      .delete()
      .eq('id', id)
      .eq('student_id', student.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from('student_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
