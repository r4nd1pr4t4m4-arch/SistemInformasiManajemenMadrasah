export type DocumentType =
  | 'KK'
  | 'AKTA_KELAHIRAN'
  | 'IJAZAH_MI_SD'
  | 'IJAZAH_RA_TK'
  | 'KTP_AYAH'
  | 'KTP_IBU'
  | 'KTP_WALI'
  | 'KIP'
  | 'BPJS_KIS'
  | 'KKS'
  | 'PKH'
  | 'LAINNYA';

export type DocFilter = 'ALL' | 'UPLOADED' | 'MISSING' | 'VERIFIED';

export type BiodataDokumenSection = 'biodata' | 'dokumen';

export interface StudentDocument {
  id: string;
  student_id: string;
  document_type: DocumentType;
  document_title: string | null;
  document_number: string | null;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  verification_status: 'MENUNGGU' | 'TERVERIFIKASI' | 'DITOLAK';
  verification_notes: string | null;
  updated_at: string;
}

export interface StudentRef {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
}

export const STANDARD_DOCUMENTS: Array<{
  type: Exclude<DocumentType, 'LAINNYA'>;
  label: string;
  description: string;
}> = [
  { type: 'KK', label: 'Kartu Keluarga (KK)', description: 'Scan/foto Kartu Keluarga terbaru yang jelas.' },
  { type: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran', description: 'Scan Akta Kelahiran asli/legalisir.' },
  { type: 'IJAZAH_MI_SD', label: 'Ijazah MI / SD / Sederajat', description: 'Scan Ijazah atau SKL jenjang MI/SD.' },
  { type: 'IJAZAH_RA_TK', label: 'Ijazah RA / TK', description: 'Scan Ijazah atau surat tamat belajar RA/TK.' },
  { type: 'KTP_AYAH', label: 'KTP Ayah', description: 'Scan/foto KTP Ayah kandung.' },
  { type: 'KTP_IBU', label: 'KTP Ibu', description: 'Scan/foto KTP Ibu kandung.' },
  { type: 'KTP_WALI', label: 'KTP Wali', description: 'Scan/foto KTP Wali (jika tinggal bersama wali).' },
  { type: 'KIP', label: 'Kartu Indonesia Pintar (KIP)', description: 'Scan Kartu KIP jika memiliki.' },
  { type: 'BPJS_KIS', label: 'BPJS Kesehatan / KIS', description: 'Scan Kartu BPJS Kesehatan atau KIS.' },
  { type: 'KKS', label: 'Kartu Keluarga Sejahtera (KKS)', description: 'Scan Kartu KKS jika keluarga memiliki.' },
  { type: 'PKH', label: 'Kartu PKH', description: 'Scan Kartu Program Keluarga Harapan (PKH) jika memiliki.' },
];

export const EMPTY_BIODATA = {
  full_name: '',
  nis: '',
  nisn: '',
  nik: '',
  kk_number: '',
  birth_certificate_number: '',
  gender: 'L' as 'L' | 'P',
  birth_place: '',
  birth_date: '',
  religion: 'Islam',
  child_order: '',
  siblings_count: '',
  phone: '',
  email: '',
  address: '',
  rt_rw: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postal_code: '',
  previous_school: '',
  previous_school_npsn: '',
  kip_number: '',
  kis_number: '',
  kks_number: '',
  pkh_number: '',
  father_name: '',
  father_nik: '',
  father_job: '',
  father_phone: '',
  mother_name: '',
  mother_nik: '',
  mother_job: '',
  mother_phone: '',
  guardian_name: '',
  guardian_nik: '',
  guardian_job: '',
  guardian_phone: '',
};

export type BiodataFormState = typeof EMPTY_BIODATA;

export function mapStudentToBiodata(
  student: Record<string, unknown>,
  profileEmail?: string | null
): BiodataFormState {
  const str = (key: string, fallback = '') => {
    const val = student[key];
    return typeof val === 'string' && val ? val : fallback;
  };
  const coVal = student.child_order;
  const scVal = student.siblings_count;
  return {
    full_name: str('full_name'),
    nis: str('nis'),
    nisn: str('nisn'),
    nik: str('nik'),
    kk_number: str('kk_number'),
    birth_certificate_number: str('birth_certificate_number'),
    gender: (student.gender as 'L' | 'P') || 'L',
    birth_place: str('birth_place'),
    birth_date: str('birth_date'),
    religion: str('religion', 'Islam'),
    child_order: coVal != null ? String(coVal) : '',
    siblings_count: scVal != null ? String(scVal) : '',
    phone: str('phone'),
    email: str('email', profileEmail || ''),
    address: str('address'),
    rt_rw: str('rt_rw'),
    village: str('village'),
    district: str('district'),
    city: str('city'),
    province: str('province'),
    postal_code: str('postal_code'),
    previous_school: str('previous_school'),
    previous_school_npsn: str('previous_school_npsn'),
    kip_number: str('kip_number'),
    kis_number: str('kis_number'),
    kks_number: str('kks_number'),
    pkh_number: str('pkh_number'),
    father_name: str('father_name'),
    father_nik: str('father_nik'),
    father_job: str('father_job'),
    father_phone: str('father_phone'),
    mother_name: str('mother_name'),
    mother_nik: str('mother_nik'),
    mother_job: str('mother_job'),
    mother_phone: str('mother_phone'),
    guardian_name: str('guardian_name'),
    guardian_nik: str('guardian_nik'),
    guardian_job: str('guardian_job'),
    guardian_phone: str('guardian_phone'),
  };
}
