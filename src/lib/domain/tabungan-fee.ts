import { formatRupiah } from './honorarium';

export interface SavingsFeeTier {
  id?: string;
  tier_order: number;
  label?: string | null;
  min_amount: number;
  max_amount: number | null; // null = tanpa batas atas
  fee_percentage: number; // misal 2.00, 2.25, 2.50
  is_active: boolean;
}

export interface WithdrawalFeeCalculation {
  amount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number; // nominal uang yang diterima pemilik tabungan
  matchedTier: SavingsFeeTier | null;
}

/**
 * 6 Aturan Default Fee Penarikan Tabungan:
 * 1. Penarikan < Rp 500.000: 2.00%
 * 2. Penarikan Rp 500.000 s/d Rp 1.000.000: 2.25%
 * 3. Penarikan Rp 1.000.000 s/d Rp 2.000.000: 2.50%
 * 4. Penarikan Rp 2.000.000 s/d Rp 4.000.000: 2.75%
 * 5. Penarikan Rp 4.000.000 s/d Rp 8.000.000: 3.00%
 * 6. Penarikan > Rp 8.000.000: 3.50%
 */
export const DEFAULT_WITHDRAWAL_FEE_TIERS: SavingsFeeTier[] = [
  {
    tier_order: 1,
    label: 'Kurang dari Rp 500.000',
    min_amount: 0,
    max_amount: 500000,
    fee_percentage: 2.0,
    is_active: true,
  },
  {
    tier_order: 2,
    label: 'Rp 500.000 s/d Rp 1.000.000',
    min_amount: 500000,
    max_amount: 1000000,
    fee_percentage: 2.25,
    is_active: true,
  },
  {
    tier_order: 3,
    label: 'Rp 1.000.000 s/d Rp 2.000.000',
    min_amount: 1000000,
    max_amount: 2000000,
    fee_percentage: 2.5,
    is_active: true,
  },
  {
    tier_order: 4,
    label: 'Rp 2.000.000 s/d Rp 4.000.000',
    min_amount: 2000000,
    max_amount: 4000000,
    fee_percentage: 2.75,
    is_active: true,
  },
  {
    tier_order: 5,
    label: 'Rp 4.000.000 s/d Rp 8.000.000',
    min_amount: 4000000,
    max_amount: 8000000,
    fee_percentage: 3.0,
    is_active: true,
  },
  {
    tier_order: 6,
    label: 'Lebih dari Rp 8.000.000',
    min_amount: 8000000,
    max_amount: null,
    fee_percentage: 3.5,
    is_active: true,
  },
];

export function generateTierLabel(min: number, max: number | null): string {
  if (min <= 0 && max != null) {
    return `Kurang dari ${formatRupiah(max)}`;
  }
  if (max == null) {
    return `Lebih dari ${formatRupiah(min)}`;
  }
  return `${formatRupiah(min)} s/d ${formatRupiah(max)}`;
}

export function calculateWithdrawalFee(
  amount: number,
  tiers?: SavingsFeeTier[] | null
): WithdrawalFeeCalculation {
  if (!amount || amount <= 0) {
    return {
      amount: 0,
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 0,
      matchedTier: null,
    };
  }

  const activeTiers = (tiers && tiers.length > 0 ? tiers : DEFAULT_WITHDRAWAL_FEE_TIERS)
    .filter((t) => t.is_active)
    .sort((a, b) => a.tier_order - b.tier_order);

  if (activeTiers.length === 0) {
    return {
      amount,
      feePercentage: 0,
      feeAmount: 0,
      netAmount: amount,
      matchedTier: null,
    };
  }

  let matched: SavingsFeeTier | null = null;

  for (const tier of activeTiers) {
    const min = Number(tier.min_amount) || 0;
    const max = tier.max_amount != null ? Number(tier.max_amount) : null;

    if (min === 0 && max != null) {
      if (amount < max) {
        matched = tier;
        break;
      }
    } else if (max != null) {
      if (amount >= min && amount <= max) {
        matched = tier;
        break;
      }
    } else {
      // Unbounded upper tier
      if (amount > min) {
        matched = tier;
        break;
      }
    }
  }

  // Jika belum cocok (misal amount tepat di batas atas atau melebih batas terakhir)
  if (!matched) {
    matched = activeTiers[activeTiers.length - 1] || null;
  }

  const feePercentage = matched ? Number(matched.fee_percentage) || 0 : 0;
  const feeAmount = Math.round((amount * feePercentage) / 100);
  const netAmount = Math.max(0, amount - feeAmount);

  return {
    amount,
    feePercentage,
    feeAmount,
    netAmount,
    matchedTier: matched,
  };
}
