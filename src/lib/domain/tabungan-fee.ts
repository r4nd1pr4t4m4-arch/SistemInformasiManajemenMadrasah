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
  rawFeeAmount: number; // nominal fee murni sebelum pembulatan
  feeAmount: number; // nominal fee setelah pembulatan
  netAmount: number; // nominal uang yang diterima pemilik tabungan
  matchedTier: SavingsFeeTier | null;
}

/**
 * Aturan Pembulatan Nominal Fee Penarikan Tabungan:
 * 1. Jika nominal ratusannya kurang dari 330, maka dibulatkan menjadi 000 (ribuan bawah).
 * 2. Jika nominal ratusannya antara 330 hingga 660, maka dibulatkan menjadi 500 (tengah).
 * 3. Jika nominal ratusannya lebih dari 660, maka dibulatkan menjadi 1000 (ribuan atas).
 *
 * Contoh:
 * - 2.300 -> ratusan 300 (< 330) -> dibulatkan menjadi 2.000
 * - 2.560 -> ratusan 560 (330 s/d 660) -> dibulatkan menjadi 2.500
 * - 2.870 -> ratusan 870 (> 660) -> dibulatkan menjadi 3.000
 */
export function roundSavingsFee(rawFee: number): number {
  if (!rawFee || rawFee <= 0) return 0;

  const baseThousands = Math.floor(rawFee / 1000) * 1000;
  const remainder = rawFee - baseThousands;

  if (remainder < 330) {
    return baseThousands;
  } else if (remainder <= 660) {
    return baseThousands + 500;
  } else {
    return baseThousands + 1000;
  }
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
      rawFeeAmount: 0,
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
      rawFeeAmount: 0,
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

  // Jika belum cocok: hanya gunakan tier tertinggi jika nominal melebihi batas atas tier terakhir;
  // jika di bawah batas minimum tier terendah (misal tier pertama dinonaktifkan), biaya 0%.
  if (!matched && activeTiers.length > 0) {
    const lastTier = activeTiers[activeTiers.length - 1];
    const lastBound = lastTier.max_amount != null ? Number(lastTier.max_amount) : Number(lastTier.min_amount) || 0;
    if (amount >= lastBound) {
      matched = lastTier;
    }
  }

  const feePercentage = matched ? Number(matched.fee_percentage) || 0 : 0;
  const rawFee = (amount * feePercentage) / 100;
  const feeAmount = roundSavingsFee(rawFee);
  const netAmount = Math.max(0, amount - feeAmount);

  return {
    amount,
    feePercentage,
    rawFeeAmount: Math.round(rawFee),
    feeAmount,
    netAmount,
    matchedTier: matched,
  };
}
