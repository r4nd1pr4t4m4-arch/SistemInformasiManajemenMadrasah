import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';
import { sanitizeApiError } from '@/lib/security/api-error';

const PublicTracerSchema = z.object({
  full_name: z.string().trim().min(2),
  nisn: z.string().trim().optional().default(''),
  graduation_year: z.number().int().min(1980).max(2100),
  current_activity: z.enum(['KULIAH', 'BEKERJA', 'WIRAUSAHA', 'PESANTREN', 'LAINNYA']),
  institution_or_company: z.string().trim().optional().default(''),
  major_or_position: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  testimonial: z.string().trim().optional().default(''),
  captcha: z.custom<CaptchaPayload>().optional(),
});

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      stats: { total: 0, kuliah: 0, bekerja: 0, wirausaha: 0, pesantren: 0, lainnya: 0 },
      byYear: [],
      alumni: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('alumni_tracers')
    .select(
      'id, full_name, graduation_year, current_activity, institution_or_company, major_or_position, city, testimonial'
    )
    .order('graduation_year', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });

  const rows = data || [];
  const stats = {
    total: rows.length,
    kuliah: rows.filter((r) => r.current_activity === 'KULIAH').length,
    bekerja: rows.filter((r) => r.current_activity === 'BEKERJA').length,
    wirausaha: rows.filter((r) => r.current_activity === 'WIRAUSAHA').length,
    pesantren: rows.filter((r) => r.current_activity === 'PESANTREN').length,
    lainnya: rows.filter((r) => r.current_activity === 'LAINNYA').length,
  };

  const yearMap = new Map<number, number>();
  for (const r of rows) {
    const y = Number(r.graduation_year || 0);
    if (y > 0) yearMap.set(y, (yearMap.get(y) || 0) + 1);
  }
  const byYear = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year)
    .slice(0, 8);

  return NextResponse.json({ stats, byYear, alumni: rows.slice(0, 60) });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = PublicTracerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data Tracer Study Alumni tidak valid.' }, { status: 400 });
    }

    const captchaRes = await verifyCaptchaToken(parsed.data.captcha, request);
    if (!captchaRes.success) {
      return NextResponse.json(
        {
          error: captchaRes.error || 'Verifikasi keamanan (CAPTCHA) gagal.',
          turnstileUnavailable: Boolean(captchaRes.turnstileUnavailable),
        },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();
    let linkedStudentId: string | null = null;
    if (parsed.data.nisn && /^\d{10}$/.test(parsed.data.nisn)) {
      const { data: st } = await supabase
        .from('students')
        .select('id')
        .eq('nisn', parsed.data.nisn)
        .maybeSingle();
      if (st?.id) linkedStudentId = st.id;
    }

    const { data, error } = await supabase
      .from('alumni_tracers')
      .insert({
        student_id: linkedStudentId,
        full_name: parsed.data.full_name,
        graduation_year: parsed.data.graduation_year,
        current_activity: parsed.data.current_activity,
        institution_or_company: parsed.data.institution_or_company || null,
        major_or_position: parsed.data.major_or_position || null,
        city: parsed.data.city || null,
        testimonial: parsed.data.testimonial || null,
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, message: 'Data Tracer Study berhasil direkam. Terima kasih!' });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan Tracer Study.' }, { status: 500 });
  }
}
