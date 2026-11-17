export interface JtmBreakdown {
  teachingJtm: number;
  substituteJtm: number;
  examSupervisorJtm: number;
  examCommitteeJtm: number;
  eventJtm?: number;
  picketJtm?: number;
  ceremonyJtm?: number;
  paidHolidayJtm?: number;
}

export interface DutyAllowanceInput {
  code: string;
  name: string;
  receivesAllowance: boolean;
  monthlyAllowance: number;
}

export interface HonorariumCalculationResult {
  totalJtm: number;
  ratePerJtm: number;
  jtmHonorariumAmount: number;
  eligibleDuties: DutyAllowanceInput[];
  excludedDuties: DutyAllowanceInput[];
  additionalDutyAllowance: number;
  transportAllowance: number;
  totalAmount: number;
}

export interface DailyTransportResult {
  attendedMinutes: number;
  shortLeaveMinutes: number;
  schoolDurationMinutes: number;
  percentage: number;
  amount: number;
}

function parseTimeToMinutes(timeStr: string): number {
  const [hStr = '0', mStr = '0'] = timeStr.split(':');
  return Number(hStr) * 60 + Number(mStr);
}

function getWibMinutesOfDay(isoTimestamp: string): number {
  const date = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Menghitung tunjangan transportasi harian:
 * (% durasi kehadiran di madrasah terhadap jam sekolah) x jarak rumah (KM) x tarif per KM.
 * Contoh: jam sekolah 07:30-12:30 (300 menit), hadir 08:00-12:00 (240 menit) => 80% x jarak x tarif.
 */
export function calculateDailyTransportAllowance(params: {
  checkInTime: string;
  checkOutTime: string;
  schoolStartTime: string;
  schoolEndTime: string;
  homeDistanceKm: number;
  transportRatePerKm: number;
  shortLeaves?: { startTime: string; endTime: string }[];
}): DailyTransportResult {
  const startMin = parseTimeToMinutes(params.schoolStartTime);
  const endMin = parseTimeToMinutes(params.schoolEndTime);
  const schoolDurationMinutes = Math.max(1, endMin - startMin);

  const inMin = getWibMinutesOfDay(params.checkInTime);
  const outMin = getWibMinutesOfDay(params.checkOutTime);

  const effectiveStart = Math.max(inMin, startMin);
  const effectiveEnd = Math.min(outMin, endMin);
  const grossAttendedMinutes = Math.max(0, effectiveEnd - effectiveStart);

  let shortLeaveMinutes = 0;
  for (const lv of params.shortLeaves || []) {
    const lvStart = Math.max(effectiveStart, parseTimeToMinutes(lv.startTime));
    const lvEnd = Math.min(effectiveEnd, parseTimeToMinutes(lv.endTime));
    if (lvEnd > lvStart) {
      shortLeaveMinutes += lvEnd - lvStart;
    }
  }

  const attendedMinutes = Math.max(0, grossAttendedMinutes - shortLeaveMinutes);

  const percentage = Math.min(
    100,
    Number(((attendedMinutes / schoolDurationMinutes) * 100).toFixed(2))
  );
  const amount = Number(
    (
      (percentage / 100) *
      Math.max(0, params.homeDistanceKm) *
      Math.max(0, params.transportRatePerKm)
    ).toFixed(2)
  );

  return {
    attendedMinutes,
    shortLeaveMinutes,
    schoolDurationMinutes,
    percentage,
    amount,
  };
}

const NON_ALLOWANCE_DUTY_CODES = new Set([
  'BENDAHARA_KOMITE',
  'PENGELOLA_TABUNGAN',
]);

/**
 * Menghitung honorarium bulanan guru:
 * (Total JTM x Tarif per JTM) + Total Tunjangan Tugas Tambahan yang berhak.
 * Catatan aturan bisnis: Bendahara Komite dan Pengelola Tabungan tidak mendapat tambahan tunjangan.
 */
export function calculateTeacherHonorarium(
  jtm: JtmBreakdown,
  ratePerJtm: number,
  duties: DutyAllowanceInput[],
  transportAllowance = 0
): HonorariumCalculationResult {
  const totalJtm =
    Math.max(0, jtm.teachingJtm) +
    Math.max(0, jtm.substituteJtm) +
    Math.max(0, jtm.examSupervisorJtm) +
    Math.max(0, jtm.examCommitteeJtm) +
    Math.max(0, jtm.eventJtm ?? 0) +
    Math.max(0, jtm.picketJtm ?? 0) +
    Math.max(0, jtm.ceremonyJtm ?? 0) +
    Math.max(0, jtm.paidHolidayJtm ?? 0);

  const safeRate = Math.max(0, ratePerJtm);
  const jtmHonorariumAmount = totalJtm * safeRate;

  const eligibleDuties: DutyAllowanceInput[] = [];
  const excludedDuties: DutyAllowanceInput[] = [];

  for (const duty of duties) {
    if (duty.receivesAllowance && !NON_ALLOWANCE_DUTY_CODES.has(duty.code)) {
      eligibleDuties.push(duty);
    } else {
      excludedDuties.push(duty);
    }
  }

  const additionalDutyAllowance = eligibleDuties.reduce(
    (sum, item) => sum + Math.max(0, item.monthlyAllowance),
    0
  );

  const safeTransport = Math.max(0, Number(transportAllowance.toFixed(2)));

  return {
    totalJtm,
    ratePerJtm: safeRate,
    jtmHonorariumAmount,
    eligibleDuties,
    excludedDuties,
    additionalDutyAllowance,
    transportAllowance: safeTransport,
    totalAmount: jtmHonorariumAmount + additionalDutyAllowance + safeTransport,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
