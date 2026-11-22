import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { isR2Configured, uploadBufferToR2 } from '@/lib/storage/r2';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.SISWA_BIODATA_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const docType = String(formData.get('document_type') || 'DOKUMEN');

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
      return NextResponse.json(
        { error: 'Ukuran file maksimal 5 MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    const safeExt = mimeToExt[file.type] || 'bin';
    const safeDocType = docType.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'DOKUMEN';
    const userId = guard.session.userId;
    const fileName = `${safeDocType.toLowerCase()}-${userId.slice(0, 8)}-${Date.now()}.${safeExt}`;

    if (isR2Configured()) {
      const uploaded = await uploadBufferToR2({
        folder: 'student-documents',
        fileName,
        contentType: file.type,
        body: buffer,
      });
      return NextResponse.json({
        fileUrl: uploaded.publicUrl,
        objectKey: uploaded.objectKey,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
    }

    if (isSupabaseAdminConfigured()) {
      const supabase = createSupabaseAdminClient();
      const bucketName = 'student-documents';
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some((b) => b.name === bucketName)) {
        await supabase.storage.createBucket(bucketName, { public: true });
      }

      const objectKey = `${userId}/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from(bucketName)
        .upload(objectKey, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pub } = supabase.storage.from(bucketName).getPublicUrl(objectKey);
        return NextResponse.json({
          fileUrl: pub.publicUrl,
          objectKey,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });
      }
    }

    if (file.size <= 1.5 * 1024 * 1024) {
      const base64 = buffer.toString('base64');
      return NextResponse.json({
        fileUrl: `data:${file.type};base64,${base64}`,
        objectKey: null,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
    }

    return NextResponse.json(
      { error: 'Layanan penyimpanan file belum terkonfigurasi untuk file > 1.5 MB.' },
      { status: 503 }
    );
  } catch (err) {
    console.error('Upload student document error:', err);
    return NextResponse.json({ error: 'Gagal mengunggah scan dokumen.' }, { status: 500 });
  }
}
