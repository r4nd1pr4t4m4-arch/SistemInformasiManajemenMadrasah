import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaTabunganPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="tabungan"
      title="Buku Tabungan Digital Saya"
      subtitle="Informasi saldo tabungan serta riwayat transaksi setoran dan penarikan Anda."
    />
  );
}
