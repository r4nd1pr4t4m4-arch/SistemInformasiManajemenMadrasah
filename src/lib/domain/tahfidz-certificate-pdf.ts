'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl, registerDocumentLedger } from '@/lib/verification/document-verify';
import { fetchInstitutionSettings } from '@/lib/hooks/use-institution-settings';

export interface TahfidzCertificatePayload {
  studentId: string;
  studentName: string;
  nis: string | null;
  items: Array<{
    surah_or_juz: string;
    status: string;
    fluency: string | null;
    tajwid_score: number | null;
    tasmi_score: number | null;
    tasmi_date: string | null;
    examiner_name: string | null;
  }>;
}

export async function generateTahfidzReportPdf(payload: TahfidzCertificatePayload) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const settings = await fetchInstitutionSettings().catch(() => null);
  const safeName = payload.studentName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'SISWA';
  const refCode = `PNL-TAHFIDZ-${safeName}-${Date.now().toString(36).toUpperCase()}`;

  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((settings?.name || 'SERTIFIKAT & RAPOR TAHFIDZ AL-QUR\'AN').toUpperCase(), 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Sertifikat & Laporan Capaian Hafalan Al-Qur\'an (Program Guru Wali)', 14, 18);
  doc.setFontSize(7.5);
  doc.text(`Ref Verifikasi: ${refCode}`, 14, 24);

  try {
    const verifyUrl = buildVerificationUrl({
      ref: refCode,
      type: 'PENILAIAN',
      origin: settings?.website_url || undefined,
    });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - 33, 4, 20, 20, 1.5, 1.5, 'F');
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 32, 5, 18, 18);
    void registerDocumentLedger({
      referenceCode: refCode,
      documentType: 'PENILAIAN',
      title: 'Sertifikat & Rapor Hafalan Tahfidz',
      metadata: { subtitle: payload.studentName, studentId: payload.studentId },
    });
  } catch {
    // non-blocking
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RAPOR & SERTIFIKAT CAPAIAN HAFALAN', pageWidth / 2, 38, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Nama Siswa: ${payload.studentName}   |   NIS: ${payload.nis || '-'}`,
    pageWidth / 2,
    45,
    { align: 'center' }
  );

  const completedCount = payload.items.filter((i) => i.status === 'TUNTAS').length;
  const pct = payload.items.length > 0 ? Math.round((completedCount / payload.items.length) * 100) : 0;
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text(
    `Capaian Ketuntasan: ${completedCount} dari ${payload.items.length} target (${pct}%)`,
    pageWidth / 2,
    51,
    { align: 'center' }
  );

  autoTable(doc, {
    startY: 56,
    head: [['No', 'Surah / Juz', 'Status', 'Kelancaran', 'Tajwid', 'Ujian Tasmi\'', 'Penguji']],
    body: payload.items.map((item, idx) => [
      String(idx + 1),
      item.surah_or_juz,
      item.status,
      item.fluency || '-',
      item.tajwid_score !== null ? String(item.tajwid_score) : '-',
      item.tasmi_score !== null
        ? `${item.tasmi_score}${item.tasmi_date ? ` (${item.tasmi_date})` : ''}`
        : '-',
      item.examiner_name || '-',
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
  });

  doc.save(`Rapor_Tahfidz_${payload.studentName.replace(/\s+/g, '_')}.pdf`);
}
