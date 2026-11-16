import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PortalAkademikClient } from './portal-akademik-client';

function PortalAkademikFallback() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data akademik...
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
