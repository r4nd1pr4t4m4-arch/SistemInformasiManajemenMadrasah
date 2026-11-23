'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/state-views';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SIMMS PortalError]', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <ErrorState
        title="Gagal Memuat Halaman Portal"
        message="Terjadi kendala saat memproses modul portal ini. Data Anda tetap aman — silakan coba muat ulang atau kembali ke Dashboard Portal."
        code={error.digest}
        onRetry={() => reset()}
        backHref="/portal"
        backLabel="Ke Dashboard Portal"
      />
    </div>
  );
}
