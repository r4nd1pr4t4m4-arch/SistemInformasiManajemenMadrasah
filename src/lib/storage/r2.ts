import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageFolder =
  | 'ppdb'
  | 'cms-posts'
  | 'gallery'
  | 'ebooks'
  | 'letters'
  | 'avatars'
  | 'student-documents';

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 belum dikonfigurasi pada environment variables.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function createR2PresignedUploadUrl(params: {
  folder: StorageFolder;
  fileName: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME belum dikonfigurasi.');
  }

  const sanitizedName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `${params.folder}/${Date.now()}-${sanitizedName}`;

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 300,
  });

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
  const publicUrl = publicBase ? `${publicBase}/${objectKey}` : objectKey;

  return { uploadUrl, objectKey, publicUrl };
}

export async function uploadBufferToR2(params: {
  folder: StorageFolder;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<{ objectKey: string; publicUrl: string }> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME belum dikonfigurasi.');
  }

  const sanitizedName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `${params.folder}/${Date.now()}-${sanitizedName}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: params.contentType,
      Body: params.body,
    })
  );

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
  const publicUrl = publicBase ? `${publicBase}/${objectKey}` : objectKey;

  return { objectKey, publicUrl };
}

export async function getR2ObjectBuffer(objectKey: string): Promise<Uint8Array> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME belum dikonfigurasi.');
  }
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
  if (!res.Body) {
    throw new Error('Objek E-Book kosong di R2.');
  }
  return res.Body.transformToByteArray();
}
