import type { Metadata } from 'next';
import { PortalShell } from '@/components/layout/portal-shell';

export const metadata: Metadata = {
  title: {
    default: 'Portal Terpadu',
    template: '%s | Portal SiM-M',
  },
  description: 'Portal Administrasi, Akademik, Keuangan, dan Layanan Terpadu SiM-M.',
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
