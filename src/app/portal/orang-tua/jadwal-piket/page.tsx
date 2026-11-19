import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function OrtuJadwalPiketPage() {
  return (
    <PersonalWorkspace
      scope="orang-tua"
      section="jadwal-piket"
      title="Jadwal Piket Kelas Anak"
      subtitle="Jadwal piket kelas putra/putri Anda dengan penanda khusus pada hari tugas piketnya."
    />
  );
}
