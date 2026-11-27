import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/public-shell';
import { ELibraryClient } from '@/components/elibrary/elibrary-client';

export const metadata: Metadata = {
  title: 'E-Library & Koleksi Buku Digital — SIMMS',
  description:
    'Perpustakaan digital resmi lembaga: baca koleksi buku elektronik pembelajaran, referensi akademik, dan literasi secara interaktif.',
};

export default function PublicELibraryPage() {
  return (
    <PublicShell>
      <ELibraryClient />
    </PublicShell>
  );
}
