import type {
  PathwayDefinition,
  PathwayDocRequirement,
  PathwayQuotas,
} from '@/lib/ppdb/pathways';
import type { RegistrationCardData } from '@/components/ppdb/registration-card';

export type PpdbTab = 'daftar' | 'cek';

export interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
  pathway_quotas?: PathwayQuotas;
}

export interface UploadedDoc {
  documentType:
    | 'KK'
    | 'AKTA_KELAHIRAN'
    | 'IJAZAH_SKL'
    | 'PAS_FOTO'
    | 'SERTIFIKAT_PRESTASI'
    | 'LAINNYA';
  fileUrl: string;
  fileName: string;
}

export interface PpdbFormState {
  fullName: string;
  nisn: string;
  nik: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  previousSchool: string;
  address: string;
  parentName: string;
  parentPhone: string;
}

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
export const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

export const INITIAL_FORM: PpdbFormState = {
  fullName: '',
  nisn: '',
  nik: '',
  gender: 'L',
  birthPlace: '',
  birthDate: '',
  previousSchool: '',
  address: '',
  parentName: '',
  parentPhone: '',
};

export const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

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

export async function uploadFileToR2(
  docType: UploadedDoc['documentType'],
  prefix: string,
  file: File
): Promise<UploadedDoc | null> {
  const presignRes = await fetch('/api/storage/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder: 'ppdb',
      fileName: `${prefix}-${file.name}`,
      contentType: file.type || 'application/octet-stream',
    }),
  });

  if (!presignRes.ok) return null;
  const { uploadUrl, publicUrl } = await presignRes.json();
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putRes.ok) return null;

  return {
    documentType: docType,
    fileUrl: publicUrl,
    fileName: `${prefix}: ${file.name}`,
  };
}

export type PpdbFormValidationResult =
  | { error: string }
  | {
      error: null;
      trimmed: {
        fullName: string;
        birthPlace: string;
        previousSchool: string;
        parentName: string;
      };
      allReqs: PathwayDocRequirement[];
    };

export function validatePpdbForm(params: {
  hasActivePeriod: boolean;
  activePathwayDef: PathwayDefinition | null;
  form: PpdbFormState;
  todayIso: string;
  addressComplete: boolean;
  files: Record<string, File | undefined>;
}): PpdbFormValidationResult {
  const { hasActivePeriod, activePathwayDef, form, todayIso, addressComplete, files } = params;

  if (!hasActivePeriod) {
    return {
      error: 'Pendaftaran tidak dapat dikirim karena tidak ada periode PPDB yang aktif.',
    };
  }
  if (!activePathwayDef) {
    return { error: 'Silakan pilih jalur pendaftaran terlebih dahulu.' };
  }

  const trimmedFullName = form.fullName.trim();
  const trimmedBirthPlace = form.birthPlace.trim();
  const trimmedPreviousSchool = form.previousSchool.trim();
  const trimmedParentName = form.parentName.trim();

  if (trimmedFullName.length < 2) {
    return { error: 'Nama lengkap calon siswa minimal 2 karakter.' };
  }
  if (form.nisn.length !== 10) {
    return { error: 'NISN harus tepat 10 digit angka.' };
  }
  if (form.nik.length !== 16) {
    return { error: 'NIK harus tepat 16 digit angka.' };
  }
  if (trimmedBirthPlace.length < 2) {
    return { error: 'Tempat lahir minimal 2 karakter.' };
  }
  if (!form.birthDate || form.birthDate > todayIso) {
    return { error: 'Tanggal lahir tidak valid atau tidak boleh melebihi hari ini.' };
  }
  if (trimmedPreviousSchool.length < 2) {
    return { error: 'Asal sekolah / madrasah minimal 2 karakter.' };
  }
  if (trimmedParentName.length < 2) {
    return { error: 'Nama orang tua / wali minimal 2 karakter.' };
  }
  if (form.parentPhone.length !== 12) {
    return { error: 'No. WhatsApp Orang Tua / Wali harus tepat 12 digit angka.' };
  }
  if (!addressComplete) {
    return {
      error:
        'Lengkapi seluruh rincian alamat (Provinsi, Kab/Kota, Kecamatan, Desa, RT, RW, dan Alamat).',
    };
  }

  const allReqs = [...activePathwayDef.generalDocs, ...activePathwayDef.specialDocs];
  const missingRequiredDocs = allReqs.filter((req) => req.required && !files[req.key]);
  if (missingRequiredDocs.length > 0) {
    return {
      error: `Unggah berkas wajib berikut terlebih dahulu: ${missingRequiredDocs
        .map((d) => d.label)
        .join(', ')}.`,
    };
  }

  return {
    error: null,
    trimmed: {
      fullName: trimmedFullName,
      birthPlace: trimmedBirthPlace,
      previousSchool: trimmedPreviousSchool,
      parentName: trimmedParentName,
    },
    allReqs,
  };
}

export interface RegistrationApiRecord {
  registration_number: string;
  full_name: string;
  nisn: string;
  pathway: RegistrationCardData['pathway'];
  previous_school: string;
  parent_name: string;
  parent_phone: string;
  status: RegistrationCardData['status'];
  created_at: string;
  admin_notes?: string | null;
  ppdb_documents?: Array<{
    document_type: string;
    file_name: string | null;
    is_verified: boolean;
  }>;
}

export function mapRegistrationRecordToCard(reg: RegistrationApiRecord): RegistrationCardData {
  return {
    registrationNumber: reg.registration_number,
    fullName: reg.full_name,
    nisn: reg.nisn,
    pathway: reg.pathway,
    previousSchool: reg.previous_school,
    parentName: reg.parent_name,
    parentPhone: reg.parent_phone,
    status: reg.status,
    createdAt: reg.created_at,
    notes: reg.admin_notes,
    documents: (reg.ppdb_documents || []).map((d) => ({
      label: d.file_name || d.document_type,
      verified: d.is_verified,
    })),
  };
}
