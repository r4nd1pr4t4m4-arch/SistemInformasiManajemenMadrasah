import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function OrtuJadwalPelajaranPage() {
  return (
    <PersonalWorkspace
      scope="orang-tua"
      section="jadwal-pelajaran"
      title="Jadwal Pelajaran Anak"
      subtitle="Pantau jadwal pelajaran putra/putri Anda selama sepekan sesuai rombel kelasnya."
    />
  );
}
