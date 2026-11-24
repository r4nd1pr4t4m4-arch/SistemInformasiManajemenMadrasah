import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';
import { resolveTeacherForProfile } from '@/lib/sdm/sync';
import { notifyUserDirect } from '@/lib/notifications/event-hooks';

const CreateDispositionSchema = z.object({
  letter_id: z.string().uuid('Surat masuk wajib dipilih.'),
  assigned_to_teacher_id: z.string().uuid('Pejabat / GTK penerima disposisi wajib dipilih.'),
  instruction: z.string().trim().min(3, 'Instruksi disposisi wajib diisi.'),
  notes: z.string().trim().optional().nullable(),
  priority: z.enum(['BIASA', 'PENTING', 'SEGERA', 'RAHASIA']).optional().default('BIASA'),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
});

const UpdateDispositionSchema = z.object({
  id: z.string().uuid('ID disposisi tidak valid.'),
  status: z.enum(['DITERUSKAN', 'DIBACA', 'DITINDAKLANJUTI', 'SELESAI']),
  completion_notes: z.string().trim().optional().nullable(),
});

const DISPOSITION_SELECT_QUERY =
  '*, letter:letters(id, direction, category, letter_number, letter_date, subject, counterparty, summary, file_url, attachment_name, priority), assignee:teachers_staff(id, full_name, nip, staff_type, profile_id)';

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ dispositions: [] });
  }

  const supabase = createSupabaseAdminClient();
  const scope = request.nextUrl.searchParams.get('scope') || '';
  const letterId = request.nextUrl.searchParams.get('letter_id') || '';

  const isGlobalViewer = hasAnyRole(session, [
    ...PERMISSIONS.PERSURATAN_VIEW,
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_HUMAS',
    'WAKA_SARPRAS',
  ]);

  let query = supabase
    .from('letter_dispositions')
    .select(DISPOSITION_SELECT_QUERY)
    .order('created_at', { ascending: false })
    .limit(300);

  if (letterId) {
    query = query.eq('letter_id', letterId);
  }

  if (!isGlobalViewer || scope === 'personal') {
    const teacher = await resolveTeacherForProfile(supabase, {
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
    });

    if (!teacher?.id) {
      return NextResponse.json({ dispositions: [] });
    }
    query = query.eq('assigned_to_teacher_id', teacher.id);
  }

  const { data, error } = await query;
  if (error) {
    // Jika tabel letter_dispositions belum dimigrasikan pada DB remote, kembalikan array kosong dengan aman
    return NextResponse.json({ dispositions: [] });
  }

  return NextResponse.json({ dispositions: data || [] });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const canCreate = hasAnyRole(session, [
    ...PERMISSIONS.PERSURATAN_MANAGE,
    'KEPALA_LEMBAGA',
  ]);
  if (!canCreate) {
    return NextResponse.json(
      { error: 'Hanya Kepala Lembaga atau Tata Usaha yang dapat membuat disposisi surat.' },
      { status: 403 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreateDispositionSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data disposisi tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('letter_dispositions')
      .insert({
        letter_id: parsed.data.letter_id,
        assigned_to_teacher_id: parsed.data.assigned_to_teacher_id,
        assigned_by: session.userId,
        assigned_by_name: session.fullName || session.email || 'Kepala Lembaga / TU',
        instruction: parsed.data.instruction.trim(),
        notes: parsed.data.notes?.trim() || null,
        priority: parsed.data.priority || 'BIASA',
        due_date: parsed.data.due_date?.trim() || null,
        status: 'DITERUSKAN',
      })
      .select(DISPOSITION_SELECT_QUERY)
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    const assignee = Array.isArray(data.assignee) ? data.assignee[0] : data.assignee;
    const letter = Array.isArray(data.letter) ? data.letter[0] : data.letter;

    if (assignee?.profile_id) {
      await notifyUserDirect({
        userId: String(assignee.profile_id),
        categoryKey: 'PERPUSTAKAAN_SURAT',
        title: `Disposisi Surat Masuk Baru (${parsed.data.priority || 'BIASA'})`,
        body: `Instruksi: "${parsed.data.instruction}" untuk surat No. ${
          letter?.letter_number || '-'
        } (${letter?.subject || 'Surat Masuk'}).`,
        url: '/portal/gtk/persuratan',
        dedupeKey: `disp-new-${data.id}`,
        createdBy: session.userId,
      });
    }

    return NextResponse.json({ disposition: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan disposisi surat masuk.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateDispositionSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data pembaruan disposisi tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('letter_dispositions')
      .select('*, assignee:teachers_staff(id, full_name, profile_id), letter:letters(letter_number, subject)')
      .eq('id', parsed.data.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Data disposisi tidak ditemukan.' }, { status: 404 });
    }

    const isAdminOrKamad = hasAnyRole(session, [
      ...PERMISSIONS.PERSURATAN_MANAGE,
      'KEPALA_LEMBAGA',
    ]);
    const assignee = Array.isArray(existing.assignee) ? existing.assignee[0] : existing.assignee;
    const isAssignee = assignee?.profile_id === session.userId;

    if (!isAdminOrKamad && !isAssignee) {
      // Fallback: cek via resolveTeacherForProfile
      const resolvedTeacher = await resolveTeacherForProfile(supabase, {
        userId: session.userId,
        email: session.email,
        fullName: session.fullName,
      });
      if (!resolvedTeacher || resolvedTeacher.id !== existing.assigned_to_teacher_id) {
        return NextResponse.json(
          { error: 'Anda tidak berhak memperbarui disposisi ini.' },
          { status: 403 }
        );
      }
    }

    const isCompleted = parsed.data.status === 'SELESAI';
    const { data, error } = await supabase
      .from('letter_dispositions')
      .update({
        status: parsed.data.status,
        completion_notes: parsed.data.completion_notes?.trim() ?? existing.completion_notes,
        completed_at: isCompleted ? new Date().toISOString() : existing.completed_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.id)
      .select(DISPOSITION_SELECT_QUERY)
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    // Jika selesai ditindaklanjuti, kirim notifikasi ke pemberi disposisi
    if (isCompleted && existing.assigned_by && existing.assigned_by !== session.userId) {
      const letter = Array.isArray(existing.letter) ? existing.letter[0] : existing.letter;
      await notifyUserDirect({
        userId: String(existing.assigned_by),
        categoryKey: 'PERPUSTAKAAN_SURAT',
        title: 'Disposisi Surat Masuk Selesai Ditindaklanjuti',
        body: `${assignee?.full_name || 'GTK'} telah menyelesaikan disposisi surat "${
          letter?.subject || '-'
        }".${parsed.data.completion_notes ? ` Laporan: ${parsed.data.completion_notes}` : ''}`,
        url: '/portal/layanan/persuratan',
        dedupeKey: `disp-done-${existing.id}`,
        createdBy: session.userId,
      });
    }

    return NextResponse.json({ disposition: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status disposisi.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const canDelete = hasAnyRole(session, [
    ...PERMISSIONS.PERSURATAN_MANAGE,
    'KEPALA_LEMBAGA',
  ]);
  if (!canDelete) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'ID disposisi tidak valid.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('letter_dispositions').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, id });
}
