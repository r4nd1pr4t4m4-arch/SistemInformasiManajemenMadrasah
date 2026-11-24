export type KalenderSection = 'agenda' | 'log-jtm';

export type CalendarEventCategory =
  | 'LIBUR_BERBAYAR'
  | 'LIBUR_TIDAK_BERBAYAR'
  | 'HARI_EFEKTIF'
  | 'AGENDA_KHUSUS';

export interface CalendarEventRow {
  id: string;
  event_date: string;
  title: string;
  category: CalendarEventCategory;
  description: string | null;
  auto_jtm_processed: boolean;
  auto_jtm_processed_at: string | null;
}

export interface PaidHolidayLogRow {
  id: string;
  holiday_date: string;
  teaching_jtm: number;
  picket_jtm: number;
  total_jtm: number;
  email_sent: boolean;
  details: string | null;
  teacher?: { full_name: string } | null;
  calendar_event?: { title: string } | null;
}

export interface CalendarEventFormState {
  event_date: string;
  title: string;
  category: CalendarEventCategory;
  description: string;
}

export interface KalenderPostResponse {
  result?: {
    isPaidHoliday: boolean;
    message: string;
  } | null;
  [key: string]: unknown;
}

export type PostKalenderFn = (body: unknown) => Promise<KalenderPostResponse | null>;

export type ShowToastFn = (type: 'success' | 'error', text: string) => void;

export const CATEGORY_LABELS: Record<CalendarEventCategory, string> = {
  LIBUR_BERBAYAR: 'Libur Berbayar (Otomatis JTM)',
  LIBUR_TIDAK_BERBAYAR: 'Libur Tidak Berbayar',
  HARI_EFEKTIF: 'Hari Efektif Belajar',
  AGENDA_KHUSUS: 'Agenda Khusus Lembaga',
};

export const CATEGORY_BADGES: Record<CalendarEventCategory, string> = {
  LIBUR_BERBAYAR: 'bg-emerald-50 text-emerald-700',
  LIBUR_TIDAK_BERBAYAR: 'bg-rose-50 text-rose-700',
  HARI_EFEKTIF: 'bg-sky-50 text-sky-700',
  AGENDA_KHUSUS: 'bg-amber-50 text-amber-700',
};

export const PAGE_SIZE = 8;

export function computeAgendaStats(events: CalendarEventRow[]) {
  const paidHolidays = events.filter((e) => e.category === 'LIBUR_BERBAYAR');
  const processedCount = paidHolidays.filter((e) => e.auto_jtm_processed).length;
  const pendingCount = paidHolidays.length - processedCount;
  return {
    total: events.length,
    paidHolidays: paidHolidays.length,
    processedCount,
    pendingCount,
  };
}

export function computeLogStats(logs: PaidHolidayLogRow[]) {
  const totalJtm = Number(
    logs.reduce((acc, l) => acc + Number(l.total_jtm || 0), 0).toFixed(2)
  );
  const emailSent = logs.filter((l) => l.email_sent).length;
  return {
    total: logs.length,
    totalJtm,
    emailSent,
    emailUnsent: logs.length - emailSent,
  };
}
