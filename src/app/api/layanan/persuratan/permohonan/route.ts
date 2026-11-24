import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { sanitizeApiError } from '@/lib/security/api-error';
import { escapeLikePattern, resolveTeacherForProfile } from '@/lib/sdm/sync';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import { notifyStudentFamilyEvent, notifyUserDirect } from '@/lib/notifications/event-hooks';
import {
  formatLetterCategoryLabel,
  generateSuggestedLetterNumber,
  getDefaultClassificationCode,
} from '@/lib/domain/persuratan-agenda-pdf';
import { LETTER_CATEGORIES } from '../route';

const CreateLetterRequestSchema = z.object({
  category: z.enum(LETTER_CATEGORIES),
  subject: z.string().trim().min(3, 'Perihal permohonan minimal 3 karakter.'),
  purpose: z.string().trim().min(5, 'Keperluan / alasan pengajuan minimal 5 karakter.'),
  counterparty: z.string().trim().optional().nullable(),
  student_id: z.string().uuid().optional().nullable().or(z.literal('')),
  teacher_id: z.string().uuid().optional().nullable().or(z.literal('')),
  leave_type: z.enum(['SAKIT', 'IZIN', 'DISPENSASI']).optional().nullable(),
  leave_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  leave_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  attachment_url: z.string().trim().optional().nullable(),
  attachment_name: z.string().trim().optional().nullable(),
});

const ReviewLetterRequestSchema = z.object({
  id: z.string().uuid('ID permohonan surat tidak valid.'),
  action: z.enum(['DIVERIFIKASI_TU', 'DISETUJUI', 'DITOLAK']),
  reviewer_notes: z.string().trim().optional().nullable(),
  letter_number: z.string().trim().optional().nullable(),
  signatory_name: z.string().trim().optional().nullable(),
  signatory_title: z.string().trim().optional().nullable(),
});

const REQUEST_SELECT_QUERY =
  '*, student:students(id, full_name, nis, nisn, gender, birth_place, birth_date, father_name, mother_name, address, status), teacher:teachers_staff(id, full_name, nip, nuptk, staff_type, employment_status, education_level, major), issued_letter:letters(*, student:students(id, full_name, nis, nisn, gender, birth_place, birth_date, father_name, mother_name, address, status), teacher:teachers_staff(id, full_name, nip, nuptk, staff_type, employment_status, education_level, major))';

const LETTER_SELECT_QUERY =
  '*, student:students(id, full_name, nis, nisn, gender, birth_place, birth_date, father_name, mother_name, address, status), teacher:teachers_staff(id, full_name, nip, nuptk, staff_type, employment_status, education_level, major)';

async function resolveUserContext(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentUserWithRoles>>>
) {
  let student: Record<string, unknown> | null = null;
  let children: Array<Record<string, unknown>> = [];
  let teacher: Record<string, unknown> | null = null;

  if (session.roles.includes('SISWA')) {
    const { data: st } = await supabase
      .from('students')
      .select('id, full_name, nis, nisn, gender, birth_place, birth_date, father_name, mother_name, address, status')
      .eq('profile_id', session.userId)
      .maybeSingle();
    if (st) student = st;
  }

  if (session.roles.includes('ORANG_TUA')) {
    const { data: guards } = await supabase
      .from('student_guardians')
      .select(
        'id, relationship, is_primary, student:students(id, full_name, nis, nisn, gender, birth_place, birth_date, father_name, mother_name, address, status)'
      )
      .eq('profile_id', session.userId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    let guardianRows = guards || [];
    if (guardianRows.length === 0 && session.email) {
      const { data: byEmail } = await supabase
        .from('student_guardians')
        .select(
          'id, relationship, is_primary, student:students(id, full_name, nis, nisn, gender, birth_place, birth_date, father_name, mother_name, address, status)'
        )
        .ilike('email', escapeLikePattern(session.email.trim()))
        .is('profile_id', null)
        .eq('is_active', true);

      if (byEmail && byEmail.length > 0) {
        await supabase
          .from('student_guardians')
          .update({ profile_id: session.userId, updated_at: new Date().toISOString() })
          .in(
            'id',
            byEmail.map((g) => g.id as string)
          );
        guardianRows = byEmail;
      }
    }

    children = guardianRows
      .map((g) => (Array.isArray(g.student) ? g.student[0] : g.student) as Record<string, unknown> | null)
      .filter((s): s is Record<string, unknown> => Boolean(s));
  }

  if (hasAnyRole(session, PERMISSIONS.GTK_PERSONAL_VIEW)) {
    const resolved = await resolveTeacherForProfile(supabase, {
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
    });
    if (resolved) {
      teacher = resolved as unknown as Record<string, unknown>;
    }
  }

  return { student, children, teacher };
}

export async function GET(request: NextRequest) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      requests: [],
      myLetters: [],
      identity: { student: null, children: [], teacher: null },
      institution: null,
    });
  }

  const supabase = createSupabaseAdminClient();
  const isAdminOrReviewer = hasAnyRole(session, [
    ...PERMISSIONS.PERSURATAN_VIEW,
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'WAKA_HUMAS',
  ]);
  const scope = request.nextUrl.searchParams.get('scope') || '';

  const [identity, { data: inst }] = await Promise.all([
    resolveUserContext(supabase, session),
    supabase
      .from('institution_settings')
      .select(
        'institution_type, name, short_name, address, phone, email, website_url, headmaster_name, head_title_label, nsm, npsn, accreditation, logo_url'
      )
      .limit(1)
      .maybeSingle(),
  ]);

  const studentIds = new Set<string>();
  if (identity.student?.id) studentIds.add(String(identity.student.id));
  for (const child of identity.children) {
    if (child.id) studentIds.add(String(child.id));
  }
  const teacherId = identity.teacher?.id ? String(identity.teacher.id) : null;

  // 1. Ambil daftar permohonan surat (letter_requests)
  let requestsData: unknown[] = [];
  if (isAdminOrReviewer && scope !== 'personal') {
    const { data, error } = await supabase
      .from('letter_requests')
      .select(REQUEST_SELECT_QUERY)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) {
      requestsData = data;
    }
  } else {
    const orFilters: string[] = [`requester_id.eq.${session.userId}`];
    if (studentIds.size > 0) {
      orFilters.push(`student_id.in.(${Array.from(studentIds).join(',')})`);
    }
    if (teacherId) {
      orFilters.push(`teacher_id.eq.${teacherId}`);
    }

    const { data, error } = await supabase
      .from('letter_requests')
      .select(REQUEST_SELECT_QUERY)
      .or(orFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(150);

    if (!error && data) {
      requestsData = data;
    }
  }

  // 2. Ambil surat resmi yang sudah diterbitkan untuk warga ini + Surat Edaran umum
  const letterOrFilters: string[] = [`category.eq.SURAT_EDARAN`];
  if (studentIds.size > 0) {
    letterOrFilters.push(`student_id.in.(${Array.from(studentIds).join(',')})`);
  }
  if (teacherId) {
    letterOrFilters.push(`teacher_id.eq.${teacherId}`);
  }

  const { data: myLetters } = await supabase
    .from('letters')
    .select(LETTER_SELECT_QUERY)
    .or(letterOrFilters.join(','))
    .order('letter_date', { ascending: false })
    .limit(100);

  return NextResponse.json({
    requests: requestsData,
    myLetters: (myLetters || []).filter(
      (l) => !l.status || l.status === 'TERBIT' || l.status === 'DIARSIPKAN'
    ),
    identity,
    institution: inst || null,
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = CreateLetterRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data pengajuan surat tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const identity = await resolveUserContext(supabase, session);

    let requesterRole: 'SISWA' | 'ORANG_TUA' | 'GTK' | 'ALUMNI' | 'UMUM' | 'ADMIN' = 'UMUM';
    if (session.roles.includes('SISWA')) requesterRole = 'SISWA';
    else if (session.roles.includes('ORANG_TUA')) requesterRole = 'ORANG_TUA';
    else if (hasAnyRole(session, PERMISSIONS.GTK_PERSONAL_VIEW)) requesterRole = 'GTK';
    else if (session.roles.includes('ALUMNI')) requesterRole = 'ALUMNI';
    else if (hasAnyRole(session, PERMISSIONS.PERSURATAN_MANAGE)) requesterRole = 'ADMIN';

    let targetStudentId = parsed.data.student_id?.trim() || null;
    let targetTeacherId = parsed.data.teacher_id?.trim() || null;

    if (!targetStudentId && identity.student?.id) {
      targetStudentId = String(identity.student.id);
    }
    if (!targetStudentId && identity.children.length === 1 && identity.children[0]?.id) {
      targetStudentId = String(identity.children[0].id);
    }
    if (!targetTeacherId && identity.teacher?.id && requesterRole === 'GTK') {
      targetTeacherId = String(identity.teacher.id);
    }

    const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const requestNumber = `REQ-${todayCompact}-${randomSuffix}`;

    const insertPayload = {
      request_number: requestNumber,
      requester_id: session.userId,
      requester_role: requesterRole,
      requester_name: session.fullName || session.email || 'Warga Madrasah',
      category: parsed.data.category,
      subject: parsed.data.subject.trim(),
      purpose: parsed.data.purpose.trim(),
      counterparty: parsed.data.counterparty?.trim() || null,
      student_id: targetStudentId,
      teacher_id: targetTeacherId,
      leave_type: parsed.data.leave_type || null,
      leave_start_date: parsed.data.leave_start_date?.trim() || null,
      leave_end_date: parsed.data.leave_end_date?.trim() || null,
      attachment_url: parsed.data.attachment_url?.trim() || null,
      attachment_name: parsed.data.attachment_name?.trim() || null,
      status: 'DIAJUKAN',
    };

    const { data, error } = await supabase
      .from('letter_requests')
      .insert(insertPayload)
      .select(REQUEST_SELECT_QUERY)
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    // Kirim notifikasi ke Staf TU, Kepala TU, dan Kepala Lembaga
    try {
      await dispatchNotification({
        categoryKey: 'PERPUSTAKAAN_SURAT',
        title: `Permohonan Surat Baru (${formatLetterCategoryLabel(parsed.data.category)})`,
        body: `${insertPayload.requester_name} (${requesterRole}) mengajukan: ${insertPayload.subject}.`,
        url: '/portal/layanan/persuratan',
        sourceType: 'SYSTEM_EVENT',
        createdBy: session.userId,
        dedupeKey: `letter-req-new-${data.id}`,
        target: { roles: PERMISSIONS.PERSURATAN_VIEW },
      });
    } catch {
      // Abaikan jika gagal kirim push
    }

    return NextResponse.json({ request: data });
  } catch {
    return NextResponse.json({ error: 'Gagal mengirim permohonan surat.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const canReview = hasAnyRole(session, [
    ...PERMISSIONS.PERSURATAN_MANAGE,
    'KEPALA_LEMBAGA',
  ]);
  if (!canReview) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki hak akses untuk memproses permohonan surat.' },
      { status: 403 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ReviewLetterRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data verifikasi tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: existingReq, error: findErr } = await supabase
      .from('letter_requests')
      .select('*')
      .eq('id', parsed.data.id)
      .maybeSingle();

    if (findErr || !existingReq) {
      return NextResponse.json({ error: 'Data permohonan surat tidak ditemukan.' }, { status: 404 });
    }

    let issuedLetterId: string | null = existingReq.issued_letter_id || null;

    // Jika DISETUJUI dan belum diterbitkan surat di tabel letters, otomatis terbitkan surat resmi!
    if (parsed.data.action === 'DISETUJUI' && !issuedLetterId) {
      const [{ data: inst }, { data: existingLetters }] = await Promise.all([
        supabase
          .from('institution_settings')
          .select('name, short_name, headmaster_name, head_title_label')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('letters')
          .select('direction, letter_date, letter_number')
          .eq('direction', 'KELUAR')
          .limit(500),
      ]);

      const todayIso = new Date().toISOString().slice(0, 10);
      const classCode = getDefaultClassificationCode(existingReq.category);
      const autoNumber =
        parsed.data.letter_number?.trim() ||
        generateSuggestedLetterNumber({
          category: existingReq.category,
          letterDate: todayIso,
          classificationCode: classCode,
          institutionShortName: inst?.short_name || inst?.name,
          existingLetters: (existingLetters || []) as Array<{
            direction: string;
            letter_date: string;
            letter_number: string;
          }>,
        });

      const leavePeriodNote =
        existingReq.leave_start_date
          ? ` (Periode Izin: ${existingReq.leave_start_date}${
              existingReq.leave_end_date ? ` s/d ${existingReq.leave_end_date}` : ''
            }${existingReq.leave_type ? ` - ${existingReq.leave_type}` : ''})`
          : '';

      const fullSummary = `${existingReq.purpose || ''}${leavePeriodNote}`.trim();

      const { data: createdLetter, error: letterErr } = await supabase
        .from('letters')
        .insert({
          direction: 'KELUAR',
          category: existingReq.category,
          letter_number: autoNumber,
          letter_date: todayIso,
          classification_code: classCode,
          priority: 'BIASA',
          status: 'TERBIT',
          subject: existingReq.subject,
          counterparty: existingReq.counterparty || existingReq.requester_name,
          student_id: existingReq.student_id || null,
          teacher_id: existingReq.teacher_id || null,
          summary: fullSummary,
          file_url: existingReq.attachment_url || null,
          attachment_name: existingReq.attachment_name || null,
          signatory_name:
            parsed.data.signatory_name?.trim() || inst?.headmaster_name || null,
          signatory_title:
            parsed.data.signatory_title?.trim() || inst?.head_title_label || 'Kepala Madrasah',
          created_by: session.userId,
        })
        .select('id, letter_number')
        .maybeSingle();

      if (!letterErr && createdLetter?.id) {
        issuedLetterId = createdLetter.id;
      } else {
        // Fallback ke kolom dasar jika migrasi 0046 belum dijalankan di remote DB
        const { data: fallbackLetter } = await supabase
          .from('letters')
          .insert({
            direction: 'KELUAR',
            category: [
              'SURAT_KETERANGAN_AKTIF',
              'SURAT_MUTASI',
              'SURAT_TUGAS',
              'SURAT_UNDANGAN',
              'SURAT_EDARAN',
              'LAINNYA',
            ].includes(existingReq.category)
              ? existingReq.category
              : 'LAINNYA',
            letter_number: autoNumber,
            letter_date: todayIso,
            subject: existingReq.subject,
            counterparty: existingReq.counterparty || existingReq.requester_name,
            student_id: existingReq.student_id || null,
            teacher_id: existingReq.teacher_id || null,
            summary: fullSummary,
            file_url: existingReq.attachment_url || null,
            created_by: session.userId,
          })
          .select('id')
          .maybeSingle();
        if (fallbackLetter?.id) {
          issuedLetterId = fallbackLetter.id;
        }
      }

      // Jika pengajuan berupa SURAT_IZIN (Sakit/Izin) untuk siswa dan memiliki tanggal izin, sinkronkan ke student_daily_attendances jika tabel tersedia
      if (
        existingReq.category === 'SURAT_IZIN' &&
        existingReq.student_id &&
        existingReq.leave_start_date
      ) {
        try {
          const attendanceStatus = existingReq.leave_type === 'SAKIT' ? 'SAKIT' : 'IZIN';
          await supabase.from('student_daily_attendances').upsert(
            {
              student_id: existingReq.student_id,
              attendance_date: existingReq.leave_start_date,
              status: attendanceStatus,
              notes: `Surat Izin Digital Disetujui (${existingReq.request_number}): ${existingReq.purpose}`,
              recorded_by: session.userId,
            },
            { onConflict: 'student_id,attendance_date' }
          );
        } catch {
          // Abaikan jika struktur tabel absensi harian berbeda
        }
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('letter_requests')
      .update({
        status: parsed.data.action,
        reviewer_notes: parsed.data.reviewer_notes?.trim() || null,
        reviewed_by: session.userId,
        reviewed_at: new Date().toISOString(),
        issued_letter_id: issuedLetterId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.id)
      .select(REQUEST_SELECT_QUERY)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: sanitizeApiError(updateErr) }, { status: 500 });
    }

    // Kirim notifikasi ke pemohon (dan keluarga siswa jika terkait siswa)
    const targetUrl =
      existingReq.requester_role === 'SISWA'
        ? '/portal/siswa/persuratan'
        : existingReq.requester_role === 'ORANG_TUA'
          ? '/portal/orang-tua/persuratan'
          : existingReq.requester_role === 'GTK'
            ? '/portal/gtk/persuratan'
            : '/portal/layanan/persuratan';

    const statusTitle =
      parsed.data.action === 'DISETUJUI'
        ? 'Permohonan Surat Disetujui & Terbit'
        : parsed.data.action === 'DIVERIFIKASI_TU'
          ? 'Permohonan Surat Diverifikasi TU'
          : 'Permohonan Surat Ditolak';

    const statusBody =
      parsed.data.action === 'DISETUJUI'
        ? `Permohonan "${existingReq.subject}" telah disetujui dan Naskah Surat Resmi siap diunduh.`
        : parsed.data.action === 'DIVERIFIKASI_TU'
          ? `Permohonan "${existingReq.subject}" telah diverifikasi oleh Tata Usaha dan menunggu pengesahan akhir.`
          : `Permohonan "${existingReq.subject}" belum dapat disetujui.${
              parsed.data.reviewer_notes ? ` Catatan: ${parsed.data.reviewer_notes}` : ''
            }`;

    if (existingReq.requester_id) {
      await notifyUserDirect({
        userId: existingReq.requester_id,
        categoryKey: 'PERPUSTAKAAN_SURAT',
        title: statusTitle,
        body: statusBody,
        url: targetUrl,
        dedupeKey: `letter-req-status-${existingReq.id}-${parsed.data.action}`,
        createdBy: session.userId,
      });
    }

    if (existingReq.student_id) {
      await notifyStudentFamilyEvent({
        studentId: existingReq.student_id,
        categoryKey: 'PERPUSTAKAAN_SURAT',
        title: statusTitle,
        body: statusBody,
        url: '/portal/orang-tua/persuratan',
        dedupeKey: `letter-req-fam-${existingReq.id}-${parsed.data.action}`,
        createdBy: session.userId,
      });
    }

    return NextResponse.json({ request: updated });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permohonan surat.' }, { status: 500 });
  }
}
