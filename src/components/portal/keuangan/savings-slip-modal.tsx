'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Loader2, X, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { downloadSavingsSlipPng, type SavingsSlipData } from '@/lib/cards/savings-slip-png';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';

export function SavingsSlipModal({
  slip,
  onClose,
}: {
  slip: SavingsSlipData;
  onClose: () => void;
}) {
  const school = useInstitutionSettings();
  const [downloading, setDownloading] = useState(false);

  const isTarik = slip.transactionType === 'TARIK';
  const feeAmt = Number(slip.feeAmount) || 0;
  const feePct = Number(slip.feePercentage) || 0;
  const netAmt = Number(slip.netAmount ?? slip.amount - feeAmt);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadSavingsSlipPng(slip, school.name || 'SIMMS — Tabungan Digital');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Modern Slip Header */}
        <div
          className={`p-6 text-white relative ${
            isTarik
              ? 'bg-gradient-to-br from-slate-900 to-amber-900'
              : 'bg-gradient-to-br from-emerald-900 to-teal-800'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">
            {school.name || 'Tabungan Digital'}
          </p>
          <h3 className="text-lg font-black mt-1 flex items-center gap-2">
            {isTarik ? (
              <ArrowDownRight className="w-5 h-5 text-amber-300" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-emerald-300" />
            )}
            {isTarik ? 'Slip Penarikan Tabungan' : 'Slip Setoran Tabungan'}
          </h3>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Berhasil
            </span>
            <span className="font-mono text-[11px] text-white/85">{slip.referenceNumber}</span>
          </div>
        </div>

        {/* Slip Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Pemilik Rekening</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{slip.ownerName}</p>
              <p className="text-[11px] text-slate-500">
                Kategori: {slip.ownerType || 'UMUM'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-slate-400">No. Rekening</p>
              <p className="font-mono font-bold text-slate-800 mt-0.5">{slip.accountNumber}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Waktu Transaksi</span>
              <span className="font-semibold text-slate-800">
                {slip.transactionDate
                  ? new Date(slip.transactionDate).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : new Date().toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">
                {isTarik ? 'Nominal Penarikan Saldo' : 'Nominal Setoran'}
              </span>
              <strong className="text-slate-900">{formatRupiah(Number(slip.amount) || 0)}</strong>
            </div>

            {isTarik && (
              <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-600">
                <span>Potongan Fee ({feePct}%)</span>
                <strong>{feeAmt > 0 ? `- ${formatRupiah(feeAmt)}` : 'Rp 0'}</strong>
              </div>
            )}

            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between">
              <span className="font-bold text-emerald-900">
                {isTarik ? 'Diterima Bersih Tunai' : 'Masuk ke Rekening'}
              </span>
              <span className="text-base font-black text-emerald-700">
                {formatRupiah(isTarik ? netAmt : Number(slip.amount) || 0)}
              </span>
            </div>

            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-medium">Saldo Rekening Akhir</span>
              <strong className="text-slate-900 font-mono">
                {formatRupiah(Number(slip.balanceAfter) || 0)}
              </strong>
            </div>

            {slip.notes && (
              <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                Catatan: {slip.notes}
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan PNG...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Unduh Slip PNG
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
