import { getWibTodayDateString } from './jtm-late-penalty';

export type SavingsDatePreset = 'ALL' | '7D' | '30D' | '90D' | 'CUSTOM';
export type SavingsTypeFilter = 'ALL' | 'SETOR' | 'TARIK';

export interface SavingsTransactionLike {
  id: string;
  account_id: string;
  transaction_type: 'SETOR' | 'TARIK';
  amount: number;
  fee_percentage?: number | null;
  fee_amount?: number | null;
  net_amount?: number | null;
  balance_after: number;
  reference_number: string;
  notes?: string | null;
  transaction_date: string;
}

export interface SavingsFilterOptions {
  accountId: string; // 'ALL' or specific account id
  typeFilter: SavingsTypeFilter;
  datePreset: SavingsDatePreset;
  customStartDate?: string;
  customEndDate?: string;
  searchQuery?: string;
  todayIso?: string;
}

export function getTodayWibIsoDate(): string {
  return getWibTodayDateString();
}

/**
 * Mengonversi string tanggal/timestamp transaksi menjadi format YYYY-MM-DD (WIB).
 */
export function toWibDateOnly(rawDate: string): string {
  const trimmed = (rawDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed.slice(0, 10);
  return getWibTodayDateString(parsed);
}

/**
 * Mengurangi N hari dari tanggal YYYY-MM-DD secara aman (UTC calendar math).
 */
export function subtractDaysFromIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() - Math.max(0, days));
  return d.toISOString().slice(0, 10);
}

/**
 * Memastikan tanggal input tidak melebihi hari ini (tidak boleh tanggal masa depan).
 */
export function clampDateToToday(dateStr: string, todayIso = getTodayWibIsoDate()): string {
  const clean = (dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return '';
  return clean > todayIso ? todayIso : clean;
}

export function isFutureIsoDate(dateStr: string, todayIso = getTodayWibIsoDate()): boolean {
  const clean = (dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
  return clean > todayIso;
}

/**
 * Menghitung rentang tanggal aktif [startDate, endDate] (inklusif) berdasarkan preset.
 */
export function resolveSavingsDateRange(params: {
  datePreset: SavingsDatePreset;
  customStartDate?: string;
  customEndDate?: string;
  todayIso?: string;
}): { startDate: string | null; endDate: string | null; isInvalidRange: boolean } {
  const today = params.todayIso || getTodayWibIsoDate();

  if (params.datePreset === 'ALL') {
    return { startDate: null, endDate: null, isInvalidRange: false };
  }
  if (params.datePreset === '7D') {
    return {
      startDate: subtractDaysFromIsoDate(today, 6),
      endDate: today,
      isInvalidRange: false,
    };
  }
  if (params.datePreset === '30D') {
    return {
      startDate: subtractDaysFromIsoDate(today, 29),
      endDate: today,
      isInvalidRange: false,
    };
  }
  if (params.datePreset === '90D') {
    return {
      startDate: subtractDaysFromIsoDate(today, 89),
      endDate: today,
      isInvalidRange: false,
    };
  }

  // CUSTOM range — cegah tanggal masa depan
  const start = params.customStartDate ? clampDateToToday(params.customStartDate, today) : null;
  const end = params.customEndDate ? clampDateToToday(params.customEndDate, today) : null;
  const isInvalidRange = Boolean(start && end && start > end);

  return {
    startDate: start || null,
    endDate: end || null,
    isInvalidRange,
  };
}

export function filterSavingsTransactions<T extends SavingsTransactionLike>(
  transactions: readonly T[],
  options: SavingsFilterOptions
): T[] {
  const { startDate, endDate, isInvalidRange } = resolveSavingsDateRange({
    datePreset: options.datePreset,
    customStartDate: options.customStartDate,
    customEndDate: options.customEndDate,
    todayIso: options.todayIso,
  });

  if (isInvalidRange) return [];

  const q = (options.searchQuery || '').trim().toLowerCase();

  return transactions.filter((trx) => {
    if (options.accountId !== 'ALL' && trx.account_id !== options.accountId) {
      return false;
    }
    if (options.typeFilter !== 'ALL' && trx.transaction_type !== options.typeFilter) {
      return false;
    }

    if (startDate || endDate) {
      const trxDate = toWibDateOnly(trx.transaction_date);
      if (startDate && trxDate < startDate) return false;
      if (endDate && trxDate > endDate) return false;
    }

    if (q) {
      const refMatch = (trx.reference_number || '').toLowerCase().includes(q);
      const notesMatch = (trx.notes || '').toLowerCase().includes(q);
      const dateMatch = (trx.transaction_date || '').toLowerCase().includes(q);
      if (!refMatch && !notesMatch && !dateMatch) return false;
    }

    return true;
  });
}

export function describeSavingsFilterLabel(params: {
  datePreset: SavingsDatePreset;
  typeFilter: SavingsTypeFilter;
  customStartDate?: string;
  customEndDate?: string;
  todayIso?: string;
}): { periodLabel: string; typeLabel: string; fileSlug: string } {
  const { startDate, endDate } = resolveSavingsDateRange(params);

  let periodLabel = 'Semua Periode';
  let periodSlug = 'semua';
  if (params.datePreset === '7D') {
    periodLabel = `7 Hari Terakhir (${startDate} s.d. ${endDate})`;
    periodSlug = '7-hari';
  } else if (params.datePreset === '30D') {
    periodLabel = `30 Hari Terakhir (${startDate} s.d. ${endDate})`;
    periodSlug = '30-hari';
  } else if (params.datePreset === '90D') {
    periodLabel = `90 Hari Terakhir (${startDate} s.d. ${endDate})`;
    periodSlug = '90-hari';
  } else if (params.datePreset === 'CUSTOM') {
    if (startDate && endDate) {
      periodLabel = `${startDate} s.d. ${endDate}`;
      periodSlug = `${startDate}_sd_${endDate}`;
    } else if (startDate) {
      periodLabel = `Mulai ${startDate}`;
      periodSlug = `mulai-${startDate}`;
    } else if (endDate) {
      periodLabel = `Sampai ${endDate}`;
      periodSlug = `sampai-${endDate}`;
    }
  }

  const typeLabel =
    params.typeFilter === 'SETOR'
      ? 'Transaksi Setor Saja'
      : params.typeFilter === 'TARIK'
        ? 'Transaksi Tarik Saja'
        : 'Semua Jenis (Setor & Tarik)';

  const typeSlug =
    params.typeFilter === 'SETOR'
      ? 'setor'
      : params.typeFilter === 'TARIK'
        ? 'tarik'
        : 'semua-jenis';

  return {
    periodLabel,
    typeLabel,
    fileSlug: `${periodSlug}_${typeSlug}`,
  };
}
