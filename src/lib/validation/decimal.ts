/**
 * Utilitas normalisasi, parsing, pembulatan aman, dan pemformatan angka desimal lintas locale
 * (mendukung pemisah koma ',' maupun titik '.' secara konsisten di semua browser).
 */

export interface DecimalInputOptions {
  allowNegative?: boolean;
  maxDecimals?: number;
}

/**
 * Membulatkan angka desimal secara aman dengan koreksi Number.EPSILON
 * untuk menghindari anomali biner IEEE-754 (mis. 1.005 * 100 = 100.49999999999999 -> 1.01).
 */
export function roundDecimal(val: number, decimals = 2): number {
  if (!Number.isFinite(val)) return 0;
  const safeDecimals = Math.max(0, Math.min(10, Math.trunc(decimals)));
  const factor = 10 ** safeDecimals;
  const sign = val < 0 ? -1 : 1;
  const rounded = Math.round((Math.abs(val) + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : sign * rounded;
}

/**
 * Mengecek apakah sebuah angka memiliki maksimal `maxDecimals` angka di belakang koma
 * dengan toleransi floating-point.
 */
export function hasMaxDecimals(val: number, maxDecimals = 2): boolean {
  if (!Number.isFinite(val)) return false;
  const safeDecimals = Math.max(0, Math.min(10, Math.trunc(maxDecimals)));
  const factor = 10 ** safeDecimals;
  return Math.abs(Math.round(val * factor) - val * factor) < 1e-6;
}

/**
 * Menormalkan input teks angka desimal saat pengguna mengetik:
 * - Mengubah koma ',' menjadi titik '.'
 * - Mempertahankan tanda minus di awal (jika allowNegative = true)
 * - Mengizinkan maksimal satu titik desimal dan mempertahankan titik di akhir saat mengetik (mis. "85.")
 * - Membatasi jumlah digit di belakang koma jika `maxDecimals` diberikan
 */
export function normalizeDecimalInput(
  raw: string,
  options: DecimalInputOptions = {}
): string {
  const { allowNegative = false, maxDecimals } = options;
  const replaced = raw.replace(/,/g, '.').replace(/\s+/g, '');

  let result = '';
  let hasDot = false;
  let decimalCount = 0;

  for (let i = 0; i < replaced.length; i += 1) {
    const ch = replaced[i];
    if (ch >= '0' && ch <= '9') {
      if (hasDot && maxDecimals !== undefined && decimalCount >= maxDecimals) {
        continue;
      }
      result += ch;
      if (hasDot) {
        decimalCount += 1;
      }
    } else if (ch === '.' && !hasDot) {
      if (maxDecimals === 0) continue;
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
  return String(roundDecimal(val, maxDecimals));
}
