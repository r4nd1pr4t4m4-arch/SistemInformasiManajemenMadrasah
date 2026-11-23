import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { NOTIFICATION_DASHBOARD_ROLES } from '@/lib/notifications/category-access';
import { processPushQueueBatch } from '@/lib/notifications/queue-worker';

const ProcessQueueSchema = z.object({
  campaignId: z.string().uuid().optional(),
  batchSize: z.number().int().min(10).max(60).optional(),
});

/**
 * Endpoint pemroses antrean bertahap (live batch drain) yang dipanggil
 * dari Dashboard Notifikasi agar broadcast 150-250+ perangkat tuntas cepat
 * tanpa menyentuh batas timeout serverless Vercel Hobby.
 */
export async function POST(request: Request) {
  const guard = await requireApiRoles(NOTIFICATION_DASHBOARD_ROLES);
  if (guard.errorResponse) return guard.errorResponse;

  const rawBody = await request.json().catch(() => ({}));
  const parsed = ProcessQueueSchema.safeParse(rawBody);
  const opts = parsed.success ? parsed.data : {};

  const result = await processPushQueueBatch({
    campaignId: opts.campaignId,
    batchSize: opts.batchSize ?? 40,
    maxBatches: 1,
    concurrency: 10,
    timeBudgetMs: 5500,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
