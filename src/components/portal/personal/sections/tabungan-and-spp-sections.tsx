'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarRange,
  Download,
  FileDown,
  Loader2,
  Receipt,
  RotateCcw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import {
  clampDateToToday,
  filterSavingsTransactions,
  getTodayWibIsoDate,
  resolveSavingsDateRange,
  type SavingsDatePreset,
  type SavingsTypeFilter,
} from '@/lib/domain/savings-history-filter';
import { exportSavingsHistoryToPdf } from '@/lib/domain/savings-statement-pdf';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';
import type { SppSlipData } from '@/lib/cards/spp-slip-png';
import {
  PersonalEmptyState,
  PersonalStatCard,
  formatDateId,
  type PersonalPayload,
  type PersonalScope,
} from './types';

export function TabunganSection({
  data,
  scope,
  onSelectSlip,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
  onSelectSlip: (slip: SavingsSlipData) => void;
}) {
  const school = useInstitutionSettings();
  const todayIso = useMemo(() => getTodayWibIsoDate(), []);

  const [trxSearch, setTrxSearch] = useState('');
  const [trxTypeFilter, setTrxTypeFilter] = useState<SavingsTypeFilter>('ALL');
  const [trxDatePreset, setTrxDatePreset] = useState<SavingsDatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [trxAccountFilter, setTrxAccountFilter] = useState<string>('ALL');
  const [trxVisibleCount, setTrxVisibleCount] = useState<number>(15);
  const [exportingPdfMode, setExportingPdfMode] = useState<'filtered' | 'all' | null>(null);

  if (data.savingsAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <PersonalEmptyState
          icon={<Wallet className="w-8 h-8 text-slate-300" />}
          title={
            scope === 'orang-tua' && !data.student
              ? 'Belum ada data putra/putri terhubung'
              : scope === 'orang-tua'
                ? 'Putra/putri Anda belum memiliki rekening tabungan'
                : scope === 'gtk' && !data.teacher
                  ? 'Akun belum tertaut ke data GTK'
                  : 'Belum memiliki rekening tabungan'
          }
          description={
            scope === 'orang-tua' && !data.student
              ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
              : scope === 'gtk' && !data.teacher
                ? 'Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha.'
                : 'Silakan hubungi Pengelola Tabungan atau Bendahara Madrasah untuk membuka buku tabungan digital.'
          }
        />
      </div>
    );
  }

  const effectiveAccountFilter =
    trxAccountFilter !== 'ALL' && data.savingsAccounts.some((a) => a.id === trxAccountFilter)
      ? trxAccountFilter
      : 'ALL';

  const { isInvalidRange } = resolveSavingsDateRange({
    datePreset: trxDatePreset,
    customStartDate,
    customEndDate,
    todayIso,
  });

  const filteredTrx = filterSavingsTransactions(data.savingsTransactions, {
    accountId: effectiveAccountFilter,
    typeFilter: trxTypeFilter,
    datePreset: trxDatePreset,
    customStartDate,
    customEndDate,
    searchQuery: trxSearch,
    todayIso,
  });

  const totalSetor = filteredTrx
    .filter((t) => t.transaction_type === 'SETOR')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalTarik = filteredTrx
    .filter((t) => t.transaction_type === 'TARIK')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const displayedTrx = filteredTrx.slice(0, trxVisibleCount);
  const hasMoreTrx = trxVisibleCount < filteredTrx.length;
  const hasTrxFilter =
    trxSearch.trim().length > 0 ||
    trxTypeFilter !== 'ALL' ||
    trxDatePreset !== 'ALL' ||
    effectiveAccountFilter !== 'ALL';

  function resetAllFilters() {
    setTrxSearch('');
    setTrxTypeFilter('ALL');
    setTrxDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setTrxAccountFilter('ALL');
    setTrxVisibleCount(15);
  }

  async function handleExportPdf(mode: 'filtered' | 'all') {
    const targetTransactions =
      mode === 'all' ? data.savingsTransactions : filteredTrx;
    if (targetTransactions.length === 0 || exportingPdfMode) return;

    setExportingPdfMode(mode);
    try {
      await exportSavingsHistoryToPdf({
        institutionName: school.name || school.short_name || 'SiM-M',
        institutionAddress: school.address,
        ownerDisplayName:
          data.student?.full_name ||
          data.teacher?.full_name ||
          data.profile.fullName ||
          'Nasabah',
        accounts: data.savingsAccounts,
        selectedAccountId: mode === 'all' ? 'ALL' : effectiveAccountFilter,
        transactions: targetTransactions,
        datePreset: mode === 'all' ? 'ALL' : trxDatePreset,
        typeFilter: mode === 'all' ? 'ALL' : trxTypeFilter,
        customStartDate: mode === 'all' ? undefined : customStartDate,
        customEndDate: mode === 'all' ? undefined : customEndDate,
      });
    } finally {
      setExportingPdfMode(null);
    }
  }

  function openSlip(trx: PersonalPayload['savingsTransactions'][number]) {
    const acc = data.savingsAccounts.find((a) => a.id === trx.account_id);
    onSelectSlip({
      referenceNumber: trx.reference_number,
      accountNumber: acc?.account_number || '-',
      ownerName:
        acc?.owner_name ||
        data.student?.full_name ||
        data.profile.fullName ||
        'Nasabah',
      ownerType: acc?.owner_type || 'UMUM',
      transactionType: trx.transaction_type,
      amount: Number(trx.amount) || 0,
      feePercentage: Number(trx.fee_percentage) || 0,
      feeAmount: Number(trx.fee_amount) || 0,
      netAmount: Number(trx.net_amount ?? trx.amount) || 0,
      balanceAfter: Number(trx.balance_after) || 0,
      transactionDate: trx.transaction_date,
      notes: trx.notes,
    });
  }

  return (
    <div className="space-y-6">
      <div
        className={`grid gap-4 ${data.savingsAccounts.length === 1
            ? 'grid-cols-1 max-w-xl'
            : 'grid-cols-1 md:grid-cols-2'
          }`}
      >
        {data.savingsAccounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-3xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-5 sm:p-6 shadow-md space-y-4 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono bg-white/15 px-3 py-1 rounded-full break-all">
                {acc.account_number}
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${acc.is_active
                    ? 'bg-emerald-400 text-emerald-950'
                    : 'bg-slate-400 text-slate-900'
                  }`}
              >
                {acc.is_active ? 'REKENING AKTIF' : 'NONAKTIF'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-emerald-200 uppercase font-semibold">
                Saldo Tabungan Tersedia
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1 break-words">
                {formatRupiah(Number(acc.balance) || 0)}
              </p>
            </div>
            <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-100">
              <span className="break-words">Pemilik: {acc.owner_name}</span>
              <span className="shrink-0">Kategori: {acc.owner_type}</span>
            </div>
          </div>
        ))}
      </div>

      {data.savingsTransactions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <PersonalStatCard
            label={hasTrxFilter ? 'Total Setoran (Filter)' : 'Total Setoran'}
            value={formatRupiah(totalSetor)}
            tone="emerald"
          />
          <PersonalStatCard
            label={hasTrxFilter ? 'Total Penarikan (Filter)' : 'Total Penarikan'}
            value={formatRupiah(totalTarik)}
            tone="amber"
          />
          <PersonalStatCard
            label={hasTrxFilter ? 'Transaksi Terfilter' : 'Jumlah Transaksi'}
            value={`${filteredTrx.length} Kali`}
            tone="slate"
          />
        </div>
      )}

      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Riwayat Transaksi Setor &amp; Tarik Tabungan</span>
            </h2>
            {data.savingsTransactions.length > 0 && (
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Menampilkan {displayedTrx.length} dari {filteredTrx.length} transaksi
                {hasTrxFilter ? ` (total keseluruhan: ${data.savingsTransactions.length})` : ''}
              </p>
            )}
          </div>

          {data.savingsTransactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={filteredTrx.length === 0 || isInvalidRange || Boolean(exportingPdfMode)}
                onClick={() => handleExportPdf('filtered')}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white text-xs font-semibold transition shadow-xs"
                title={
                  hasTrxFilter
                    ? 'Unduh riwayat transaksi sesuai filter yang sedang aktif dalam format PDF'
                    : 'Unduh seluruh riwayat transaksi tabungan dalam format PDF'
                }
              >
                {exportingPdfMode === 'filtered' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {hasTrxFilter
                    ? `Unduh PDF Filter (${filteredTrx.length})`
                    : `Unduh PDF Semua (${data.savingsTransactions.length})`}
                </span>
              </button>

              {hasTrxFilter && (
                <button
                  type="button"
                  disabled={Boolean(exportingPdfMode)}
                  onClick={() => handleExportPdf('all')}
                  className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 text-slate-700 text-xs font-semibold transition disabled:opacity-45"
                  title="Unduh seluruh riwayat transaksi tanpa filter dalam format PDF"
                >
                  {exportingPdfMode === 'all' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Unduh Semua ({data.savingsTransactions.length})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {data.savingsTransactions.length > 0 && (
          <div className="space-y-3 pt-1">
            {/* Baris 1: Pencarian, Rekening & Jenis Transaksi */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={trxSearch}
                  onChange={(e) => {
                    setTrxSearch(e.target.value);
                    setTrxVisibleCount(15);
                  }}
                  placeholder="Cari referensi, tanggal, atau keterangan..."
                  aria-label="Cari transaksi tabungan"
                  className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {trxSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrxSearch('');
                      setTrxVisibleCount(15);
                    }}
                    aria-label="Hapus pencarian transaksi"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {data.savingsAccounts.length > 1 && (
                  <select
                    value={effectiveAccountFilter}
                    onChange={(e) => {
                      setTrxAccountFilter(e.target.value);
                      setTrxVisibleCount(15);
                    }}
                    aria-label="Filter rekening tabungan"
                    className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  >
                    <option value="ALL">Semua Rekening</option>
                    {data.savingsAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_number}
                      </option>
                    ))}
                  </select>
                )}
                {(['ALL', 'SETOR', 'TARIK'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    aria-pressed={trxTypeFilter === tp}
                    onClick={() => {
                      setTrxTypeFilter(tp);
                      setTrxVisibleCount(15);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${trxTypeFilter === tp
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                      }`}
                  >
                    {tp === 'ALL' ? 'Semua Jenis' : tp === 'SETOR' ? 'Transaksi Setor' : 'Transaksi Tarik'}
                  </button>
                ))}
              </div>
            </div>

            {/* Baris 2: Filter Periode (7 Hari, 30 Hari, 90 Hari, Rentang Tanggal) */}
            <div className="p-3 rounded-2xl bg-slate-50/85 border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-1">
                    <CalendarRange className="w-3.5 h-3.5 text-emerald-700" />
                    Periode:
                  </span>
                  {(
                    [
                      { key: 'ALL', label: 'Semua Waktu' },
                      { key: '7D', label: '7 Hari' },
                      { key: '30D', label: '30 Hari' },
                      { key: '90D', label: '90 Hari' },
                      { key: 'CUSTOM', label: 'Rentang Tanggal' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      aria-pressed={trxDatePreset === preset.key}
                      onClick={() => {
                        setTrxDatePreset(preset.key);
                        setTrxVisibleCount(15);
                        if (preset.key === 'CUSTOM') {
                          if (!customEndDate) setCustomEndDate(todayIso);
                          if (!customStartDate) setCustomStartDate(todayIso);
                        }
                      }}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${trxDatePreset === preset.key
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {hasTrxFilter && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-700 transition"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Filter
                  </button>
                )}
              </div>

              {trxDatePreset === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
                  <div>
                    <label
                      htmlFor="tabungan-custom-start"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Dari Tanggal (maks. hari ini: {todayIso})
                    </label>
                    <input
                      id="tabungan-custom-start"
                      type="date"
                      value={customStartDate}
                      max={customEndDate && customEndDate <= todayIso ? customEndDate : todayIso}
                      onChange={(e) => {
                        const clamped = clampDateToToday(e.target.value, todayIso);
                        setCustomStartDate(clamped);
                        setTrxVisibleCount(15);
                      }}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="tabungan-custom-end"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Sampai Tanggal (maks. hari ini: {todayIso})
                    </label>
                    <input
                      id="tabungan-custom-end"
                      type="date"
                      value={customEndDate}
                      min={customStartDate || undefined}
                      max={todayIso}
                      onChange={(e) => {
                        const clamped = clampDateToToday(e.target.value, todayIso);
                        setCustomEndDate(clamped);
                        setTrxVisibleCount(15);
                      }}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                  {isInvalidRange && (
                    <div className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Tanggal awal tidak boleh lebih besar dari tanggal akhir. Sesuaikan rentang
                        tanggal terlebih dahulu.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {data.savingsTransactions.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Belum ada transaksi tercatat.
          </p>
        ) : filteredTrx.length === 0 ? (
          <div className="py-8 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-600">
              {isInvalidRange
                ? 'Rentang tanggal tidak valid.'
                : 'Tidak ada transaksi yang sesuai filter.'}
            </p>
            {hasTrxFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="space-y-3 md:hidden">
              {displayedTrx.map((trx) => {
                const isTarik = trx.transaction_type === 'TARIK';
                return (
                  <div
                    key={trx.id}
                    className="modular-card rounded-2xl p-4 space-y-2.5 text-xs min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isTarik
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                            }`}
                        >
                          {isTarik ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {trx.transaction_type}
                        </span>
                        <p className="font-mono text-[11px] text-slate-500 mt-1 break-all">
                          {trx.reference_number}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {formatDateId(trx.transaction_date)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Nominal</span>
                      <span className="text-sm font-extrabold text-slate-900">
                        {formatRupiah(Number(trx.amount) || 0)}
                      </span>
                    </div>

                    {isTarik && Number(trx.fee_amount) > 0 && (
                      <div className="flex items-center justify-between gap-2 text-rose-600">
                        <span>Fee Tarik</span>
                        <span>- {formatRupiah(Number(trx.fee_amount))}</span>
                      </div>
                    )}

                    {isTarik && (
                      <div className="flex items-center justify-between gap-2 text-emerald-700 font-semibold">
                        <span>Diterima Bersih</span>
                        <span>{formatRupiah(Number(trx.net_amount ?? trx.amount) || 0)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Saldo Akhir</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatRupiah(Number(trx.balance_after) || 0)}
                      </span>
                    </div>

                    {trx.notes && (
                      <p className="text-[11px] text-slate-500 break-words bg-slate-50 rounded-xl px-2.5 py-1.5">
                        {trx.notes}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => openSlip(trx)}
                      className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip PNG
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Referensi</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Jenis</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Nominal</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Fee Tarik</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Diterima Bersih</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Saldo Akhir</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedTrx.map((trx) => {
                    const isTarik = trx.transaction_type === 'TARIK';
                    return (
                      <tr key={trx.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                          {formatDateId(trx.transaction_date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {trx.reference_number}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isTarik
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                              }`}
                          >
                            {isTarik ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {trx.transaction_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatRupiah(Number(trx.amount) || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600 whitespace-nowrap">
                          {isTarik && Number(trx.fee_amount) > 0
                            ? `- ${formatRupiah(Number(trx.fee_amount))}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {isTarik
                            ? formatRupiah(Number(trx.net_amount ?? trx.amount) || 0)
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                          {formatRupiah(Number(trx.balance_after) || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[220px] break-words">
                          {trx.notes || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openSlip(trx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                            title="Lihat & Unduh Slip PNG"
                          >
                            <Download className="w-3 h-3" /> PNG
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMoreTrx && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setTrxVisibleCount((c) => c + 15)}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                >
                  Muat Lebih Banyak ({filteredTrx.length - displayedTrx.length}{' '}
                  tersisa)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const SPP_MONTH_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function SppSection({
  data,
  scope,
  onSelectSppSlip,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
  onSelectSppSlip: (slip: SppSlipData) => void;
}) {
  const [sppStatusFilter, setSppStatusFilter] = useState<'ALL' | 'UNPAID' | 'CICILAN' | 'LUNAS'>(
    'ALL'
  );
  const [sppSearch, setSppSearch] = useState('');
  const [proofBill, setProofBill] = useState<PersonalPayload['bills'][number] | null>(null);
  const [proofForm, setProofForm] = useState(() => ({
    amount_claimed: 0,
    payment_method: 'TRANSFER' as 'TRANSFER' | 'QRIS',
    transfer_date: getTodayWibIso(),
    proof_file_url: '',
    notes: '',
  }));
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofMsg, setProofMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (data.bills.length === 0) {
    return (
      <div className="space-y-6">
        <PersonalEmptyState
          icon={<Receipt className="w-8 h-8 text-slate-300" />}
          title={
            scope === 'orang-tua' && !data.student
              ? 'Belum ada data putra/putri terhubung'
              : 'Belum ada tagihan SPP / Komite'
          }
          description={
            scope === 'orang-tua' && !data.student
              ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
              : 'Belum ada tagihan yang diterbitkan untuk akun siswa ini.'
          }
        />
      </div>
    );
  }

  const totalTagihan = data.bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalDibayar = data.bills.reduce(
    (sum, b) => sum + (Number(b.paid_amount) || 0),
    0
  );
  const totalSisa = Math.max(0, totalTagihan - totalDibayar);

  const q = sppSearch.trim().toLowerCase();
  const filteredBills = data.bills.filter((b) => {
    if (sppStatusFilter === 'LUNAS' && b.status !== 'LUNAS') return false;
    if (sppStatusFilter === 'CICILAN' && b.status !== 'CICILAN') return false;
    if (sppStatusFilter === 'UNPAID' && b.status === 'LUNAS') return false;
    if (q) {
      const feeName = b.title || b.fee_type?.name || 'Tagihan';
      const monthNum = Number(b.billing_month) || 0;
      const monthName = SPP_MONTH_NAMES[monthNum] || '';
      const paddedMonth = monthNum > 0 ? String(monthNum).padStart(2, '0') : '';
      const period =
        b.billing_month && b.billing_year
          ? `${b.billing_month}/${b.billing_year} ${paddedMonth}/${b.billing_year} ${monthName} ${b.billing_year}`
          : '';
      const haystack = `${feeName} ${period} ${b.status}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const openSppSlip = (b: PersonalPayload['bills'][number]) => {
    const relatedPay = data.payments.find((p) => p.bill_id === b.id);
    onSelectSppSlip({
      billId: b.id,
      referenceNumber: relatedPay?.receipt_number || relatedPay?.reference_number || null,
      studentName: data.student?.full_name || data.profile.fullName,
      studentNis: data.student?.nis || null,
      feeName: b.title || b.fee_type?.name || 'SPP / Iuran Komite',
      feeCategory: b.fee_type?.category || null,
      periodLabel:
        b.billing_month && b.billing_year
          ? `${b.billing_month}/${b.billing_year}`
          : null,
      amount: Number(b.amount) || 0,
      originalAmount:
        b.original_amount !== null && b.original_amount !== undefined
          ? Number(b.original_amount)
          : null,
      discountAmount:
        b.discount_amount !== null && b.discount_amount !== undefined
          ? Number(b.discount_amount)
          : null,
      isSiblingExempt: Boolean(b.is_sibling_exempt),
      paidAmount: Number(b.paid_amount) || 0,
      status: b.status,
      paymentDate: relatedPay?.payment_date || null,
      paymentMethod: relatedPay?.payment_method || null,
      notes: b.notes || null,
    });
  };

  const hasSppFilter = sppSearch.trim().length > 0 || sppStatusFilter !== 'ALL';

  function openProofModal(b: PersonalPayload['bills'][number]) {
    const rem = Math.max(0, (Number(b.amount) || 0) - (Number(b.paid_amount) || 0));
    setProofBill(b);
    setProofMsg(null);
    setProofForm({
      amount_claimed: rem,
      payment_method: 'TRANSFER',
      transfer_date: getTodayWibIso(),
      proof_file_url: '',
      notes: '',
    });
  }

  async function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    if (!proofBill || proofSubmitting) return;
    setProofSubmitting(true);
    setProofMsg(null);
    try {
      const res = await fetch('/api/keuangan/spp/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_id: proofBill.id,
          amount_claimed: Number(proofForm.amount_claimed),
          payment_method: proofForm.payment_method,
          transfer_date: proofForm.transfer_date,
          proof_file_url: proofForm.proof_file_url.trim(),
          notes: proofForm.notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProofMsg({ type: 'err', text: json.error || 'Gagal mengirim bukti transfer.' });
      } else {
        setProofMsg({
          type: 'ok',
          text: 'Bukti transfer berhasil dikirim dan menunggu verifikasi Bendahara.',
        });
        setTimeout(() => setProofBill(null), 1800);
      }
    } catch {
      setProofMsg({ type: 'err', text: 'Gagal terhubung ke server.' });
    } finally {
      setProofSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <PersonalStatCard
          label="Total Tagihan"
          value={formatRupiah(totalTagihan)}
          tone="slate"
        />
        <PersonalStatCard
          label="Sudah Dibayar"
          value={formatRupiah(totalDibayar)}
          tone="emerald"
        />
        <PersonalStatCard
          label="Sisa Tagihan"
          value={formatRupiah(totalSisa)}
          tone={totalSisa > 0 ? 'rose' : 'emerald'}
        />
      </div>

      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Daftar Tagihan &amp; Status Pembayaran</span>
          </h2>
          <span className="text-[11px] font-medium text-slate-500">
            Menampilkan {filteredBills.length} dari {data.bills.length} tagihan
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="spp-search-input" className="sr-only">
              Cari tagihan SPP
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="spp-search-input"
              type="text"
              value={sppSearch}
              onChange={(e) => setSppSearch(e.target.value)}
              placeholder="Cari jenis biaya atau periode (mis. 11/2026 atau November)..."
              className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {sppSearch && (
              <button
                type="button"
                onClick={() => setSppSearch('')}
                aria-label="Hapus pencarian tagihan"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
            {(
              [
                { key: 'ALL', label: 'Semua' },
                { key: 'UNPAID', label: 'Belum Lunas' },
                { key: 'CICILAN', label: 'Cicilan' },
                { key: 'LUNAS', label: 'Lunas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={sppStatusFilter === tab.key}
                onClick={() => setSppStatusFilter(tab.key)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 whitespace-nowrap ${sppStatusFilter === tab.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredBills.length === 0 ? (
          <div className="py-8 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-600">
              Tidak ada tagihan yang sesuai filter.
            </p>
            {hasSppFilter && (
              <button
                type="button"
                onClick={() => {
                  setSppSearch('');
                  setSppStatusFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="space-y-3 md:hidden">
              {filteredBills.map((b) => {
                const amount = Number(b.amount) || 0;
                const paid = Number(b.paid_amount) || 0;
                const remaining = Math.max(0, amount - paid);
                const canDownloadSlip = paid > 0 || b.status === 'LUNAS';
                const periodLabel =
                  b.billing_month && b.billing_year
                    ? `${b.billing_month}/${b.billing_year}`
                    : '-';
                return (
                  <div
                    key={b.id}
                    className="modular-card rounded-2xl p-4 space-y-2.5 text-xs min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-words">
                          {b.title || b.fee_type?.name || 'Tagihan'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Periode: {periodLabel}
                          {b.due_date ? ` • Tempo: ${formatDateId(b.due_date)}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'LUNAS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'CICILAN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Nominal Tagihan</span>
                        <span className="font-bold text-slate-900">
                          {formatRupiah(amount)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Sudah Dibayar</span>
                        <span className="font-semibold text-emerald-700">
                          {formatRupiah(paid)}
                        </span>
                      </div>
                      {remaining > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Sisa</span>
                          <span className="font-semibold text-rose-600">
                            {formatRupiah(remaining)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => openProofModal(b)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                        >
                          Kirim Bukti Transfer
                        </button>
                      )}
                      {canDownloadSlip && (
                        <button
                          type="button"
                          onClick={() => openSppSlip(b)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Slip PNG
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Jenis Biaya</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Periode</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Nominal Tagihan</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Sudah Dibayar</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Sisa</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBills.map((b) => {
                    const amount = Number(b.amount) || 0;
                    const paid = Number(b.paid_amount) || 0;
                    const remaining = Math.max(0, amount - paid);
                    const canDownloadSlip = paid > 0 || b.status === 'LUNAS';
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 break-words">
                          {b.title || b.fee_type?.name || 'Tagihan'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {b.billing_month && b.billing_year
                            ? `${b.billing_month}/${b.billing_year}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                          {formatRupiah(amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap">
                          {formatRupiah(paid)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap text-rose-600">
                          {remaining > 0 ? formatRupiah(remaining) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'LUNAS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'CICILAN'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap space-x-1.5">
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => openProofModal(b)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                              title="Konfirmasi & Kirim Bukti Transfer"
                            >
                              Bayar / Bukti
                            </button>
                          )}
                          {canDownloadSlip && (
                            <button
                              type="button"
                              onClick={() => openSppSlip(b)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                              title="Lihat & Unduh Slip PNG"
                            >
                              <Download className="w-3 h-3" /> PNG
                            </button>
                          )}
                          {!canDownloadSlip && remaining <= 0 && (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {proofBill && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!proofSubmitting) setProofBill(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <form
            onSubmit={handleSubmitProof}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Kirim Bukti Transfer SPP</h3>
              <button
                type="button"
                onClick={() => setProofBill(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600">
              Tagihan: <strong>{proofBill.title || proofBill.fee_type?.name || 'SPP'}</strong>
            </p>
            {proofMsg && (
              <div
                className={`p-3 rounded-xl border ${proofMsg.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
              >
                {proofMsg.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Transfer (Rp) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={proofForm.amount_claimed}
                  onChange={(e) =>
                    setProofForm({ ...proofForm, amount_claimed: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode *</label>
                <select
                  value={proofForm.payment_method}
                  onChange={(e) =>
                    setProofForm({
                      ...proofForm,
                      payment_method: e.target.value as 'TRANSFER' | 'QRIS',
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Transfer *</label>
              <input
                type="date"
                required
                value={proofForm.transfer_date}
                onChange={(e) => setProofForm({ ...proofForm, transfer_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                URL Bukti Transfer (Foto/PDF) *
              </label>
              <input
                type="url"
                required
                value={proofForm.proof_file_url}
                onChange={(e) => setProofForm({ ...proofForm, proof_file_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Catatan (Opsional)</label>
              <input
                value={proofForm.notes}
                onChange={(e) => setProofForm({ ...proofForm, notes: e.target.value })}
                placeholder="mis. Transfer via BSI a.n. ..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProofBill(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={proofSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
              >
                {proofSubmitting ? 'Mengirim...' : 'Kirim Bukti Transfer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
