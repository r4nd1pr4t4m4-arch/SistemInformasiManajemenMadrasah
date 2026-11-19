import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft, Loader2 } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { MutasiContent } from '@/components/ppdb/mutasi-content';

export default function PpdbMutasiPage() {
  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto py-6 sm:py-10 px-4 space-y-6">
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-emerald-50 mb-2 border border-white/20">
                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Layanan Mutasi Masuk Siswa Pindahan</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                PPDB Khusus Mutasi Masuk
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Lengkapi biodata siswa pindahan, alasan mutasi, &amp; berkas persyaratan, serta
                cetak Kartu Bukti Pendaftaran.
              </p>
            </div>
            <Link
              href="/ppdb"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2.5 rounded-xl transition shrink-0 w-full sm:w-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>PPDB Reguler</span>
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="p-6 sm:p-8 flex items-center justify-center gap-3 text-sm text-slate-500 min-h-[240px]">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                <span>Memuat formulir mutasi masuk...</span>
              </div>
            }
          >
            <MutasiContent />
          </Suspense>
        </div>
      </div>
    </PublicShell>
  );
}
