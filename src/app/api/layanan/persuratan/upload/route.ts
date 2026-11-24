import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
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
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = String(formData.get('category') || 'SURAT');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Berkas lampiran surat wajib dipilih.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Format berkas harus PDF, JPG, PNG, atau WEBP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran berkas maksimal 5 MB.' },
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
    const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'SURAT';
    const userId = session.userId;
    const fileName = `${safeCategory.toLowerCase()}-${userId.slice(0, 8)}-${Date.now()}.${safeExt}`;

    if (isR2Configured()) {
      const uploaded = await uploadBufferToR2({
        folder: 'letters',
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
      const bucketName = 'letters';
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
      { error: 'Layanan penyimpanan berkas belum terkonfigurasi untuk ukuran > 1.5 MB.' },
      { status: 503 }
    );
  } catch (err) {
    console.error('Upload letter document error:', err);
    return NextResponse.json({ error: 'Gagal mengunggah berkas lampiran surat.' }, { status: 500 });
  }
}
