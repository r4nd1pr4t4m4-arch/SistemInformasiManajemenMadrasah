import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { InstitutionFaviconSync } from "@/components/layout/favicon-sync";
import { AppStateMonitor } from "@/components/providers/app-state-monitor";
import { PwaProvider } from "@/components/providers/pwa-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "SIMMS — Sistem Informasi Manajemen Madrasah & Sekolah",
  description:
    "Platform terpadu Website Resmi CMS, Portal Akademik, dan Manajemen Administrasi, Keuangan & Layanan Pendukung.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SiM-M",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <PwaProvider>
          <InstitutionFaviconSync />
          <AppStateMonitor />
          {children}
        </PwaProvider>
      </body>
    </html>
  );
}
