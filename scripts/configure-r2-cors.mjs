import { existsSync } from 'node:fs';
import {
  GetBucketCorsCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error('Variabel R2 di .env.local belum lengkap.');
  process.exit(1);
}

const extraOrigins = process.argv.slice(2).filter(Boolean);
const allowedOrigins = Array.from(
  new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...(appUrl ? [appUrl.replace(/\/$/, '')] : []),
    ...extraOrigins.map((o) => o.replace(/\/$/, '')),
  ])
);

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function main() {
  console.log(`Memeriksa bucket R2: ${bucketName}...`);
  await client.send(new HeadBucketCommand({ Bucket: bucketName }));
  console.log('✓ Koneksi ke bucket R2 berhasil.');

  console.log('Menerapkan aturan CORS untuk origin:', allowedOrigins);
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );

  const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucketName }));
  console.log('✓ CORS R2 aktif:', JSON.stringify(cors.CORSRules, null, 2));
}

main().catch((err) => {
  console.error('Gagal mengonfigurasi R2:', err?.message || err);
  process.exit(1);
});
