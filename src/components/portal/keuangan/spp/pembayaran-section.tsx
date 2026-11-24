'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Search, X } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { SppSlipData } from '@/lib/cards/spp-slip-png';
import type {
  BillRow,
  BillStatusFilter,
  PaymentMethod,
  PostSppFn,
  ShowToastFn,
} from './types';

const BILL_PAGE_SIZE = 10;

interface PembayaranSectionProps {
  canManage: boolean;
  submitting: boolean;
  bills: BillRow[];
  postSpp: PostSppFn;
  showToast: ShowToastFn;
  onOpenSlip: (slip: SppSlipData) => void;
}

export function PembayaranSection({
  canManage,
  submitting,
  bills,
  postSpp,
  showToast,
  onOpenSlip,
}: PembayaranSectionProps) {
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<BillStatusFilter>('ALL');
  const [billPage, setBillPage] = useState(1);
  const [payForm, setPayForm] = useState({
    bill_id: '',
    amount_paid: 150000,
    payment_method: 'TUNAI' as PaymentMethod,
  });

  const unpaidBills = useMemo(
    () => bills.filter((b) => b.status !== 'LUNAS'),
    [bills]
  );

  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    return bills.filter((b) => {
      if (billStatusFilter !== 'ALL' && b.status !== billStatusFilter) return false;
      if (!q) return true;
      return (
        (b.student?.full_name || '').toLowerCase().includes(q) ||
        (b.student?.nis || '').toLowerCase().includes(q) ||
        (b.fee_type?.name || '').toLowerCase().includes(q)
      );
    });
  }, [bills, billStatusFilter, billSearch]);

  const totalBillPages = Math.max(1, Math.ceil(filteredBills.length / BILL_PAGE_SIZE));
  const currentBillPage = Math.min(billPage, totalBillPages);
  const billPageStart = (currentBillPage - 1) * BILL_PAGE_SIZE;
  const pagedBills = useMemo(
    () => filteredBills.slice(billPageStart, billPageStart + BILL_PAGE_SIZE),
    [filteredBills, billPageStart]
  );

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">
          {canManage ? 'Catat Pembayaran & Daftar Tagihan' : 'Daftar Tagihan SPP & Komite'}
        </h2>
        <span className="text-xs text-slate-500 tabular-nums">
          {unpaidBills.length} tagihan belum lunas
        </span>
      </div>

      {canManage && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!payForm.bill_id) {
              showToast('Pilih tagihan yang akan dibayar terlebih dahulu.', 'err');
              return;
            }
            if (!Number.isFinite(payForm.amount_paid) || payForm.amount_paid < 1) {
              showToast('Nominal pembayaran minimal Rp 1.', 'err');
              return;
            }
            const ok = await postSpp(
              { action: 'RECORD_PAYMENT', ...payForm },
              'Pembayaran SPP/Komite berhasil dicatat.'
            );
            if (ok) {
              setPayForm((prev) => ({ ...prev, bill_id: '' }));
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl"
        >
          <div className="sm:col-span-2 lg:col-span-5">
            <label
              htmlFor="pay-bill"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tagihan Belum Lunas *
            </label>
            <select
              id="pay-bill"
              required
              value={payForm.bill_id}
              onChange={(e) => {
                const selected = unpaidBills.find((b) => b.id === e.target.value);
                const remaining = selected
                  ? Math.max(1, Number(selected.amount) - Number(selected.paid_amount))
                  : payForm.amount_paid;
                setPayForm({
                  ...payForm,
                  bill_id: e.target.value,
                  amount_paid: remaining,
                });
              }}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Pilih Tagihan Belum Lunas --</option>
              {unpaidBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.student?.full_name} — {b.fee_type?.name} (Sisa:{' '}
                  {formatRupiah(Math.max(0, Number(b.amount) - Number(b.paid_amount)))})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label
              htmlFor="pay-amount"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Nominal Bayar (Rp) *
            </label>
            <input
              id="pay-amount"
              type="number"
              required
              min={1}
              value={payForm.amount_paid}
              onChange={(e) =>
                setPayForm({ ...payForm, amount_paid: Number(e.target.value) })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="pay-method"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Metode
            </label>
            <select
              id="pay-method"
              value={payForm.payment_method}
              onChange={(e) =>
                setPayForm({
                  ...payForm,
                  payment_method: e.target.value as PaymentMethod,
                })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="TUNAI">Tunai</option>
              <option value="TRANSFER">Transfer</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs py-2.5 px-3 transition shadow-sm"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Bayar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={billSearch}
            onChange={(e) => {
              setBillSearch(e.target.value);
              setBillPage(1);
            }}
            placeholder="Cari nama siswa, NIS, atau biaya..."
            aria-label="Cari daftar tagihan"
            className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {billSearch && (
            <button
              type="button"
              onClick={() => {
                setBillSearch('');
                setBillPage(1);
              }}
              aria-label="Hapus pencarian tagihan"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          aria-label="Filter status tagihan"
          value={billStatusFilter}
          onChange={(e) => {
            setBillStatusFilter(e.target.value as BillStatusFilter);
            setBillPage(1);
          }}
          className="w-full sm:w-44 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="ALL">Semua Status ({bills.length})</option>
          <option value="BELUM_LUNAS">Belum Lunas</option>
          <option value="CICILAN">Cicilan</option>
          <option value="LUNAS">Lunas</option>
        </select>
      </div>

      {pagedBills.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">
          {bills.length === 0
            ? 'Belum ada tagihan SPP atau komite yang tercatat.'
            : 'Tidak ada tagihan yang cocok dengan filter pencarian.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {pagedBills.map((b) => (
            <div
              key={b.id}
              className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-bold text-slate-900 break-words">
                    {b.student?.full_name} • {b.fee_type?.name}
                  </p>
                  {b.is_sibling_exempt && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                      Gratis Saudara
                    </span>
                  )}
                </div>
                <p className="text-slate-500 tabular-nums">
                  Tagihan:{' '}
                  {b.is_sibling_exempt && b.original_amount ? (
                    <>
                      <span className="line-through text-slate-400 mr-1">
                        {formatRupiah(Number(b.original_amount))}
                      </span>
                      <span className="font-semibold text-emerald-700">Rp 0</span>
                    </>
                  ) : (
                    formatRupiah(Number(b.amount))
                  )}{' '}
                  • Dibayar: {formatRupiah(Number(b.paid_amount))}
                </p>
                {b.notes && (
                  <p className="text-[11px] text-slate-400 break-words mt-0.5">{b.notes}</p>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                    b.status === 'LUNAS'
                      ? 'bg-emerald-50 text-emerald-700'
                      : b.status === 'CICILAN'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {b.status}
                </span>
                {(Number(b.paid_amount) > 0 ||
                  b.status === 'LUNAS' ||
                  b.is_sibling_exempt) && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSlip({
                        billId: b.id,
                        studentName: b.student?.full_name || 'Siswa',
                        studentNis: b.student?.nis || null,
                        feeName: b.fee_type?.name || 'SPP / Iuran',
                        feeCategory: b.fee_type?.category || null,
                        amount: Number(b.amount) || 0,
                        originalAmount: b.original_amount ?? null,
                        discountAmount: b.discount_amount ?? null,
                        isSiblingExempt: Boolean(b.is_sibling_exempt),
                        paidAmount: Number(b.paid_amount) || 0,
                        status: b.status,
                        notes: b.notes || null,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                    title="Lihat & Unduh Slip PNG"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredBills.length > BILL_PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Menampilkan {billPageStart + 1}–
            {Math.min(billPageStart + BILL_PAGE_SIZE, filteredBills.length)} dari{' '}
            {filteredBills.length} tagihan
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBillPage((p) => Math.max(1, p - 1))}
              disabled={currentBillPage <= 1}
              aria-label="Halaman tagihan sebelumnya"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-700 tabular-nums">
              Hal {currentBillPage} / {totalBillPages}
            </span>
            <button
              type="button"
              onClick={() => setBillPage((p) => Math.min(totalBillPages, p + 1))}
              disabled={currentBillPage >= totalBillPages}
              aria-label="Halaman tagihan berikutnya"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
