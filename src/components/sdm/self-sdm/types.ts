import type { SdmDocumentItem } from '@/components/sdm/sdm-document-section';

export type SelfSdmRoleScope = 'gtk' | 'orang-tua';
export type SelfSdmSection = 'biodata' | 'dokumen';

export const GTK_DOC_OPTIONS = [
  { value: 'KTP', label: 'KTP' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'IJAZAH_TERAKHIR', label: 'Ijazah Pendidikan Terakhir' },
  { value: 'SK_PENGANGKATAN', label: 'SK Pengangkatan (PNS/PPPK/GTY/GTT)' },
  { value: 'SK_PEMBAGIAN_TUGAS', label: 'SK Pembagian Tugas Mengajar' },
  { value: 'SERTIFIKAT_PENDIDIK', label: 'Sertifikat Pendidik / NRG' },
  { value: 'NPWP', label: 'NPWP' },
  { value: 'BUKU_REKENING', label: 'Buku Rekening Honorarium' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

export const ORANG_TUA_DOC_OPTIONS = [
  { value: 'KTP', label: 'KTP Orang Tua / Wali' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'SURAT_KUASA_WALI', label: 'Surat Kuasa / Keterangan Perwalian' },
  { value: 'KIP_KKS_PKH', label: 'Kartu Bantuan (KIP / KKS / PKH)' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

export interface GtkSelfPayload {
  teacher: Record<string, unknown>;
  employmentHistories: Record<string, unknown>[];
  additionalDuties: Record<string, unknown>[];
  documents: SdmDocumentItem[];
  sharedStudentDocuments?: SdmDocumentItem[];
}

export interface GuardianSelfPayload {
  id: string;
  full_name: string;
  relationship: string;
  nik: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  rt_rw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  is_primary?: boolean;
  student?: {
    id?: string;
    full_name?: string;
    nis?: string | null;
    nisn?: string | null;
    status?: string | null;
  } | null;
  documents: SdmDocumentItem[];
  sharedStudentDocuments?: SdmDocumentItem[];
}

export interface GtkFormState {
  id: string;
  full_name: string;
  nip: string;
  nuptk: string;
  nik: string;
  gender: string;
  birth_place: string;
  birth_date: string;
  phone: string;
  email: string;
  address: string;
  rt_rw: string;
  village: string;
  district: string;
  city: string;
  province: string;
  education_level: string;
  major: string;
  last_campus: string;
  graduation_year: string;
  thesis_title: string;
  thesis_abstract: string;
  thesis_keywords: string;
  thesis_article_url: string;
}

export interface GuardianFormState {
  full_name: string;
  relationship: string;
  nik: string;
  phone: string;
  email: string;
  occupation: string;
  address: string;
  rt_rw: string;
  village: string;
  district: string;
  city: string;
  province: string;
}

export interface ToastState {
  type: 'ok' | 'err';
  text: string;
}

export const INITIAL_GTK_FORM: GtkFormState = {
  id: '',
  full_name: '',
  nip: '',
  nuptk: '',
  nik: '',
  gender: 'L',
  birth_place: '',
  birth_date: '',
  phone: '',
  email: '',
  address: '',
  rt_rw: '',
  village: '',
  district: '',
  city: '',
  province: '',
  education_level: '',
  major: '',
  last_campus: '',
  graduation_year: '',
  thesis_title: '',
  thesis_abstract: '',
  thesis_keywords: '',
  thesis_article_url: '',
};

export function mapTeacherToGtkForm(teacher: Record<string, unknown>): GtkFormState {
  return {
    id: String(teacher.id || ''),
    full_name: String(teacher.full_name || ''),
    nip: String(teacher.nip || ''),
    nuptk: String(teacher.nuptk || ''),
    nik: String(teacher.nik || ''),
    gender: teacher.gender === 'P' ? 'P' : 'L',
    birth_place: String(teacher.birth_place || ''),
    birth_date: String(teacher.birth_date || ''),
    phone: String(teacher.phone || ''),
    email: String(teacher.email || ''),
    address: String(teacher.address || ''),
    rt_rw: String(teacher.rt_rw || ''),
    village: String(teacher.village || ''),
    district: String(teacher.district || ''),
    city: String(teacher.city || ''),
    province: String(teacher.province || ''),
    education_level: String(teacher.education_level || ''),
    major: String(teacher.major || ''),
    last_campus: String(teacher.last_campus || ''),
    graduation_year: teacher.graduation_year != null ? String(teacher.graduation_year) : '',
    thesis_title: String(teacher.thesis_title || ''),
    thesis_abstract: String(teacher.thesis_abstract || ''),
    thesis_keywords: Array.isArray(teacher.thesis_keywords)
      ? (teacher.thesis_keywords as string[]).join(', ')
      : String(teacher.thesis_keywords || ''),
    thesis_article_url: String(teacher.thesis_article_url || ''),
  };
}

export function mapGuardiansToForms(
  guardians: GuardianSelfPayload[],
): Record<string, GuardianFormState> {
  const nextForms: Record<string, GuardianFormState> = {};
  for (const g of guardians) {
    nextForms[g.id] = {
      full_name: g.full_name || '',
      relationship: g.relationship || 'WALI',
      nik: g.nik || '',
      phone: g.phone || '',
      email: g.email || '',
      occupation: g.occupation || '',
      address: g.address || '',
      rt_rw: g.rt_rw || '',
      village: g.village || '',
      district: g.district || '',
      city: g.city || '',
      province: g.province || '',
    };
  }
  return nextForms;
}
