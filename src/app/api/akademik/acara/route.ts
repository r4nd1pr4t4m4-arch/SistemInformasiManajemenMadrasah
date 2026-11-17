import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';

const CreateEventSchema = z.object({
  action: z.literal('CREATE_EVENT'),
  title: z.string().min(3, 'Judul acara minimal 3 karakter.'),
  description: z.string().optional().nullable(),
  event_type: z.enum(['RUTIN_MINGGUAN', 'INSIDENTAL']),
  day_of_week: z.number().min(1).max(7).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  jtm_allocated: z.number().min(1).max(24).default(2),
});

const ToggleEventSchema = z.object({
  action: z.literal('TOGGLE_EVENT'),
  event_id: z.string().uuid(),
  is_active: z.boolean(),
});

const ConfirmEventAttendanceSchema = z.object({
  action: z.literal('CONFIRM_EVENT_ATTENDANCE'),
  event_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  event_date: z.string(),
  picket_attendance_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const SubmitEventJournalSchema = z.object({
  action: z.literal('SUBMIT_EVENT_JOURNAL'),
  confirmation_id: z.string().uuid(),
  summary: z.string().min(5, 'Ringkasan kegiatan acara minimal 5 karakter.'),
  outcomes: z.string().optional().nullable(),
});

function getIsoDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Minggu .. 6=Sabtu
  return day === 0 ? 7 : day; // 1=Senin .. 7=Minggu
}

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.AKADEMIK);
  if (guard.errorResponse) return guard.errorResponse;

  const canManageEvents = hasAnyRole(guard.session, ROLE_GROUPS.ADMIN_CONFIRM);

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      events: [],
      confirmations: [],
      journals: [],
      confirmedPicketAttendances: [],
      teachers: [],
      currentTeacher: null,
      canManageEvents,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: events },
    { data: confirmations },
    { data: journals },
    { data: confirmedPicketAttendances },
    { data: teachers },
    { data: currentTeacher },
  ] = await Promise.all([
    supabase.from('school_events').select('*').order('created_at', { ascending: false }).limit(100),
    supabase
      .from('event_teacher_confirmations')
      .select(
        '*, event:school_events(id, title, event_type, day_of_week, start_date, end_date, start_time, end_time, location, jtm_allocated), teacher:teachers_staff(id, full_name)'
      )
      .order('event_date', { ascending: false })
      .limit(150),
    supabase
      .from('event_journals')
      .select(
        '*, event:school_events(title, event_type), teacher:teachers_staff(full_name)'
      )
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('teacher_attendances')
      .select('id, teacher_id, attendance_date, teacher:teachers_staff(full_name)')
      .eq('attendance_type', 'PIKET')
      .eq('is_within_geofence', true)
      .eq('admin_confirmed', true)
      .order('attendance_date', { ascending: false })
      .limit(50),
    supabase.from('teachers_staff').select('id, full_name, profile_id').order('full_name').limit(200),
    supabase
      .from('teachers_staff')
      .select('id, full_name')
      .eq('profile_id', guard.session.userId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    events: events || [],
    confirmations: confirmations || [],
    journals: journals || [],
    confirmedPicketAttendances: confirmedPicketAttendances || [],
    teachers: teachers || [],
    currentTeacher: currentTeacher || null,
    canManageEvents,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.AKADEMIK);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const isAdmin = hasAnyRole(guard.session, ROLE_GROUPS.ADMIN_CONFIRM);

    if (body.action === 'CREATE_EVENT') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Hanya Admin / Kurikulum / Kesiswaan / TU yang dapat membuat acara/kegiatan.' },
          { status: 403 }
        );
      }

      const parsed = CreateEventSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data acara tidak valid.' },
          { status: 400 }
        );
      }

      const d = parsed.data;
      if (d.event_type === 'RUTIN_MINGGUAN' && !d.day_of_week) {
        return NextResponse.json(
          { error: 'Pilih hari pelaksanaan untuk acara rutin mingguan.' },
          { status: 400 }
        );
      }
      if (d.event_type === 'INSIDENTAL') {
        if (!d.start_date) {
          return NextResponse.json(
            { error: 'Tanggal mulai wajib diisi untuk acara insidental.' },
            { status: 400 }
          );
        }
        const endDate = d.end_date || d.start_date;
        if (endDate < d.start_date) {
          return NextResponse.json(
            { error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' },
            { status: 400 }
          );
        }
      }

      const { data, error } = await supabase
        .from('school_events')
        .insert({
          title: d.title.trim(),
          description: d.description?.trim() || null,
          event_type: d.event_type,
          day_of_week: d.event_type === 'RUTIN_MINGGUAN' ? d.day_of_week : null,
          start_date: d.event_type === 'INSIDENTAL' ? d.start_date : d.start_date || null,
          end_date:
            d.event_type === 'INSIDENTAL' ? d.end_date || d.start_date : d.end_date || null,
          start_time: d.start_time || null,
          end_time: d.end_time || null,
          location: d.location?.trim() || null,
          jtm_allocated: d.jtm_allocated,
          is_active: true,
          created_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ event: data });
    }

    if (body.action === 'TOGGLE_EVENT') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Tidak memiliki izin mengubah status acara.' }, { status: 403 });
      }
      const parsed = ToggleEventSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('school_events')
        .update({ is_active: parsed.data.is_active })
        .eq('id', parsed.data.event_id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ event: data });
    }

    if (body.action === 'CONFIRM_EVENT_ATTENDANCE') {
      const parsed = ConfirmEventAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data konfirmasi kehadiran acara tidak valid.' }, { status: 400 });
      }

      const { event_id, teacher_id, event_date, picket_attendance_id, notes } = parsed.data;

      let confirmedByRole: 'ADMIN' | 'GURU_PIKET' = 'ADMIN';
      if (picket_attendance_id) {
        const { data: picketAtt } = await supabase
          .from('teacher_attendances')
          .select('id, attendance_type, attendance_date, is_within_geofence, admin_confirmed')
          .eq('id', picket_attendance_id)
          .maybeSingle();

        if (
          !picketAtt ||
          picketAtt.attendance_type !== 'PIKET' ||
          !picketAtt.is_within_geofence ||
          !picketAtt.admin_confirmed
        ) {
          return NextResponse.json(
            { error: 'Presensi Guru Piket belum valid atau belum dikonfirmasi Admin.' },
            { status: 403 }
          );
        }
        if (picketAtt.attendance_date !== event_date) {
          return NextResponse.json(
            { error: `Guru Piket hanya dapat mengonfirmasi acara pada tanggal piketnya (${picketAtt.attendance_date}).` },
            { status: 400 }
          );
        }
        confirmedByRole = 'GURU_PIKET';
      } else if (!isAdmin) {
        return NextResponse.json(
          { error: 'Pilih presensi Guru Piket hari ini yang sudah dikonfirmasi Admin, atau login sebagai Admin.' },
          { status: 403 }
        );
      }

      const { data: event } = await supabase
        .from('school_events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (!event || !event.is_active) {
        return NextResponse.json({ error: 'Acara tidak ditemukan atau sedang nonaktif.' }, { status: 404 });
      }

      if (event.event_type === 'RUTIN_MINGGUAN') {
        const dayOfWeek = getIsoDayOfWeek(event_date);
        if (event.day_of_week !== dayOfWeek) {
          return NextResponse.json(
            { error: 'Tanggal yang dipilih tidak sesuai dengan hari pelaksanaan acara rutin mingguan ini.' },
            { status: 400 }
          );
        }
      } else {
        if (
          (event.start_date && event_date < event.start_date) ||
          (event.end_date && event_date > event.end_date)
        ) {
          return NextResponse.json(
            { error: 'Tanggal yang dipilih berada di luar rentang tanggal acara insidental ini.' },
            { status: 400 }
          );
        }
      }

      const { data: confirmation, error: confErr } = await supabase
        .from('event_teacher_confirmations')
        .insert({
          event_id,
          teacher_id,
          event_date,
          confirmed_by_role: confirmedByRole,
          confirmed_by_profile_id: guard.session.userId,
          picket_attendance_id: picket_attendance_id || null,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single();

      if (confErr) {
        if (confErr.code === '23505') {
          return NextResponse.json(
            { error: 'Kehadiran guru pada acara dan tanggal tersebut sudah dikonfirmasi.' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: confErr.message }, { status: 500 });
      }

      return NextResponse.json({ confirmation });
    }

    if (body.action === 'SUBMIT_EVENT_JOURNAL') {
      const parsed = SubmitEventJournalSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data jurnal acara tidak valid.' },
          { status: 400 }
        );
      }

      const { data: confirmation, error: confErr } = await supabase
        .from('event_teacher_confirmations')
        .select('*, event:school_events(id, title, jtm_allocated)')
        .eq('id', parsed.data.confirmation_id)
        .single();

      if (confErr || !confirmation) {
        return NextResponse.json(
          { error: 'Konfirmasi kehadiran acara tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (!isAdmin) {
        const { data: currentTeacher } = await supabase
          .from('teachers_staff')
          .select('id')
          .eq('profile_id', guard.session.userId)
          .maybeSingle();

        if (currentTeacher && currentTeacher.id !== confirmation.teacher_id) {
          return NextResponse.json(
            { error: 'Anda hanya dapat mengisi Jurnal Acara untuk kehadiran Anda sendiri.' },
            { status: 403 }
          );
        }
      }

      const { data: existingJournal } = await supabase
        .from('event_journals')
        .select('id')
        .eq('confirmation_id', confirmation.id)
        .maybeSingle();

      if (existingJournal) {
        return NextResponse.json(
          { error: 'Jurnal Acara untuk jadwal kehadiran ini sudah pernah diisi.' },
          { status: 400 }
        );
      }

      const eventObj = Array.isArray(confirmation.event) ? confirmation.event[0] : confirmation.event;
      const jtmCredited = Number(eventObj?.jtm_allocated ?? 2);

      const { data: journal, error: journalErr } = await supabase
        .from('event_journals')
        .insert({
          confirmation_id: confirmation.id,
          event_id: confirmation.event_id,
          teacher_id: confirmation.teacher_id,
          journal_date: confirmation.event_date,
          summary: parsed.data.summary.trim(),
          outcomes: parsed.data.outcomes?.trim() || null,
          jtm_credited: jtmCredited,
          submitted_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (journalErr || !journal) {
        return NextResponse.json(
          { error: journalErr?.message || 'Gagal menyimpan Jurnal Acara.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ journal, jtmCredited });
    }

    return NextResponse.json({ error: 'Aksi acara tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data acara.' }, { status: 500 });
  }
}
