import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createR2PresignedUploadUrl, isR2Configured } from '@/lib/storage/r2';

const PresignSchema = z.object({
  folder: z.enum([
    'ppdb',
    'cms-posts',
    'gallery',
    'ebooks',
    'letters',
    'avatars',
    'student-documents',
  ]),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'Cloudflare R2 belum dikonfigurasi pada server.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = PresignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data upload tidak valid', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await createR2PresignedUploadUrl(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Presign R2 error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat presigned URL untuk upload.' },
      { status: 500 }
    );
  }
}
