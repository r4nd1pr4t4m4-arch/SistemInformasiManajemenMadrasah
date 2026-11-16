export type PpdbPathwayCode = 'DOMISILI' | 'AFIRMASI' | 'PRESTASI';

export interface PathwayQuotas {
  DOMISILI: number;
  AFIRMASI: number;
  PRESTASI: number;
}

export const DEFAULT_PATHWAY_QUOTAS: PathwayQuotas = {
  DOMISILI: 100,
  AFIRMASI: 40,
  PRESTASI: 40,
};

export interface PathwayDocRequirement {
  key: string;
  label: string;
  documentType:
    | 'KK'
    | 'AKTA_KELAHIRAN'
    | 'IJAZAH_SKL'
    | 'PAS_FOTO'
    | 'SERTIFIKAT_PRESTASI'
    | 'LAINNYA';
  required: boolean;
}

export interface PathwayDefinition {
  code: PpdbPathwayCode;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  generalDocs: PathwayDocRequirement[];
  specialDocs: PathwayDocRequirement[];
}

export const GENERAL_PPDB_DOCS: PathwayDocRequirement[] = [
  { key: 'KK', label: 'Kartu Keluarga (KK)', documentType: 'KK', required: true },
  {
    key: 'AKTA_KELAHIRAN',
    label: 'Akta Kelahiran',
    documentType: 'AKTA_KELAHIRAN',
    required: true,
  },
  {
    key: 'IJAZAH_SKL',
    label: 'Ijazah / Surat Keterangan Lulus (SKL)',
    documentType: 'IJAZAH_SKL',
    required: true,
  },
  {
    key: 'PAS_FOTO',
    label: 'Pas Foto Berwarna 3x4',
    documentType: 'PAS_FOTO',
    required: false,
  },
];

export const PPDB_PATHWAYS: PathwayDefinition[] = [
  {
    code: 'DOMISILI',
    title: 'Jalur Domisili',
    subtitle: 'Seleksi berdasarkan kedekatan wilayah tempat tinggal',
    badge: 'Zonasi / Domisili',
    description:
      'Diperuntukkan bagi calon peserta didik yang berdomisili di wilayah sekitar madrasah/sekolah sesuai alamat pada Kartu Keluarga.',
    generalDocs: GENERAL_PPDB_DOCS,
    specialDocs: [
      {
        key: 'BUKTI_DOMISILI',
        label: 'Surat Keterangan Domisili / Bukti Alamat Wilayah',
        documentType: 'LAINNYA',
        required: true,
      },
    ],
  },
  {
    code: 'AFIRMASI',
    title: 'Jalur Afirmasi',
    subtitle: 'Untuk keluarga kurang mampu & penyandang disabilitas',
    badge: 'Afirmasi / KIP / PKH',
    description:
      'Memberikan kesempatan prioritas bagi calon peserta didik dari keluarga ekonomi tidak mampu pemegang KIP/PKH/KKS atau penyandang disabilitas.',
    generalDocs: GENERAL_PPDB_DOCS,
    specialDocs: [
      {
        key: 'KARTU_AFIRMASI',
        label: 'Kartu KIP / PKH / KKS / SKTM Resmi',
        documentType: 'LAINNYA',
        required: true,
      },
    ],
  },
  {
    code: 'PRESTASI',
    title: 'Jalur Prestasi',
    subtitle: 'Seleksi nilai rapor & kejuaraan akademik/non-akademik',
    badge: 'Akademik & Non-Akademik',
    description:
      'Diperuntukkan bagi calon peserta didik yang memiliki prestasi unggul di bidang akademik, olahraga, seni, maupun keagamaan/tahfidz.',
    generalDocs: GENERAL_PPDB_DOCS,
    specialDocs: [
      {
        key: 'SERTIFIKAT_PRESTASI',
        label: 'Sertifikat / Piagam Kejuaraan & Rapor Unggulan',
        documentType: 'SERTIFIKAT_PRESTASI',
        required: true,
      },
    ],
  },
];

export function getPathwayLabel(pathway: string): string {
  if (pathway === 'DOMISILI' || pathway === 'REGULER') return 'Jalur Domisili';
  if (pathway === 'AFIRMASI') return 'Jalur Afirmasi';
  if (pathway === 'PRESTASI') return 'Jalur Prestasi';
  if (pathway === 'MUTASI') return 'Mutasi Masuk';
  return pathway;
}
