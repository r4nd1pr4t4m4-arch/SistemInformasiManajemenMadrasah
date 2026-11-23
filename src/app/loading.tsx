import { LoadingState } from '@/components/ui/state-views';

export default function RootLoading() {
  return (
    <div className="min-h-screen simms-ambient flex items-center justify-center">
      <LoadingState
        variant="page"
        title="Menyiapkan Halaman..."
        description="Sistem sedang memuat konten dan informasi terbaru untuk Anda."
      />
    </div>
  );
}
