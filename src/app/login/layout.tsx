import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Masuk & Daftar Akun',
  description:
    'Masuk ke Portal SIMMS untuk mengakses CMS Website, Portal Akademik, Keuangan, dan Layanan, atau daftar akun baru dengan verifikasi OTP.',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
