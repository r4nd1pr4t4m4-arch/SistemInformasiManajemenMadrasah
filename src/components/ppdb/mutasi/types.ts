export interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
}

export type DocType =
  | 'KK'
  | 'AKTA_KELAHIRAN'
  | 'IJAZAH_SKL'
  | 'PAS_FOTO'
  | 'SERTIFIKAT_PRESTASI'
  | 'LAINNYA';

export interface MutasiDocItem {
  documentType: DocType;
  label: string;
  fileName: string;
  fileSize: number;
  fileData: string;
}

export interface MutationDocConfig {
  key: string;
  documentType: DocType;
  label: string;
  required: boolean;
}

export interface MutationReasonOption {
  value: string;
  label: string;
}

export interface MutationReasonGroup {
  label: string;
  options: MutationReasonOption[];
}

export interface MutasiFormValues {
  fullName: string;
  nisn: string;
  nik: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  previousSchool: string;
  targetGrade: string;
  mutationReason: string;
  otherReason: string;
  parentName: string;
  parentPhone: string;
}

export const INITIAL_MUTASI_FORM: MutasiFormValues = {
  fullName: '',
  nisn: '',
  nik: '',
  gender: 'L',
  birthPlace: '',
  birthDate: '',
  previousSchool: '',
  targetGrade: '',
  mutationReason: '',
  otherReason: '',
  parentName: '',
  parentPhone: '',
};

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
export const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

export const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

export const MUTATION_REASON_GROUPS: MutationReasonGroup[] = [
  {
    label: '1) Perpindahan Tugas atau Domisili Orang Tua/Wali',
    options: [
      {
        value: 'Mutasi Kerja',
        label:
          'Mutasi Kerja — Orang tua/wali dipindahtugaskan instansi pemerintah, TNI/Polri, BUMN, atau swasta ke kota/kabupaten lain',
      },
      {
        value: 'Pindah Tempat Tinggal',
        label:
          'Pindah Tempat Tinggal — Keluarga berpindah domisili (ekonomi, rumah baru, atau perubahan kondisi keluarga)',
      },
    ],
  },
  {
    label: '2) Alasan Ekonomi dan Aksesibilitas',
    options: [
      {
        value: 'Keterbatasan Biaya',
        label:
          'Keterbatasan Biaya — Pindah ke sekolah dengan biaya lebih terjangkau karena kondisi finansial keluarga',
      },
      {
        value: 'Jarak dan Transportasi',
        label:
          'Jarak dan Transportasi — Lokasi sekolah asal terlalu jauh atau akses transportasi sulit',
      },
    ],
  },
  {
    label: '3) Kesesuaian Lingkungan dan Kondisi Psikologis Siswa',
    options: [
      {
        value: 'Kenyamanan dan Keamanan',
        label:
          'Kenyamanan dan Keamanan — Ketidaknyamanan, perundungan (bullying), konflik interpersonal, atau adaptasi sosial',
      },
      {
        value: 'Pertimbangan Kesehatan',
        label:
          'Pertimbangan Kesehatan — Kondisi fisik/mental mengharuskan bersekolah lebih dekat rumah atau fasilitas kesehatan',
      },
    ],
  },
  {
    label: '4) Alasan Akademik dan Minat Bakat',
    options: [
      {
        value: 'Perbedaan Kurikulum atau Program',
        label:
          'Perbedaan Kurikulum atau Program — Mengikuti program khusus (akselerasi, bilingual, peminatan/jurusan)',
      },
      {
        value: 'Pindah Jalur Pendidikan',
        label:
          'Pindah Jalur Pendidikan — Perpindahan antar-jalur sederajat (Madrasah <-> Sekolah Umum <-> Paket A/B/C)',
      },
    ],
  },
  {
    label: '5) Kepulangan dari Luar Negeri atau Pondok Pesantren',
    options: [
      {
        value: 'Kepulangan dari Luar Negeri',
        label:
          'Kepulangan dari Luar Negeri — Mengikuti orang tua selesai bertugas/studi di luar negeri (perlu penyetaraan)',
      },
      {
        value: 'Keluar dari Pendidikan Berasrama',
        label:
          'Keluar dari Pendidikan Berasrama — Berhenti dari boarding school / pondok pesantren ke sekolah reguler',
      },
    ],
  },
  {
    label: '6) Lainnya',
    options: [
      {
        value: 'Lainnya',
        label: 'Lainnya (tuliskan penjelasan alasan mutasi)',
      },
    ],
  },
];

export const MUTATION_DOCS: MutationDocConfig[] = [
  {
    key: 'surat_pindah',
    documentType: 'LAINNYA',
    label: 'Surat Keterangan Pindah / Mutasi dari Sekolah Asal',
    required: true,
  },
  {
    key: 'rapor',
    documentType: 'IJAZAH_SKL',
    label: 'Scan / Fotokopi Rapor Semester Terakhir yang Dilegalisir',
    required: true,
  },
  {
    key: 'kk',
    documentType: 'KK',
    label: 'Scan Kartu Keluarga (KK)',
    required: true,
  },
  {
    key: 'akta',
    documentType: 'AKTA_KELAHIRAN',
    label: 'Scan Akta Kelahiran Siswa',
    required: true,
  },
];

export function isFinalGradeLevel(grade: string, allGrades: string[]): boolean {
  const normalized = grade.trim().toUpperCase();
  if (!normalized) return false;
  if (['VI', 'IX', 'XII', '6', '9', '12'].includes(normalized)) return true;
  if (/\b(VI|IX|XII|6|9|12)\b/.test(normalized)) return true;
  if (allGrades.length > 0 && allGrades[allGrades.length - 1]?.trim().toUpperCase() === normalized) {
    return true;
  }
  return false;
}

export function formatPeriodDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
