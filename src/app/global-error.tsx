'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SIMMS GlobalError]', error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-slate-900">Terjadi Gangguan Sistem</h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Aplikasi mengalami kesalahan kritis. Silakan muat ulang halaman untuk memulihkan sesi
              Anda.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-slate-400">Ref: {error.digest}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Muat Ulang Aplikasi</span>
          </button>
        </div>
      </body>
    </html>
  );
}
