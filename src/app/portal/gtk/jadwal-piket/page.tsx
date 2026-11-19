import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function GtkJadwalPiketPage() {
  return (
    <PersonalWorkspace
      scope="gtk"
      section="jadwal-piket"
      title="Jadwal Piket GTK Saya"
      subtitle="Jadwal tugas piket harian madrasah yang ditetapkan untuk Anda."
    />
  );
}
