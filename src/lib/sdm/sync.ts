import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export const FAMILY_SHARED_STUDENT_DOC_TYPES = [
  'KK',
  'KTP_AYAH',
  'KTP_IBU',
  'KTP_WALI',
  'KIP',
  'KKS',
  'PKH',
] as const;

export function guardianRelationshipToStudentDocType(relationship?: string | null): string | null {
  const rel = (relationship || '').toUpperCase();
  if (rel === 'AYAH') return 'KTP_AYAH';
  if (rel === 'IBU') return 'KTP_IBU';
  if (rel === 'WALI') return 'KTP_WALI';
  return null;
}

export function studentDocTypeToGuardianRelationship(docType: string): string | null {
  if (docType === 'KTP_AYAH') return 'AYAH';
  if (docType === 'KTP_IBU') return 'IBU';
  if (docType === 'KTP_WALI') return 'WALI';
  return null;
}

/**
 * Sinkronkan nama & nomor telepon ke tabel `profiles` jika `profile_id` tertaut.
 */
export async function syncBasicProfileFields(
  supabase: AdminClient,
  profileId: string | null | undefined,
  fields: { full_name?: string | null; phone?: string | null }
) {
  if (!profileId) return;
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (fields.full_name && fields.full_name.trim()) {
    payload.full_name = fields.full_name.trim();
  }
  if (fields.phone !== undefined) {
    payload.phone = fields.phone || null;
  }
  await supabase.from('profiles').update(payload).eq('id', profileId);
}

/**
 * Sinkronkan perubahan kontak (full_name, phone, email) dari Halaman Profil
 * ke seluruh entitas SDM tertaut (teachers_staff, students, student_guardians).
 */
export async function syncProfileContactToEntities(
  supabase: AdminClient,
  profileId: string,
  fields: { full_name?: string | null; phone?: string | null; email?: string | null }
) {
  const now = new Date().toISOString();
  const basePayload: Record<string, unknown> = { updated_at: now };
  if (fields.full_name && fields.full_name.trim()) {
    basePayload.full_name = fields.full_name.trim();
  }
  if (fields.phone !== undefined) {
    basePayload.phone = fields.phone || null;
  }
  if (fields.email !== undefined) {
    basePayload.email = fields.email || null;
  }

  await Promise.all([
    supabase.from('teachers_staff').update(basePayload).eq('profile_id', profileId),
    supabase.from('students').update(basePayload).eq('profile_id', profileId),
    supabase.from('student_guardians').update(basePayload).eq('profile_id', profileId),
  ]);

  if (fields.phone !== undefined || fields.full_name) {
    const { data: guardians } = await supabase
      .from('student_guardians')
      .select('student_id, relationship, full_name, nik, occupation, phone')
      .eq('profile_id', profileId);
    for (const g of guardians || []) {
      await syncGuardianToStudent(supabase, g);
    }
  }
}

/**
 * Sinkronkan perubahan pada `student_guardians` -> `students` (father_*, mother_*, guardian_*).
 */
export async function syncGuardianToStudent(
  supabase: AdminClient,
  guardian: {
    student_id: string;
    relationship: string;
    full_name: string;
    nik?: string | null;
    occupation?: string | null;
    phone?: string | null;
  }
) {
  const rel = (guardian.relationship || '').toUpperCase();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rel === 'AYAH') {
    updatePayload.father_name = guardian.full_name;
    updatePayload.father_nik = guardian.nik ?? null;
    updatePayload.father_job = guardian.occupation ?? null;
    updatePayload.father_phone = guardian.phone ?? null;
  } else if (rel === 'IBU') {
    updatePayload.mother_name = guardian.full_name;
    updatePayload.mother_nik = guardian.nik ?? null;
    updatePayload.mother_job = guardian.occupation ?? null;
    updatePayload.mother_phone = guardian.phone ?? null;
  } else {
    updatePayload.guardian_name = guardian.full_name;
    updatePayload.guardian_nik = guardian.nik ?? null;
    updatePayload.guardian_job = guardian.occupation ?? null;
    updatePayload.guardian_phone = guardian.phone ?? null;
  }

  await supabase.from('students').update(updatePayload).eq('id', guardian.student_id);
}

/**
 * Sinkronkan perubahan biodata orang tua di `students` -> baris `student_guardians` yang sudah tertaut.
 * Hanya memperbarui baris yang sudah ada agar tidak menciptakan orphan rows.
 */
export async function syncStudentToGuardians(
  supabase: AdminClient,
  studentId: string,
  fields: {
    father_name?: string | null;
    father_nik?: string | null;
    father_job?: string | null;
    father_phone?: string | null;
    mother_name?: string | null;
    mother_nik?: string | null;
    mother_job?: string | null;
    mother_phone?: string | null;
    guardian_name?: string | null;
    guardian_nik?: string | null;
    guardian_job?: string | null;
    guardian_phone?: string | null;
  }
) {
  const { data: existingGuardians } = await supabase
    .from('student_guardians')
    .select('id, relationship, profile_id')
    .eq('student_id', studentId);

  if (!existingGuardians || existingGuardians.length === 0) return;

  for (const g of existingGuardians) {
    const rel = String(g.relationship || '').toUpperCase();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let shouldUpdate = false;

    if (rel === 'AYAH' && fields.father_name) {
      updatePayload.full_name = fields.father_name;
      updatePayload.nik = fields.father_nik ?? null;
      updatePayload.occupation = fields.father_job ?? null;
      updatePayload.phone = fields.father_phone ?? null;
      shouldUpdate = true;
    } else if (rel === 'IBU' && fields.mother_name) {
      updatePayload.full_name = fields.mother_name;
      updatePayload.nik = fields.mother_nik ?? null;
      updatePayload.occupation = fields.mother_job ?? null;
      updatePayload.phone = fields.mother_phone ?? null;
      shouldUpdate = true;
    } else if (rel === 'WALI' && fields.guardian_name) {
      updatePayload.full_name = fields.guardian_name;
      updatePayload.nik = fields.guardian_nik ?? null;
      updatePayload.occupation = fields.guardian_job ?? null;
      updatePayload.phone = fields.guardian_phone ?? null;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      await supabase.from('student_guardians').update(updatePayload).eq('id', g.id);
      if (g.profile_id) {
        await syncBasicProfileFields(supabase, g.profile_id as string, {
          full_name: updatePayload.full_name as string,
          phone: updatePayload.phone as string | null,
        });
      }
    }
  }
}

/**
 * Sinkronkan dokumen keluarga dari `sdm_documents` (ORANG_TUA) -> `student_documents` (SISWA).
 */
export async function syncGuardianDocToStudent(
  supabase: AdminClient,
  params: {
    guardianId: string;
    documentType: string;
    documentTitle: string | null;
    documentNumber: string | null;
    fileName: string;
    fileUrl: string;
    objectKey: string | null;
    mimeType: string | null;
    fileSize: number | null;
    uploadedBy: string;
  }
) {
  const { data: guardian } = await supabase
    .from('student_guardians')
    .select('student_id, relationship')
    .eq('id', params.guardianId)
    .maybeSingle();

  if (!guardian?.student_id) return;

  let targetStudentDocType: string | null = null;
  if (params.documentType === 'KK') {
    targetStudentDocType = 'KK';
  } else if (params.documentType === 'KTP') {
    targetStudentDocType = guardianRelationshipToStudentDocType(guardian.relationship);
  }

  if (!targetStudentDocType) return;

  const payload = {
    student_id: guardian.student_id,
    document_type: targetStudentDocType,
    document_title: params.documentTitle,
    document_number: params.documentNumber,
    file_name: params.fileName,
    file_url: params.fileUrl,
    object_key: params.objectKey,
    mime_type: params.mimeType,
    file_size: params.fileSize,
    verification_status: 'MENUNGGU',
    uploaded_by: params.uploadedBy,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('student_documents')
    .select('id')
    .eq('student_id', guardian.student_id)
    .eq('document_type', targetStudentDocType)
    .maybeSingle();

  if (existing) {
    await supabase.from('student_documents').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('student_documents').insert(payload);
  }
}

/**
 * Sinkronkan dokumen keluarga dari `student_documents` (SISWA) -> `sdm_documents` (ORANG_TUA).
 */
export async function syncStudentDocToGuardians(
  supabase: AdminClient,
  params: {
    studentId: string;
    documentType: string;
    documentTitle: string | null;
    documentNumber: string | null;
    fileName: string;
    fileUrl: string;
    objectKey: string | null;
    mimeType: string | null;
    fileSize: number | null;
    uploadedBy: string;
  }
) {
  const targetRel = studentDocTypeToGuardianRelationship(params.documentType);
  if (params.documentType !== 'KK' && !targetRel) return;

  let query = supabase
    .from('student_guardians')
    .select('id, relationship')
    .eq('student_id', params.studentId)
    .eq('is_active', true);

  if (targetRel) {
    query = query.eq('relationship', targetRel);
  }

  const { data: guardians } = await query;
  if (!guardians || guardians.length === 0) return;

  const sdmDocType = params.documentType === 'KK' ? 'KK' : 'KTP';

  for (const g of guardians) {
    const { data: existing } = await supabase
      .from('sdm_documents')
      .select('id')
      .eq('entity_type', 'ORANG_TUA')
      .eq('entity_id', g.id)
      .eq('document_type', sdmDocType)
      .maybeSingle();

    const payload = {
      entity_type: 'ORANG_TUA',
      entity_id: g.id,
      document_type: sdmDocType,
      document_title: params.documentTitle,
      document_number: params.documentNumber,
      file_name: params.fileName,
      file_url: params.fileUrl,
      object_key: params.objectKey,
      mime_type: params.mimeType,
      file_size: params.fileSize,
      uploaded_by: params.uploadedBy,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('sdm_documents').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('sdm_documents').insert(payload);
    }
  }
}
