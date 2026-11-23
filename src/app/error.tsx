'use client';

import { useEffect } from 'react';
import { PublicShell } from '@/components/layout/public-shell';
import { ErrorState } from '@/components/ui/state-views';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SIMMS RootError]', error);
  }, [error]);

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <ErrorState
          title="Terjadi Kesalahan pada Halaman"
          message="Maaf, sistem mengalami kendala tak terduga saat menampilkan halaman ini. Anda dapat mencoba memuat ulang atau kembali ke beranda."
          code={error.digest}
          onRetry={() => reset()}
          backHref="/"
          backLabel="Kembali ke Beranda"
        />
      </div>
    </PublicShell>
  );
}
