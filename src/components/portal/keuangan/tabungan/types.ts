import type { SavingsFeeTier } from '@/lib/domain/tabungan-fee';

export type TabunganSection = 'buka-rekening' | 'transaksi' | 'rekap' | 'aturan-fee';

export type OwnerType = 'SISWA' | 'GURU' | 'TU' | 'UMUM';

export interface SavingsAccountRow {
  id: string;
  account_number: string;
  owner_type: string;
  student_id?: string | null;
  teacher_id?: string | null;
  owner_name: string;
  owner_phone: string | null;
  balance: number;
}

export interface SavingsTransactionRow {
  id: string;
  account_id: string;
  transaction_type: 'SETOR' | 'TARIK';
  amount: number;
  fee_percentage?: number | null;
  fee_amount?: number | null;
  net_amount?: number | null;
  balance_after: number;
  reference_number: string;
  notes: string | null;
  transaction_date: string;
  account?: {
    account_number: string;
    owner_name: string;
    owner_type: string;
  } | null;
}

export interface StudentCandidate {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  phone: string | null;
}

export interface GtkCandidate {
  id: string;
  full_name: string;
  nip: string | null;
  phone: string | null;
  staff_type: string;
}

export interface PublicCandidate {
  id: string;
  full_name: string;
  phone: string | null;
  label: string;
}

export interface LastReceipt {
  referenceNumber: string;
  accountNumber: string;
  ownerName: string;
  ownerType: string;
  type: 'SETOR' | 'TARIK';
  amount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  balanceAfter: number;
  transactionDate: string;
}

export interface TierFormState {
  tier_order: number;
  label: string;
  min_amount: number;
  max_amount: number | null;
  is_unbounded: boolean;
  fee_percentage: number;
  is_active: boolean;
}

export interface TabunganPostResponse {
  transaction?: {
    reference_number: string;
    transaction_date?: string;
  };
  fee_percentage?: number;
  fee_amount?: number;
  net_amount?: number;
  balance?: number;
  feeTiers?: SavingsFeeTier[];
  error?: string;
}

export type PostTabunganFn = (
  body: unknown,
  successMsg: string
) => Promise<TabunganPostResponse | false>;
