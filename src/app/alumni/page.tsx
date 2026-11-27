import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/public-shell';
import { AlumniClient } from '@/components/alumni/alumni-client';

export const metadata: Metadata = {
  title: 'Tracer Study & Sebaran Alumni — SIMMS',
  description:
    'Data sebaran lulusan di perguruan tinggi, dunia kerja, pesantren, dan wirausaha serta formulir Tracer Study alumni mandiri.',
};

export default function PublicAlumniPage() {
  return (
    <PublicShell>
      <AlumniClient />
    </PublicShell>
  );
}
