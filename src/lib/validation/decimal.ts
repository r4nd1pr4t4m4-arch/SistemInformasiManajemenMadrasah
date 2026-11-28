/**
 * Utilitas normalisasi, parsing, dan pemformatan angka desimal lintas locale
 * (mendukung pemisah koma ',' maupun titik '.' secara konsisten di semua browser).
 */

export interface DecimalInputOptions {
  allowNegative?: boolean;
}

/**
 * Menormalkan input teks angka desimal saat pengguna mengetik:
 * - Mengubah koma ',' menjadi titik '.'
 * - Mempertahankan tanda minus di awal (jika allowNegative = true)
 * - Mengizinkan maksimal satu titik desimal dan mempertahankan titik di akhir saat mengetik (mis. "85.")
 */
export function normalizeDecimalInput(
  raw: string,
  options: DecimalInputOptions = {}
): string {
  const { allowNegative = false } = options;
  const replaced = raw.replace(/,/g, '.').replace(/\s+/g, '');

  let result = '';
  let hasDot = false;

  for (let i = 0; i < replaced.length; i += 1) {
    const ch = replaced[i];
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      result += '.';
    } else if (ch === '-' && allowNegative && i === 0 && result.length === 0) {
      result += '-';
    }
  }

  return result;
}

/**
 * Mengurai nilai input desimal (string/number) menjadi number yang valid atau null.
 * Mendukung koma ',' maupun titik '.' sebagai pemisah desimal.
 */
export function parseDecimalInput(
  raw: string | number | null | undefined,
  options: DecimalInputOptions = {}
): number | null {
  const { allowNegative = false } = options;

  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    if (!allowNegative && raw < 0) return null;
    return raw;
  }

  const trimmed = raw.trim().replace(/,/g, '.');
  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return null;
  }

  const pattern = allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  if (!pattern.test(trimmed)) return null;

  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  if (!allowNegative && num < 0) return null;
  return num;
}

/**
 * Memformat nilai akademik/desimal hingga maksimal `maxDecimals` angka di belakang koma
 * (default 2 desimal sesuai presisi penyimpanan NUMERIC(5,2) / NUMERIC(8,2)),
 * tanpa memotong presisi menjadi 1 desimal.
 */
export function formatScoreDecimal(
  val: number | null | undefined,
  maxDecimals = 2
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '-';
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(val * factor) / factor;
  return String(rounded);
}
