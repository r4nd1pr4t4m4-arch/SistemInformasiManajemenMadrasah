import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { InstitutionFaviconSync } from "@/components/layout/favicon-sync";
import { AppStateMonitor } from "@/components/providers/app-state-monitor";
import { PwaProvider } from "@/components/providers/pwa-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

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
  title: "SiM-M — Sistem Informasi Manajemen Madrasah & Sekolah",
  description:
    "Platform terpadu Website Resmi CMS, Portal Akademik, dan Manajemen Administrasi, Keuangan & Layanan Pendukung.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SiM-M",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <PwaProvider>
          <ToastProvider>
            <InstitutionFaviconSync />
            <AppStateMonitor />
            {children}
          </ToastProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
