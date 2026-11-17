export interface LateJtmCalculation {
  allowed: boolean;
  isSunday: boolean;
  delayDays: number;
  percentage: number;
  creditedJtm: number;
  submitDate: string;
  reason?: string;
}

/**
 * Mengambil tanggal hari ini (YYYY-MM-DD) dalam zona waktu Asia/Jakarta (WIB).
 */
export function getWibTodayDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function isSundayDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getUTCDay() === 0;
}

/**
 * Menghitung jumlah hari keterlambatan (H+N) dari scheduledDate ke submitDate
 * dengan mengecualikan Hari Minggu.
 * Contoh: Jadwal Sabtu, input Senin => Minggu tidak dihitung => H+1.
 */
export function countNonSundayDelayDays(scheduledDate: string, submitDate: string): number {
  const start = new Date(`${scheduledDate}T00:00:00Z`);
  const end = new Date(`${submitDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end <= start) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor <= end) {
    if (cursor.getUTCDay() !== 0) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function getPercentageForDelayDays(delayDays: number): number {
  if (delayDays <= 0) return 100;
  if (delayDays === 1) return 80;
  if (delayDays === 2) return 60;
  if (delayDays === 3) return 40;
  if (delayDays === 4) return 20;
  if (delayDays === 5) return 10;
  return 0;
}

/**
 * Menghitung JTM yang sah berdasarkan keterlambatan input Jurnal Pembelajaran / Jurnal Acara / BAP.
 * - Hari Minggu: tidak diperbolehkan input jurnal/BAP apapun.
 * - H+0: 100%, H+1: 80%, H+2: 60%, H+3: 40%, H+4: 20%, H+5: 10%, >H+5: 0%.
 */
export function calculateLateJtm(
  baseJtm: number,
  scheduledDate: string,
  submitDate = getWibTodayDateString()
): LateJtmCalculation {
  if (isSundayDate(submitDate)) {
    return {
      allowed: false,
      isSunday: true,
      delayDays: 0,
      percentage: 0,
      creditedJtm: 0,
      submitDate,
      reason:
        'Hari Minggu tidak ada pengisian Jurnal Pembelajaran, Jurnal Acara, maupun BAP. Silakan input pada hari Senin atau hari aktif berikutnya.',
    };
  }

  const delayDays = countNonSundayDelayDays(scheduledDate, submitDate);
  const percentage = getPercentageForDelayDays(delayDays);
  const creditedJtm = Number(((Math.max(0, baseJtm) * percentage) / 100).toFixed(2));

  return {
    allowed: true,
    isSunday: false,
    delayDays,
    percentage,
    creditedJtm,
    submitDate,
  };
}
