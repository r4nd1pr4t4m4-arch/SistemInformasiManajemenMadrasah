import { PersonalWorkspace } from '@/components/portal/personal/personal-workspace';

export default function GtkHonorariumPage() {
  return (
    <PersonalWorkspace
      scope="gtk"
      section="honorarium"
      title="Slip Honorarium Saya"
      subtitle="Rincian slip honorarium JTM, tunjangan tugas tambahan, transportasi, dan status pencairan."
    />
  );
}
