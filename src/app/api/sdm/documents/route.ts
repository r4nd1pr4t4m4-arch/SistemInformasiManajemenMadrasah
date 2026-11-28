import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { isR2Configured, uploadBufferToR2 } from '@/lib/storage/r2';
import {
  SHARED_SELF_DOC_TYPES,
  syncGuardianDocToStudent,
  syncPersonalSdmDocAcrossRoles,
  syncStudentDocToGuardians,
} from '@/lib/sdm/sync';
import { sanitizeApiError } from '@/lib/security/api-error';
import { markDocumentReviewAsRevised } from '@/lib/sdm/biodata-reviews';

async function resolveOwnerProfileIdOfSdmEntity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  entityType: string,
  entityId: string
): Promise<string | null> {
  if (entityType === 'GTK') {
    const { data } = await supabase
      .from('teachers_staff')
      .select('profile_id')
      .eq('id', entityId)
      .maybeSingle();
    return (data?.profile_id as string | null) || null;
  }
  if (entityType === 'ORANG_TUA') {
    const { data } = await supabase
      .from('student_guardians')
      .select('profile_id')
      .eq('id', entityId)
      .maybeSingle();
    return (data?.profile_id as string | null) || null;
  }
  return null;
}

async function isSelfOwnerOfSdmEntity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  if (entityType === 'GTK') {
    const { data } = await supabase
      .from('teachers_staff')
      .select('id')
      .eq('id', entityId)
      .eq('profile_id', userId)
      .maybeSingle();
    return Boolean(data);
  }
  if (entityType === 'ORANG_TUA') {
    const { data } = await supabase
      .from('student_guardians')
      .select('id')
      .eq('id', entityId)
      .eq('profile_id', userId)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

async function uploadFileToStorage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  file: File,
  keyPrefix: string
): Promise<{ fileUrl: string; objectKey: string | null }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeExt = file.name.split('.').pop() || 'bin';
  const fileName = `${keyPrefix}-${Date.now()}.${safeExt}`;

  if (isR2Configured()) {
    const uploaded = await uploadBufferToR2({
      folder: 'student-documents',
      fileName,
      contentType: file.type,
      body: buffer,
    });
    return { fileUrl: uploaded.publicUrl, objectKey: uploaded.objectKey };
  }

  const bucketName = 'student-documents';
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucketName)) {
    await supabase.storage.createBucket(bucketName, { public: true });
  }

  const objectKey = `sdm/${fileName}`;
  const { error: uploadErr } = await supabase.storage
    .from(bucketName)
    .upload(objectKey, buffer, { contentType: file.type, upsert: true });

  if (!uploadErr) {
    const { data: pub } = supabase.storage.from(bucketName).getPublicUrl(objectKey);
    return { fileUrl: pub.publicUrl, objectKey };
  }

  if (file.size <= 1.5 * 1024 * 1024) {
    const base64 = buffer.toString('base64');
    return { fileUrl: `data:${file.type};base64,${base64}`, objectKey: null };
  }

  throw new Error('Gagal mengunggah file ke penyimpanan.');
}

export async function POST(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const entityType = String(formData.get('entity_type') || '');
    const entityId = String(formData.get('entity_id') || '');
    const documentType = String(formData.get('document_type') || 'LAINNYA');
    const documentTitle = String(formData.get('document_title') || '').trim() || null;
    const documentNumber = String(formData.get('document_number') || '').trim() || null;

    if (!['GTK', 'ORANG_TUA', 'SISWA', 'ALUMNI'].includes(entityType) || !entityId) {
      return NextResponse.json({ error: 'Target entitas dokumen tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const canManageSdm = hasAnyRole(session, PERMISSIONS.SDM_MANAGE);
    if (!canManageSdm) {
      const isOwner = await isSelfOwnerOfSdmEntity(supabase, session.userId, entityType, entityId);
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki izin untuk mengunggah dokumen ini.' },
          { status: 403 }
        );
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File dokumen wajib dipilih.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Format file harus JPG, PNG, WEBP, atau PDF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5 MB.' }, { status: 400 });
    }

    const { fileUrl, objectKey } = await uploadFileToStorage(
      supabase,
      file,
      `${entityType.toLowerCase()}-${documentType.toLowerCase()}-${entityId.slice(0, 8)}`
    );

    if (entityType === 'SISWA' || entityType === 'ALUMNI') {
      const payload = {
        student_id: entityId,
        document_type: documentType,
        document_title: documentTitle,
        document_number: documentNumber,
        file_name: file.name,
        file_url: fileUrl,
        object_key: objectKey,
        mime_type: file.type,
        file_size: file.size,
        verification_status: 'TERVERIFIKASI',
        uploaded_by: session.userId,
        updated_at: new Date().toISOString(),
      };

      if (documentType !== 'LAINNYA') {
        const { data: existingDoc } = await supabase
          .from('student_documents')
          .select('id')
          .eq('student_id', entityId)
          .eq('document_type', documentType)
          .maybeSingle();

        if (existingDoc) {
          const { data, error } = await supabase
            .from('student_documents')
            .update(payload)
            .eq('id', existingDoc.id)
            .select('*')
            .single();
          if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
          await syncStudentDocToGuardians(supabase, {
            studentId: entityId,
            documentType,
            documentTitle,
            documentNumber,
            fileName: file.name,
            fileUrl,
            objectKey,
            mimeType: file.type,
            fileSize: file.size,
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
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      await syncStudentDocToGuardians(supabase, {
        studentId: entityId,
        documentType,
        documentTitle,
        documentNumber,
        fileName: file.name,
        fileUrl,
        objectKey,
        mimeType: file.type,
        fileSize: file.size,
        uploadedBy: session.userId,
      });
      return NextResponse.json({ document: data }, { status: 201 });
    }

    const isSharedSelfDoc = SHARED_SELF_DOC_TYPES.includes(documentType as 'KTP' | 'KK');
    let savedDoc: Record<string, unknown> | null = null;

    if (isSharedSelfDoc && (entityType === 'GTK' || entityType === 'ORANG_TUA')) {
      const { data: existingSdm } = await supabase
        .from('sdm_documents')
        .select('id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('document_type', documentType)
        .maybeSingle();

      const sdmPayload = {
        entity_type: entityType,
        entity_id: entityId,
        document_type: documentType,
        document_title: documentTitle,
        document_number: documentNumber,
        file_name: file.name,
        file_url: fileUrl,
        object_key: objectKey,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: session.userId,
        updated_at: new Date().toISOString(),
      };

      if (existingSdm) {
        const { data, error } = await supabase
          .from('sdm_documents')
          .update(sdmPayload)
          .eq('id', existingSdm.id)
          .select('*')
          .single();
        if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
        savedDoc = data;
      } else {
        const { data, error } = await supabase
          .from('sdm_documents')
          .insert(sdmPayload)
          .select('*')
          .single();
        if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
        savedDoc = data;
      }
    } else {
      const { data, error } = await supabase
        .from('sdm_documents')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          document_type: documentType,
          document_title: documentTitle,
          document_number: documentNumber,
          file_name: file.name,
          file_url: fileUrl,
          object_key: objectKey,
          mime_type: file.type,
          file_size: file.size,
          uploaded_by: session.userId,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      savedDoc = data;
    }

    if (entityType === 'GTK' || entityType === 'ORANG_TUA') {
      await markDocumentReviewAsRevised(supabase, entityType, entityId, documentType);
    }

    if (entityType === 'ORANG_TUA') {
      await syncGuardianDocToStudent(supabase, {
        guardianId: entityId,
        documentType,
        documentTitle,
        documentNumber,
        fileName: file.name,
        fileUrl,
        objectKey,
        mimeType: file.type,
        fileSize: file.size,
        uploadedBy: session.userId,
      });
    }

    if (isSharedSelfDoc && (entityType === 'GTK' || entityType === 'ORANG_TUA')) {
      const ownerProfileId = await resolveOwnerProfileIdOfSdmEntity(supabase, entityType, entityId);
      if (ownerProfileId) {
        await syncPersonalSdmDocAcrossRoles(supabase, {
          profileId: ownerProfileId,
          sourceEntityType: entityType,
          sourceEntityId: entityId,
          documentType,
          documentTitle,
          documentNumber,
          fileName: file.name,
          fileUrl,
          objectKey,
          mimeType: file.type,
          fileSize: file.size,
          uploadedBy: session.userId,
        });
      }
    }
    return NextResponse.json({ document: savedDoc }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Gagal mengunggah dokumen SDM.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.SDM_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const VerifySchema = z.object({
    id: z.string().uuid(),
    verification_status: z.enum(['MENUNGGU', 'TERVERIFIKASI', 'DITOLAK']),
    verification_notes: z.string().optional().nullable(),
  });

  try {
    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data verifikasi dokumen tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('student_documents')
      .update({
        verification_status: parsed.data.verification_status,
        verification_notes: parsed.data.verification_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ document: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui verifikasi dokumen.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const entityType = request.nextUrl.searchParams.get('entity_type');
  const id = request.nextUrl.searchParams.get('id');
  if (!entityType || !id) {
    return NextResponse.json({ error: 'Parameter entity_type dan id wajib diisi.' }, { status: 400 });
  }

  const table =
    entityType === 'SISWA' || entityType === 'ALUMNI' ? 'student_documents' : 'sdm_documents';

  const supabase = createSupabaseAdminClient();
  const canManageSdm = hasAnyRole(session, PERMISSIONS.SDM_MANAGE);

  if (!canManageSdm) {
    if (table !== 'sdm_documents') {
      return NextResponse.json({ error: 'Anda tidak memiliki izin untuk menghapus dokumen ini.' }, { status: 403 });
    }
    const { data: docRow } = await supabase
      .from('sdm_documents')
      .select('id, entity_type, entity_id')
      .eq('id', id)
      .maybeSingle();

    if (
      !docRow ||
      !(await isSelfOwnerOfSdmEntity(
        supabase,
        session.userId,
        String(docRow.entity_type || ''),
        String(docRow.entity_id || '')
      ))
    ) {
      return NextResponse.json({ error: 'Anda tidak memiliki izin untuk menghapus dokumen ini.' }, { status: 403 });
    }
  }

  const targetSelect =
    table === 'sdm_documents'
      ? 'id, file_url, object_key, entity_type, entity_id, document_type'
      : 'id, file_url, object_key, document_type';
  const { data: targetRow } = await supabase
    .from(table)
    .select(targetSelect)
    .eq('id', id)
    .maybeSingle();
  const target = targetRow as Record<string, unknown> | null;

  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });

  // Hapus salinan dokumen bersama (KTP / KK) milik profile_id yang sama
  if (
    table === 'sdm_documents' &&
    target &&
    SHARED_SELF_DOC_TYPES.includes(String(target.document_type || '') as 'KTP' | 'KK') &&
    (target.entity_type === 'GTK' || target.entity_type === 'ORANG_TUA')
  ) {
    const ownerProfileId = await resolveOwnerProfileIdOfSdmEntity(
      supabase,
      String(target.entity_type),
      String(target.entity_id)
    );
    if (ownerProfileId) {
      const [{ data: teacher }, { data: guardians }] = await Promise.all([
        supabase
          .from('teachers_staff')
          .select('id')
          .eq('profile_id', ownerProfileId)
          .maybeSingle(),
        supabase
          .from('student_guardians')
          .select('id')
          .eq('profile_id', ownerProfileId)
          .eq('is_active', true),
      ]);
      const siblingIds = [
        ...(teacher?.id ? [teacher.id as string] : []),
        ...(guardians || []).map((g) => g.id as string),
      ].filter((sid) => sid !== String(target.entity_id));

      if (siblingIds.length > 0 && target.file_url) {
        await supabase
          .from('sdm_documents')
          .delete()
          .in('entity_id', siblingIds)
          .eq('document_type', String(target.document_type))
          .eq('file_url', String(target.file_url));
      }
    }
  }

  if (target?.object_key) {
    const objectKey = String(target.object_key);
    const [{ count: sdmRefCount }, { count: studentRefCount }] = await Promise.all([
      supabase
        .from('sdm_documents')
        .select('id', { count: 'exact', head: true })
        .eq('object_key', objectKey),
      supabase
        .from('student_documents')
        .select('id', { count: 'exact', head: true })
        .eq('object_key', objectKey),
    ]);
    if ((sdmRefCount || 0) === 0 && (studentRefCount || 0) === 0 && !isR2Configured()) {
      await supabase.storage.from('student-documents').remove([objectKey]);
    }
  }
  return NextResponse.json({ ok: true });
}
