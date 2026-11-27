import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/public-shell';
import { KontakClient } from '@/components/kontak/kontak-client';

export const metadata: Metadata = {
  title: 'Kontak, Pengaduan & FAQ — SIMMS',
  description:
    'Hubungi lembaga, sampaikan pengaduan atau aspirasi secara daring, lacak status tiket pengaduan, dan baca pertanyaan umum (FAQ).',
};

export default function KontakPage() {
  return (
    <PublicShell>
      <KontakClient />
    </PublicShell>
  );
}
