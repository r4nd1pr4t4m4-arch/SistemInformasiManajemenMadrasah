import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PortalAkademikClient } from './portal-akademik-client';

function PortalAkademikFallback() {
  return (
    <div className="min-h-screen simms-ambient py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Portal Terpadu
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Portal Akademik</h1>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data akademik dari Supabase...
        </div>
      </div>
    </div>
  );
}

export default function PortalAkademikPage() {
  return (
    <Suspense fallback={<PortalAkademikFallback />}>
      <PortalAkademikClient />
    </Suspense>
  );
}
