import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

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

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.BK_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      records: [],
      catalog: [],
      bookings: [],
      homeVisits: [],
      studentPointSummary: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data, error }, catalogRes, bookingsRes, visitsRes] = await Promise.all([
    supabase
      .from('bk_records')
      .select('*, student:students(id, full_name, nis), counselor:teachers_staff(full_name)')
      .order('incident_date', { ascending: false })
      .limit(150),
    supabase.from('bk_rule_catalog').select('*').order('rule_type').order('code'),
    supabase
      .from('bk_counseling_bookings')
      .select('*, student:students(full_name, nis)')
      .order('preferred_date', { ascending: false })
      .limit(100),
    supabase
      .from('bk_home_visits')
      .select('*, student:students(full_name, nis)')
      .order('visit_date', { ascending: false })
      .limit(100),
  ]);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });

  const isGlobalBkViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KESISWAAN',
    'GURU_BK',
  ]);
  const ta = guard.session.teacherAssignments;

  let records = data || [];
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
    records,
    catalog: catalogRes.error ? [] : catalogRes.data || [],
    bookings: bookingsRes.error ? [] : bookingsRes.data || [],
    homeVisits: visitsRes.error ? [] : visitsRes.data || [],
    studentPointSummary,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.BK_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const wibToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
      new Date()
    );

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
        .insert({ ...p.data, code: p.data.code.toUpperCase() })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ rule: data });
    }

    if (body.action === 'CREATE_BOOKING') {
      const schema = z.object({
        student_id: z.string().uuid(),
        preferred_date: z.string().min(8),
        topic: z.string().trim().min(3),
      });
      const p = schema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data booking konseling tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('bk_counseling_bookings')
        .insert({
          student_id: p.data.student_id,
          requested_by: guard.session.userId,
          preferred_date: p.data.preferred_date,
          topic: p.data.topic,
          status: 'DIJADWALKAN',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (body.action === 'UPDATE_BOOKING') {
      const schema = z.object({
        id: z.string().uuid(),
        status: z.enum(['MENUNGGU', 'DIJADWALKAN', 'SELESAI', 'DIBATALKAN']),
        counselor_notes: z.string().optional().nullable(),
      });
      const p = schema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data pembaruan booking tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('bk_counseling_bookings')
        .update({
          status: p.data.status,
          counselor_notes: p.data.counselor_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.data.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (body.action === 'CREATE_HOME_VISIT') {
      const schema = z.object({
        student_id: z.string().uuid(),
        visit_date: z.string().min(8),
        visited_address: z.string().optional().nullable(),
        met_with: z.string().optional().nullable(),
        summary: z.string().trim().min(5),
        follow_up: z.string().optional().nullable(),
      });
      const p = schema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data Home Visit tidak valid.' }, { status: 400 });
      const { data, error } = await supabase
        .from('bk_home_visits')
        .insert({
          ...p.data,
          created_by: guard.session.userId,
        })
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

    const { data, error } = await supabase
      .from('bk_records')
      .insert({
        ...parsed.data,
        counselor_id: parsed.data.counselor_id || null,
        incident_date: parsed.data.incident_date || wibToday,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    if (!parsed.data.is_confidential) {
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
    const { data, error } = await supabase
      .from('bk_records')
      .update(fields)
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
  const guard = await requireApiRoles(PERMISSIONS.BK_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const target = searchParams.get('target') || 'record';
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const table = target === 'rule' ? 'bk_rule_catalog' : 'bk_records';
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
