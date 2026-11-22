'use client';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportTablePayload {
  fileName: string;
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
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

export function exportAssessmentToPdf(payload: ExportTablePayload) {
  const doc = new jsPDF({
    orientation: payload.headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFontSize(13);
  doc.text(payload.title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(payload.subtitle, 14, 21);

  autoTable(doc, {
    startY: 26,
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
