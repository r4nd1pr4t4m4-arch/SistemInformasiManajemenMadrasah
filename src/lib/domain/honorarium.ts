export interface JtmBreakdown {
  teachingJtm: number;
  substituteJtm: number;
  examSupervisorJtm: number;
  examCommitteeJtm: number;
  eventJtm?: number;
  picketJtm?: number;
  ceremonyJtm?: number;
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
  totalAmount: number;
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
  duties: DutyAllowanceInput[]
): HonorariumCalculationResult {
  const totalJtm =
    Math.max(0, jtm.teachingJtm) +
    Math.max(0, jtm.substituteJtm) +
    Math.max(0, jtm.examSupervisorJtm) +
    Math.max(0, jtm.examCommitteeJtm) +
    Math.max(0, jtm.eventJtm ?? 0) +
    Math.max(0, jtm.picketJtm ?? 0) +
    Math.max(0, jtm.ceremonyJtm ?? 0);

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

  return {
    totalJtm,
    ratePerJtm: safeRate,
    jtmHonorariumAmount,
    eligibleDuties,
    excludedDuties,
    additionalDutyAllowance,
    totalAmount: jtmHonorariumAmount + additionalDutyAllowance,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
