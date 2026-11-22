'use client';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import { fetchInstitutionSettings } from '@/lib/hooks/use-institution-settings';

export interface ExportTablePayload {
  fileName: string;
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  referenceCode?: string;
}

export function exportAssessmentToXlsx(payload: ExportTablePayload) {
  const sheetData = [
    [payload.title],
    [payload.subtitle],
    [],
    payload.headers,
    ...payload.rows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Penilaian');
  XLSX.writeFile(workbook, `${payload.fileName}.xlsx`);
}

export async function exportAssessmentToPdf(payload: ExportTablePayload) {
  const isLandscape = payload.headers.length > 6;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const refCode =
    payload.referenceCode ||
    `PNL-${payload.fileName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 14)}-${Date.now()
      .toString(36)
      .toUpperCase()}`;

  const qrSize = 18;
  const qrX = pageWidth - 14 - qrSize;
  const maxTextWidth = qrX - 18;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(payload.title, 14, 14, { maxWidth: maxTextWidth });

  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text(payload.subtitle, 14, 20, { maxWidth: maxTextWidth });

  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(`Ref: ${refCode} | Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 25.5, {
    maxWidth: maxTextWidth,
  });

  try {
    const settings = await fetchInstitutionSettings().catch(() => null);
    const qrUrl = buildVerificationUrl({
      ref: refCode,
      type: 'PENILAIAN',
      origin: settings?.website_url || undefined,
    });
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', qrX, 8, qrSize, qrSize);
  } catch {
    // Abaikan jika QR gagal dirender agar ekspor PDF tetap berjalan
  }

  autoTable(doc, {
    startY: 30,
    head: [payload.headers],
    body: payload.rows,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  doc.save(`${payload.fileName}.pdf`);
}
