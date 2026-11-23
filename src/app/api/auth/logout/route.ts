import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { ROLE_CACHE_COOKIE } from '@/lib/auth/role-cache';
import { STEP_UP_COOKIE } from '@/lib/auth/step-up';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ROLE_CACHE_COOKIE);
  res.cookies.delete(STEP_UP_COOKIE);
  if (!isSupabaseServerConfigured()) {
    return res;
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return res;
}
