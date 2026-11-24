import type { HonorariumDutyItem } from '@/lib/cards/honorarium-slip-png';

export type HonorariumSection = 'tarif-jam' | 'jarak-guru' | 'tugas-tambahan' | 'rekap';

export interface TeacherOption {
  id: string;
  full_name: string;
  home_distance_km?: number;
}

export interface HonorariumRow {
  id: string;
  period_month: number;
  period_year: number;
  teaching_jtm?: number;
  substitute_jtm?: number;
  exam_supervisor_jtm?: number;
  exam_committee_jtm?: number;
  event_jtm?: number;
  picket_jtm?: number;
  ceremony_jtm?: number;
  paid_holiday_jtm?: number;
  total_jtm: number;
  rate_per_jtm?: number;
  jtm_honorarium_amount: number;
  additional_duty_allowance: number;
  transport_allowance?: number;
  total_amount: number;
  status: string;
  teacher?: { full_name: string; nip?: string | null; home_distance_km?: number | null } | null;
  items?: HonorariumDutyItem[];
}

export interface DailyHourRow {
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
}

export interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export interface RateSnapshot {
  ratePerJtm: number;
  transportRatePerKm: number;
  schoolStartTime: string;
  schoolEndTime: string;
}

export interface AcademicYearOption {
  id: string;
  name: string;
  semester: 'GANJIL' | 'GENAP' | string;
  is_active: boolean;
}

export interface TeacherDutyAssignment {
  id: string;
  teacher_id: string;
  duty_type_id: string;
  academic_year_id?: string | null;
  decree_number?: string | null;
  is_active?: boolean;
  teacher?: { full_name: string } | null;
  duty_type?: {
    code: string;
    name: string;
    receives_allowance: boolean;
    monthly_allowance: number;
  } | null;
  academic_year?: AcademicYearOption | null;
}

export type CallHonorApiFn = (
  method: 'POST' | 'PATCH' | 'DELETE',
  body: { action?: string; [key: string]: unknown },
  msg: string
) => Promise<boolean>;

export type ShowToastFn = (message: string, type?: 'success' | 'error') => void;

export const DAY_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export function parseTimeMinutes(timeStr: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatDurationLabel(startTime: string, endTime: string): string {
  const start = parseTimeMinutes(startTime);
  const end = parseTimeMinutes(endTime);
  if (start === null || end === null) return 'Format jam tidak valid';
  const diff = end - start;
  if (diff <= 0) return 'Jam pulang harus > masuk';
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours} jam ${mins} mnt` : `${hours} jam`;
}
