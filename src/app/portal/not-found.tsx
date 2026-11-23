import { NotFoundState } from '@/components/ui/state-views';

export default function PortalNotFound() {
  return (
    <NotFoundState
      isPortal
      title="Halaman Portal Tidak Ditemukan"
      description="Menu atau rute portal yang Anda tuju tidak tersedia atau telah dipindahkan. Silakan pilih modul dari navigasi atau kembali ke Dashboard Portal."
    />
  );
}
