export type SdmAlumniSection = 'lulusan' | 'tracer';

export type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type AlumniStudent = {
  id: string;
  profile_id: string | null;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  graduation_year: number | null;
  profile?: ActiveAccount | null;
};

export type ActiveStudent = {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
};

export type AlumniTracer = {
  id: string;
  student_id: string | null;
  full_name: string;
  graduation_year: number;
  phone: string | null;
  email: string | null;
  current_activity: 'KULIAH' | 'BEKERJA' | 'WIRAUSAHA' | 'PESANTREN' | 'MENCARI_KERJA' | 'LAINNYA';
  institution_or_company: string | null;
  major_or_position: string | null;
  city: string | null;
  testimonial: string | null;
};

export type WorkspaceMessage = {
  type: 'ok' | 'err';
  text: string;
};

export const EMPTY_TRACER_FORM = {
  student_id: '',
  full_name: '',
  graduation_year: String(new Date().getFullYear()),
  phone: '',
  email: '',
  current_activity: 'KULIAH' as AlumniTracer['current_activity'],
  institution_or_company: '',
  major_or_position: '',
  city: '',
  testimonial: '',
};

export type TracerFormState = typeof EMPTY_TRACER_FORM;

export const ACTIVITY_LABELS: Record<AlumniTracer['current_activity'], string> = {
  KULIAH: 'Kuliah',
  BEKERJA: 'Bekerja',
  WIRAUSAHA: 'Wirausaha',
  PESANTREN: 'Pesantren',
  MENCARI_KERJA: 'Mencari Kerja',
  LAINNYA: 'Lainnya',
};

export const PAGE_SIZE = 12;
