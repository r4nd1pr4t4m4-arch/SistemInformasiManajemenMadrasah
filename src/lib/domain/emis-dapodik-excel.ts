import * as XLSX from 'xlsx';

export interface EmisDapodikStudentRecord {
  full_name: string;
  nis?: string | null;
  nisn?: string | null;
  nik?: string | null;
  gender: 'L' | 'P';
  birth_place?: string | null;
  birth_date?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
}

export interface EmisDapodikTeacherRecord {
  full_name: string;
  staff_type: 'GURU' | 'TATA_USAHA' | 'LAINNYA';
  nip?: string | null;
  nuptk?: string | null;
  nik?: string | null;
  gender: 'L' | 'P';
  employment_status?: string | null;
  education_level?: string | null;
  major?: string | null;
  phone?: string | null;
  email?: string | null;
  initial_position?: string | null;
}

function normalizeHeaderKey(rawKey: string): string {
  return rawKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getRowField(row: Record<string, unknown>, aliases: string[]): string {
  const normalizedMap = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    const strVal = String(v).trim();
    if (strVal) {
      normalizedMap.set(normalizeHeaderKey(k), strVal);
    }
  }
  for (const alias of aliases) {
    const val = normalizedMap.get(normalizeHeaderKey(alias));
    if (val) return val;
  }
  return '';
}

function normalizeGender(val: string): 'L' | 'P' {
  const clean = val.trim().toUpperCase();
  if (
    clean === 'P' ||
    clean === 'PEREMPUAN' ||
    clean === 'WANITA' ||
    clean === 'F' ||
    clean === 'FEMALE'
  ) {
    return 'P';
  }
  return 'L';
}

function normalizeStaffType(val: string): 'GURU' | 'TATA_USAHA' | 'LAINNYA' {
  const clean = val.trim().toUpperCase().replace(/[\s/-]+/g, '_');
  if (clean.includes('TATA_USAHA') || clean === 'TU' || clean.includes('ADMINISTRASI')) {
    return 'TATA_USAHA';
  }
  if (clean.includes('LAIN')) {
    return 'LAINNYA';
  }
  return 'GURU';
}

function normalizeIsoDate(val: string): string | null {
  const clean = val.trim();
  if (!clean) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(clean);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/**
 * Ekspor daftar siswa Buku Induk ke format Excel standar EMIS (Kemenag) / Dapodik (Kemendikdasmen).
 */
export function exportStudentsEmisDapodikXlsx(
  students: Array<{
    nis?: string | null;
    nisn?: string | null;
    nik?: string | null;
    full_name: string;
    gender?: 'L' | 'P' | null;
    birth_place?: string | null;
    birth_date?: string | null;
    father_name?: string | null;
    mother_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    status?: string | null;
  }>
) {
  const rows = students.map((s, idx) => ({
    No: idx + 1,
    NIS: s.nis || '',
    NISN: s.nisn || '',
    NIK: s.nik || '',
    'Nama Lengkap': s.full_name,
    'L/P': s.gender || 'L',
    'Tempat Lahir': s.birth_place || '',
    'Tanggal Lahir (YYYY-MM-DD)': s.birth_date || '',
    'Nama Ayah Kandung': s.father_name || '',
    'Nama Ibu Kandung': s.mother_name || '',
    'No. HP / WA': s.phone || '',
    Email: s.email || '',
    Alamat: s.address || '',
    Status: (s.status || 'AKTIF').toUpperCase(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Buku_Induk_Siswa');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `SiM-M_Buku_Induk_Siswa_EMIS_Dapodik_${today}.xlsx`);
}

/**
 * Unduh Template Excel Impor Siswa standar EMIS / Dapodik.
 */
export function downloadStudentTemplateXlsx() {
  const sampleRows = [
    {
      NIS: '20260001',
      NISN: '0081234567',
      NIK: '3201010101080001',
      'Nama Lengkap': 'Ahmad Fauzi',
      'L/P': 'L',
      'Tempat Lahir': 'Jakarta',
      'Tanggal Lahir (YYYY-MM-DD)': '2010-05-14',
      'Nama Ayah Kandung': 'Abdullah',
      'Nama Ibu Kandung': 'Siti Aminah',
      'No. HP / WA': '081234567890',
      Alamat: 'Jl. Pendidikan No. 10',
    },
    {
      NIS: '20260002',
      NISN: '0087654321',
      NIK: '3201014102080002',
      'Nama Lengkap': 'Aisyah Putri',
      'L/P': 'P',
      'Tempat Lahir': 'Bandung',
      'Tanggal Lahir (YYYY-MM-DD)': '2010-08-21',
      'Nama Ayah Kandung': 'Hasan Basri',
      'Nama Ibu Kandung': 'Fatimah',
      'No. HP / WA': '081298765432',
      Alamat: 'Jl. Madrasah Raya No. 5',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Impor_Siswa');
  XLSX.writeFile(wb, 'Template_Impor_Siswa_EMIS_Dapodik_SiM-M.xlsx');
}

/**
 * Parsing file Excel/CSV Siswa standar EMIS / Dapodik.
 */
export async function parseStudentImportXlsx(
  file: File
): Promise<{ records: EmisDapodikStudentRecord[]; skippedCount: number }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { records: [], skippedCount: 0 };
  }
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const records: EmisDapodikStudentRecord[] = [];
  let skippedCount = 0;

  for (const row of rawRows) {
    const fullName = getRowField(row, [
      'Nama Lengkap',
      'Nama Siswa',
      'Nama Peserta Didik',
      'Nama',
      'full_name',
    ]);
    if (!fullName || fullName.length < 2) {
      skippedCount++;
      continue;
    }

    const genderRaw = getRowField(row, ['L/P', 'JK', 'Jenis Kelamin', 'Gender']);
    const nis = getRowField(row, ['NIS', 'Nomor Induk Siswa', 'NIPD']) || null;
    const nisn = getRowField(row, ['NISN', 'Nomor Induk Siswa Nasional']) || null;
    const nik = getRowField(row, ['NIK', 'Nomor Induk Kependudukan']) || null;
    const birthPlace = getRowField(row, ['Tempat Lahir', 'Tmp Lahir', 'birth_place']) || null;
    const birthDateRaw = getRowField(row, [
      'Tanggal Lahir (YYYY-MM-DD)',
      'Tanggal Lahir',
      'Tgl Lahir',
      'birth_date',
    ]);
    const fatherName =
      getRowField(row, ['Nama Ayah Kandung', 'Nama Ayah', 'Ayah', 'father_name']) || null;
    const motherName =
      getRowField(row, ['Nama Ibu Kandung', 'Nama Ibu', 'Ibu', 'mother_name']) || null;
    const phone = getRowField(row, ['No. HP / WA', 'No. HP', 'No HP', 'Telepon', 'HP', 'phone']) || null;
    const address = getRowField(row, ['Alamat', 'Alamat Lengkap', 'address']) || null;

    records.push({
      full_name: fullName,
      nis,
      nisn,
      nik,
      gender: normalizeGender(genderRaw),
      birth_place: birthPlace,
      birth_date: normalizeIsoDate(birthDateRaw),
      father_name: fatherName,
      mother_name: motherName,
      phone,
      address,
    });
  }

  return { records, skippedCount };
}

/**
 * Ekspor daftar GTK Buku Induk ke format Excel standar EMIS / Simpatika / Dapodik.
 */
export function exportTeachersEmisDapodikXlsx(
  teachers: Array<{
    full_name: string;
    staff_type?: string | null;
    nip?: string | null;
    nuptk?: string | null;
    nik?: string | null;
    gender?: 'L' | 'P' | null;
    employment_status?: string | null;
    education_level?: string | null;
    major?: string | null;
    phone?: string | null;
    email?: string | null;
  }>
) {
  const rows = teachers.map((t, idx) => ({
    No: idx + 1,
    'Nama Lengkap & Gelar': t.full_name,
    'Jenis GTK': t.staff_type || 'GURU',
    'L/P': t.gender || 'L',
    NIP: t.nip || '',
    NUPTK: t.nuptk || '',
    NIK: t.nik || '',
    'Status Kepegawaian': t.employment_status || 'GTY',
    'Pendidikan Terakhir': t.education_level || '',
    'Jurusan / Prodi': t.major || '',
    'No. HP / WA': t.phone || '',
    Email: t.email || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Buku_Induk_GTK');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `SiM-M_Buku_Induk_GTK_EMIS_Dapodik_${today}.xlsx`);
}

/**
 * Unduh Template Excel Impor GTK standar EMIS / Simpatika / Dapodik.
 */
export function downloadTeacherTemplateXlsx() {
  const sampleRows = [
    {
      'Nama Lengkap & Gelar': 'Drs. Budi Santoso, M.Pd.',
      'Jenis GTK (GURU/TATA_USAHA/LAINNYA)': 'GURU',
      'L/P': 'L',
      NIP: '198001012005011001',
      NUPTK: '1234567890123456',
      NIK: '3201010101800001',
      'Status Kepegawaian (GTY/GTT/PNS/PPPK/PTY/PTT)': 'GTY',
      'Pendidikan Terakhir': 'S2',
      'Jurusan / Prodi': 'Pendidikan Matematika',
      'No. HP / WA': '081234567891',
      Email: 'budi.santoso@madrasah.sch.id',
      'Jabatan Awal': 'Guru Mata Pelajaran',
    },
    {
      'Nama Lengkap & Gelar': 'Rina Kartika, S.E.',
      'Jenis GTK (GURU/TATA_USAHA/LAINNYA)': 'TATA_USAHA',
      'L/P': 'P',
      NIP: '',
      NUPTK: '',
      NIK: '3201014202900002',
      'Status Kepegawaian (GTY/GTT/PNS/PPPK/PTY/PTT)': 'PTY',
      'Pendidikan Terakhir': 'S1',
      'Jurusan / Prodi': 'Manajemen',
      'No. HP / WA': '081298765433',
      Email: 'rina.tu@madrasah.sch.id',
      'Jabatan Awal': 'Staf Tata Usaha',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Impor_GTK');
  XLSX.writeFile(wb, 'Template_Impor_GTK_EMIS_Dapodik_SiM-M.xlsx');
}

/**
 * Parsing file Excel/CSV GTK standar EMIS / Simpatika / Dapodik.
 */
export async function parseTeacherImportXlsx(
  file: File
): Promise<{ records: EmisDapodikTeacherRecord[]; skippedCount: number }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { records: [], skippedCount: 0 };
  }
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const records: EmisDapodikTeacherRecord[] = [];
  let skippedCount = 0;

  for (const row of rawRows) {
    const fullName = getRowField(row, [
      'Nama Lengkap & Gelar',
      'Nama Lengkap',
      'Nama GTK',
      'Nama Guru',
      'Nama PTK',
      'Nama',
      'full_name',
    ]);
    if (!fullName || fullName.length < 2) {
      skippedCount++;
      continue;
    }

    const staffTypeRaw = getRowField(row, [
      'Jenis GTK (GURU/TATA_USAHA/LAINNYA)',
      'Jenis GTK',
      'Jenis PTK',
      'staff_type',
    ]);
    const genderRaw = getRowField(row, ['L/P', 'JK', 'Jenis Kelamin', 'Gender']);
    const nip = getRowField(row, ['NIP', 'Nomor Induk Pegawai']) || null;
    const nuptk = getRowField(row, ['NUPTK', 'Nomor Unik Pendidik dan Tenaga Kependidikan']) || null;
    const nik = getRowField(row, ['NIK', 'Nomor Induk Kependudukan']) || null;
    const empStatus =
      getRowField(row, [
        'Status Kepegawaian (GTY/GTT/PNS/PPPK/PTY/PTT)',
        'Status Kepegawaian',
        'employment_status',
      ]) || 'GTY';
    const educationLevel =
      getRowField(row, ['Pendidikan Terakhir', 'Jenjang Pendidikan', 'Pendidikan', 'education_level']) ||
      null;
    const major = getRowField(row, ['Jurusan / Prodi', 'Jurusan', 'Program Studi', 'major']) || null;
    const phone = getRowField(row, ['No. HP / WA', 'No. HP', 'No HP', 'Telepon', 'HP', 'phone']) || null;
    const email = getRowField(row, ['Email', 'Alamat Email']) || null;
    const initialPosition =
      getRowField(row, ['Jabatan Awal', 'Riwayat Jabatan Awal', 'Tugas Utama', 'initial_position']) ||
      null;

    records.push({
      full_name: fullName,
      staff_type: normalizeStaffType(staffTypeRaw),
      nip,
      nuptk,
      nik,
      gender: normalizeGender(genderRaw),
      employment_status: empStatus.toUpperCase(),
      education_level: educationLevel,
      major,
      phone,
      email,
      initial_position: initialPosition,
    });
  }

  return { records, skippedCount };
}
