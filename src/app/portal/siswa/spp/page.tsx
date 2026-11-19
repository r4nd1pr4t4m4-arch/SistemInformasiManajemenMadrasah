import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaSppPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="spp"
      title="Tagihan & Pembayaran SPP"
      subtitle="Daftar tagihan SPP, iuran komite, dan status pembayaran Anda."
    />
  );
}
