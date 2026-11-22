import { NextResponse } from 'next/server';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isR2Configured, uploadBufferToR2 } from '@/lib/storage/r2';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi.' },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'File logo tidak ditemukan.' },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran file logo maksimal 2 MB.' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mime = file.type || EXT_TO_MIME[ext] || '';
    if (!ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        { error: 'Format logo harus PNG, JPG, WEBP, SVG, atau ICO.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let logoUrl = '';

    if (isR2Configured()) {
      try {
        const uploaded = await uploadBufferToR2({
          folder: 'institution-logos',
          fileName: file.name,
          contentType: mime,
          body: buffer,
        });
        if (uploaded.publicUrl && /^https?:\/\//i.test(uploaded.publicUrl)) {
          logoUrl = uploaded.publicUrl;
        }
      } catch {
        // Fallback ke Data URL jika R2 gagal
      }
    }

    if (!logoUrl) {
      logoUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    const supabase = createSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('institution_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: 'Data pengaturan lembaga belum dibuat. Simpan profil lembaga terlebih dahulu.' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('institution_settings')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logo_url: logoUrl, settings: data });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memproses unggahan logo lembaga.' },
      { status: 500 }
    );
  }
}
