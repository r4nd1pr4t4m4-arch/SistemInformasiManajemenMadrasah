import { SelfServicePersuratanWorkspace } from '@/components/portal/persuratan/self-service-persuratan-workspace';

export default function SiswaPersuratanPage() {
  return (
    <SelfServicePersuratanWorkspace
      scope="siswa"
      title="Layanan Persuratan & Izin Siswa"
      subtitle="Ajukan Surat Keterangan Siswa Aktif, Rekomendasi Lomba/Beasiswa, atau Izin Kehadiran serta unduh surat resmi ber-QR Code."
    />
  );
}
