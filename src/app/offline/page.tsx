'use client';

import Link from 'next/link';
import { Home, Newspaper, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen simms-ambient flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full modular-card rounded-3xl p-6 sm:p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shadow-sm">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Mode Offline PWA
          </p>
          <h1 className="text-xl font-bold text-slate-900">
            Koneksi Internet Terputus
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Halaman ini belum tersimpan di cache perangkat Anda. Periksa koneksi internet lalu
            muat ulang, atau buka halaman yang telah tersimpan sebelumnya.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Muat Ulang</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Home className="w-4 h-4" />
            <span>Ke Beranda</span>
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-200/80">
          <p className="text-[11px] font-semibold text-slate-500 mb-2.5">
            Pintasan Halaman Utama
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              href="/berita"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Berita</span>
            </Link>
            <Link
              href="/verifikasi"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 text-slate-700 font-medium transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verifikasi</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
