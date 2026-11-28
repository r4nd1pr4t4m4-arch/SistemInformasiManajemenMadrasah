import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DEFAULT_PATHWAY_QUOTAS } from '@/lib/ppdb/pathways';
import {
  loadPpdbPathwayDocuments,
  syncPpdbPeriodsBySchedule,
} from '@/lib/ppdb/period-sync';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyPpdbNewRegistration } from '@/lib/notifications/event-hooks';

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
  parentPhone: z
    .string()
    .regex(/^\d{10,13}$/, 'No. WhatsApp Orang Tua / Wali harus berupa 10 hingga 13 digit angka.'),
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
    const [{ activePeriod, announcementPeriod, todayWib }, pathwayDocuments, { data: classroomRows }] =
      await Promise.all([
        syncPpdbPeriodsBySchedule(supabase),
        loadPpdbPathwayDocuments(supabase),
        supabase.from('classrooms').select('grade_level').order('grade_level'),
      ]);

    const pathwayCounts: Record<string, number> = {
      DOMISILI: 0,
      AFIRMASI: 0,
      PRESTASI: 0,
      MUTASI: 0,
    };
    if (activePeriod?.id) {
      const { data: regRows } = await supabase
        .from('ppdb_registrations')
        .select('pathway')
        .eq('period_id', activePeriod.id);
      for (const r of regRows || []) {
        const key = String(r.pathway || '').toUpperCase();
        if (key in pathwayCounts) pathwayCounts[key] += 1;
      }
    }

    const dbGrades = Array.from(
      new Set((classroomRows || []).map((c) => String(c.grade_level).trim()).filter(Boolean))
    );
    const gradeLevels = dbGrades.length > 0 ? dbGrades : ['VII', 'VIII', 'IX'];

    return NextResponse.json({
      period: activePeriod
        ? {
            ...activePeriod,
            pathway_quotas: activePeriod.pathway_quotas || DEFAULT_PATHWAY_QUOTAS,
            pathway_counts: pathwayCounts,
          }
        : null,
      announcementPeriod: announcementPeriod
        ? {
            id: announcementPeriod.id,
            name: announcementPeriod.name,
            open_date: announcementPeriod.open_date,
            close_date: announcementPeriod.close_date,
            announcement_date: announcementPeriod.announcement_date,
            is_announcement_open: announcementPeriod.is_announcement_open,
          }
        : null,
      pathwayDocuments,
      todayWib,
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

    // Sinkronkan status periode secara otomatis berdasarkan tanggal buka & tutup (WIB)
    // Mutasi Masuk tetap dibuka sepanjang tahun
    const isMutasi = parsed.data.pathway === 'MUTASI';
    const { activePeriod } = await syncPpdbPeriodsBySchedule(supabase);

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

    await notifyPpdbNewRegistration({
      registrationId: inserted.id,
      applicantName: parsed.data.fullName,
      registrationNumber: inserted.registration_number,
    });

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

const PpdbRevisionSchema = z.object({
  registrationNumber: z.string().trim().min(5),
  nik: z.string().regex(/^\d{16}$/, 'NIK konfirmasi harus berupa 16 digit angka.'),
  documentType: z.enum([
    'KK',
    'AKTA_KELAHIRAN',
    'IJAZAH_SKL',
    'PAS_FOTO',
    'SERTIFIKAT_PRESTASI',
    'LAINNYA',
  ]),
  fileUrl: z.string().trim().min(4),
  fileName: z.string().trim().min(2),
});

export async function PATCH(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = PpdbRevisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data berkas perbaikan tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: reg } = await supabase
      .from('ppdb_registrations')
      .select('id, status, nik')
      .eq('registration_number', parsed.data.registrationNumber.toUpperCase())
      .maybeSingle();

    if (!reg || reg.nik !== parsed.data.nik) {
      return NextResponse.json(
        { error: 'Nomor pendaftaran atau NIK tidak cocok.' },
        { status: 403 }
      );
    }
    if (reg.status !== 'PERLU_PERBAIKAN') {
      return NextResponse.json(
        { error: 'Upload berkas perbaikan hanya tersedia untuk pendaftar berstatus PERLU PERBAIKAN.' },
        { status: 400 }
      );
    }

    await supabase.from('ppdb_documents').insert({
      registration_id: reg.id,
      document_type: parsed.data.documentType,
      file_url: parsed.data.fileUrl,
      file_name: parsed.data.fileName,
      is_verified: false,
    });

    await supabase
      .from('ppdb_registrations')
      .update({
        status: 'MENUNGGU_VERIFIKASI',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reg.id);

    return NextResponse.json({
      ok: true,
      message: 'Berkas perbaikan berhasil dikirim. Status kembali ke MENUNGGU VERIFIKASI.',
    });
  } catch {
    return NextResponse.json({ error: 'Gagal mengirim berkas perbaikan.' }, { status: 500 });
  }
}
