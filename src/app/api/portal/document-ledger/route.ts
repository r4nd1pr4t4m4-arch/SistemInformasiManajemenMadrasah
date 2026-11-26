import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { sanitizeApiError } from '@/lib/security/api-error';

const RegisterLedgerSchema = z.object({
  referenceCode: z.string().trim().min(4).max(120),
  documentType: z.enum([
    'REKAP_ABSENSI',
    'PENILAIAN',
    'SURAT',
    'MUTASI_TABUNGAN',
    'SPP',
    'HONORARIUM',
    'TABUNGAN',
  ]),
  title: z.string().trim().min(2).max(200),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const body = await request.json();
    const parsed = RegisterLedgerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data registrasi ledger tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const normalizedRef = parsed.data.referenceCode.toUpperCase();
    const { error } = await supabase.from('document_verification_ledger').upsert(
      {
        reference_code: normalizedRef,
        document_type: parsed.data.documentType,
        title: parsed.data.title,
        issued_by: session.userId,
        issued_at: new Date().toISOString(),
        metadata: parsed.data.metadata,
        is_revoked: false,
      },
      { onConflict: 'reference_code' }
    );

    if (error) {
      // Toleransi apabila migrasi 0049 belum dijalankan di environment tertentu
      if (error.code === '42P01') {
        return NextResponse.json({ ok: true, skipped: true });
      }
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referenceCode: normalizedRef });
  } catch {
    return NextResponse.json({ error: 'Gagal mencatat dokumen ke ledger.' }, { status: 500 });
  }
}
