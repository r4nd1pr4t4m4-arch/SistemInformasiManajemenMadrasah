import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaGuruWaliPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="guru-wali"
      title="Rekam Jejak Bimbingan Guru Wali"
      subtitle="Pantau riwayat pendampingan, setoran hafalan, dan rekomendasi dari Guru Wali Anda."
    />
  );
}
