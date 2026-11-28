import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl, registerDocumentLedger } from '@/lib/verification/document-verify';
import { drawLogoInBox, loadInstitutionLogoForPdf } from './pdf-logo-helper';

export type LetterDirection = 'MASUK' | 'KELUAR';

export type LetterCategory =
  | 'SURAT_KETERANGAN_AKTIF'
  | 'SURAT_MUTASI'
  | 'SURAT_TUGAS'
  | 'SURAT_UNDANGAN'
  | 'SURAT_EDARAN'
  | 'SURAT_KEPUTUSAN'
  | 'SURAT_REKOMENDASI'
  | 'SURAT_IZIN'
  | 'SURAT_PANGGILAN'
  | 'SURAT_PENGANTAR'
  | 'LAINNYA';

export type LetterPriority = 'BIASA' | 'PENTING' | 'SEGERA' | 'RAHASIA';
export type LetterStatus = 'DRAFT' | 'TERBIT' | 'DIARSIPKAN' | 'DIBATALKAN';

export interface LetterStudentRef {
  id?: string;
  full_name: string;
  nis?: string | null;
  nisn?: string | null;
}

export interface LetterTeacherRef {
  id?: string;
  full_name: string;
  nip?: string | null;
  staff_type?: string | null;
}

export interface LetterRecord {
  id: string;
  direction: LetterDirection;
  category: LetterCategory | string;
  letter_number: string;
  letter_date: string;
  subject: string;
  counterparty: string | null;
  student_id?: string | null;
  teacher_id?: string | null;
  summary?: string | null;
  file_url?: string | null;
  classification_code?: string | null;
  priority?: LetterPriority | string | null;
  status?: LetterStatus | string | null;
  signatory_name?: string | null;
  signatory_title?: string | null;
  attachment_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  student?: LetterStudentRef | LetterStudentRef[] | null;
  teacher?: LetterTeacherRef | LetterTeacherRef[] | null;
}

export interface InstitutionInfoForLetter {
  name?: string | null;
  short_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  headmaster_name?: string | null;
  head_title_label?: string | null;
  nsm?: string | null;
  npsn?: string | null;
  logo_url?: string | null;
}

export const LETTER_CATEGORY_OPTIONS: ReadonlyArray<{
  value: LetterCategory;
  label: string;
  defaultCode: string;
  targetHint: 'STUDENT' | 'TEACHER' | 'GENERAL';
}> = [
  {
    value: 'SURAT_KETERANGAN_AKTIF',
    label: 'Surat Keterangan Siswa Aktif',
    defaultCode: 'PP.00.6',
    targetHint: 'STUDENT',
  },
  {
    value: 'SURAT_MUTASI',
    label: 'Surat Keterangan Pindah / Mutasi',
    defaultCode: 'PP.00.6',
    targetHint: 'STUDENT',
  },
  {
    value: 'SURAT_REKOMENDASI',
    label: 'Surat Rekomendasi / Pengantar Lomba & Beasiswa',
    defaultCode: 'PP.01.1',
    targetHint: 'STUDENT',
  },
  {
    value: 'SURAT_IZIN',
    label: 'Surat Permohonan Izin / Dispensasi',
    defaultCode: 'PP.02',
    targetHint: 'STUDENT',
  },
  {
    value: 'SURAT_PANGGILAN',
    label: 'Surat Panggilan Orang Tua / Siswa',
    defaultCode: 'PP.03',
    targetHint: 'STUDENT',
  },
  {
    value: 'SURAT_TUGAS',
    label: 'Surat Tugas GTK / SPPD',
    defaultCode: 'KP.01.2',
    targetHint: 'TEACHER',
  },
  {
    value: 'SURAT_KEPUTUSAN',
    label: 'Surat Keputusan (SK) Kepala Lembaga',
    defaultCode: 'OT.01.3',
    targetHint: 'TEACHER',
  },
  {
    value: 'SURAT_UNDANGAN',
    label: 'Surat Undangan Resmi',
    defaultCode: 'HM.01',
    targetHint: 'GENERAL',
  },
  {
    value: 'SURAT_EDARAN',
    label: 'Surat Edaran / Pemberitahuan',
    defaultCode: 'HM.00',
    targetHint: 'GENERAL',
  },
  {
    value: 'SURAT_PENGANTAR',
    label: 'Surat Pengantar Dokumen / Dinas',
    defaultCode: 'TU.01',
    targetHint: 'GENERAL',
  },
  {
    value: 'LAINNYA',
    label: 'Surat Dinas Lainnya',
    defaultCode: 'TU.00',
    targetHint: 'GENERAL',
  },
];

export const LETTER_PRIORITY_OPTIONS: ReadonlyArray<{
  value: LetterPriority;
  label: string;
}> = [
  { value: 'BIASA', label: 'Biasa' },
  { value: 'PENTING', label: 'Penting' },
  { value: 'SEGERA', label: 'Segera / Kilat' },
  { value: 'RAHASIA', label: 'Rahasia' },
];

export const LETTER_STATUS_OPTIONS: ReadonlyArray<{
  value: LetterStatus;
  label: string;
}> = [
  { value: 'TERBIT', label: 'Terbit / Berlaku' },
  { value: 'DRAFT', label: 'Draf / Konsep' },
  { value: 'DIARSIPKAN', label: 'Diarsipkan' },
  { value: 'DIBATALKAN', label: 'Dibatalkan / Void' },
];

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

export function formatLetterCategoryLabel(category?: string | null): string {
  if (!category) return '-';
  const found = LETTER_CATEGORY_OPTIONS.find((c) => c.value === category);
  if (found) return found.label;
  return category.replace(/_/g, ' ');
}

export function getDefaultClassificationCode(category?: string | null): string {
  const found = LETTER_CATEGORY_OPTIONS.find((c) => c.value === category);
  return found?.defaultCode || 'TU.00';
}

export function extractLinkedStudent(letter: LetterRecord): LetterStudentRef | null {
  if (!letter.student) return null;
  return Array.isArray(letter.student) ? letter.student[0] || null : letter.student;
}

export function extractLinkedTeacher(letter: LetterRecord): LetterTeacherRef | null {
  if (!letter.teacher) return null;
  return Array.isArray(letter.teacher) ? letter.teacher[0] || null : letter.teacher;
}

/**
 * Menghasilkan saran nomor surat keluar resmi sesuai tata naskah dinas:
 * Contoh: B-012/MA-SIMMS/PP.00.6/XI/2026
 */
export function generateSuggestedLetterNumber(params: {
  category: string;
  letterDate?: string;
  classificationCode?: string | null;
  institutionShortName?: string | null;
  existingLetters: ReadonlyArray<{ direction: string; letter_date: string; letter_number: string }>;
}): string {
  const dateObj = params.letterDate ? new Date(`${params.letterDate}T00:00:00`) : new Date();
  const validDate = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  const year = validDate.getFullYear();
  const monthIdx = validDate.getMonth();
  const romanMonth = ROMAN_MONTHS[monthIdx] || 'I';

  const yearPrefix = String(year);
  const outgoingThisYear = params.existingLetters.filter(
    (l) => l.direction === 'KELUAR' && String(l.letter_date || '').startsWith(yearPrefix)
  );
  const nextSeq = String(outgoingThisYear.length + 1).padStart(3, '0');

  const instCode = (params.institutionShortName || 'MA-SIMMS')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 14) || 'MA-SIMMS';

  const classCode = (
    params.classificationCode?.trim() || getDefaultClassificationCode(params.category)
  ).toUpperCase();

  return `B-${nextSeq}/${instCode}/${classCode}/${romanMonth}/${year}`;
}

function formatDateIdShort(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatWibPrintTimestamp(): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()) + ' WIB'
  );
}

/**
 * Ekspor Buku Agenda Arsip Persuratan (Surat Masuk & Keluar) ke dokumen PDF resmi ber-QR Verifikasi.
 */
export async function exportLettersAgendaToPdf(params: {
  institution?: InstitutionInfoForLetter | null;
  letters: LetterRecord[];
  filterSummary: {
    directionLabel: string;
    categoryLabel: string;
    periodLabel: string;
  };
}): Promise<void> {
  const { institution, letters, filterSummary } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const todayIso = new Date().toISOString().slice(0, 10);
  const refCode = `AGD-${todayIso.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

  const totalMasuk = letters.filter((l) => l.direction === 'MASUK').length;
  const totalKeluar = letters.filter((l) => l.direction === 'KELUAR').length;
  const totalWithFile = letters.filter((l) => Boolean(l.file_url)).length;

  // Header Banner
  doc.setFillColor(6, 95, 70); // emerald-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  const instLogo = await loadInstitutionLogoForPdf(institution?.logo_url);
  const headerTextX = instLogo ? 38 : 14;
  if (instLogo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 4, 20, 20, 2, 2, 'F');
    drawLogoInBox(doc, instLogo, 15, 5, 18, 18);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BUKU AGENDA ARSIP PERSURATAN DIGITAL RESMI', headerTextX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const instLine = institution?.name?.trim()
    ? `${institution.name.trim()} — SiM-M`
    : 'SiM-M — Sistem Informasi Manajemen Madrasah & Sekolah';
  doc.text(instLine, headerTextX, 17);
  if (institution?.address?.trim()) {
    doc.setFontSize(7.5);
    doc.text(institution.address.trim().slice(0, 110), headerTextX, 22.5);
  }

  // Metadata Cetak & QR Code Verifikasi
  const qrSize = 21;
  const qrX = pageWidth - 14 - qrSize;
  const qrY = 3.5;

  doc.setFontSize(8);
  doc.text(`Dicetak: ${formatWibPrintTimestamp()}`, qrX - 5, 10, { align: 'right' });
  doc.text(`Ref: ${refCode}`, qrX - 5, 15.5, { align: 'right' });
  doc.setFontSize(7);
  doc.text('Scan QR untuk verifikasi dokumen resmi', qrX - 5, 21, { align: 'right' });

  try {
    const verifyUrl = buildVerificationUrl({ ref: refCode, type: 'SURAT' });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1.5, 1.5, 'F');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    void registerDocumentLedger({
      referenceCode: refCode,
      documentType: 'SURAT',
      title: 'Buku Agenda Arsip Persuratan Digital Resmi',
      metadata: {
        totalRows: letters.length,
        direction: filterSummary.directionLabel,
        category: filterSummary.categoryLabel,
        period: filterSummary.periodLabel,
      },
    });
  } catch {
    // Abaikan jika gagal render QR
  }

  // Box Ringkasan Filter & Statistik
  doc.setTextColor(15, 23, 42);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 33, pageWidth - 28, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Arah & Kategori', 18, 39);
  doc.text('Periode Filter', 18, 45);
  doc.text('Total Arsip Tercatat', 18, 50.5);

  doc.setFont('helvetica', 'normal');
  doc.text(`: ${filterSummary.directionLabel} • ${filterSummary.categoryLabel}`, 54, 39);
  doc.text(`: ${filterSummary.periodLabel}`, 54, 45);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(
    `: ${letters.length} Surat (Keluar: ${totalKeluar} | Masuk: ${totalMasuk} | Berlampiran: ${totalWithFile})`,
    54,
    50.5
  );

  const headers = [
    'No',
    'Tanggal',
    'Arah',
    'Nomor Surat',
    'Kategori',
    'Perihal / Subjek',
    'Pengirim / Tujuan',
    'Terkait (Siswa / GTK)',
    'Ringkasan / Status',
  ];

  const rows = letters.map((l, idx) => {
    const student = extractLinkedStudent(l);
    const teacher = extractLinkedTeacher(l);
    const linkedParts: string[] = [];
    if (student?.full_name) {
      linkedParts.push(`Siswa: ${student.full_name}${student.nis ? ` (${student.nis})` : ''}`);
    }
    if (teacher?.full_name) {
      linkedParts.push(`GTK: ${teacher.full_name}`);
    }

    const statusTag = l.status && l.status !== 'TERBIT' ? `[${l.status}] ` : '';
    const priorityTag = l.priority && l.priority !== 'BIASA' ? `(${l.priority}) ` : '';
    const summaryText = `${statusTag}${priorityTag}${l.summary?.trim() || '-'}`;

    return [
      String(idx + 1),
      formatDateIdShort(l.letter_date),
      l.direction,
      l.letter_number,
      formatLetterCategoryLabel(l.category),
      l.subject || '-',
      l.counterparty || '-',
      linkedParts.length > 0 ? linkedParts.join(' | ') : '-',
      summaryText,
    ];
  });

  autoTable(doc, {
    startY: 58,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 21 },
      2: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      3: { cellWidth: 38, fontStyle: 'bold' },
      4: { cellWidth: 32 },
      5: { cellWidth: 48 },
      6: { cellWidth: 34 },
      7: { cellWidth: 36 },
    },
    didDrawPage: (hookData) => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Buku Agenda Persuratan Elektronik SiM-M • Verifikasi QR / Ref: ${refCode}`,
        14,
        pageHeight - 8
      );
      doc.text(
        `Halaman ${hookData.pageNumber} dari ${pageCount}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  doc.save(`Buku_Agenda_Persuratan_${todayIso}.pdf`);
}

/**
 * Cetak Lembar Bukti Registrasi / Ringkasan Arsip Surat Resmi (1 halaman Portrait)
 * dengan QR Code Verifikasi yang merujuk langsung ke Nomor Surat (/verifikasi?ref=...).
 */
export async function exportSingleLetterArchivePdf(params: {
  letter: LetterRecord;
  institution?: InstitutionInfoForLetter | null;
}): Promise<void> {
  const { letter, institution } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Kop Lembaga
  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, pageWidth, 32, 'F');

  const instLogo = await loadInstitutionLogoForPdf(institution?.logo_url);
  const kopTextX = instLogo ? 40 : 14;
  if (instLogo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 5, 22, 22, 2, 2, 'F');
    drawLogoInBox(doc, instLogo, 15, 6, 20, 20);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(
    (institution?.name || 'SISTEM INFORMASI MANAJEMEN MADRASAH & SEKOLAH').toUpperCase(),
    kopTextX,
    12
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subHeader = [
    institution?.nsm ? `NSM: ${institution.nsm}` : null,
    institution?.npsn ? `NPSN: ${institution.npsn}` : null,
    institution?.phone ? `Telp: ${institution.phone}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');
  doc.text(subHeader || 'Layanan Tata Usaha & Arsip Persuratan Digital', kopTextX, 18);

  if (institution?.address) {
    doc.setFontSize(8);
    doc.text(institution.address.slice(0, 88), kopTextX, 24);
  }

  // Judul Lembar
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LEMBAR REGISTRASI & VERIFIKASI ARSIP SURAT', pageWidth / 2, 45, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Nomor Surat: ${letter.letter_number}`, pageWidth / 2, 51, { align: 'center' });

  const student = extractLinkedStudent(letter);
  const teacher = extractLinkedTeacher(letter);

  const detailRows: Array<[string, string]> = [
    ['Nomor Surat Resmi', letter.letter_number],
    ['Arah & Jenis Surat', `SURAT ${letter.direction} — ${formatLetterCategoryLabel(letter.category)}`],
    ['Tanggal Surat', formatDateIdShort(letter.letter_date)],
    ['Kode Klasifikasi', letter.classification_code || getDefaultClassificationCode(letter.category)],
    ['Sifat / Prioritas', String(letter.priority || 'BIASA')],
    ['Status Dokumen', String(letter.status || 'TERBIT')],
    ['Perihal / Subjek', letter.subject || '-'],
    [
      letter.direction === 'MASUK' ? 'Pengirim / Instansi Asal' : 'Tujuan / Penerima Surat',
      letter.counterparty || '-',
    ],
  ];

  if (student?.full_name) {
    detailRows.push([
      'Data Siswa Terkait',
      `${student.full_name}${student.nis ? ` (NIS: ${student.nis})` : ''}${
        student.nisn ? ` / NISN: ${student.nisn}` : ''
      }`,
    ]);
  }

  if (teacher?.full_name) {
    detailRows.push([
      'Data GTK Terkait',
      `${teacher.full_name}${teacher.nip ? ` (NIP: ${teacher.nip})` : ''}`,
    ]);
  }

  if (letter.signatory_name || institution?.headmaster_name) {
    detailRows.push([
      'Pejabat Penandatangan',
      `${letter.signatory_name || institution?.headmaster_name || '-'}${
        letter.signatory_title || institution?.head_title_label
          ? ` (${letter.signatory_title || institution?.head_title_label})`
          : ''
      }`,
    ]);
  }

  detailRows.push(['Ringkasan Isi / Catatan', letter.summary?.trim() || '-']);
  detailRows.push([
    'Berkas Lampiran Digital',
    letter.file_url ? letter.attachment_name || 'Tersedia di Arsip Digital SiM-M' : 'Tidak ada lampiran',
  ]);

  autoTable(doc, {
    startY: 58,
    body: detailRows,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: {
        cellWidth: 55,
        fontStyle: 'bold',
        fillColor: [248, 250, 252],
      },
      1: {
        cellWidth: pageWidth - 28 - 55,
      },
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 180;
  const qrBoxY = Math.min(finalY + 12, pageHeight - 62);

  // Kotak Verifikasi QR
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, qrBoxY, pageWidth - 28, 38, 2.5, 2.5, 'FD');

  try {
    const verifyUrl = buildVerificationUrl({ ref: letter.letter_number, type: 'SURAT' });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(18, qrBoxY + 4, 30, 30, 1.5, 1.5, 'F');
    doc.addImage(qrDataUrl, 'PNG', 19, qrBoxY + 5, 28, 28);
  } catch {
    // ignore QR error
  }

  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VERIFIKASI KEASLIAN DOKUMEN ELEKTRONIK', 53, qrBoxY + 12);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    'Pindai QR Code di samping atau kunjungi halaman /verifikasi pada portal resmi lembaga',
    53,
    qrBoxY + 18.5
  );
  doc.text(
    `dengan memasukkan Nomor Referensi: ${letter.letter_number}`,
    53,
    qrBoxY + 24
  );
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dicetak dari SiM-M pada: ${formatWibPrintTimestamp()}`, 53, qrBoxY + 30.5);

  const safeSlug = letter.letter_number.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  doc.save(`Arsip_Surat_${safeSlug}.pdf`);
}

/**
 * Ekspor Buku Agenda Persuratan ke berkas CSV (kompatibel penuh dengan Microsoft Excel).
 */
export function exportLettersAgendaToCsv(letters: LetterRecord[]): void {
  const headers = [
    'No',
    'Arah Surat',
    'Nomor Surat',
    'Tanggal Surat',
    'Kategori',
    'Kode Klasifikasi',
    'Sifat / Prioritas',
    'Status',
    'Perihal / Subjek',
    'Pengirim / Tujuan',
    'Siswa Terkait',
    'NIS Siswa',
    'GTK Terkait',
    'NIP GTK',
    'Pejabat Penandatangan',
    'Ringkasan / Catatan',
    'Tautan Lampiran',
  ];

  const escapeCsvCell = (val: unknown): string => {
    const str = String(val ?? '')
      .replace(/\r?\n/g, ' ')
      .trim();
    if (str.includes(',') || str.includes('"') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...letters.map((l, idx) => {
      const student = extractLinkedStudent(l);
      const teacher = extractLinkedTeacher(l);
      return [
        idx + 1,
        l.direction,
        l.letter_number,
        l.letter_date,
        formatLetterCategoryLabel(l.category),
        l.classification_code || getDefaultClassificationCode(l.category),
        l.priority || 'BIASA',
        l.status || 'TERBIT',
        l.subject || '',
        l.counterparty || '',
        student?.full_name || '',
        student?.nis || '',
        teacher?.full_name || '',
        teacher?.nip || '',
        l.signatory_name || '',
        l.summary || '',
        l.file_url || '',
      ]
        .map(escapeCsvCell)
        .join(',');
    }),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayIso = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `Buku_Agenda_Persuratan_${todayIso}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
