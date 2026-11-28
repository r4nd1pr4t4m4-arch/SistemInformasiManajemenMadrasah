import { NextResponse } from 'next/server';
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/notifications/vapid';

export async function GET() {
  const publicKey = getVapidPublicKey();
  return NextResponse.json(
    {
      configured: isWebPushConfigured(),
      publicKey: publicKey || null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
