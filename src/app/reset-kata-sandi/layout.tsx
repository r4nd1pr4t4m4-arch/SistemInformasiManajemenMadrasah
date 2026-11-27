import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Reset Kata Sandi',
  description:
    'Atur ulang kata sandi akun SIMMS secara aman menggunakan verifikasi Kode OTP Email atau MFA Authenticator.',
  robots: { index: false, follow: false },
};

export default function ResetKataSandiLayout({ children }: { children: ReactNode }) {
  return children;
}
