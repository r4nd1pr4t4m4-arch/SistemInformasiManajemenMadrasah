import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function GtkTabunganPage() {
  return (
    <PersonalWorkspace
      scope="gtk"
      section="tabungan"
      title="Tabungan Digital Saya (GTK)"
      subtitle="Informasi saldo tabungan dan riwayat transaksi setor/tarik pribadi Anda."
    />
  );
}
