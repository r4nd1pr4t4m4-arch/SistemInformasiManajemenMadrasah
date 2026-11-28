import type jsPDF from 'jspdf';

export interface LoadedPdfLogo {
  dataUrl: string;
  width: number;
  height: number;
}

const LOGO_CACHE_TTL_MS = 2 * 60 * 1000;
let cachedLogo: { key: string; expiresAt: number; value: LoadedPdfLogo | null } | null = null;

function rasterizeImageToPng(src: string): Promise<LoadedPdfLogo | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || 256;
        const naturalH = img.naturalHeight || 256;
        const maxDim = 320;
        const scale = Math.min(maxDim / naturalW, maxDim / naturalH, 2);
        const targetW = Math.max(1, Math.round(naturalW * scale));
        const targetH = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, width: naturalW, height: naturalH });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function fetchAsRasterizedLogo(url: string): Promise<LoadedPdfLogo | null> {
  if (url.startsWith('data:image/')) {
    return rasterizeImageToPng(url);
  }
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await rasterizeImageToPng(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/**
 * Memuat logo institusi sebagai PNG data URL siap pakai untuk jsPDF (mendukung PNG, JPG, WEBP, SVG, ICO).
 * Selalu memiliki fallback ke endpoint same-origin `/api/cms/logo` agar bebas masalah CORS.
 */
export async function loadInstitutionLogoForPdf(
  preferredLogoUrl?: string | null
): Promise<LoadedPdfLogo | null> {
  if (typeof window === 'undefined') return null;

  const trimmed = preferredLogoUrl?.trim() || '';
  const cacheKey = trimmed || '/api/cms/logo';
  if (cachedLogo && cachedLogo.key === cacheKey && cachedLogo.expiresAt > Date.now()) {
    return cachedLogo.value;
  }

  const candidates: string[] = [];
  if (trimmed && (trimmed.startsWith('data:image/') || trimmed.startsWith('/'))) {
    candidates.push(trimmed);
  }
  if (!candidates.includes('/api/cms/logo')) {
    candidates.push('/api/cms/logo');
  }

  let resolved: LoadedPdfLogo | null = null;
  for (const candidate of candidates) {
    resolved = await fetchAsRasterizedLogo(candidate);
    if (resolved) break;
  }

  cachedLogo = {
    key: cacheKey,
    expiresAt: Date.now() + LOGO_CACHE_TTL_MS,
    value: resolved,
  };
  return resolved;
}

/**
 * Menggambar logo institusi ke dalam kotak target (boxX, boxY, boxW, boxH)
 * dengan mempertahankan rasio aspek (object-contain) dan rata tengah.
 */
export function drawLogoInBox(
  doc: jsPDF,
  logo: LoadedPdfLogo,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  const ratio = logo.width > 0 && logo.height > 0 ? logo.width / logo.height : 1;
  let drawW = boxW;
  let drawH = boxW / ratio;
  if (drawH > boxH) {
    drawH = boxH;
    drawW = boxH * ratio;
  }
  const offsetX = boxX + (boxW - drawW) / 2;
  const offsetY = boxY + (boxH - drawH) / 2;
  doc.addImage(logo.dataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
}
