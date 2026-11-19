import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaBkPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="bk"
      title="Catatan Bimbingan Konseling (BK)"
      subtitle="Ringkasan catatan pembinaan, prestasi, dan bimbingan konseling Anda."
    />
  );
}
