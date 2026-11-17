import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import {
  formatWibDateTime,
  isGmailSmtpConfigured,
  sendInstitutionalEmail,
} from '@/lib/email/mailer';
import { buildPaidHolidayJtmEmail } from '@/lib/email/templates';

function getIsoDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

export interface PaidHolidayRunResult {
  date: string;
  isPaidHoliday: boolean;
  holidayTitle?: string;
  teachersCredited: number;
  emailsSent: number;
  message: string;
}

/**
 * Menambahkan JTM otomatis untuk seluruh guru yang memiliki jadwal mengajar atau jadwal piket
 * pada tanggal libur berbayar (dijalankan otomatis pukul 10.00 WIB atau manual oleh Admin).
 */
export async function processPaidHolidayJtm(
  targetDate = getWibTodayDateString()
): Promise<PaidHolidayRunResult> {
  if (!isSupabaseAdminConfigured()) {
    return {
      date: targetDate,
      isPaidHoliday: false,
      teachersCredited: 0,
      emailsSent: 0,
      message: 'Supabase belum dikonfigurasi.',
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: calEvent } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .eq('event_date', targetDate)
    .eq('category', 'LIBUR_BERBAYAR')
    .maybeSingle();

  if (!calEvent) {
    return {
      date: targetDate,
      isPaidHoliday: false,
      teachersCredited: 0,
      emailsSent: 0,
      message: `Tanggal ${targetDate} bukan hari libur berbayar.`,
    };
  }

  const dayOfWeek = getIsoDayOfWeek(targetDate);

  const [
    { data: schedules },
    { data: picketSchedules },
    { data: teachers },
    { data: inst },
  ] = await Promise.all([
    supabase
      .from('schedules')
      .select('teacher_id, jtm_count, start_time, classroom:classrooms(name), subject:subjects(name)')
      .eq('day_of_week', dayOfWeek),
    supabase
      .from('picket_schedules')
      .select('teacher_id, jtm_allocated')
      .eq('day_of_week', dayOfWeek),
    supabase
      .from('teachers_staff')
      .select('id, full_name, email, profile:profiles(email)'),
    supabase
      .from('institution_settings')
      .select('name, address, email')
      .limit(1)
      .maybeSingle(),
  ]);

  const teacherMap = new Map<
    string,
    { full_name: string; email: string | null }
  >();
  for (const t of teachers || []) {
    const prof = Array.isArray(t.profile) ? t.profile[0] : t.profile;
    teacherMap.set(t.id, {
      full_name: t.full_name,
      email: t.email || (prof?.email ?? null),
    });
  }

  const acc = new Map<
    string,
    { teachingJtm: number; picketJtm: number; details: string[] }
  >();

  for (const s of schedules || []) {
    const cur = acc.get(s.teacher_id) || { teachingJtm: 0, picketJtm: 0, details: [] };
    const jtm = Number(s.jtm_count || 0);
    cur.teachingJtm += jtm;
    const cls = Array.isArray(s.classroom) ? s.classroom[0]?.name : (s.classroom as { name?: string } | null)?.name;
    const subj = Array.isArray(s.subject) ? s.subject[0]?.name : (s.subject as { name?: string } | null)?.name;
    cur.details.push(`Mengajar ${cls || ''} ${subj || ''} (${jtm} JTM)`);
    acc.set(s.teacher_id, cur);
  }

  for (const ps of picketSchedules || []) {
    const cur = acc.get(ps.teacher_id) || { teachingJtm: 0, picketJtm: 0, details: [] };
    const jtm = Number(ps.jtm_allocated ?? 2);
    cur.picketJtm += jtm;
    cur.details.push(`Guru Piket (${jtm} JTM)`);
    acc.set(ps.teacher_id, cur);
  }

  let teachersCredited = 0;
  let emailsSent = 0;
  const smtpReady = isGmailSmtpConfigured();
  const processedAtWib = formatWibDateTime();

  for (const [teacherId, entry] of acc.entries()) {
    const totalJtm = Number((entry.teachingJtm + entry.picketJtm).toFixed(2));
    if (totalJtm <= 0) continue;

    const { data: existing } = await supabase
      .from('paid_holiday_jtm_logs')
      .select('id')
      .eq('holiday_date', targetDate)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (existing) continue;

    const detailsText = entry.details.join('; ');
    const { data: inserted, error: insErr } = await supabase
      .from('paid_holiday_jtm_logs')
      .insert({
        calendar_event_id: calEvent.id,
        holiday_date: targetDate,
        teacher_id: teacherId,
        teaching_jtm: entry.teachingJtm,
        picket_jtm: entry.picketJtm,
        total_jtm: totalJtm,
        email_sent: false,
        details: detailsText,
      })
      .select('id')
      .single();

    if (insErr || !inserted) continue;
    teachersCredited += 1;

    const info = teacherMap.get(teacherId);
    if (smtpReady && info?.email) {
      try {
        const tpl = buildPaidHolidayJtmEmail({
          institutionName: inst?.name || 'Portal SIMMS',
          institutionAddress: inst?.address,
          institutionEmail: inst?.email,
          recipientName: info.full_name,
          holidayDate: targetDate,
          holidayTitle: calEvent.title,
          teachingJtm: entry.teachingJtm,
          picketJtm: entry.picketJtm,
          totalJtm,
          details: detailsText,
          processedAtWib,
        });
        await sendInstitutionalEmail({
          senderLabel: inst?.name || 'Admin SIMMS',
          to: info.email,
          ...tpl,
        });
        await supabase
          .from('paid_holiday_jtm_logs')
          .update({ email_sent: true })
          .eq('id', inserted.id);
        emailsSent += 1;
      } catch {
        // Kegagalan kirim email tidak membatalkan pencatatan JTM
      }
    }
  }

  await supabase
    .from('academic_calendar_events')
    .update({
      auto_jtm_processed: true,
      auto_jtm_processed_at: new Date().toISOString(),
    })
    .eq('id', calEvent.id);

  return {
    date: targetDate,
    isPaidHoliday: true,
    holidayTitle: calEvent.title,
    teachersCredited,
    emailsSent,
    message: `Libur Berbayar "${calEvent.title}" (${targetDate}) diproses: ${teachersCredited} guru menerima JTM otomatis, ${emailsSent} email notifikasi terkirim.`,
  };
}
