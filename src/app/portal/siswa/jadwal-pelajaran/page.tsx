import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function SiswaJadwalPelajaranPage() {
  return (
    <PersonalWorkspace
      scope="siswa"
      section="jadwal-pelajaran"
      title="Jadwal Pelajaran Sepekan"
      subtitle="Jadwal mata pelajaran aktif selama satu pekan (Senin–Sabtu) sesuai rombel kelas Anda."
    />
  );
}
