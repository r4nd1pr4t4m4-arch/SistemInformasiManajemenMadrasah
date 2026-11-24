export type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type StudentGender = 'L' | 'P';

export type StudentStatus = 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF';

export type StudentItem = {
  id: string;
  profile_id: string | null;
  nis: string | null;
  nisn: string | null;
  nik: string | null;
  full_name: string;
  gender: StudentGender | null;
  birth_place: string | null;
  birth_date: string | null;
  religion: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  entry_year: number | null;
  graduation_year: number | null;
  status: StudentStatus;
  profile?: ActiveAccount | null;
};

export type StudentFormState = {
  full_name: string;
  nis: string;
  nisn: string;
  nik: string;
  gender: StudentGender;
  birth_place: string;
  birth_date: string;
  religion: string;
  phone: string;
  email: string;
  address: string;
  father_name: string;
  mother_name: string;
  guardian_name: string;
  entry_year: string;
  graduation_year: string;
  status: StudentStatus;
  profile_id: string;
};

export type StudentStats = {
  total: number;
  aktif: number;
  lulus: number;
  mutasi: number;
};

export const EMPTY_FORM: StudentFormState = {
  full_name: '',
  nis: '',
  nisn: '',
  nik: '',
  gender: 'L',
  birth_place: '',
  birth_date: '',
  religion: 'Islam',
  phone: '',
  email: '',
  address: '',
  father_name: '',
  mother_name: '',
  guardian_name: '',
  entry_year: String(new Date().getFullYear()),
  graduation_year: '',
  status: 'AKTIF',
  profile_id: '',
};

export const STATUS_BADGES: Record<StudentStatus, string> = {
  AKTIF: 'bg-emerald-100 text-emerald-700',
  LULUS: 'bg-blue-100 text-blue-700',
  MUTASI: 'bg-amber-100 text-amber-700',
  NONAKTIF: 'bg-slate-200 text-slate-700',
};

export const PAGE_SIZE = 12;

export function studentToForm(item: StudentItem): StudentFormState {
  return {
    full_name: item.full_name || '',
    nis: item.nis || '',
    nisn: item.nisn || '',
    nik: item.nik || '',
    gender: item.gender || 'L',
    birth_place: item.birth_place || '',
    birth_date: item.birth_date || '',
    religion: item.religion || 'Islam',
    phone: item.phone || '',
    email: item.email || '',
    address: item.address || '',
    father_name: item.father_name || '',
    mother_name: item.mother_name || '',
    guardian_name: item.guardian_name || '',
    entry_year: item.entry_year ? String(item.entry_year) : '',
    graduation_year: item.graduation_year ? String(item.graduation_year) : '',
    status: item.status || 'AKTIF',
    profile_id: item.profile_id || '',
  };
}

export function buildStudentPayload(
  form: StudentFormState,
  editingId: string | null
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const trimmedName = form.full_name.trim();
  if (trimmedName.length < 2) {
    return { ok: false, error: 'Nama lengkap siswa minimal 2 karakter.' };
  }

  const entryYearNum = form.entry_year ? Number(form.entry_year) : null;
  const gradYearNum = form.graduation_year ? Number(form.graduation_year) : null;
  if (
    entryYearNum !== null &&
    (!Number.isInteger(entryYearNum) || entryYearNum < 1980 || entryYearNum > 2100)
  ) {
    return { ok: false, error: 'Tahun masuk harus antara 1980 dan 2100.' };
  }
  if (
    gradYearNum !== null &&
    (!Number.isInteger(gradYearNum) || gradYearNum < 1980 || gradYearNum > 2100)
  ) {
    return { ok: false, error: 'Tahun lulus harus antara 1980 dan 2100.' };
  }

  return {
    ok: true,
    payload: {
      scope: 'siswa',
      ...(editingId ? { id: editingId } : {}),
      ...form,
      full_name: trimmedName,
      nis: form.nis.trim(),
      nisn: form.nisn.trim(),
      nik: form.nik.trim(),
      birth_place: form.birth_place.trim(),
      religion: form.religion.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      father_name: form.father_name.trim(),
      mother_name: form.mother_name.trim(),
      guardian_name: form.guardian_name.trim(),
      entry_year: entryYearNum,
      graduation_year: gradYearNum,
    },
  };
}
