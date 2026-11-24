import { SelfServicePersuratanWorkspace } from '@/components/portal/persuratan/self-service-persuratan-workspace';

export default function GtkPersuratanPage() {
  return (
    <SelfServicePersuratanWorkspace
      scope="gtk"
      title="Layanan Persuratan, Surat Tugas & SK GTK"
      subtitle="Ajukan permohonan Surat Tugas Dinas / SPPD, Surat Rekomendasi, dan unduh SK / Surat Edaran resmi ber-TTE QR Code."
    />
  );
}
