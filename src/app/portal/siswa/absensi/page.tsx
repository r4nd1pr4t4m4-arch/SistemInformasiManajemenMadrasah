import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaAbsensiPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="absensi"
      title="Riwayat Absensi Siswa"
      subtitle="Rekapitulasi dan riwayat kehadiran harian maupun per mata pelajaran."
    />
  );
}
