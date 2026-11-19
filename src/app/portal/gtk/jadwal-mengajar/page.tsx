import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function GtkJadwalMengajarPage() {
  return (
    <PersonalWorkspace
      scope="gtk"
      section="jadwal-pelajaran"
      title="Jadwal Mengajar Saya"
      subtitle="Jadwal mengajar Anda selama sepekan beserta jumlah JTM per sesi."
    />
  );
}
