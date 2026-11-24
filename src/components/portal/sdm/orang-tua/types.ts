export type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type StudentRef = {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  status: string;
};

export type GuardianRelationship = 'AYAH' | 'IBU' | 'WALI';

export type GuardianItem = {
  id: string;
  student_id: string;
  profile_id: string | null;
  relationship: GuardianRelationship;
  full_name: string;
  nik: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  is_primary: boolean;
  is_active: boolean;
  student?: StudentRef | null;
  profile?: ActiveAccount | null;
};

export type GuardianFormState = {
  student_id: string;
  profile_id: string;
  relationship: GuardianRelationship;
  full_name: string;
  nik: string;
  phone: string;
  email: string;
  occupation: string;
  address: string;
  is_primary: boolean;
  is_active: boolean;
};

export type GuardianStats = {
  total: number;
  linked: number;
  primary: number;
  active: number;
};

export const EMPTY_FORM: GuardianFormState = {
  student_id: '',
  profile_id: '',
  relationship: 'WALI',
  full_name: '',
  nik: '',
  phone: '',
  email: '',
  occupation: '',
  address: '',
  is_primary: true,
  is_active: true,
};

export const RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  AYAH: 'Ayah',
  IBU: 'Ibu',
  WALI: 'Wali',
};

export const PAGE_SIZE = 12;

export function guardianToFormState(item: GuardianItem): GuardianFormState {
  return {
    student_id: item.student_id,
    profile_id: item.profile_id || '',
    relationship: item.relationship || 'WALI',
    full_name: item.full_name || '',
    nik: item.nik || '',
    phone: item.phone || '',
    email: item.email || '',
    occupation: item.occupation || '',
    address: item.address || '',
    is_primary: item.is_primary,
    is_active: item.is_active,
  };
}
