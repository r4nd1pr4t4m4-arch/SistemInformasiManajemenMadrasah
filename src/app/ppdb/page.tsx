import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { PpdbContent } from '@/components/ppdb/ppdb-content';

export default function PpdbPage() {
  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto py-6 sm:py-10 px-4 space-y-6">
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
            <div className="min-w-0">
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-emerald-200 mb-1">
                Portal Penerimaan Siswa Baru
              </span>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                Penerimaan Peserta Didik Baru (PPDB)
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Pilih jalur pendaftaran, lengkapi biodata &amp; berkas, serta cetak Kartu Bukti
                Pendaftaran.
              </p>
            </div>
            <Link
              href="/ppdb/mutasi"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2.5 rounded-xl transition shrink-0 w-full sm:w-auto"
            >
              <span>Khusus Mutasi Masuk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="p-6 sm:p-8 flex items-center justify-center gap-3 text-sm text-slate-500 min-h-[240px]">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                <span>Memuat formulir PPDB...</span>
              </div>
            }
          >
            <PpdbContent />
          </Suspense>
        </div>
      </div>
    </PublicShell>
  );
}
