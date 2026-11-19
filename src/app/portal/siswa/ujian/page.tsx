import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaUjianPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="ujian"
      title="Jadwal & Ruang Ujian"
      subtitle="Informasi ruang ujian dan nomor kursi Anda pada periode ujian aktif."
    />
  );
}
