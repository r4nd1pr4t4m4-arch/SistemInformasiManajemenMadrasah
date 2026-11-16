import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles } from '@/lib/auth/session';

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
