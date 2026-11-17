export interface SiblingBillingSummary {
  totalSiblings: number;
  payableCount: number;
  exemptCount: number;
  exemptStudentId: string | null;
}

/**
 * Menghitung aturan kelompok saudara untuk SPP & Iuran Komite:
 * - 1 saudara -> bayar 1 (0 gratis)
 * - 2 saudara -> bayar 1 (1 gratis)
 * - 3 saudara -> bayar 2 (1 gratis)
 * - N saudara (N >= 2) -> bayar (N - 1), 1 siswa gratis
 */
export function calculateSiblingGroupBilling(
  activeMemberIds: string[],
  preferredExemptStudentId?: string | null
): SiblingBillingSummary {
  const uniqueIds = Array.from(new Set(activeMemberIds));
  const totalSiblings = uniqueIds.length;

  if (totalSiblings < 2) {
    return {
      totalSiblings,
      payableCount: totalSiblings,
      exemptCount: 0,
      exemptStudentId: null,
    };
  }

  const exemptStudentId =
    preferredExemptStudentId && uniqueIds.includes(preferredExemptStudentId)
      ? preferredExemptStudentId
      : uniqueIds[0];

  return {
    totalSiblings,
    payableCount: totalSiblings - 1,
    exemptCount: 1,
    exemptStudentId,
  };
}

export function isSiblingDiscountCategory(category?: string | null): boolean {
  return category === 'SPP' || category === 'KOMITE';
}
