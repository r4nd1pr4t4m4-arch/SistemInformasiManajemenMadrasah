import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DEFAULT_PATHWAY_QUOTAS } from '@/lib/ppdb/pathways';

const PpdbDocumentInput = z.object({
  documentType: z.enum([
    'KK',
    'AKTA_KELAHIRAN',
    'IJAZAH_SKL',
    'PAS_FOTO',
    'SERTIFIKAT_PRESTASI',
    'LAINNYA',
  ]),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
});

const PpdbRegisterSchema = z.object({
  fullName: z.string().min(2),
  nisn: z.string().optional().default(''),
  nik: z.string().min(8),
  gender: z.enum(['L', 'P']),
  birthPlace: z.string().min(2),
  birthDate: z.string().min(4),
  previousSchool: z.string().min(2),
  address: z.string().min(4),
  parentName: z.string().min(2),
  parentPhone: z.string().min(6),
  pathway: z.enum(['DOMISILI', 'AFIRMASI', 'PRESTASI', 'MUTASI', 'REGULER']).default('DOMISILI'),
  targetGrade: z.string().optional().default(''),
  mutationReason: z.string().optional().default(''),
  documents: z.array(PpdbDocumentInput).optional().default([]),
});

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const info = searchParams.get('info');
  const supabase = createSupabaseAdminClient();

  if (info === 'active') {
    const { data: period } = await supabase
      .from('ppdb_periods')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      period: period
        ? {
            ...period,
            pathway_quotas: period.pathway_quotas || DEFAULT_PATHWAY_QUOTAS,
          }
        : null,
    });
  }

  const code = searchParams.get('code')?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { error: 'Masukkan nomor pendaftaran PPDB.' },
      { status: 400 }
    );
  }
  const { data, error } = await supabase
    .from('ppdb_registrations')
    .select(
      'registration_number, full_name, nisn, pathway, previous_school, parent_name, parent_phone, status, admin_notes, created_at, ppdb_documents(document_type, file_name, is_verified)'
    )
    .eq('registration_number', code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: `Nomor pendaftaran ${code} tidak ditemukan.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ registration: data });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = PpdbRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data formulir PPDB belum lengkap atau tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Cari periode PPDB aktif; jika belum ada, buat periode default
    let { data: activePeriod } = await supabase
      .from('ppdb_periods')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!activePeriod) {
      const { data: createdPeriod, error: periodErr } = await supabase
        .from('ppdb_periods')
        .insert({
          name: 'PPDB Tahun Ajaran 2026/2027',
          open_date: '2026-01-01',
          close_date: '2026-12-31',
          is_active: true,
        })
        .select('id')
        .single();

      if (periodErr || !createdPeriod) {
        return NextResponse.json(
          { error: 'Gagal menyiapkan periode PPDB aktif.' },
          { status: 500 }
        );
      }
      activePeriod = createdPeriod;
    }

    const prefix = parsed.data.pathway === 'MUTASI' ? 'MUTASI-2026' : 'PPDB-2026';
    const registrationNumber = `${prefix}-${Math.floor(10000 + Math.random() * 90000)}`;
    const extraMutationNote =
      parsed.data.pathway === 'MUTASI'
        ? [
            parsed.data.targetGrade ? `Kelas Tujuan: ${parsed.data.targetGrade}` : '',
            parsed.data.mutationReason ? `Alasan Mutasi: ${parsed.data.mutationReason}` : '',
          ]
            .filter(Boolean)
            .join(' | ')
        : null;

    const { data: inserted, error: insertErr } = await supabase
      .from('ppdb_registrations')
      .insert({
        period_id: activePeriod.id,
        registration_number: registrationNumber,
        full_name: parsed.data.fullName,
        nisn: parsed.data.nisn || null,
        nik: parsed.data.nik,
        gender: parsed.data.gender,
        birth_place: parsed.data.birthPlace,
        birth_date: parsed.data.birthDate,
        previous_school: parsed.data.previousSchool,
        address: parsed.data.address,
        parent_name: parsed.data.parentName,
        parent_phone: parsed.data.parentPhone,
        pathway: parsed.data.pathway,
        status: 'MENUNGGU_VERIFIKASI',
        admin_notes: extraMutationNote,
      })
      .select('id, registration_number')
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: insertErr?.message || 'Gagal menyimpan pendaftaran.' },
        { status: 500 }
      );
    }

    if (parsed.data.documents.length > 0) {
      const docsPayload = parsed.data.documents.map((d) => ({
        registration_id: inserted.id,
        document_type: d.documentType,
        file_url: d.fileUrl,
        file_name: d.fileName,
      }));
      await supabase.from('ppdb_documents').insert(docsPayload);
    }

    return NextResponse.json({
      registrationNumber: inserted.registration_number,
      registration: {
        registration_number: inserted.registration_number,
        full_name: parsed.data.fullName,
        nisn: parsed.data.nisn || null,
        pathway: parsed.data.pathway,
        previous_school: parsed.data.previousSchool,
        parent_name: parsed.data.parentName,
        parent_phone: parsed.data.parentPhone,
        status: 'MENUNGGU_VERIFIKASI',
        admin_notes: extraMutationNote,
        created_at: new Date().toISOString(),
        documents: parsed.data.documents.map((d) => ({
          label: d.fileName,
          verified: false,
        })),
      },
      message: 'Pendaftaran PPDB berhasil disimpan.',
    });
  } catch (error) {
    console.error('PPDB POST error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses pendaftaran PPDB.' },
      { status: 500 }
    );
  }
}
