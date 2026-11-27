import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createR2PresignedUploadUrl, isR2Configured } from '@/lib/storage/r2';
import { PUBLIC_R2_MEDIA_PREFIXES } from '@/lib/storage/r2-url-helper';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import type { AppRole } from '@/types/database';

const PresignSchema = z.object({
  folder: z.enum([
    'ppdb',
    'cms-posts',
    'gallery',
    'ebooks',
    'letters',
    'avatars',
    'student-documents',
    'institution-logos',
  ]),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
});

const IMAGE_ONLY_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const DOC_AND_IMAGE_TYPES = new Set([
  ...IMAGE_ONLY_TYPES,
  'application/pdf',
]);

const FOLDER_ALLOWED_TYPES: Record<z.infer<typeof PresignSchema>['folder'], Set<string>> = {
  ppdb: DOC_AND_IMAGE_TYPES,
  'cms-posts': IMAGE_ONLY_TYPES,
  gallery: new Set([...IMAGE_ONLY_TYPES, 'video/mp4', 'video/webm']),
  'institution-logos': IMAGE_ONLY_TYPES,
  avatars: IMAGE_ONLY_TYPES,
  ebooks: new Set(['application/pdf']),
  letters: DOC_AND_IMAGE_TYPES,
  'student-documents': DOC_AND_IMAGE_TYPES,
};

const FOLDER_PERMISSIONS: Partial<Record<z.infer<typeof PresignSchema>['folder'], readonly AppRole[]>> = {
  'cms-posts': PERMISSIONS.CMS_MANAGE,
  gallery: PERMISSIONS.CMS_MANAGE,
  'institution-logos': PERMISSIONS.CMS_MANAGE,
  ebooks: PERMISSIONS.PERPUSTAKAAN_MANAGE,
  letters: PERMISSIONS.PERSURATAN_MANAGE,
  'student-documents': PERMISSIONS.SISWA_BIODATA_MANAGE,
};

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

    const { folder, contentType } = parsed.data;
    const normalizedType = contentType.trim().toLowerCase();
    const allowedMimeSet = FOLDER_ALLOWED_TYPES[folder];

    if (!allowedMimeSet.has(normalizedType)) {
      return NextResponse.json(
        { error: `Tipe berkas "${normalizedType}" tidak diizinkan untuk folder ${folder}.` },
        { status: 400 }
      );
    }

    if (folder !== 'ppdb') {
      const session = await getCurrentUserWithRoles();
      if (!session) {
        return NextResponse.json(
          { error: 'Silakan login terlebih dahulu untuk mengunggah berkas.' },
          { status: 401 }
        );
      }
      const allowedRoles = FOLDER_PERMISSIONS[folder];
      if (allowedRoles && !hasAnyRole(session, allowedRoles)) {
        return NextResponse.json(
          { error: 'Akses ditolak untuk folder penyimpanan ini.' },
          { status: 403 }
        );
      }
    }

    const result = await createR2PresignedUploadUrl(parsed.data);
    const isPublicMediaFolder = PUBLIC_R2_MEDIA_PREFIXES.some((prefix) =>
      result.objectKey.startsWith(prefix)
    );
    return NextResponse.json({
      ...result,
      publicUrl: isPublicMediaFolder
        ? `/api/public/media?key=${encodeURIComponent(result.objectKey)}`
        : result.publicUrl,
    });
  } catch (error) {
    console.error('Presign R2 error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat presigned URL untuk upload.' },
      { status: 500 }
    );
  }
}
