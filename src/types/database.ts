export type InstitutionType = 'MADRASAH' | 'SEKOLAH';

export type AppRole =
  | 'SUPERADMIN'
  | 'OPERATOR'
  | 'KEPALA_LEMBAGA'
  | 'WAKA_KESISWAAN'
  | 'WAKA_KURIKULUM'
  | 'WAKA_HUMAS'
  | 'WAKA_SARPRAS'
  | 'KEPALA_TU'
  | 'STAF_TU'
  | 'GURU'
  | 'WALI_KELAS'
  | 'GURU_WALI'
  | 'GURU_BK'
  | 'BENDAHARA'
  | 'BENDAHARA_KOMITE'
  | 'PENGELOLA_TABUNGAN'
  | 'PEMBINA_OSIM'
  | 'PEMBINA_EKSTRAKURIKULER'
  | 'PUSTAKAWAN'
  | 'SISWA'
  | 'ORANG_TUA'
  | 'ALUMNI'
  | 'UMUM';

export interface InstitutionSettings {
  id: string;
  institution_type: InstitutionType;
  name: string;
  short_name: string | null;
  npsn: string | null;
  nsm: string | null;
  accreditation: string | null;
  accreditation_year: number | null;
  student_org_label: string;
  head_title_label: string;
  logo_url: string | null;
  hero_image_url: string | null;
  history: string | null;
  vision: string | null;
  mission: string[];
  org_structure_url: string | null;
  headmaster_name: string | null;
  headmaster_photo_url: string | null;
  headmaster_greeting: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website_url: string | null;
  google_maps_embed_url: string | null;
  geofence_enabled?: boolean;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_meters: number;
  social_links: {
    youtube?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
}

export interface AdditionalDutyType {
  id: string;
  code: string;
  name: string;
  receives_allowance: boolean;
  monthly_allowance: number;
  description: string | null;
  is_active: boolean;
}

export interface PostItem {
  id: string;
  title: string;
  slug: string;
  category: 'BERITA' | 'ARTIKEL' | 'PENGUMUMAN' | 'KARYA_GURU' | 'KARYA_SISWA';
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author_display_name: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  published_at: string | null;
  created_at?: string | null;
}

export interface Student {
  id: string;
  nis: string | null;
  nisn: string | null;
  nik: string | null;
  full_name: string;
  gender: 'L' | 'P' | null;
  birth_place: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  father_name: string | null;
  mother_name: string | null;
  status: 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF';
  qr_token: string | null;
}

export interface TeacherStaff {
  id: string;
  staff_type: 'GURU' | 'TATA_USAHA' | 'LAINNYA';
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  employment_status: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  show_in_public_directory: boolean;
}
