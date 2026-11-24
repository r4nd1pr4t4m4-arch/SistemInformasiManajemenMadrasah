export type AcaraSection = 'kegiatan' | 'konfirmasi' | 'upacara';

export interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: 'RUTIN_MINGGUAN' | 'INSIDENTAL';
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  jtm_allocated: number;
  is_active: boolean;
}

export interface TeacherOpt {
  id: string;
  full_name: string;
}

export interface PicketAttOpt {
  id: string;
  teacher_id: string;
  attendance_date: string;
  teacher?: { full_name: string } | null;
}

export interface ConfirmationRow {
  id: string;
  event_date: string;
  confirmed_by_role: 'ADMIN' | 'GURU_PIKET';
  event?: { title: string; jtm_allocated: number } | null;
  teacher?: { full_name: string } | null;
}

export interface CeremonyRow {
  id: string;
  ceremony_date: string;
  teacher_id: string;
  original_teacher_id: string | null;
  jtm_allocated: number;
  status: 'TERJADWAL' | 'TERLAKSANA' | 'DIBATALKAN';
  substitution_reason: string | null;
  substituted_by_role: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

export const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export type PostAcaraFn = (body: unknown, successMsg: string) => Promise<boolean>;

export type ShowToastFn = (type: 'success' | 'error', text: string) => void;
