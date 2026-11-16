import { NextResponse } from 'next/server';
import { connection } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function GET() {
  await connection();
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ faqs: [] });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('faqs')
      .select('id, question, answer')
      .eq('is_published', true)
      .order('sort_order');

    if (error) {
      return NextResponse.json({ faqs: [] });
    }
    return NextResponse.json({ faqs: data || [] });
  } catch {
    return NextResponse.json({ faqs: [] });
  }
}
