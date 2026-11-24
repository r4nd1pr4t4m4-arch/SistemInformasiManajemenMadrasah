export type BukuIndukSection = 'siswa' | 'gtk' | 'penempatan-akun';

export interface StudentRow {
  id: string;
  nis: string | null;
  nisn: string | null;
  nik?: string | null;
  full_name: string;
  gender: 'L' | 'P' | null;
  birth_place?: string | null;
  birth_date?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
}

export interface EmploymentHistoryRow {
  id: string;
  position_title: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TeacherRow {
  id: string;
  staff_type: string;
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  nik?: string | null;
  gender?: 'L' | 'P' | null;
  employment_status: string | null;
  education_level?: string | null;
  major?: string | null;
  phone?: string | null;
  email?: string | null;
  employment_histories?: EmploymentHistoryRow[] | null;
}

export interface ActiveAccountRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: string;
  is_student: boolean;
  is_teacher: boolean;
  is_library_member: boolean;
}

export const STUDENT_PAGE_SIZE = 20;

export type SubmitEntityFn = (body: unknown, msg: string) => Promise<boolean>;

export type ShowToastFn = (type: 'success' | 'error', text: string) => void;
