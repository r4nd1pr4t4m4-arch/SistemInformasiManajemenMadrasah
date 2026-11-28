import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { isR2Configured, uploadBufferToR2 } from '@/lib/storage/r2';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.BK_KASUS_ACCESS);
  if (guard.errorResponse) return guard.errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = String(formData.get('category') || 'BK_EVIDENCE');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File gambar bukti wajib dipilih.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Format gambar harus PNG, JPG, JPEG, atau WEBP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran gambar maksimal 1,5 MB per file.' },
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
    };
    const safeExt = mimeToExt[file.type] || 'jpg';
    const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'bk';
    const userId = guard.session.userId;
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const fileName = `${safeCategory.toLowerCase()}-${userId.slice(0, 8)}-${Date.now()}-${randomSuffix}.${safeExt}`;

    if (isR2Configured()) {
      const uploaded = await uploadBufferToR2({
        folder: 'bk-evidence',
        fileName,
        contentType: file.type,
        body: buffer,
      });
      return NextResponse.json({
        url: uploaded.publicUrl,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      });
    }

    if (isSupabaseAdminConfigured()) {
      const supabase = createSupabaseAdminClient();
      const bucketName = 'bk-evidence';
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
          url: pub.publicUrl,
          name: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }
    }

    // Fallback data URL karena batas ukuran <= 1.5 MB
    const base64 = buffer.toString('base64');
    return NextResponse.json({
      url: `data:${file.type};base64,${base64}`,
      name: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (err) {
    console.error('Upload BK evidence error:', err);
    return NextResponse.json({ error: 'Gagal mengunggah gambar bukti.' }, { status: 500 });
  }
}
