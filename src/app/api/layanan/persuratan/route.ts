import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

export const LETTER_CATEGORIES = [
  'SURAT_KETERANGAN_AKTIF',
  'SURAT_MUTASI',
  'SURAT_TUGAS',
  'SURAT_UNDANGAN',
  'SURAT_EDARAN',
  'SURAT_KEPUTUSAN',
  'SURAT_REKOMENDASI',
  'SURAT_IZIN',
  'SURAT_PANGGILAN',
  'SURAT_PENGANTAR',
  'LAINNYA',
] as const;

const LEGACY_CATEGORIES = new Set([
  'SURAT_KETERANGAN_AKTIF',
  'SURAT_MUTASI',
  'SURAT_TUGAS',
  'SURAT_UNDANGAN',
  'SURAT_EDARAN',
  'LAINNYA',
]);

const LetterPriorityEnum = z.enum(['BIASA', 'PENTING', 'SEGERA', 'RAHASIA']);
const LetterStatusEnum = z.enum(['DRAFT', 'TERBIT', 'DIARSIPKAN', 'DIBATALKAN']);

const BaseLetterPayloadSchema = z.object({
  direction: z.enum(['MASUK', 'KELUAR']),
  category: z.enum(LETTER_CATEGORIES),
  letter_number: z.string().trim().min(2, 'Nomor surat minimal 2 karakter.'),
  letter_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal surat harus YYYY-MM-DD.'),
  subject: z.string().trim().min(3, 'Perihal surat minimal 3 karakter.'),
  counterparty: z.string().trim().optional().nullable(),
  student_id: z.string().uuid().optional().nullable().or(z.literal('')),
  teacher_id: z.string().uuid().optional().nullable().or(z.literal('')),
  summary: z.string().trim().optional().nullable(),
  file_url: z.string().trim().optional().nullable(),
  classification_code: z.string().trim().max(40).optional().nullable(),
  priority: LetterPriorityEnum.optional().default('BIASA'),
  status: LetterStatusEnum.optional().default('TERBIT'),
  signatory_name: z.string().trim().max(120).optional().nullable(),
  signatory_title: z.string().trim().max(120).optional().nullable(),
  attachment_name: z.string().trim().max(200).optional().nullable(),
});

const UpdateLetterPayloadSchema = BaseLetterPayloadSchema.extend({
  id: z.string().uuid('ID arsip surat tidak valid.'),
});

const LETTER_SELECT_QUERY =
  '*, student:students(id, full_name, nis, nisn, nik, gender, birth_place, birth_date, father_name, mother_name, address, status), teacher:teachers_staff(id, full_name, nip, nuptk, gender, staff_type, employment_status, education_level, major)';

function normalizeOptionalUuid(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isMissingColumnOrCheckError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    err.code === '23514' ||
    msg.includes('column') ||
    msg.includes('letters_category_check')
  );
}

export async function GET(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ letters: [], institution: null });
  }

  const supabase = createSupabaseAdminClient();
  const sp = request.nextUrl.searchParams;
  const direction = sp.get('direction')?.toUpperCase();
  const category = sp.get('category')?.toUpperCase();
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  const studentId = sp.get('studentId');
  const teacherId = sp.get('teacherId');

  let query = supabase
    .from('letters')
    .select(LETTER_SELECT_QUERY)
    .order('letter_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (direction === 'MASUK' || direction === 'KELUAR') {
    query = query.eq('direction', direction);
  }
  if (category && category !== 'ALL') {
    query = query.eq('category', category);
  }
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    query = query.gte('letter_date', startDate);
  }
  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    query = query.lte('letter_date', endDate);
  }
  if (studentId) {
    query = query.eq('student_id', studentId);
  }
  if (teacherId) {
    query = query.eq('teacher_id', teacherId);
  }

  const [{ data, error }, { data: inst }] = await Promise.all([
    query,
    supabase
      .from('institution_settings')
      .select(
        'institution_type, name, short_name, address, phone, email, website_url, headmaster_name, head_title_label, nsm, npsn, accreditation, logo_url'
      )
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  }

  return NextResponse.json({
    letters: data || [],
    institution: inst || null,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = BaseLetterPayloadSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data surat tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const normalizedNumber = parsed.data.letter_number.trim();

    // Cek duplikasi nomor surat pada arah yang sama
    const { data: existingDup } = await supabase
      .from('letters')
      .select('id, letter_number, direction')
      .eq('direction', parsed.data.direction)
      .ilike('letter_number', normalizedNumber.replace(/[\\%_]/g, '\\$&'))
      .limit(1)
      .maybeSingle();

    if (existingDup) {
      return NextResponse.json(
        {
          error: `Nomor surat "${normalizedNumber}" sudah terdaftar pada arsip surat ${parsed.data.direction.toLowerCase()}.`,
        },
        { status: 409 }
      );
    }

    const corePayload = {
      direction: parsed.data.direction,
      category: parsed.data.category,
      letter_number: normalizedNumber,
      letter_date: parsed.data.letter_date,
      subject: parsed.data.subject.trim(),
      counterparty: normalizeOptionalText(parsed.data.counterparty),
      student_id: normalizeOptionalUuid(parsed.data.student_id),
      teacher_id: normalizeOptionalUuid(parsed.data.teacher_id),
      summary: normalizeOptionalText(parsed.data.summary),
      file_url: normalizeOptionalText(parsed.data.file_url),
      created_by: guard.session.userId,
    };

    const enrichedPayload = {
      ...corePayload,
      classification_code: normalizeOptionalText(parsed.data.classification_code),
      priority: parsed.data.priority || 'BIASA',
      status: parsed.data.status || 'TERBIT',
      signatory_name: normalizeOptionalText(parsed.data.signatory_name),
      signatory_title: normalizeOptionalText(parsed.data.signatory_title),
      attachment_name: normalizeOptionalText(parsed.data.attachment_name),
    };

    let { data, error } = await supabase
      .from('letters')
      .insert(enrichedPayload)
      .select(LETTER_SELECT_QUERY)
      .single();

    if (error && isMissingColumnOrCheckError(error)) {
      const fallbackCategory = LEGACY_CATEGORIES.has(parsed.data.category)
        ? parsed.data.category
        : 'LAINNYA';
      const fallbackRes = await supabase
        .from('letters')
        .insert({
          ...corePayload,
          category: fallbackCategory,
        })
        .select(LETTER_SELECT_QUERY)
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    return NextResponse.json({ letter: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan arsip surat.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateLetterPayloadSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data pembaruan surat tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const normalizedNumber = parsed.data.letter_number.trim();

    // Cek duplikasi nomor surat selain surat yang sedang diedit
    const { data: existingDup } = await supabase
      .from('letters')
      .select('id, letter_number')
      .eq('direction', parsed.data.direction)
      .ilike('letter_number', normalizedNumber.replace(/[\\%_]/g, '\\$&'))
      .neq('id', parsed.data.id)
      .limit(1)
      .maybeSingle();

    if (existingDup) {
      return NextResponse.json(
        {
          error: `Nomor surat "${normalizedNumber}" sudah digunakan oleh arsip surat ${parsed.data.direction.toLowerCase()} lainnya.`,
        },
        { status: 409 }
      );
    }

    const coreUpdate = {
      direction: parsed.data.direction,
      category: parsed.data.category,
      letter_number: normalizedNumber,
      letter_date: parsed.data.letter_date,
      subject: parsed.data.subject.trim(),
      counterparty: normalizeOptionalText(parsed.data.counterparty),
      student_id: normalizeOptionalUuid(parsed.data.student_id),
      teacher_id: normalizeOptionalUuid(parsed.data.teacher_id),
      summary: normalizeOptionalText(parsed.data.summary),
      file_url: normalizeOptionalText(parsed.data.file_url),
    };

    const enrichedUpdate = {
      ...coreUpdate,
      classification_code: normalizeOptionalText(parsed.data.classification_code),
      priority: parsed.data.priority || 'BIASA',
      status: parsed.data.status || 'TERBIT',
      signatory_name: normalizeOptionalText(parsed.data.signatory_name),
      signatory_title: normalizeOptionalText(parsed.data.signatory_title),
      attachment_name: normalizeOptionalText(parsed.data.attachment_name),
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('letters')
      .update(enrichedUpdate)
      .eq('id', parsed.data.id)
      .select(LETTER_SELECT_QUERY)
      .single();

    if (error && isMissingColumnOrCheckError(error)) {
      const fallbackCategory = LEGACY_CATEGORIES.has(parsed.data.category)
        ? parsed.data.category
        : 'LAINNYA';
      const fallbackRes = await supabase
        .from('letters')
        .update({
          ...coreUpdate,
          category: fallbackCategory,
        })
        .eq('id', parsed.data.id)
        .select(LETTER_SELECT_QUERY)
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    return NextResponse.json({ letter: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui arsip surat.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    let id = request.nextUrl.searchParams.get('id')?.trim() || '';
    if (!id) {
      const body = await request.json().catch(() => null);
      id = typeof body?.id === 'string' ? body.id.trim() : '';
    }

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'ID arsip surat tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('letters').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus arsip surat.' }, { status: 500 });
  }
}
