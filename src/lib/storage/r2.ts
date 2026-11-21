import type { S3Client } from '@aws-sdk/client-s3';
import { isR2Configured } from './r2-config';

export { isR2Configured };

export type StorageFolder =
  | 'ppdb'
  | 'cms-posts'
  | 'gallery'
  | 'ebooks'
  | 'letters'
  | 'avatars'
  | 'student-documents';

async function getR2Client(): Promise<S3Client> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 belum dikonfigurasi pada environment variables.');
  }

  const { S3Client: Client } = await import('@aws-sdk/client-s3');
  return new Client({
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

  const client = await getR2Client();
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
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

  const client = await getR2Client();
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
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
  const client = await getR2Client();
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
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

export async function getR2ObjectStream(objectKey: string, range?: string | null) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME belum dikonfigurasi.');
  }
  const client = await getR2Client();
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ...(range ? { Range: range } : {}),
    })
  );
  if (!res.Body) {
    throw new Error('Objek E-Book kosong di R2.');
  }
  return {
    stream: res.Body.transformToWebStream(),
    contentLength: res.ContentLength,
    contentRange: res.ContentRange,
    isPartial: Boolean(range && res.ContentRange),
  };
}
