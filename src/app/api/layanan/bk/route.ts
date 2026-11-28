import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

const COUNSELING_TYPES = [
  'INDIVIDU',
  'KELOMPOK',
  'KLASIKAL',
  'KONSULTASI',
  'MEDIASI',
  'LAINNYA',
] as const;

const TOPIC_CATEGORIES = ['PRIBADI', 'SOSIAL', 'BELAJAR', 'KARIR', 'LAINNYA'] as const;

const TOPIC_CATEGORY_LABELS: Record<(typeof TOPIC_CATEGORIES)[number], string> = {
  PRIBADI: 'Konseling Pribadi',
  SOSIAL: 'Konseling Sosial',
  BELAJAR: 'Konseling Belajar',
  KARIR: 'Konseling Karir',
  LAINNYA: 'Lainnya',
};

const EvidenceFileSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .refine(
      (val) => /^https?:\/\//i.test(val) || val.startsWith('/') || val.startsWith('data:image/'),
      { message: 'URL gambar bukti tidak valid.' }
    ),
  name: z.string().trim().min(1).max(200),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']).optional(),
  size: z.number().int().min(1).max(Math.floor(1.5 * 1024 * 1024)).optional(),
});

const CreateBkSchema = z.object({
  student_id: z.string().uuid(),
  counselor_id: z.string().uuid().optional().nullable(),
  record_type: z.enum(['PELANGGARAN', 'PRESTASI', 'KONSULTASI']),
  title: z.string().min(2),
  points: z.number().default(0),
  incident_date: z.string().optional(),
  description: z.string().min(3),
  follow_up: z.string().optional().nullable(),
  is_confidential: z.boolean().default(false),
});

const UpdateBkSchema = z.object({
  id: z.string().uuid(),
  record_type: z.enum(['PELANGGARAN', 'PRESTASI', 'KONSULTASI']).optional(),
  title: z.string().min(2).optional(),
  points: z.number().optional(),
  description: z.string().min(3).optional(),
  follow_up: z.string().optional().nullable(),
  is_confidential: z.boolean().optional(),
});

const BookingUpsertSchema = z
  .object({
    student_id: z.string().uuid('Siswa wajib dipilih.'),
    preferred_date: z.string().min(8, 'Tanggal sesi konseling wajib diisi.'),
    counseling_type: z.enum(COUNSELING_TYPES).default('INDIVIDU'),
    counseling_type_other: z.string().trim().optional().nullable(),
    topic_category: z.enum(TOPIC_CATEGORIES).default('PRIBADI'),
    topic_other: z.string().trim().optional().nullable(),
    topic: z.string().trim().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.counseling_type === 'LAINNYA' && (!val.counseling_type_other || val.counseling_type_other.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Penjelasan Tipe Konseling Lainnya wajib diisi (minimal 2 karakter).',
        path: ['counseling_type_other'],
      });
    }
    if (val.topic_category === 'LAINNYA' && (!val.topic_other || val.topic_other.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Penjelasan Topik Konseling Lainnya wajib diisi (minimal 2 karakter).',
        path: ['topic_other'],
      });
    }
  });

const HomeVisitUpsertSchema = z.object({
  student_id: z.string().uuid('Siswa wajib dipilih.'),
  visit_date: z.string().min(8, 'Tanggal kunjungan wajib diisi.'),
  visited_address: z.string().trim().optional().nullable(),
  met_with: z.string().trim().optional().nullable(),
  participants: z.string().trim().min(2, 'Daftar pihak yang ikut Home Visit wajib diisi.'),
  summary: z.string().trim().min(5, 'Hasil kunjungan minimal 5 karakter.'),
  follow_up: z.string().trim().optional().nullable(),
  evidence_files: z
    .array(EvidenceFileSchema)
    .max(5, 'Maksimal 5 gambar bukti kunjungan.')
    .default([]),
});

function buildReadableTopic(
  topicCategory: (typeof TOPIC_CATEGORIES)[number],
  topicOther?: string | null,
  fallbackTopic?: string | null
): string {
  if (topicCategory === 'LAINNYA') {
    const detail = (topicOther || fallbackTopic || '').trim();
    return detail ? `Lainnya: ${detail}` : 'Lainnya';
  }
  return TOPIC_CATEGORY_LABELS[topicCategory] || fallbackTopic || 'Konseling Pribadi';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const rawAcademicYearId = (searchParams.get('academicYearId') || 'ACTIVE').trim();

  // Halaman /portal/layanan/bk/kasus hanya boleh diakses oleh SUPERADMIN, OPERATOR, dan GURU_BK
  const guard = await requireApiRoles(
    scope === 'kasus' ? PERMISSIONS.BK_KASUS_ACCESS : PERMISSIONS.BK_VIEW
  );
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      academicYears: [],
      activeAcademicYear: null,
      selectedAcademicYearId: rawAcademicYearId || 'ACTIVE',
      records: [],
      catalog: [],
      bookings: [],
      homeVisits: [],
      studentPointSummary: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [yearsRes, { data, error }, catalogRes, bookingsRes, visitsRes] = await Promise.all([
    supabase
      .from('academic_years')
      .select('id, name, semester, is_active')
      .order('is_active', { ascending: false })
      .order('name', { ascending: false })
      .order('semester', { ascending: false }),
    supabase
      .from('bk_records')
      .select(
        '*, student:students(id, full_name, nis), counselor:teachers_staff(full_name), academic_year:academic_years(id, name, semester, is_active)'
      )
      .order('incident_date', { ascending: false })
      .limit(300),
    supabase
      .from('bk_rule_catalog')
      .select('*, academic_year:academic_years(id, name, semester, is_active)')
      .order('rule_type')
      .order('code'),
    supabase
      .from('bk_counseling_bookings')
      .select(
        '*, student:students(id, full_name, nis), academic_year:academic_years(id, name, semester, is_active)'
      )
      .order('preferred_date', { ascending: false })
      .limit(200),
    supabase
      .from('bk_home_visits')
      .select(
        '*, student:students(id, full_name, nis), academic_year:academic_years(id, name, semester, is_active)'
      )
      .order('visit_date', { ascending: false })
      .limit(200),
  ]);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });

  const academicYears = yearsRes.error ? [] : yearsRes.data || [];
  const activeAcademicYear =
    academicYears.find((y) => Boolean(y.is_active)) || academicYears[0] || null;
  const activeYearId = (activeAcademicYear?.id as string | undefined) || null;

  const isGlobalBkViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'GURU_BK',
  ]);
  const ta = guard.session.teacherAssignments;

  const filterAndTagByAcademicYear = <T extends { academic_year_id?: string | null }>(rows: T[]) => {
    const tagged = rows.map((row) => {
      const rowYearId = (row.academic_year_id as string | null) || null;
      return {
        ...row,
        is_archived: Boolean(activeYearId && rowYearId && rowYearId !== activeYearId),
      };
    });
    if (rawAcademicYearId.toUpperCase() === 'ACTIVE') {
      if (!activeYearId) return tagged;
      return tagged.filter((r) => !r.academic_year_id || r.academic_year_id === activeYearId);
    }
    if (rawAcademicYearId.toUpperCase() === 'ALL') {
      return tagged;
    }
    return tagged.filter((r) => r.academic_year_id === rawAcademicYearId);
  };

  let records = filterAndTagByAcademicYear(data || []);
  const catalog = filterAndTagByAcademicYear(catalogRes.error ? [] : catalogRes.data || []);
  const bookings = filterAndTagByAcademicYear(bookingsRes.error ? [] : bookingsRes.data || []);
  const homeVisits = filterAndTagByAcademicYear(visitsRes.error ? [] : visitsRes.data || []);
  if (!isGlobalBkViewer) {
    if (!ta?.homeroomClassroomIds?.length) {
      records = [];
    } else {
      const { data: enrolls } = await supabase
        .from('student_enrollments')
        .select('student_id')
        .in('classroom_id', ta.homeroomClassroomIds);
      const homeroomStudentIds = new Set(
        (enrolls || []).map((e) => e.student_id as string).filter(Boolean)
      );
      records = records.filter(
        (r) => homeroomStudentIds.has(r.student_id) && !r.is_confidential
      );
    }
  }

  // Akumulasi Poin per Siswa & Rekomendasi SP
  const summaryMap = new Map<
    string,
    {
      student_id: string;
      full_name: string;
      nis: string | null;
      violation_points: number;
      achievement_points: number;
      consultation_count: number;
    }
  >();

  for (const r of records) {
    const st = Array.isArray(r.student) ? r.student[0] : r.student;
    const sid = r.student_id as string;
    const cur = summaryMap.get(sid) || {
      student_id: sid,
      full_name: st?.full_name || 'Siswa',
      nis: st?.nis || null,
      violation_points: 0,
      achievement_points: 0,
      consultation_count: 0,
    };
    if (r.record_type === 'PELANGGARAN') cur.violation_points += Math.abs(Number(r.points || 0));
    else if (r.record_type === 'PRESTASI') cur.achievement_points += Math.abs(Number(r.points || 0));
    else cur.consultation_count += 1;
    summaryMap.set(sid, cur);
  }

  const studentPointSummary = Array.from(summaryMap.values())
    .map((s) => ({
      ...s,
      recommended_action:
        s.violation_points >= 75
          ? 'SP3 / PANGGILAN ORTU'
          : s.violation_points >= 50
          ? 'SP2'
          : s.violation_points >= 25
          ? 'SP1'
          : 'PEMBINAAN',
    }))
    .sort((a, b) => b.violation_points - a.violation_points);

  return NextResponse.json({
    academicYears,
    activeAcademicYear,
    selectedAcademicYearId: rawAcademicYearId || 'ACTIVE',
    records,
    catalog,
    bookings,
    homeVisits,
    studentPointSummary,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const isKasusAction = [
      'CREATE_RULE',
      'CREATE_BOOKING',
      'UPDATE_BOOKING',
      'COMPLETE_BOOKING',
      'CREATE_HOME_VISIT',
      'UPDATE_HOME_VISIT',
      'ISSUE_SP_LETTER',
    ].includes(String(body?.action || ''));

    // Semua aksi halaman Kasus BK dibatasi khusus untuk SUPERADMIN, OPERATOR, dan GURU_BK
    const guard = await requireApiRoles(
      isKasusAction ? PERMISSIONS.BK_KASUS_ACCESS : PERMISSIONS.BK_MANAGE
    );
    if (guard.errorResponse) return guard.errorResponse;

    const supabase = createSupabaseAdminClient();
    const wibToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
      new Date()
    );
    const { data: activeYearRow } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const activeYearId = (activeYearRow?.id as string | undefined) || null;

    if (body.action === 'CREATE_RULE') {
      const schema = z.object({
        code: z.string().trim().min(2),
        rule_type: z.enum(['PELANGGARAN', 'PRESTASI']),
        title: z.string().trim().min(3),
        default_points: z.number().int().min(1).max(200),
        sanction_hint: z.string().optional().nullable(),
      });
      const p = schema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data katalog aturan tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('bk_rule_catalog')
        .insert({ ...p.data, academic_year_id: activeYearId, code: p.data.code.toUpperCase() })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ rule: data });
    }

    if (body.action === 'CREATE_BOOKING') {
      const p = BookingUpsertSchema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data jadwal konseling tidak valid.' },
          { status: 400 }
        );
      }
      const readableTopic = buildReadableTopic(
        p.data.topic_category,
        p.data.topic_other,
        p.data.topic
      );
      const { data, error } = await supabase
        .from('bk_counseling_bookings')
        .insert({
          student_id: p.data.student_id,
          academic_year_id: activeYearId,
          requested_by: guard.session.userId,
          counselor_id: guard.session.teacherAssignments?.teacherId || null,
          preferred_date: p.data.preferred_date,
          counseling_type: p.data.counseling_type,
          counseling_type_other:
            p.data.counseling_type === 'LAINNYA' ? p.data.counseling_type_other?.trim() || null : null,
          topic_category: p.data.topic_category,
          topic_other:
            p.data.topic_category === 'LAINNYA' ? p.data.topic_other?.trim() || null : null,
          topic: readableTopic,
          status: 'DIJADWALKAN',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (body.action === 'UPDATE_BOOKING') {
      const schema = BookingUpsertSchema.extend({
        id: z.string().uuid(),
        status: z.enum(['MENUNGGU', 'DIJADWALKAN', 'SELESAI', 'DIBATALKAN']).optional(),
        counselor_notes: z.string().optional().nullable(),
      });
      const p = schema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan jadwal konseling tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existingBooking } = await supabase
        .from('bk_counseling_bookings')
        .select('id, academic_year_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existingBooking) {
        return NextResponse.json({ error: 'Jadwal konseling tidak ditemukan.' }, { status: 404 });
      }
      if (
        existingBooking.academic_year_id &&
        activeYearId &&
        existingBooking.academic_year_id !== activeYearId
      ) {
        return NextResponse.json(
          {
            error:
              'Jadwal konseling dari tahun pelajaran tidak aktif bersifat arsip (hanya lihat) dan tidak dapat diedit.',
          },
          { status: 403 }
        );
      }

      const readableTopic = buildReadableTopic(
        p.data.topic_category,
        p.data.topic_other,
        p.data.topic
      );
      const updatePayload: Record<string, unknown> = {
        student_id: p.data.student_id,
        preferred_date: p.data.preferred_date,
        counseling_type: p.data.counseling_type,
        counseling_type_other:
          p.data.counseling_type === 'LAINNYA' ? p.data.counseling_type_other?.trim() || null : null,
        topic_category: p.data.topic_category,
        topic_other:
          p.data.topic_category === 'LAINNYA' ? p.data.topic_other?.trim() || null : null,
        topic: readableTopic,
        updated_at: new Date().toISOString(),
      };
      if (p.data.status) updatePayload.status = p.data.status;
      if (p.data.counselor_notes !== undefined) {
        updatePayload.counselor_notes = p.data.counselor_notes?.trim() || null;
      }

      const { data, error } = await supabase
        .from('bk_counseling_bookings')
        .update(updatePayload)
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (body.action === 'COMPLETE_BOOKING') {
      const schema = z.object({
        id: z.string().uuid(),
        bap_summary: z.string().trim().min(5, 'Laporan / BAP konseling minimal 5 karakter.'),
        bap_follow_up: z.string().trim().optional().nullable(),
        counselor_notes: z.string().trim().optional().nullable(),
        evidence_files: z
          .array(EvidenceFileSchema)
          .min(1, 'Minimal 1 gambar bukti konseling (lembar konseling/BAP/foto) wajib diunggah.')
          .max(5, 'Maksimal 5 gambar bukti konseling.'),
      });
      const p = schema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data laporan BAP konseling tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existingBooking } = await supabase
        .from('bk_counseling_bookings')
        .select('id, academic_year_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existingBooking) {
        return NextResponse.json({ error: 'Jadwal konseling tidak ditemukan.' }, { status: 404 });
      }
      if (
        existingBooking.academic_year_id &&
        activeYearId &&
        existingBooking.academic_year_id !== activeYearId
      ) {
        return NextResponse.json(
          {
            error:
              'Jadwal konseling dari tahun pelajaran tidak aktif bersifat arsip (hanya lihat) dan tidak dapat diperbarui.',
          },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from('bk_counseling_bookings')
        .update({
          status: 'SELESAI',
          bap_summary: p.data.bap_summary,
          bap_follow_up: p.data.bap_follow_up || null,
          counselor_notes: p.data.counselor_notes || null,
          evidence_files: p.data.evidence_files,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (body.action === 'CREATE_HOME_VISIT') {
      const p = HomeVisitUpsertSchema.safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data Home Visit tidak valid.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('bk_home_visits')
        .insert({
          student_id: p.data.student_id,
          academic_year_id: activeYearId,
          counselor_id: guard.session.teacherAssignments?.teacherId || null,
          visit_date: p.data.visit_date,
          visited_address: p.data.visited_address || null,
          met_with: p.data.met_with || null,
          participants: p.data.participants,
          summary: p.data.summary,
          follow_up: p.data.follow_up || null,
          evidence_files: p.data.evidence_files,
          created_by: guard.session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ homeVisit: data });
    }

    if (body.action === 'UPDATE_HOME_VISIT') {
      const p = HomeVisitUpsertSchema.extend({ id: z.string().uuid() }).safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pembaruan Home Visit tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existingVisit } = await supabase
        .from('bk_home_visits')
        .select('id, academic_year_id')
        .eq('id', p.data.id)
        .maybeSingle();
      if (!existingVisit) {
        return NextResponse.json({ error: 'Laporan Home Visit tidak ditemukan.' }, { status: 404 });
      }
      if (
        existingVisit.academic_year_id &&
        activeYearId &&
        existingVisit.academic_year_id !== activeYearId
      ) {
        return NextResponse.json(
          {
            error:
              'Laporan Home Visit dari tahun pelajaran tidak aktif bersifat arsip (hanya lihat) dan tidak dapat diedit.',
          },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from('bk_home_visits')
        .update({
          student_id: p.data.student_id,
          visit_date: p.data.visit_date,
          visited_address: p.data.visited_address || null,
          met_with: p.data.met_with || null,
          participants: p.data.participants,
          summary: p.data.summary,
          follow_up: p.data.follow_up || null,
          evidence_files: p.data.evidence_files,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ homeVisit: data });
    }

    if (body.action === 'ISSUE_SP_LETTER') {
      const schema = z.object({
        student_id: z.string().uuid(),
        letter_level: z.enum(['SP1', 'SP2', 'SP3', 'PANGGILAN_ORTU']),
        reason: z.string().trim().min(3),
      });
      const p = schema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data surat peringatan tidak valid.' }, { status: 400 });

      const { data: st } = await supabase
        .from('students')
        .select('id, full_name, guardian_name')
        .eq('id', p.data.student_id)
        .single();
      if (!st) return NextResponse.json({ error: 'Siswa tidak ditemukan.' }, { status: 404 });

      const labelMap = {
        SP1: 'Surat Peringatan 1 (SP1)',
        SP2: 'Surat Peringatan 2 (SP2)',
        SP3: 'Surat Peringatan 3 (SP3)',
        PANGGILAN_ORTU: 'Surat Panggilan Orang Tua / Wali',
      };
      const letterNumber = `BK-${p.data.letter_level}-${Date.now().toString().slice(-5)}`;
      const { data: letter, error: lErr } = await supabase
        .from('letters')
        .insert({
          direction: 'KELUAR',
          category: 'SURAT_PANGGILAN',
          letter_number: letterNumber,
          letter_date: wibToday,
          subject: `${labelMap[p.data.letter_level]} an. ${st.full_name}`,
          counterparty: st.guardian_name || `Orang Tua/Wali ${st.full_name}`,
          student_id: st.id,
          summary: p.data.reason,
          status: 'DRAFT',
          priority: 'PENTING',
          classification_code: 'PP.03',
        })
        .select('id, letter_number')
        .single();
      if (lErr) return NextResponse.json({ error: sanitizeApiError(lErr) }, { status: 500 });

      await notifyStudentFamilyEvent({
        studentId: st.id,
        categoryKey: 'LAYANAN_BK',
        title: `${labelMap[p.data.letter_level]} Diterbitkan`,
        body: `Lembaga menerbitkan ${labelMap[p.data.letter_level]} (${letterNumber}) untuk {studentName}.`,
        url: '/portal/orang-tua/bk',
        createdBy: guard.session.userId,
      });

      return NextResponse.json({ ok: true, letter });
    }

    const parsed = CreateBkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data BK tidak valid.' }, { status: 400 });
    }

    const isGuruBk = guard.session.roles.includes('GURU_BK');
    if (parsed.data.record_type === 'KONSULTASI' && !isGuruBk) {
      return NextResponse.json(
        {
          error:
            'Opsi Konsultasi BK hanya dapat dipilih oleh guru dengan tugas tambahan Guru BK.',
        },
        { status: 403 }
      );
    }

    const safeConfidential =
      parsed.data.record_type === 'KONSULTASI' ? Boolean(parsed.data.is_confidential) : false;

    const { data, error } = await supabase
      .from('bk_records')
      .insert({
        ...parsed.data,
        academic_year_id: activeYearId,
        is_confidential: safeConfidential,
        counselor_id: parsed.data.counselor_id || null,
        incident_date: parsed.data.incident_date || wibToday,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    if (!safeConfidential) {
      await notifyStudentFamilyEvent({
        studentId: parsed.data.student_id,
        categoryKey: 'LAYANAN_BK',
        title: `Catatan BK (${parsed.data.record_type})`,
        body: `Catatan baru untuk {studentName}: ${parsed.data.title}`,
        url: '/portal/orang-tua',
        dedupeKey: `bk-${data.id}`,
        createdBy: guard.session.userId,
      });
    }
    return NextResponse.json({ record: data });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan catatan BK.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.BK_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateBkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data pembaruan BK tidak valid.' }, { status: 400 });
    }
    const { id, ...fields } = parsed.data;
    const supabase = createSupabaseAdminClient();

    const [{ data: existingRec }, { data: activeYearRow }] = await Promise.all([
      supabase
        .from('bk_records')
        .select('id, academic_year_id, record_type')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('academic_years').select('id').eq('is_active', true).limit(1).maybeSingle(),
    ]);

    if (!existingRec) {
      return NextResponse.json({ error: 'Catatan BK tidak ditemukan.' }, { status: 404 });
    }
    const activeYearId = (activeYearRow?.id as string | undefined) || null;
    if (existingRec.academic_year_id && activeYearId && existingRec.academic_year_id !== activeYearId) {
      return NextResponse.json(
        {
          error:
            'Catatan BK dari tahun pelajaran yang sudah tidak aktif bersifat arsip (hanya lihat) dan tidak dapat diedit.',
        },
        { status: 403 }
      );
    }

    const nextRecordType = fields.record_type || (existingRec.record_type as string);
    if (nextRecordType === 'KONSULTASI' && !guard.session.roles.includes('GURU_BK')) {
      return NextResponse.json(
        {
          error:
            'Opsi Konsultasi BK hanya dapat dipilih oleh guru dengan tugas tambahan Guru BK.',
        },
        { status: 403 }
      );
    }

    const sanitizedFields = {
      ...fields,
      ...(nextRecordType !== 'KONSULTASI' ? { is_confidential: false } : {}),
    };

    const { data, error } = await supabase
      .from('bk_records')
      .update(sanitizedFields)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ record: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui catatan BK.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const target = searchParams.get('target') || 'record';

  const isKasusTarget = target === 'rule' || target === 'booking' || target === 'home_visit';
  const guard = await requireApiRoles(
    isKasusTarget ? PERMISSIONS.BK_KASUS_ACCESS : PERMISSIONS.BK_MANAGE
  );
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const tableMap: Record<string, string> = {
    rule: 'bk_rule_catalog',
    booking: 'bk_counseling_bookings',
    home_visit: 'bk_home_visits',
    record: 'bk_records',
  };
  const table = tableMap[target] || 'bk_records';

  const supabase = createSupabaseAdminClient();
  const [{ data: existingRow }, { data: activeYearRow }] = await Promise.all([
    supabase.from(table).select('id, academic_year_id').eq('id', id).maybeSingle(),
    supabase.from('academic_years').select('id').eq('is_active', true).limit(1).maybeSingle(),
  ]);
  if (!existingRow) {
    return NextResponse.json({ error: 'Data BK tidak ditemukan.' }, { status: 404 });
  }
  const activeYearId = (activeYearRow?.id as string | undefined) || null;
  if (existingRow.academic_year_id && activeYearId && existingRow.academic_year_id !== activeYearId) {
    return NextResponse.json(
      {
        error:
          'Data BK dari tahun pelajaran yang sudah tidak aktif bersifat arsip (hanya lihat) dan tidak dapat dihapus.',
      },
      { status: 403 }
    );
  }

  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
