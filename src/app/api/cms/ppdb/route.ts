import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'MENUNGGU_VERIFIKASI',
    'TERVERIFIKASI',
    'PERLU_PERBAIKAN',
    'LULUS',
    'CADANGAN',
    'TIDAK_LULUS',
  ]),
  admin_notes: z.string().optional().nullable(),
});

const SyncSchema = z.object({
  action: z.literal('SYNC_TO_STUDENT'),
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).optional(),
});

const ToggleDocVerifySchema = z.object({
  action: z.literal('TOGGLE_DOC_VERIFY'),
  document_id: z.string().uuid(),
  is_verified: z.boolean(),
});

type PpdbDocumentRow = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  is_verified: boolean;
};

type PpdbRegistrationRow = {
  id: string;
  registration_number: string;
  full_name: string;
  nisn: string | null;
  nik: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  previous_school: string | null;
  address: string;
  parent_name: string;
  parent_phone: string;
  pathway: string | null;
  status: string;
  synced_student_id: string | null;
  ppdb_documents?: PpdbDocumentRow[];
};

function mapPpdbDocToStudentDoc(doc: PpdbDocumentRow): {
  document_type: string;
  document_title: string | null;
} {
  switch (doc.document_type) {
    case 'KK':
      return { document_type: 'KK', document_title: null };
    case 'AKTA_KELAHIRAN':
      return { document_type: 'AKTA_KELAHIRAN', document_title: null };
    case 'IJAZAH_SKL':
      return { document_type: 'IJAZAH_MI_SD', document_title: null };
    case 'PAS_FOTO':
      return { document_type: 'LAINNYA', document_title: 'Pas Foto PPDB' };
    case 'SERTIFIKAT_PRESTASI':
      return { document_type: 'LAINNYA', document_title: 'Sertifikat Prestasi PPDB' };
    default:
      return {
        document_type: 'LAINNYA',
        document_title: doc.file_name || 'Dokumen PPDB / Mutasi',
      };
  }
}

async function syncSingleRegistrationToStudent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  reg: PpdbRegistrationRow,
  actorUserId: string
): Promise<{ studentId: string; syncedDocs: number; created: boolean }> {
  let targetStudentId = reg.synced_student_id;
  let created = false;

  if (!targetStudentId && reg.nisn) {
    const { data: byNisn } = await supabase
      .from('students')
      .select('id')
      .eq('nisn', reg.nisn)
      .maybeSingle();
    if (byNisn) targetStudentId = byNisn.id;
  }

  if (!targetStudentId && reg.nik) {
    const { data: byNik } = await supabase
      .from('students')
      .select('id')
      .eq('nik', reg.nik)
      .maybeSingle();
    if (byNik) targetStudentId = byNik.id;
  }

  const entryYear = new Date().getFullYear();
  const biodataPayload = {
    full_name: reg.full_name,
    nisn: reg.nisn || null,
    nik: reg.nik || null,
    gender: reg.gender,
    birth_place: reg.birth_place || null,
    birth_date: reg.birth_date || null,
    address: reg.address || null,
    previous_school: reg.previous_school || null,
    guardian_name: reg.parent_name || null,
    guardian_phone: reg.parent_phone || null,
    entry_year: entryYear,
    status: 'AKTIF' as const,
    updated_at: new Date().toISOString(),
  };

  if (targetStudentId) {
    const { error: updErr } = await supabase
      .from('students')
      .update(biodataPayload)
      .eq('id', targetStudentId);
    if (updErr) throw new Error(updErr.message);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('students')
      .insert(biodataPayload)
      .select('id')
      .single();
    if (insErr || !inserted) {
      throw new Error(insErr?.message || 'Gagal membuat data siswa pada Buku Induk.');
    }
    targetStudentId = inserted.id;
    created = true;
  }

  let syncedDocs = 0;
  const ppdbDocs = reg.ppdb_documents || [];
  if (ppdbDocs.length > 0 && targetStudentId) {
    const { data: existingStudentDocs } = await supabase
      .from('student_documents')
      .select('id, document_type, file_url')
      .eq('student_id', targetStudentId);

    const existingList = existingStudentDocs || [];

    for (const doc of ppdbDocs) {
      const mapped = mapPpdbDocToStudentDoc(doc);
      const verificationStatus = doc.is_verified ? 'TERVERIFIKASI' : 'MENUNGGU';
      const fileName = doc.file_name || `${doc.document_type}.pdf`;

      if (mapped.document_type !== 'LAINNYA') {
        const match = existingList.find((e) => e.document_type === mapped.document_type);
        if (match) {
          if (match.file_url !== doc.file_url) {
            await supabase
              .from('student_documents')
              .update({
                file_name: fileName,
                file_url: doc.file_url,
                verification_status: verificationStatus,
                uploaded_by: actorUserId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', match.id);
            syncedDocs++;
          }
        } else {
          await supabase.from('student_documents').insert({
            student_id: targetStudentId,
            document_type: mapped.document_type,
            document_title: mapped.document_title,
            file_name: fileName,
            file_url: doc.file_url,
            verification_status: verificationStatus,
            uploaded_by: actorUserId,
          });
          syncedDocs++;
        }
      } else {
        const alreadySameUrl = existingList.some((e) => e.file_url === doc.file_url);
        if (!alreadySameUrl) {
          await supabase.from('student_documents').insert({
            student_id: targetStudentId,
            document_type: 'LAINNYA',
            document_title: mapped.document_title,
            file_name: fileName,
            file_url: doc.file_url,
            verification_status: verificationStatus,
            uploaded_by: actorUserId,
          });
          syncedDocs++;
        }
      }
    }
  }

  await supabase
    .from('ppdb_registrations')
    .update({
      synced_student_id: targetStudentId,
      synced_at: new Date().toISOString(),
      synced_by: actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reg.id);

  return { studentId: targetStudentId!, syncedDocs, created };
}

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ registrations: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ppdb_registrations')
    .select('*, ppdb_documents(id, document_type, file_url, file_name, is_verified)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ registrations: data || [] });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data status PPDB tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const updatePayload: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.admin_notes !== undefined) {
      updatePayload.admin_notes = parsed.data.admin_notes;
    }

    const { data, error } = await supabase
      .from('ppdb_registrations')
      .update(updatePayload)
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ registration: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status PPDB.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_PPDB_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();

    if (body?.action === 'TOGGLE_DOC_VERIFY') {
      const parsedToggle = ToggleDocVerifySchema.safeParse(body);
      if (!parsedToggle.success) {
        return NextResponse.json({ error: 'Data verifikasi dokumen tidak valid.' }, { status: 400 });
      }
      const supabase = createSupabaseAdminClient();
      const { data: updatedDoc, error: docErr } = await supabase
        .from('ppdb_documents')
        .update({ is_verified: parsedToggle.data.is_verified })
        .eq('id', parsedToggle.data.document_id)
        .select('id, is_verified')
        .single();
      if (docErr) return NextResponse.json({ error: sanitizeApiError(docErr) }, { status: 500 });
      return NextResponse.json({ ok: true, document: updatedDoc });
    }

    const parsed = SyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Permintaan sinkronisasi PPDB tidak valid.' }, { status: 400 });
    }

    const targetIds = Array.from(
      new Set([
        ...(parsed.data.id ? [parsed.data.id] : []),
        ...(parsed.data.ids || []),
      ])
    );

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal 1 pendaftar berstatus LULUS.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: regs, error: fetchErr } = await supabase
      .from('ppdb_registrations')
      .select('*, ppdb_documents(id, document_type, file_url, file_name, is_verified)')
      .in('id', targetIds);

    if (fetchErr) return NextResponse.json({ error: sanitizeApiError(fetchErr) }, { status: 500 });

    const rows = (regs || []) as PpdbRegistrationRow[];
    const lulusRows = rows.filter((r) => r.status === 'LULUS');
    if (lulusRows.length === 0) {
      return NextResponse.json(
        { error: 'Hanya calon siswa dengan status LULUS yang dapat disinkronkan ke Buku Induk Siswa.' },
        { status: 400 }
      );
    }

    let syncedCount = 0;
    let totalDocsSynced = 0;
    const results: Array<{ registrationId: string; studentId: string; created: boolean; syncedDocs: number }> = [];

    for (const reg of lulusRows) {
      const res = await syncSingleRegistrationToStudent(supabase, reg, guard.session.userId);
      syncedCount++;
      totalDocsSynced += res.syncedDocs;
      results.push({
        registrationId: reg.id,
        studentId: res.studentId,
        created: res.created,
        syncedDocs: res.syncedDocs,
      });
    }

    return NextResponse.json({
      ok: true,
      syncedCount,
      skippedCount: rows.length - lulusRows.length,
      totalDocsSynced,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Gagal menyinkronkan data PPDB ke Buku Induk Siswa.' },
      { status: 500 }
    );
  }
}
