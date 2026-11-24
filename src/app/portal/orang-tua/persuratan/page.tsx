import { SelfServicePersuratanWorkspace } from '@/components/portal/persuratan/self-service-persuratan-workspace';

export default function OrtuPersuratanPage() {
  return (
    <SelfServicePersuratanWorkspace
      scope="orang-tua"
      title="Layanan Surat, Izin Anak & Edaran"
      subtitle="Kirim Surat Izin Sakit / Keperluan Anak secara digital, ajukan Surat Keterangan Aktif Anak, dan baca Surat Edaran / Panggilan resmi."
    />
  );
}
