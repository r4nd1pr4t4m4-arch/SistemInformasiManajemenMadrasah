import { NextResponse } from 'next/server';
import { processPaidHolidayJtm } from '@/lib/domain/paid-holiday-jtm';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

/**
 * Endpoint Cron Otomatis (dijalankan pukul 10.00 WIB / 03.00 UTC)
 * untuk memproses JTM otomatis pada Hari Libur Berbayar & mengirim email notifikasi.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date') || undefined;
  const result = await processPaidHolidayJtm(dateParam);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.ADMIN_CONFIRM);
  if (guard.errorResponse) return guard.errorResponse;

  const body = await request.json().catch(() => ({}));
  const dateParam = typeof body?.date === 'string' && body.date ? body.date : undefined;
  const result = await processPaidHolidayJtm(dateParam);
  return NextResponse.json(result);
}
