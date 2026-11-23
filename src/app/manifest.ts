import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { getInstitutionSettings } from '@/lib/data/public-queries';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const settings = await getInstitutionSettings();

  const appName =
    settings.name?.trim() ||
    'SIMMS — Sistem Informasi Manajemen Madrasah & Sekolah';
  const shortName = settings.short_name?.trim() || 'SIMMS';
  const description =
    'Platform terpadu Website Resmi CMS, Portal Akademik, dan Manajemen Administrasi, Keuangan & Layanan Pendukung.';

  const icon192 = '/api/pwa/icon?size=192';
  const icon512 = '/api/pwa/icon?size=512';
  const iconMaskable = '/api/pwa/icon?size=maskable';

  return {
    id: '/?source=pwa',
    name: appName,
    short_name: shortName,
    description,
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#f6f8fb',
    theme_color: '#059669',
    lang: 'id',
    dir: 'ltr',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: iconMaskable,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard Portal',
        short_name: 'Dashboard',
        description: 'Buka ringkasan utama Portal SIMMS',
        url: '/portal',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Profil Akun',
        short_name: 'Profil',
        description: 'Kelola data profil dan keamanan akun Anda',
        url: '/portal/akun/profil',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Masuk Portal',
        short_name: 'Login',
        description: 'Masuk ke akun SIMMS Anda',
        url: '/login',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Verifikasi QR',
        short_name: 'Verifikasi',
        description: 'Verifikasi keaslian dokumen & kartu lembaga',
        url: '/verifikasi',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Berita & Pengumuman',
        short_name: 'Berita',
        description: 'Baca informasi dan pengumuman terbaru lembaga',
        url: '/berita',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
