'use client';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatScoreDecimal } from '@/lib/validation/decimal';
import { buildVerificationUrl, registerDocumentLedger } from '@/lib/verification/document-verify';
import { fetchInstitutionSettings } from '@/lib/hooks/use-institution-settings';

export interface ERaportSubjectScore {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  kkm: number;
  score: number | null;
}

export interface ERaportExtracurricularItem {
  name: string;
  grade: string;
  notes?: string;
}

export interface ERaportStudentPayload {
  studentId: string;
  fullName: string;
  nis: string | null;
  nisn: string | null;
  classroomName: string;
  gradeLevel: string;
  homeroomTeacherName?: string | null;
  academicYearName: string;
  semester: string;
  subjects: ERaportSubjectScore[];
  attendance: { sakit: number; izin: number; alpa: number };
  attitudeSpiritual?: string | null;
  attitudeSocial?: string | null;
  p5Summary?: string | null;
  extracurriculars?: ERaportExtracurricularItem[];
  achievementsNotes?: string | null;
  homeroomNotes?: string | null;
  promotionStatus?: string | null;
  nextGradeLabel?: string | null;
}

function getPredicate(score: number | null, kkm: number): string {
  if (score === null) return '-';
  if (score >= 90) return 'A';
  if (score >= Math.max(80, kkm + 5)) return 'B';
  if (score >= kkm) return 'C';
  return 'D';
}

function getCompetencyDescription(subjectName: string, score: number | null, kkm: number): string {
  if (score === null) return 'Nilai mata pelajaran belum dilengkapi.';
  if (score >= 90) {
    return `Menunjukkan penguasaan sangat baik dan konsisten pada seluruh tujuan pembelajaran ${subjectName}.`;
  }
  if (score >= Math.max(80, kkm + 5)) {
    return `Menunjukkan penguasaan baik pada materi ${subjectName} serta mampu menerapkan konsep secara mandiri.`;
  }
  if (score >= kkm) {
    return `Telah mencapai ketuntasan minimal pada materi ${subjectName}; perlu penguatan pada beberapa topik lanjutan.`;
  }
  return `Memerlukan pendampingan dan penguatan lebih lanjut untuk mencapai ketuntasan pada ${subjectName}.`;
}

export async function generateConsolidatedERaportPdf(payload: ERaportStudentPayload) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const settings = await fetchInstitutionSettings().catch(() => null);

  const safeShortName = payload.fullName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'SISWA';
  const refCode = `PNL-ERAPORT-${safeShortName}-${Date.now().toString(36).toUpperCase()}`;

  // Kop Lembaga
  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(
    (settings?.name || 'LAPORAN HASIL BELAJAR PESERTA DIDIK').toUpperCase(),
    14,
    10.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subKop = [
    settings?.npsn ? `NPSN: ${settings.npsn}` : null,
    settings?.nsm ? `NSM: ${settings.nsm}` : null,
    settings?.phone ? `Telp: ${settings.phone}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');
  doc.text(subKop || 'Laporan Hasil Belajar (E-Raport Resmi)', 14, 16.5);
  if (settings?.address) {
    doc.setFontSize(7.5);
    doc.text(settings.address.slice(0, 95), 14, 22);
  }

  // QR Verifikasi
  try {
    const verifyUrl = buildVerificationUrl({
      ref: refCode,
      type: 'PENILAIAN',
      origin: settings?.website_url || undefined,
    });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - 33, 3, 20, 20, 1.5, 1.5, 'F');
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 32, 4, 18, 18);
    void registerDocumentLedger({
      referenceCode: refCode,
      documentType: 'PENILAIAN',
      title: `Buku E-Raport Semester ${payload.semester} (${payload.academicYearName})`,
      metadata: {
        subtitle: `${payload.fullName} — Kelas ${payload.classroomName}`,
        studentId: payload.studentId,
      },
    });
  } catch {
    // non-blocking
  }

  // Judul Dokumen
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN HASIL BELAJAR (E-RAPORT)', pageWidth / 2, 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Tahun Ajaran ${payload.academicYearName} • Semester ${payload.semester} • Ref: ${refCode}`,
    pageWidth / 2,
    39.5,
    { align: 'center' }
  );

  // Identitas Siswa
  autoTable(doc, {
    startY: 43,
    body: [
      ['Nama Peserta Didik', `: ${payload.fullName}`, 'Kelas / Tingkat', `: ${payload.classroomName} (${payload.gradeLevel})`],
      ['NIS / NISN', `: ${payload.nis || '-'} / ${payload.nisn || '-'}`, 'Tahun Ajaran', `: ${payload.academicYearName}`],
      ['Wali Kelas', `: ${payload.homeroomTeacherName || '-'}`, 'Semester', `: ${payload.semester}`],
    ],
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 34 },
      1: { cellWidth: 62 },
      2: { fontStyle: 'bold', cellWidth: 30 },
      3: { cellWidth: 56 },
    },
  });

  const afterIdentityY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 62;

  // A. Nilai Mata Pelajaran
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('A. Capaian Hasil Belajar Mata Pelajaran', 14, afterIdentityY + 6);

  const subjectRows = payload.subjects.map((sub, idx) => [
    String(idx + 1),
    sub.subjectName,
    String(sub.kkm),
    formatScoreDecimal(sub.score),
    getPredicate(sub.score, sub.kkm),
    getCompetencyDescription(sub.subjectName, sub.score, sub.kkm),
  ]);

  autoTable(doc, {
    startY: afterIdentityY + 9,
    head: [['No', 'Mata Pelajaran', 'KKM', 'Nilai', 'Pred.', 'Capaian Kompetensi']],
    body: subjectRows.length > 0 ? subjectRows : [['-', 'Belum ada nilai mata pelajaran', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 13, halign: 'center' },
      3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 90 },
    },
  });

  const afterSubjectsY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 140;

  // B. Sikap, P5, Ekskul, Kehadiran & Catatan
  const nonAcademicRows: Array<[string, string]> = [
    ['Sikap Spiritual', payload.attitudeSpiritual?.trim() || 'Baik — taat beribadah dan berakhlak mulia.'],
    ['Sikap Sosial', payload.attitudeSocial?.trim() || 'Baik — disiplin, santun, dan mampu bekerja sama.'],
    ...(payload.p5Summary?.trim() ? [['Projek P5 / PPRA', payload.p5Summary.trim()] as [string, string]] : []),
    [
      'Ekstrakurikuler',
      payload.extracurriculars && payload.extracurriculars.length > 0
        ? payload.extracurriculars.map((e) => `${e.name} (${e.grade})${e.notes ? `: ${e.notes}` : ''}`).join('; ')
        : '-',
    ],
    ['Prestasi', payload.achievementsNotes?.trim() || '-'],
    [
      'Ketidakhadiran',
      `Sakit: ${payload.attendance.sakit} hari  |  Izin: ${payload.attendance.izin} hari  |  Tanpa Keterangan (Alpa): ${payload.attendance.alpa} hari`,
    ],
    ['Catatan Wali Kelas', payload.homeroomNotes?.trim() || 'Pertahankan semangat belajar dan terus tingkatkan prestasi.'],
  ];

  if (payload.promotionStatus && payload.promotionStatus !== 'MENUNGGU') {
    const statusMap: Record<string, string> = {
      NAIK_KELAS: `NAIK KE KELAS ${payload.nextGradeLabel || 'BERIKUTNYA'}`,
      TINGGAL_KELAS: 'TINGGAL DI KELAS SAAT INI',
      LULUS: 'LULUS DARI SATUAN PENDIDIKAN',
      TIDAK_LULUS: 'BELUM LULUS',
    };
    nonAcademicRows.push([
      'Keputusan Akhir',
      statusMap[payload.promotionStatus] || payload.promotionStatus,
    ]);
  }

  autoTable(doc, {
    startY: afterSubjectsY + 6,
    head: [['B. Komponen Non-Akademik & Catatan', 'Keterangan / Deskripsi']],
    body: nonAcademicRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 134 },
    },
  });

  // Tanda Tangan
  const afterNonAcadY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 220;
  const sigY = afterNonAcadY > 245 ? (doc.addPage(), 24) : afterNonAcadY + 12;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text('Mengetahui,', 20, sigY);
  doc.text('Orang Tua / Wali', 20, sigY + 5);
  doc.text('_______________________', 20, sigY + 24);

  doc.text('Wali Kelas,', pageWidth / 2 - 20, sigY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(payload.homeroomTeacherName || '_______________________', pageWidth / 2 - 20, sigY + 24);

  doc.setFont('helvetica', 'normal');
  doc.text(settings?.head_title_label || 'Kepala Lembaga,', pageWidth - 65, sigY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.headmaster_name || '_______________________', pageWidth - 65, sigY + 24);

  const fileName = `ERaport_${payload.classroomName.replace(/\s+/g, '_')}_${payload.fullName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

export function exportLegerToXlsx(params: {
  classroomName: string;
  academicYearName: string;
  semester: string;
  subjects: Array<{ code: string; name: string }>;
  rows: Array<{
    rank: number;
    nis: string | null;
    fullName: string;
    scoresBySubject: Array<number | null>;
    average: number | null;
    attendance: { sakit: number; izin: number; alpa: number };
    promotionStatus: string;
  }>;
}) {
  const headers = [
    'Rank',
    'NIS',
    'Nama Siswa',
    ...params.subjects.map((s) => s.code || s.name),
    'Rata-rata',
    'Sakit',
    'Izin',
    'Alpa',
    'Status Akhir',
  ];

  const sheetRows = params.rows.map((r) => [
    r.rank,
    r.nis || '-',
    r.fullName,
    ...r.scoresBySubject.map((sc) => (sc !== null ? sc : '-')),
    r.average !== null ? r.average : '-',
    r.attendance.sakit,
    r.attendance.izin,
    r.attendance.alpa,
    r.promotionStatus,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [`LEGER NILAI KELAS ${params.classroomName} — TA ${params.academicYearName} (${params.semester})`],
    [],
    headers,
    ...sheetRows,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leger Kelas');
  XLSX.writeFile(wb, `Leger_${params.classroomName.replace(/\s+/g, '_')}_${params.semester}.xlsx`);
}
