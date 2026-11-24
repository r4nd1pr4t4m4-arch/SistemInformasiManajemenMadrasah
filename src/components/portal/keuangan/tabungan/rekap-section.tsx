'use client';

import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Search,
  Users,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';
import type { OwnerType, SavingsAccountRow, SavingsTransactionRow } from './types';

interface RekapSectionProps {
  accounts: SavingsAccountRow[];
  transactions: SavingsTransactionRow[];
  onOpenSlip: (slip: SavingsSlipData) => void;
}

const TRX_PAGE_SIZE = 10;
const ACC_PAGE_SIZE = 9;

export function RekapSection({ accounts, transactions, onOpenSlip }: RekapSectionProps) {
  const [trxSearch, setTrxSearch] = useState('');
  const [trxTypeFilter, setTrxTypeFilter] = useState<'ALL' | 'SETOR' | 'TARIK'>('ALL');
  const [trxPage, setTrxPage] = useState(1);
  const [accSearch, setAccSearch] = useState('');
  const [accOwnerFilter, setAccOwnerFilter] = useState<'ALL' | OwnerType>('ALL');
  const [accPage, setAccPage] = useState(1);

  const filteredTransactions = useMemo(() => {
    const q = trxSearch.trim().toLowerCase();
    return transactions.filter((t) => {
      if (trxTypeFilter !== 'ALL' && t.transaction_type !== trxTypeFilter) return false;
      if (!q) return true;
      return (
        t.reference_number.toLowerCase().includes(q) ||
        (t.account?.owner_name || '').toLowerCase().includes(q) ||
        (t.account?.account_number || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    });
  }, [transactions, trxTypeFilter, trxSearch]);

  const totalTrxPages = Math.max(1, Math.ceil(filteredTransactions.length / TRX_PAGE_SIZE));
  const currentTrxPage = Math.min(trxPage, totalTrxPages);
  const trxPageStart = (currentTrxPage - 1) * TRX_PAGE_SIZE;
  const pagedTransactions = useMemo(
    () => filteredTransactions.slice(trxPageStart, trxPageStart + TRX_PAGE_SIZE),
    [filteredTransactions, trxPageStart]
  );

  const filteredAccounts = useMemo(() => {
    const q = accSearch.trim().toLowerCase();
    return accounts.filter((a) => {
      if (accOwnerFilter !== 'ALL' && a.owner_type !== accOwnerFilter) return false;
      if (!q) return true;
      return (
        a.owner_name.toLowerCase().includes(q) ||
        a.account_number.toLowerCase().includes(q) ||
        (a.owner_phone || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, accOwnerFilter, accSearch]);

  const totalAccPages = Math.max(1, Math.ceil(filteredAccounts.length / ACC_PAGE_SIZE));
  const currentAccPage = Math.min(accPage, totalAccPages);
  const accPageStart = (currentAccPage - 1) * ACC_PAGE_SIZE;
  const pagedAccounts = useMemo(
    () => filteredAccounts.slice(accPageStart, accPageStart + ACC_PAGE_SIZE),
    [filteredAccounts, accPageStart]
  );

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Rekapitulasi Riwayat Transaksi &amp; Fee ({filteredTransactions.length})
            </span>
          </h2>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <select
              aria-label="Filter jenis transaksi"
              value={trxTypeFilter}
              onChange={(e) => {
                setTrxTypeFilter(e.target.value as 'ALL' | 'SETOR' | 'TARIK');
                setTrxPage(1);
              }}
              className="w-full sm:w-40 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">Semua Transaksi</option>
              <option value="SETOR">Setor</option>
              <option value="TARIK">Tarik</option>
            </select>
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={trxSearch}
                onChange={(e) => {
                  setTrxSearch(e.target.value);
                  setTrxPage(1);
                }}
                placeholder="Cari ref, nama, no. rekening..."
                aria-label="Cari riwayat transaksi"
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {trxSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setTrxSearch('');
                    setTrxPage(1);
                  }}
                  aria-label="Hapus pencarian transaksi"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {pagedTransactions.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            {transactions.length === 0
              ? 'Belum ada riwayat transaksi tabungan.'
              : 'Tidak ada transaksi yang cocok dengan filter pencarian.'}
          </p>
        ) : (
          <>
            {/* Mobile Transaction Cards */}
            <div className="md:hidden space-y-2.5">
              {pagedTransactions.map((t) => (
                <div
                  key={t.id}
                  className="modular-card rounded-2xl p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">
                        {t.account?.owner_name || 'Nasabah'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {t.reference_number} • {t.account?.account_number || '-'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.transaction_type === 'SETOR'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {t.transaction_type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2 text-[11px] tabular-nums">
                    <div>
                      <span className="text-slate-400 block">Nominal</span>
                      <span className="font-bold text-slate-900">
                        {formatRupiah(Number(t.amount))}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Diterima / Masuk</span>
                      <span className="font-bold text-emerald-700">
                        {formatRupiah(Number(t.net_amount || t.amount))}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Potongan Fee</span>
                      <span className="font-semibold text-rose-600">
                        {t.transaction_type === 'TARIK' && Number(t.fee_amount) > 0
                          ? `- ${formatRupiah(Number(t.fee_amount))} (${t.fee_percentage}%)`
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Saldo Akhir</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {formatRupiah(Number(t.balance_after))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {new Date(t.transaction_date).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenSlip({
                          referenceNumber: t.reference_number,
                          accountNumber: t.account?.account_number || '-',
                          ownerName: t.account?.owner_name || 'Nasabah',
                          ownerType: t.account?.owner_type || 'UMUM',
                          transactionType: t.transaction_type,
                          amount: Number(t.amount),
                          feePercentage: Number(t.fee_percentage) || 0,
                          feeAmount: Number(t.fee_amount) || 0,
                          netAmount: Number(t.net_amount ?? t.amount),
                          balanceAfter: Number(t.balance_after),
                          transactionDate: t.transaction_date,
                          notes: t.notes,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                    >
                      <Download className="w-3 h-3" /> Slip PNG
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Transaction Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50 whitespace-nowrap">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">No. Ref</th>
                    <th className="py-2.5 px-3">Rekening &amp; Nasabah</th>
                    <th className="py-2.5 px-3">Jenis</th>
                    <th className="py-2.5 px-3 text-right">Nominal Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Potongan Fee</th>
                    <th className="py-2.5 px-3 text-right">Uang Diterima / Masuk</th>
                    <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                    <th className="py-2.5 px-3 text-center">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {pagedTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {new Date(t.transaction_date).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {t.reference_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900">
                          {t.account?.owner_name || 'Nasabah'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {t.account?.account_number} • {t.account?.owner_type}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.transaction_type === 'SETOR'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {t.transaction_type === 'SETOR' ? 'SETOR' : 'TARIK'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(Number(t.amount))}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {t.transaction_type === 'TARIK' && Number(t.fee_amount) > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            - {formatRupiah(Number(t.fee_amount))} ({t.fee_percentage}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatRupiah(Number(t.net_amount || t.amount))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatRupiah(Number(t.balance_after))}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenSlip({
                              referenceNumber: t.reference_number,
                              accountNumber: t.account?.account_number || '-',
                              ownerName: t.account?.owner_name || 'Nasabah',
                              ownerType: t.account?.owner_type || 'UMUM',
                              transactionType: t.transaction_type,
                              amount: Number(t.amount),
                              feePercentage: Number(t.fee_percentage) || 0,
                              feeAmount: Number(t.fee_amount) || 0,
                              netAmount: Number(t.net_amount ?? t.amount),
                              balanceAfter: Number(t.balance_after),
                              transactionDate: t.transaction_date,
                              notes: t.notes,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                          title="Lihat & Unduh Slip PNG"
                        >
                          <Download className="w-3 h-3" /> PNG
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length > TRX_PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Menampilkan {trxPageStart + 1}–
                  {Math.min(trxPageStart + TRX_PAGE_SIZE, filteredTransactions.length)} dari{' '}
                  {filteredTransactions.length} transaksi
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTrxPage((p) => Math.max(1, p - 1))}
                    disabled={currentTrxPage <= 1}
                    aria-label="Halaman transaksi sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Hal {currentTrxPage} / {totalTrxPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTrxPage((p) => Math.min(totalTrxPages, p + 1))}
                    disabled={currentTrxPage >= totalTrxPages}
                    aria-label="Halaman transaksi berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Daftar Rekening Buku Tabungan ({filteredAccounts.length})</span>
          </h2>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <select
              aria-label="Filter kategori pemilik rekening"
              value={accOwnerFilter}
              onChange={(e) => {
                setAccOwnerFilter(e.target.value as 'ALL' | OwnerType);
                setAccPage(1);
              }}
              className="w-full sm:w-40 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">Semua Pemilik</option>
              <option value="SISWA">Siswa</option>
              <option value="GURU">Guru</option>
              <option value="TU">Tata Usaha</option>
              <option value="UMUM">Umum</option>
            </select>
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={accSearch}
                onChange={(e) => {
                  setAccSearch(e.target.value);
                  setAccPage(1);
                }}
                placeholder="Cari nama atau no. rekening..."
                aria-label="Cari rekening tabungan"
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {accSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAccSearch('');
                    setAccPage(1);
                  }}
                  aria-label="Hapus pencarian rekening"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {pagedAccounts.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            {accounts.length === 0
              ? 'Belum ada rekening tabungan yang terdaftar.'
              : 'Tidak ada rekening yang cocok dengan filter pencarian.'}
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pagedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="modular-card rounded-2xl p-4 flex flex-col justify-between text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-emerald-700 font-bold">
                        {acc.account_number}
                      </p>
                      <p className="font-bold text-slate-900 text-sm mt-0.5 break-words">
                        {acc.owner_name}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {acc.owner_type}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Saldo Rekening:</span>
                    <span className="font-bold text-emerald-700 text-sm tabular-nums">
                      {formatRupiah(Number(acc.balance))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredAccounts.length > ACC_PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Menampilkan {accPageStart + 1}–
                  {Math.min(accPageStart + ACC_PAGE_SIZE, filteredAccounts.length)} dari{' '}
                  {filteredAccounts.length} rekening
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAccPage((p) => Math.max(1, p - 1))}
                    disabled={currentAccPage <= 1}
                    aria-label="Halaman rekening sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Hal {currentAccPage} / {totalAccPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAccPage((p) => Math.min(totalAccPages, p + 1))}
                    disabled={currentAccPage >= totalAccPages}
                    aria-label="Halaman rekening berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
