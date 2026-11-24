export type SppSection = 'jenis-biaya' | 'terbitkan' | 'pembayaran' | 'kelompok-saudara';

export type FeeCategory = 'SPP' | 'KOMITE' | 'UANG_GEDUNG' | 'LAINNYA';

export type PaymentMethod = 'TUNAI' | 'TRANSFER' | 'QRIS';

export type BillStatusFilter = 'ALL' | 'BELUM_LUNAS' | 'CICILAN' | 'LUNAS';

export interface StudentOption {
  id: string;
  full_name: string;
  nis: string | null;
  status?: string;
}

export interface FeeTypeRow {
  id: string;
  name: string;
  category: string;
  default_amount: number;
}

export interface BillRow {
  id: string;
  amount: number;
  original_amount?: number | null;
  discount_amount?: number | null;
  is_sibling_exempt?: boolean;
  notes?: string | null;
  paid_amount: number;
  status: string;
  student?: { full_name: string; nis: string | null } | null;
  fee_type?: { name: string; category: string } | null;
}

export interface SiblingMemberRow {
  id: string;
  group_id: string;
  student_id: string;
  is_exempt: boolean;
  student?: {
    id: string;
    full_name: string;
    nis: string | null;
    status: string;
  } | null;
}

export interface SiblingGroupRow {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  members: SiblingMemberRow[];
  billingSummary: {
    totalSiblings: number;
    payableCount: number;
    exemptCount: number;
    exemptStudentId: string | null;
  };
}

export type PostSppFn = (body: unknown, successMsg: string) => Promise<boolean>;

export type ShowToastFn = (text: string, type?: 'ok' | 'err') => void;

export const FEE_CATEGORY_LABELS: Record<string, string> = {
  SPP: 'SPP',
  KOMITE: 'Iuran Komite',
  UANG_GEDUNG: 'Uang Gedung',
  LAINNYA: 'Lainnya',
};
