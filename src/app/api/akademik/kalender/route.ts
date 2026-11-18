import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { hasAnyRole } from '@/lib/auth/session';
import { processPaidHolidayJtm } from '@/lib/domain/paid-holiday-jtm';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';

const CreateCalendarSchema = z.object({
  action: z.literal('CREATE_CALENDAR_EVENT'),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.'),
  title: z.string().min(3, 'Judul agenda/libur minimal 3 karakter.'),
  category: z.enum([
    'LIBUR_BERBAYAR',
    'LIBUR_TIDAK_BERBAYAR',
    'HARI_EFEKTIF',
    'AGENDA_KHUSUS',
  ]),
  description: z.string().optional().nullable(),
});

const DeleteCalendarSchema = z.object({
  action: z.literal('DELETE_CALENDAR_EVENT'),
  event_id: z.string().uuid(),
});

const RunAutoJtmSchema = z.object({
  action: z.literal('RUN_AUTO_JTM_NOW'),
  date: z.string().optional(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.KALENDER_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  const canManageCalendar = hasAnyRole(guard.session, PERMISSIONS.KALENDER_MANAGE);

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      events: [],
      logs: [],
      todayDate: getWibTodayDateString(),
      canManageCalendar,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: events }, { data: logs }] = await Promise.all([
    supabase
      .from('academic_calendar_events')
      .select('*')
      .order('event_date', { ascending: false })
      .limit(150),
    supabase
      .from('paid_holiday_jtm_logs')
      .select('*, teacher:teachers_staff(full_name), calendar_event:academic_calendar_events(title)')
      .order('created_at', { ascending: false })
      .limit(150),
  ]);

  const isGlobalLogsViewer = hasAnyRole(guard.session, [
    'SUPERADMIN',
    'OPERATOR',
    'KEPALA_LEMBAGA',
    'WAKA_KURIKULUM',
    'WAKA_KESISWAAN',
    'KEPALA_TU',
    'STAF_TU',
    'BENDAHARA',
  ]);
  const myTeacherId = guard.session.teacherAssignments?.teacherId;
  const scopedLogs =
    !isGlobalLogsViewer && myTeacherId
      ? (logs || []).filter((l) => l.teacher_id === myTeacherId)
      : logs || [];

  return NextResponse.json({
    events: events || [],
    logs: scopedLogs,
    todayDate: getWibTodayDateString(),
    canManageCalendar,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.KALENDER_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_CALENDAR_EVENT') {
      const parsed = CreateCalendarSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data kalender tidak valid.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('academic_calendar_events')
        .upsert(
          {
            event_date: parsed.data.event_date,
            title: parsed.data.title.trim(),
            category: parsed.data.category,
            description: parsed.data.description?.trim() || null,
            created_by: guard.session.userId,
          },
          { onConflict: 'event_date' }
        )
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ event: data });
    }

    if (body.action === 'DELETE_CALENDAR_EVENT') {
      const parsed = DeleteCalendarSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID agenda tidak valid.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('academic_calendar_events')
        .delete()
        .eq('id', parsed.data.event_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'RUN_AUTO_JTM_NOW') {
      const parsed = RunAutoJtmSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parameter tidak valid.' }, { status: 400 });
      }
      const result = await processPaidHolidayJtm(parsed.data.date || getWibTodayDateString());
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Aksi kalender tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses Kalender Pendidikan.' }, { status: 500 });
  }
}
