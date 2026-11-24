export type KelasJadwalSection = 'rombel' | 'mapel' | 'jadwal';

export interface TeacherOpt {
  id: string;
  full_name: string;
}

export interface StudentOpt {
  id: string;
  full_name: string;
  nis?: string | null;
  nisn?: string | null;
  status?: string | null;
}

export interface EnrollmentRow {
  id: string;
  student_id: string;
  classroom_id: string;
  student?: { full_name: string; nis?: string | null; nisn?: string | null } | null;
  classroom?: { name: string } | null;
}

export interface ClassroomRow {
  id: string;
  name: string;
  grade_level: string;
  homeroom_teacher_id?: string | null;
  room_location?: string | null;
  homeroom_teacher?: { id: string; full_name: string } | null;
}

export interface SubjectRow {
  id: string;
  code: string;
  name: string;
  subject_group?: string | null;
}

export interface ScheduleRow {
  id: string;
  classroom_id?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  jtm_count: number;
  classroom?: { name: string } | null;
  subject?: { name: string; code?: string | null } | null;
  teacher?: { full_name: string } | null;
}

export type ShowToastFn = (type: 'success' | 'error', text: string) => void;

export type PostActionFn = (body: unknown, msg: string) => Promise<boolean>;

export const SCHEDULE_PAGE_SIZE = 20;

export const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];
