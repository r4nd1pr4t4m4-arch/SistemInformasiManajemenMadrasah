export type VerifiableDocType =
  | 'TABUNGAN'
  | 'MUTASI_TABUNGAN'
  | 'SPP'
  | 'HONORARIUM'
  | 'KARTU_SISWA'
  | 'KARTU_PERPUSTAKAAN'
  | 'REKAP_ABSENSI'
  | 'PENILAIAN'
  | 'SURAT';

function normalizeOriginUrl(raw?: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProto.replace(/\/$/, '');
}

function isLocalhostOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

export function buildVerificationUrl(params: {
  ref: string;
  type?: VerifiableDocType;
  origin?: string;
}): string {
  const explicitOrigin = normalizeOriginUrl(params.origin);
  const globalWebsiteOrigin =
    typeof globalThis !== 'undefined'
      ? normalizeOriginUrl((globalThis as Record<string, unknown>).__simmsWebsiteUrl as string | undefined)
      : '';
  const envOrigin = normalizeOriginUrl(process.env.NEXT_PUBLIC_APP_URL);
  const windowOrigin =
    typeof window !== 'undefined' ? normalizeOriginUrl(window.location.origin) : '';

  const baseOrigin =
    explicitOrigin ||
    (globalWebsiteOrigin && !isLocalhostOrigin(globalWebsiteOrigin) ? globalWebsiteOrigin : '') ||
    (envOrigin && !isLocalhostOrigin(envOrigin) ? envOrigin : '') ||
    (windowOrigin && !isLocalhostOrigin(windowOrigin) ? windowOrigin : '') ||
    globalWebsiteOrigin ||
    envOrigin ||
    windowOrigin ||
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

export async function registerDocumentLedger(params: {
  referenceCode: string;
  documentType: 'REKAP_ABSENSI' | 'PENILAIAN' | 'SURAT' | 'MUTASI_TABUNGAN';
  title: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/portal/document-ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceCode: params.referenceCode,
        documentType: params.documentType,
        title: params.title,
        metadata: params.metadata || {},
      }),
    });
  } catch {
    // Non-blocking: kegagalan jaringan tidak menghambat unduhan PDF
  }
}
