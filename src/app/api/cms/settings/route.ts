import { NextResponse } from 'next/server';
import { connection } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getInstitutionSettings } from '@/lib/data/public-queries';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

const SettingsUpdateSchema = z.object({
  institution_type: z.enum(['MADRASAH', 'SEKOLAH']),
  name: z.string().min(3),
  short_name: z.string().optional().nullable(),
  npsn: z.string().optional().nullable(),
  nsm: z.string().optional().nullable(),
  accreditation: z.string().optional().nullable(),
  student_org_label: z.string().min(2),
  head_title_label: z.string().min(2),
  headmaster_name: z.string().optional().nullable(),
  headmaster_greeting: z.string().optional().nullable(),
  history: z.string().optional().nullable(),
  vision: z.string().optional().nullable(),
  mission: z.array(z.string()).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  geofence_lat: z.number().optional().nullable(),
  geofence_lng: z.number().optional().nullable(),
  geofence_radius_meters: z.number().min(20).max(5000),
});

export async function GET() {
  await connection();
  const settings = await getInstitutionSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.CMS);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = SettingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data pengaturan lembaga tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('institution_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { data, error } = await supabase
        .from('institution_settings')
        .insert(parsed.data)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ settings: data });
    }

    const { data, error } = await supabase
      .from('institution_settings')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memperbarui pengaturan lembaga.' },
      { status: 500 }
    );
  }
}
