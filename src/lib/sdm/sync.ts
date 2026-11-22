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

export const SHARED_SELF_DOC_TYPES = ['KTP', 'KK'] as const;

/**
 * Sinkronkan biodata bersama (NIK & alamat domisili) antar entitas milik satu profile_id
 * (teachers_staff <-> student_guardians <-> students).
 */
export async function syncSharedBiodataAcrossSelfEntities(
  supabase: AdminClient,
  profileId: string,
  fields: {
    nik?: string | null;
    address?: string | null;
    rt_rw?: string | null;
    village?: string | null;
    district?: string | null;
    city?: string | null;
    province?: string | null;
  },
  exclude?: { entityType: 'GTK' | 'ORANG_TUA'; entityId?: string }
) {
  const now = new Date().toISOString();
  const sharedPayload: Record<string, unknown> = {
    nik: fields.nik ?? null,
    address: fields.address ?? null,
    rt_rw: fields.rt_rw ?? null,
    village: fields.village ?? null,
    district: fields.district ?? null,
    city: fields.city ?? null,
    province: fields.province ?? null,
    updated_at: now,
  };

  if (exclude?.entityType !== 'GTK') {
    await supabase.from('teachers_staff').update(sharedPayload).eq('profile_id', profileId);
  }

  const { data: guardians } = await supabase
    .from('student_guardians')
    .select('id, student_id, relationship, full_name, nik, occupation, phone')
    .eq('profile_id', profileId)
    .eq('is_active', true);

  for (const g of guardians || []) {
    if (exclude?.entityType === 'ORANG_TUA' && exclude.entityId === g.id) {
      continue;
    }
    await supabase.from('student_guardians').update(sharedPayload).eq('id', g.id);
    await syncGuardianToStudent(supabase, {
      student_id: g.student_id,
      relationship: g.relationship,
      full_name: g.full_name,
      nik: fields.nik ?? null,
      occupation: g.occupation,
      phone: g.phone,
    });
  }
}

/**
 * Cari dan tautkan otomatis baris `teachers_staff` untuk user yang login:
 * 1) Cocokkan `profile_id = userId`
 * 2) Fallback: jika `profile_id IS NULL`, cocokkan `email` (case-insensitive)
 * 3) Fallback: jika masih belum ketemu, cocokkan unik `phone` atau `full_name` (exact) dengan `profile_id IS NULL`
 */
export async function resolveTeacherForProfile(
  supabase: AdminClient,
  params: {
    userId: string;
    email?: string | null;
    fullName?: string | null;
    phone?: string | null;
  }
): Promise<Record<string, unknown> | null> {
  const { data: byProfile } = await supabase
    .from('teachers_staff')
    .select('*')
    .eq('profile_id', params.userId)
    .limit(1)
    .maybeSingle();

  if (byProfile) return byProfile as Record<string, unknown>;

  let matched: Record<string, unknown> | null = null;

  if (params.email) {
    const { data: byEmail } = await supabase
      .from('teachers_staff')
      .select('*')
      .ilike('email', params.email.trim())
      .is('profile_id', null)
      .limit(2);
    if (byEmail && byEmail.length === 1) {
      matched = byEmail[0] as Record<string, unknown>;
    }
  }

  if (!matched && params.phone && params.phone.trim()) {
    const { data: byPhone } = await supabase
      .from('teachers_staff')
      .select('*')
      .eq('phone', params.phone.trim())
      .is('profile_id', null)
      .limit(2);
    if (byPhone && byPhone.length === 1) {
      matched = byPhone[0] as Record<string, unknown>;
    }
  }

  if (!matched && params.fullName && params.fullName.trim()) {
    const { data: byName } = await supabase
      .from('teachers_staff')
      .select('*')
      .ilike('full_name', params.fullName.trim())
      .is('profile_id', null)
      .limit(2);
    if (byName && byName.length === 1) {
      matched = byName[0] as Record<string, unknown>;
    }
  }

  if (matched?.id) {
    await supabase
      .from('teachers_staff')
      .update({
        profile_id: params.userId,
        email: (matched.email as string | null) || params.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matched.id)
      .is('profile_id', null);
    return {
      ...matched,
      profile_id: params.userId,
      email: (matched.email as string | null) || params.email || null,
    };
  }

  return null;
}

/**
 * Sinkronkan dokumen pribadi bersama (KTP / KK) antar GTK dan Orang Tua/Wali
 * milik profile_id yang sama, serta ke student_documents anak terkait.
 */
export async function syncPersonalSdmDocAcrossRoles(
  supabase: AdminClient,
  params: {
    profileId: string;
    sourceEntityType: 'GTK' | 'ORANG_TUA';
    sourceEntityId: string;
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
  if (!SHARED_SELF_DOC_TYPES.includes(params.documentType as 'KTP' | 'KK')) return;

  const [{ data: teacher }, { data: guardians }] = await Promise.all([
    supabase.from('teachers_staff').select('id').eq('profile_id', params.profileId).maybeSingle(),
    supabase
      .from('student_guardians')
      .select('id')
      .eq('profile_id', params.profileId)
      .eq('is_active', true),
  ]);

  const targets: Array<{ entityType: 'GTK' | 'ORANG_TUA'; entityId: string }> = [];
  if (
    teacher?.id &&
    !(params.sourceEntityType === 'GTK' && params.sourceEntityId === teacher.id)
  ) {
    targets.push({ entityType: 'GTK', entityId: teacher.id as string });
  }
  for (const g of guardians || []) {
    if (!(params.sourceEntityType === 'ORANG_TUA' && params.sourceEntityId === g.id)) {
      targets.push({ entityType: 'ORANG_TUA', entityId: g.id as string });
    }
  }

  const now = new Date().toISOString();
  for (const target of targets) {
    const { data: existing } = await supabase
      .from('sdm_documents')
      .select('id')
      .eq('entity_type', target.entityType)
      .eq('entity_id', target.entityId)
      .eq('document_type', params.documentType)
      .maybeSingle();

    const payload = {
      entity_type: target.entityType,
      entity_id: target.entityId,
      document_type: params.documentType,
      document_title: params.documentTitle,
      document_number: params.documentNumber,
      file_name: params.fileName,
      file_url: params.fileUrl,
      object_key: params.objectKey,
      mime_type: params.mimeType,
      file_size: params.fileSize,
      uploaded_by: params.uploadedBy,
      updated_at: now,
    };

    if (existing) {
      await supabase.from('sdm_documents').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('sdm_documents').insert(payload);
    }

    if (target.entityType === 'ORANG_TUA') {
      await syncGuardianDocToStudent(supabase, {
        guardianId: target.entityId,
        documentType: params.documentType,
        documentTitle: params.documentTitle,
        documentNumber: params.documentNumber,
        fileName: params.fileName,
        fileUrl: params.fileUrl,
        objectKey: params.objectKey,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
        uploadedBy: params.uploadedBy,
      });
    }
  }
}
