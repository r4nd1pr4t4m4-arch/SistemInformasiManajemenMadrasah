export type VerifiableDocType =
  | 'TABUNGAN'
  | 'SPP'
  | 'HONORARIUM'
  | 'KARTU_SISWA'
  | 'KARTU_PERPUSTAKAAN'
  | 'REKAP_ABSENSI'
  | 'SURAT';

export function buildVerificationUrl(params: {
  ref: string;
  type?: VerifiableDocType;
  origin?: string;
}): string {
  const baseOrigin =
    params.origin ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    '';

  const query = new URLSearchParams({ ref: params.ref.trim() });
  if (params.type) {
    query.set('type', params.type);
  }
  return `${baseOrigin}/verifikasi?${query.toString()}`;
}

export function extractVerificationParams(rawInput: string): {
  ref: string;
  type?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) return { ref: '' };

  // 1. Full URL or path containing ?ref=...
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/verifikasi?')) {
      const url = trimmed.startsWith('http')
        ? new URL(trimmed)
        : new URL(trimmed, 'https://simms.local');
      const refParam = url.searchParams.get('ref');
      const typeParam = url.searchParams.get('type') || undefined;
      if (refParam) {
        return { ref: refParam.trim(), type: typeParam };
      }
    }
  } catch {
    // Fallback to raw parsing
  }

  // 2. Legacy pipe/colon payloads (e.g. SIMMS:STUDENT:token:nis or SIMMS-TABUNGAN|REF|...)
  if (trimmed.startsWith('SIMMS-')) {
    const parts = trimmed.split('|');
    if (parts.length >= 2) {
      return { ref: parts[1].trim() };
    }
  }
  if (trimmed.startsWith('SIMMS:')) {
    const parts = trimmed.split(':');
    if (parts[1] === 'STUDENT' && parts[2]) {
      return { ref: parts[2].trim(), type: 'KARTU_SISWA' };
    }
    if (parts[1] === 'LIBRARY' && parts[2]) {
      return { ref: parts[2].trim(), type: 'KARTU_PERPUSTAKAAN' };
    }
  }

  return { ref: trimmed };
}
