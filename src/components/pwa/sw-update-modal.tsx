'use client';

import { RefreshCw, ShieldCheck } from 'lucide-react';

interface SwUpdateModalProps {
  open: boolean;
  updating: boolean;
  onReload: () => void;
}

export function SwUpdateModal({ open, updating, onReload }: SwUpdateModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sw-update-title"
      aria-describedby="sw-update-desc"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
            <RefreshCw className={`w-6 h-6 ${updating ? 'animate-spin' : ''}`} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Pembaruan Wajib
            </p>
            <h2 id="sw-update-title" className="text-base font-bold text-slate-900">
              Versi Baru Aplikasi Tersedia
            </h2>
            <p id="sw-update-desc" className="text-xs text-slate-600 leading-relaxed">
              Pembaruan sistem SiM-M telah siap dipasang. Untuk menjaga keamanan data dan
              kestabilan fitur, aplikasi wajib dimuat ulang sekarang.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Sesi login Anda tetap aman. Proses muat ulang hanya membutuhkan beberapa detik.
          </p>
        </div>

        <button
          type="button"
          disabled={updating}
          aria-busy={updating || undefined}
          onClick={onReload}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-70"
        >
          <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
          <span>{updating ? 'Memuat Ulang Aplikasi...' : 'Muat Ulang Sekarang'}</span>
        </button>
      </div>
    </div>
  );
}
