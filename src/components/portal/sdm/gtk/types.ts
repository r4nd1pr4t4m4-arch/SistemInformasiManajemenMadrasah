export type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type GtkItem = {
  id: string;
  profile_id: string | null;
  staff_type: 'GURU' | 'TATA_USAHA' | 'LAINNYA';
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  nik: string | null;
  gender: 'L' | 'P' | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  education_level: string | null;
  major: string | null;
  last_campus: string | null;
  graduation_year: number | null;
  thesis_title: string | null;
  thesis_abstract: string | null;
  thesis_keywords: string[] | null;
  thesis_article_url: string | null;
  employment_status: string | null;
  join_date: string | null;
  is_active: boolean;
  show_in_public_directory: boolean;
  profile?: ActiveAccount | null;
};

export type GtkFormState = {
  full_name: string;
  staff_type: 'GURU' | 'TATA_USAHA' | 'LAINNYA';
  nip: string;
  nuptk: string;
  nik: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  phone: string;
  email: string;
  address: string;
  education_level: string;
  major: string;
  last_campus: string;
  graduation_year: string;
  thesis_title: string;
  thesis_abstract: string;
  thesis_keywords: string;
  thesis_article_url: string;
  employment_status: string;
  join_date: string;
  profile_id: string;
  is_active: boolean;
  show_in_public_directory: boolean;
};

export type GtkStats = {
  total: number;
  guru: number;
  tu: number;
  active: number;
};

export const EMPTY_FORM: GtkFormState = {
  full_name: '',
  staff_type: 'GURU',
  nip: '',
  nuptk: '',
  nik: '',
  gender: 'L',
  birth_place: '',
  birth_date: '',
  phone: '',
  email: '',
  address: '',
  education_level: 'S1',
  major: '',
  last_campus: '',
  graduation_year: '',
  thesis_title: '',
  thesis_abstract: '',
  thesis_keywords: '',
  thesis_article_url: '',
  employment_status: 'GTY',
  join_date: '',
  profile_id: '',
  is_active: true,
  show_in_public_directory: true,
};

export const STAFF_TYPE_LABELS: Record<GtkItem['staff_type'], string> = {
  GURU: 'Guru',
  TATA_USAHA: 'Tata Usaha',
  LAINNYA: 'Lainnya',
};

export const PAGE_SIZE = 12;
