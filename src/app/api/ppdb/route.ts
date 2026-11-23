import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DEFAULT_PATHWAY_QUOTAS } from '@/lib/ppdb/pathways';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';
import { sanitizeApiError } from '@/lib/security/api-error';

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
  nisn: z.string().regex(/^\d{10}$/, 'NISN harus berupa 10 digit angka.'),
  nik: z.string().regex(/^\d{16}$/, 'NIK harus berupa 16 digit angka.'),
  gender: z.enum(['L', 'P']),
  birthPlace: z.string().min(2),
  birthDate: z.string().min(4),
  previousSchool: z.string().min(2),
  address: z.string().min(6),
  parentName: z.string().min(2),
  parentPhone: z.string().regex(/^\d{12}$/, 'No. WhatsApp Orang Tua / Wali harus berupa 12 digit angka.'),
  pathway: z.enum(['DOMISILI', 'AFIRMASI', 'PRESTASI', 'MUTASI', 'REGULER']).default('DOMISILI'),
  targetGrade: z.string().optional().default(''),
  mutationReason: z.string().optional().default(''),
  documents: z.array(PpdbDocumentInput).optional().default([]),
  captcha: z.custom<CaptchaPayload>().optional(),
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
    const [{ data: period }, { data: classroomRows }] = await Promise.all([
      supabase
        .from('ppdb_periods')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      supabase.from('classrooms').select('grade_level').order('grade_level'),
    ]);

    const dbGrades = Array.from(
      new Set((classroomRows || []).map((c) => String(c.grade_level).trim()).filter(Boolean))
    );
    const gradeLevels = dbGrades.length > 0 ? dbGrades : ['VII', 'VIII', 'IX'];

    return NextResponse.json({
      period: period
        ? {
            ...period,
            pathway_quotas: period.pathway_quotas || DEFAULT_PATHWAY_QUOTAS,
          }
        : null,
      gradeLevels,
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
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
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

    const captchaResult = await verifyCaptchaToken(parsed.data.captcha, request);
    if (!captchaResult.success) {
      return NextResponse.json(
        {
          error: captchaResult.error || 'Verifikasi keamanan (CAPTCHA) gagal.',
          turnstileUnavailable: Boolean(captchaResult.turnstileUnavailable),
        },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Pastikan ada periode PPDB aktif untuk jalur reguler; Mutasi Masuk tetap dibuka sepanjang tahun
    const isMutasi = parsed.data.pathway === 'MUTASI';
    const { data: activePeriod } = await supabase
      .from('ppdb_periods')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!activePeriod && !isMutasi) {
      return NextResponse.json(
        { error: 'Saat ini tidak ada periode pendaftaran PPDB yang aktif.' },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const prefix = isMutasi ? `MUTASI-${currentYear}` : `PPDB-${currentYear}`;
    const extraMutationNote = isMutasi
      ? [
          parsed.data.targetGrade ? `Kelas Tujuan: ${parsed.data.targetGrade}` : '',
          parsed.data.mutationReason ? `Alasan Mutasi: ${parsed.data.mutationReason}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
      : null;

    let inserted: { id: string; registration_number: string } | null = null;
    let insertErr: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const registrationNumber = `${prefix}-${crypto.randomInt(100000, 1000000)}`;
      const res = await supabase
        .from('ppdb_registrations')
        .insert({
          period_id: activePeriod?.id ?? null,
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

      inserted = res.data;
      insertErr = res.error;
      if (!insertErr || insertErr.code !== '23505') {
        break;
      }
    }

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
