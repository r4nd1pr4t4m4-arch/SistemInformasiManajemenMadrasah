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

export type PpdbDocumentType =
  | 'KK'
  | 'AKTA_KELAHIRAN'
  | 'IJAZAH_SKL'
  | 'PAS_FOTO'
  | 'SERTIFIKAT_PRESTASI'
  | 'LAINNYA';

export interface PathwayDocRequirement {
  key: string;
  label: string;
  documentType: PpdbDocumentType;
  required: boolean;
}

export interface PathwayDocumentsEntry {
  generalDocs: PathwayDocRequirement[];
  specialDocs: PathwayDocRequirement[];
}

export type PathwayDocumentsConfig = Record<PpdbPathwayCode, PathwayDocumentsEntry>;

export const PPDB_DOCUMENT_TYPE_OPTIONS: Array<{ value: PpdbDocumentType; label: string }> = [
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran' },
  { value: 'IJAZAH_SKL', label: 'Ijazah / SKL' },
  { value: 'PAS_FOTO', label: 'Pas Foto' },
  { value: 'SERTIFIKAT_PRESTASI', label: 'Sertifikat / Piagam Prestasi' },
  { value: 'LAINNYA', label: 'Dokumen Lainnya' },
];

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
    specialDocs: [],
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

export const DEFAULT_PATHWAY_DOCUMENTS: PathwayDocumentsConfig = {
  DOMISILI: {
    generalDocs: GENERAL_PPDB_DOCS.map((d) => ({ ...d })),
    specialDocs: [],
  },
  AFIRMASI: {
    generalDocs: GENERAL_PPDB_DOCS.map((d) => ({ ...d })),
    specialDocs: [
      {
        key: 'KARTU_AFIRMASI',
        label: 'Kartu KIP / PKH / KKS / SKTM Resmi',
        documentType: 'LAINNYA',
        required: true,
      },
    ],
  },
  PRESTASI: {
    generalDocs: GENERAL_PPDB_DOCS.map((d) => ({ ...d })),
    specialDocs: [
      {
        key: 'SERTIFIKAT_PRESTASI',
        label: 'Sertifikat / Piagam Kejuaraan & Rapor Unggulan',
        documentType: 'SERTIFIKAT_PRESTASI',
        required: true,
      },
    ],
  },
};

const VALID_DOC_TYPES = new Set<PpdbDocumentType>([
  'KK',
  'AKTA_KELAHIRAN',
  'IJAZAH_SKL',
  'PAS_FOTO',
  'SERTIFIKAT_PRESTASI',
  'LAINNYA',
]);

function sanitizeDocList(raw: unknown, fallback: PathwayDocRequirement[]): PathwayDocRequirement[] {
  if (!Array.isArray(raw)) return fallback.map((d) => ({ ...d }));
  const seen = new Set<string>();
  const cleaned: PathwayDocRequirement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const label = typeof rec.label === 'string' ? rec.label.trim() : '';
    if (!label) continue;
    const rawKey =
      typeof rec.key === 'string' && rec.key.trim()
        ? rec.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        : label
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40) || `DOC_${cleaned.length + 1}`;
    let key = rawKey;
    let suffix = 2;
    while (seen.has(key)) {
      key = `${rawKey}_${suffix++}`;
    }
    seen.add(key);
    const docType =
      typeof rec.documentType === 'string' && VALID_DOC_TYPES.has(rec.documentType as PpdbDocumentType)
        ? (rec.documentType as PpdbDocumentType)
        : 'LAINNYA';
    cleaned.push({
      key,
      label,
      documentType: docType,
      required: Boolean(rec.required),
    });
  }
  return cleaned;
}

export function normalizePathwayDocumentsConfig(raw?: unknown): PathwayDocumentsConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const codes: PpdbPathwayCode[] = ['DOMISILI', 'AFIRMASI', 'PRESTASI'];
  const result = {} as PathwayDocumentsConfig;
  for (const code of codes) {
    const entry =
      obj[code] && typeof obj[code] === 'object' ? (obj[code] as Record<string, unknown>) : null;
    result[code] = {
      generalDocs: entry && 'generalDocs' in entry
        ? sanitizeDocList(entry.generalDocs, DEFAULT_PATHWAY_DOCUMENTS[code].generalDocs)
        : DEFAULT_PATHWAY_DOCUMENTS[code].generalDocs.map((d) => ({ ...d })),
      specialDocs: entry && 'specialDocs' in entry
        ? sanitizeDocList(entry.specialDocs, DEFAULT_PATHWAY_DOCUMENTS[code].specialDocs)
        : DEFAULT_PATHWAY_DOCUMENTS[code].specialDocs.map((d) => ({ ...d })),
    };
  }
  return result;
}

export function mergePathwayDefinitions(
  config?: Partial<PathwayDocumentsConfig> | null
): PathwayDefinition[] {
  const normalized = normalizePathwayDocumentsConfig(config);
  return PPDB_PATHWAYS.map((pw) => ({
    ...pw,
    generalDocs: normalized[pw.code].generalDocs,
    specialDocs: normalized[pw.code].specialDocs,
  }));
}

export function getPathwayLabel(pathway: string): string {
  if (pathway === 'DOMISILI' || pathway === 'REGULER') return 'Jalur Domisili';
  if (pathway === 'AFIRMASI') return 'Jalur Afirmasi';
  if (pathway === 'PRESTASI') return 'Jalur Prestasi';
  if (pathway === 'MUTASI') return 'Mutasi Masuk';
  return pathway;
}
