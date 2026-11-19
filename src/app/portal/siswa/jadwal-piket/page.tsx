import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaJadwalPiketPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="jadwal-piket"
      title="Jadwal Piket Kelas"
      subtitle="Jadwal piket kebersihan kelas sepekan dengan penanda khusus pada hari piket Anda."
    />
  );
}
