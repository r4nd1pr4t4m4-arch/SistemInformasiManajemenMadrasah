import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function GtkPresensiSayaPage() {
  return (
    <PersonalWorkspace
      scope="gtk"
      section="absensi"
      title="Riwayat Presensi GTK Saya"
      subtitle="Riwayat kehadiran GPS, jam masuk/pulang, dan perolehan JTM Anda."
    />
  );
}
