import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/?source=pwa',
    name: 'SiM-M',
    short_name: 'SiM-M',
    description:
      'Platform terpadu Website Resmi CMS, Portal Akademik, dan Manajemen Administrasi, Keuangan & Layanan Pendukung.',
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
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard Portal',
        short_name: 'Dashboard',
        description: 'Buka ringkasan utama Portal SiM-M',
        url: '/portal',
        icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Profil Akun',
        short_name: 'Profil',
        description: 'Kelola data profil dan keamanan akun Anda',
        url: '/portal/akun/profil',
        icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Masuk Portal',
        short_name: 'Login',
        description: 'Masuk ke akun SiM-M Anda',
        url: '/login',
        icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Verifikasi QR',
        short_name: 'Verifikasi',
        description: 'Verifikasi keaslian dokumen & kartu lembaga',
        url: '/verifikasi',
        icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Berita & Pengumuman',
        short_name: 'Berita',
        description: 'Baca informasi dan pengumuman terbaru lembaga',
        url: '/berita',
        icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    ],
  };
}
