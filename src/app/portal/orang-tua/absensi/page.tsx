import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function OrtuAbsensiPage() {
  return (
    <PersonalWorkspace
      scope="orang-tua"
      section="absensi"
      title="Riwayat Absensi Anak"
      subtitle="Pantau rekapitulasi dan riwayat kehadiran harian maupun per mata pelajaran anak."
    />
  );
}
