export type ReviewEntityType = 'SISWA' | 'GTK' | 'ORANG_TUA';
export type ReviewTargetKind = 'BIODATA_FIELD' | 'DOCUMENT_TYPE';
export type ReviewStatus = 'OPEN' | 'REVISED' | 'RESOLVED';

export interface ReviewTargetMeta {
  key: string;
  label: string;
  kind: ReviewTargetKind;
  anchorId: string;
  editHint?: 'ACCOUNT_PROFILE';
}

export const ADDRESS_GROUP_COLUMNS = [
  'province',
  'city',
  'district',
  'village',
  'rt_rw',
  'address',
] as const;

export const SISWA_BIODATA_REVIEW_TARGETS: readonly ReviewTargetMeta[] = [
  { key: 'full_name', label: 'Nama Lengkap', kind: 'BIODATA_FIELD', anchorId: 'bio-full-name', editHint: 'ACCOUNT_PROFILE' },
  { key: 'nik', label: 'NIK Siswa', kind: 'BIODATA_FIELD', anchorId: 'bio-nik' },
  { key: 'kk_number', label: 'Nomor KK', kind: 'BIODATA_FIELD', anchorId: 'bio-kk' },
  { key: 'birth_certificate_number', label: 'No. Akta Kelahiran', kind: 'BIODATA_FIELD', anchorId: 'bio-akta' },
  { key: 'gender', label: 'Jenis Kelamin', kind: 'BIODATA_FIELD', anchorId: 'bio-gender' },
  { key: 'birth_place', label: 'Tempat Lahir', kind: 'BIODATA_FIELD', anchorId: 'bio-birth-place' },
  { key: 'birth_date', label: 'Tanggal Lahir', kind: 'BIODATA_FIELD', anchorId: 'bio-birth-date' },
  { key: 'religion', label: 'Agama', kind: 'BIODATA_FIELD', anchorId: 'bio-religion' },
  { key: 'child_order', label: 'Anak Ke-', kind: 'BIODATA_FIELD', anchorId: 'bio-child-order' },
  { key: 'siblings_count', label: 'Jumlah Saudara Kandung', kind: 'BIODATA_FIELD', anchorId: 'bio-siblings-count' },
  { key: 'phone', label: 'No. HP / WhatsApp Siswa', kind: 'BIODATA_FIELD', anchorId: 'bio-phone' },
  { key: 'email', label: 'Email Siswa', kind: 'BIODATA_FIELD', anchorId: 'bio-email', editHint: 'ACCOUNT_PROFILE' },
  { key: 'address_group', label: 'Alamat Domisili Lengkap', kind: 'BIODATA_FIELD', anchorId: 'sec-alamat' },
  { key: 'postal_code', label: 'Kode Pos', kind: 'BIODATA_FIELD', anchorId: 'bio-postal' },
  { key: 'previous_school', label: 'Asal Sekolah Sebelumnya', kind: 'BIODATA_FIELD', anchorId: 'bio-prev-school' },
  { key: 'previous_school_npsn', label: 'NPSN Sekolah Asal', kind: 'BIODATA_FIELD', anchorId: 'bio-prev-npsn' },
  { key: 'kip_number', label: 'Nomor KIP', kind: 'BIODATA_FIELD', anchorId: 'bio-kip' },
  { key: 'kis_number', label: 'Nomor BPJS / KIS', kind: 'BIODATA_FIELD', anchorId: 'bio-kis' },
  { key: 'kks_number', label: 'Nomor KKS', kind: 'BIODATA_FIELD', anchorId: 'bio-kks' },
  { key: 'pkh_number', label: 'Nomor PKH', kind: 'BIODATA_FIELD', anchorId: 'bio-pkh' },
  { key: 'father_name', label: 'Nama Ayah', kind: 'BIODATA_FIELD', anchorId: 'bio-father-name' },
  { key: 'father_nik', label: 'NIK Ayah', kind: 'BIODATA_FIELD', anchorId: 'bio-father-nik' },
  { key: 'father_job', label: 'Pekerjaan Ayah', kind: 'BIODATA_FIELD', anchorId: 'bio-father-job' },
  { key: 'father_phone', label: 'No. HP Ayah', kind: 'BIODATA_FIELD', anchorId: 'bio-father-phone' },
  { key: 'mother_name', label: 'Nama Ibu', kind: 'BIODATA_FIELD', anchorId: 'bio-mother-name' },
  { key: 'mother_nik', label: 'NIK Ibu', kind: 'BIODATA_FIELD', anchorId: 'bio-mother-nik' },
  { key: 'mother_job', label: 'Pekerjaan Ibu', kind: 'BIODATA_FIELD', anchorId: 'bio-mother-job' },
  { key: 'mother_phone', label: 'No. HP Ibu', kind: 'BIODATA_FIELD', anchorId: 'bio-mother-phone' },
  { key: 'guardian_name', label: 'Nama Wali', kind: 'BIODATA_FIELD', anchorId: 'bio-guardian-name' },
  { key: 'guardian_nik', label: 'NIK Wali', kind: 'BIODATA_FIELD', anchorId: 'bio-guardian-nik' },
  { key: 'guardian_job', label: 'Pekerjaan Wali', kind: 'BIODATA_FIELD', anchorId: 'bio-guardian-job' },
  { key: 'guardian_phone', label: 'No. HP Wali', kind: 'BIODATA_FIELD', anchorId: 'bio-guardian-phone' },
  // Dokumen Siswa
  { key: 'KK', label: 'Kartu Keluarga (KK)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KK' },
  { key: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-AKTA_KELAHIRAN' },
  { key: 'IJAZAH_MI_SD', label: 'Ijazah MI / SD / Sederajat', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-IJAZAH_MI_SD' },
  { key: 'IJAZAH_RA_TK', label: 'Ijazah RA / TK', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-IJAZAH_RA_TK' },
  { key: 'KTP_AYAH', label: 'KTP Ayah', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KTP_AYAH' },
  { key: 'KTP_IBU', label: 'KTP Ibu', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KTP_IBU' },
  { key: 'KTP_WALI', label: 'KTP Wali', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KTP_WALI' },
  { key: 'KIP', label: 'Kartu Indonesia Pintar (KIP)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KIP' },
  { key: 'BPJS_KIS', label: 'BPJS Kesehatan / KIS', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-BPJS_KIS' },
  { key: 'KKS', label: 'Kartu Keluarga Sejahtera (KKS)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KKS' },
  { key: 'PKH', label: 'Kartu PKH', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-PKH' },
  { key: 'LAINNYA', label: 'Dokumen Pendukung Lainnya', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-LAINNYA' },
] as const;

export const GTK_BIODATA_REVIEW_TARGETS: readonly ReviewTargetMeta[] = [
  { key: 'full_name', label: 'Nama Lengkap', kind: 'BIODATA_FIELD', anchorId: 'gtk-full-name', editHint: 'ACCOUNT_PROFILE' },
  { key: 'nik', label: 'NIK', kind: 'BIODATA_FIELD', anchorId: 'gtk-nik' },
  { key: 'gender', label: 'Jenis Kelamin', kind: 'BIODATA_FIELD', anchorId: 'gtk-gender' },
  { key: 'birth_place', label: 'Tempat Lahir', kind: 'BIODATA_FIELD', anchorId: 'gtk-birth-place' },
  { key: 'birth_date', label: 'Tanggal Lahir', kind: 'BIODATA_FIELD', anchorId: 'gtk-birth-date' },
  { key: 'education_level', label: 'Pendidikan Terakhir', kind: 'BIODATA_FIELD', anchorId: 'gtk-education-level' },
  { key: 'major', label: 'Jurusan / Program Studi', kind: 'BIODATA_FIELD', anchorId: 'gtk-major' },
  { key: 'last_campus', label: 'Nama Kampus Terakhir', kind: 'BIODATA_FIELD', anchorId: 'gtk-last-campus' },
  { key: 'graduation_year', label: 'Tahun Lulus', kind: 'BIODATA_FIELD', anchorId: 'gtk-graduation-year' },
  { key: 'phone', label: 'No. HP / WhatsApp', kind: 'BIODATA_FIELD', anchorId: 'gtk-phone', editHint: 'ACCOUNT_PROFILE' },
  { key: 'email', label: 'Email', kind: 'BIODATA_FIELD', anchorId: 'gtk-email', editHint: 'ACCOUNT_PROFILE' },
  { key: 'thesis_title', label: 'Judul Skripsi / Tesis / Disertasi', kind: 'BIODATA_FIELD', anchorId: 'gtk-thesis-title' },
  { key: 'thesis_abstract', label: 'Abstrak Karya Ilmiah', kind: 'BIODATA_FIELD', anchorId: 'gtk-thesis-abstract' },
  { key: 'thesis_keywords', label: 'Kata Kunci Karya Ilmiah', kind: 'BIODATA_FIELD', anchorId: 'gtk-thesis-keywords' },
  { key: 'thesis_article_url', label: 'URL Artikel Ilmiah', kind: 'BIODATA_FIELD', anchorId: 'gtk-thesis-article-url' },
  { key: 'address_group', label: 'Alamat Domisili GTK', kind: 'BIODATA_FIELD', anchorId: 'gtk-address-group' },
  // Dokumen GTK
  { key: 'KTP', label: 'KTP', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KTP' },
  { key: 'KK', label: 'Kartu Keluarga (KK)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KK' },
  { key: 'IJAZAH_TERAKHIR', label: 'Ijazah Pendidikan Terakhir', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-IJAZAH_TERAKHIR' },
  { key: 'SK_PENGANGKATAN', label: 'SK Pengangkatan (PNS/PPPK/GTY/GTT)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-SK_PENGANGKATAN' },
  { key: 'SK_PEMBAGIAN_TUGAS', label: 'SK Pembagian Tugas Mengajar', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-SK_PEMBAGIAN_TUGAS' },
  { key: 'SERTIFIKAT_PENDIDIK', label: 'Sertifikat Pendidik / NRG', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-SERTIFIKAT_PENDIDIK' },
  { key: 'NPWP', label: 'NPWP', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-NPWP' },
  { key: 'BUKU_REKENING', label: 'Buku Rekening Honorarium', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-BUKU_REKENING' },
  { key: 'LAINNYA', label: 'Dokumen Pendukung Lainnya', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-LAINNYA' },
] as const;

export const ORANG_TUA_BIODATA_REVIEW_TARGETS: readonly ReviewTargetMeta[] = [
  { key: 'full_name', label: 'Nama Lengkap', kind: 'BIODATA_FIELD', anchorId: 'guardian-name', editHint: 'ACCOUNT_PROFILE' },
  { key: 'nik', label: 'NIK', kind: 'BIODATA_FIELD', anchorId: 'guardian-nik' },
  { key: 'occupation', label: 'Pekerjaan', kind: 'BIODATA_FIELD', anchorId: 'guardian-job' },
  { key: 'phone', label: 'No. HP / WhatsApp', kind: 'BIODATA_FIELD', anchorId: 'guardian-phone', editHint: 'ACCOUNT_PROFILE' },
  { key: 'email', label: 'Email', kind: 'BIODATA_FIELD', anchorId: 'guardian-email', editHint: 'ACCOUNT_PROFILE' },
  { key: 'address_group', label: 'Alamat Domisili Orang Tua / Wali', kind: 'BIODATA_FIELD', anchorId: 'guardian-address-group' },
  // Dokumen Orang Tua / Wali
  { key: 'KTP', label: 'KTP Orang Tua / Wali', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KTP' },
  { key: 'KK', label: 'Kartu Keluarga (KK)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KK' },
  { key: 'SURAT_KUASA_WALI', label: 'Surat Kuasa / Keterangan Perwalian', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-SURAT_KUASA_WALI' },
  { key: 'KIP_KKS_PKH', label: 'Kartu Bantuan (KIP / KKS / PKH)', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-KIP_KKS_PKH' },
  { key: 'LAINNYA', label: 'Dokumen Pendukung Lainnya', kind: 'DOCUMENT_TYPE', anchorId: 'doc-card-LAINNYA' },
] as const;

const REGISTRY_BY_ENTITY: Record<ReviewEntityType, readonly ReviewTargetMeta[]> = {
  SISWA: SISWA_BIODATA_REVIEW_TARGETS,
  GTK: GTK_BIODATA_REVIEW_TARGETS,
  ORANG_TUA: ORANG_TUA_BIODATA_REVIEW_TARGETS,
};

export function getReviewTargetsForEntity(entityType: ReviewEntityType): readonly ReviewTargetMeta[] {
  return REGISTRY_BY_ENTITY[entityType] || [];
}

export function getReviewTargetMeta(
  entityType: ReviewEntityType,
  targetKind: ReviewTargetKind,
  targetKey: string
): ReviewTargetMeta | null {
  const list = REGISTRY_BY_ENTITY[entityType];
  if (!list) return null;
  return list.find((item) => item.kind === targetKind && item.key === targetKey) || null;
}

export function isValidReviewTarget(
  entityType: ReviewEntityType,
  targetKind: ReviewTargetKind,
  targetKey: string
): boolean {
  return Boolean(getReviewTargetMeta(entityType, targetKind, targetKey));
}

export function getReviewTargetLabel(
  entityType: ReviewEntityType,
  targetKind: ReviewTargetKind,
  targetKey: string
): string {
  return getReviewTargetMeta(entityType, targetKind, targetKey)?.label || targetKey;
}
