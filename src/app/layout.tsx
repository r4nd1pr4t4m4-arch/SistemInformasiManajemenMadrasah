import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { InstitutionFaviconSync } from "@/components/layout/favicon-sync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIMMS — Sistem Informasi Manajemen Madrasah & Sekolah",
  description:
    "Platform terpadu Website Resmi CMS, Portal Akademik, dan Manajemen Administrasi, Keuangan & Layanan Pendukung.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <InstitutionFaviconSync />
        {children}
      </body>
    </html>
  );
}
