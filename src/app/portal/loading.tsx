import { LoadingState } from '@/components/ui/state-views';

export default function PortalLoading() {
  return (
    <LoadingState
      variant="page"
      title="Memuat Modul Portal..."
      description="Menyiapkan data akademik, administrasi, dan layanan lembaga."
    />
  );
}
