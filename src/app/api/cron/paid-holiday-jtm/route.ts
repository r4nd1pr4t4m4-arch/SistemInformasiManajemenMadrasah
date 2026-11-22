import { NextResponse } from 'next/server';
import { processPaidHolidayJtm } from '@/lib/domain/paid-holiday-jtm';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Endpoint Cron Otomatis (dijalankan pukul 10.00 WIB / 03.00 UTC)
 * untuk memproses JTM otomatis pada Hari Libur Berbayar & mengirim email notifikasi.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date') || undefined;
  if (dateParam && !ISO_DATE_RE.test(dateParam)) {
    return NextResponse.json({ error: 'Format tanggal harus YYYY-MM-DD.' }, { status: 400 });
  }
  const result = await processPaidHolidayJtm(dateParam);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.ADMIN_CONFIRM);
  if (guard.errorResponse) return guard.errorResponse;

  const body = await request.json().catch(() => ({}));
  const dateParam = typeof body?.date === 'string' && body.date ? body.date : undefined;
  if (dateParam && !ISO_DATE_RE.test(dateParam)) {
    return NextResponse.json({ error: 'Format tanggal harus YYYY-MM-DD.' }, { status: 400 });
  }
  const result = await processPaidHolidayJtm(dateParam);
  return NextResponse.json(result);
}
