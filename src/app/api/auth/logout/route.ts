import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

export async function POST() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ ok: true });
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
