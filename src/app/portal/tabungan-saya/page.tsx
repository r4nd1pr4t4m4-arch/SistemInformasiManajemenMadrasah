import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function TabunganSayaPage() {
  return (
    <PersonalWorkspace
      scope="umum"
      section="tabungan"
      title="Tabungan Digital Saya"
      subtitle="Informasi buku tabungan, saldo tersedia, serta riwayat transaksi setoran dan penarikan Anda."
    />
  );
}
