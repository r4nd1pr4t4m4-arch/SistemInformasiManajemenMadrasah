import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import type {
  DailyStudentRecapRow,
  RekapAbsensiSection,
  SubjectStudentRecapRow,
  TeacherRecapRow,
} from './types';

export interface ExportPayload {
  title: string;
  fileName: string;
  headers: string[];
  rows: (string | number)[][];
  objects: Record<string, string | number>[];
}

export function getExportTitle(
  section: RekapAbsensiSection,
  startDate: string,
  endDate: string
): string {
  if (section === 'guru') {
    return `Rekapitulasi Absensi Guru (${startDate} s.d. ${endDate})`;
  }
  if (section === 'siswa-harian') {
    return `Rekapitulasi Absensi Siswa Harian/Piket (${startDate} s.d. ${endDate})`;
  }
  return `Rekapitulasi Absensi Siswa per Mata Pelajaran (${startDate} s.d. ${endDate})`;
}

export function buildExportPayload(params: {
  section: RekapAbsensiSection;
  startDate: string;
  endDate: string;
  filteredGuru: TeacherRecapRow[];
  filteredDailyStudent: DailyStudentRecapRow[];
  filteredSubjectStudent: SubjectStudentRecapRow[];
}): ExportPayload {
  const {
    section,
    startDate,
    endDate,
    filteredGuru,
    filteredDailyStudent,
    filteredSubjectStudent,
  } = params;

  if (section === 'guru') {
    const headers = [
      'No',
      'Nama Guru',
      'NIP',
      'Hari Hadir',
      'Mengajar',
      'Piket',
      'Ujian',
      'Acara',
      'Terkonfirmasi',
      'Total JTM',
      'Izin Keluar (Menit)',
      'Rata-rata Hadir (%)',
    ];
    const rows = filteredGuru.map((r, idx) => [
      idx + 1,
      r.full_name,
      r.nip || '-',
      r.total_days_present,
      r.teaching_sessions,
      r.picket_sessions,
      r.exam_sessions,
      r.event_sessions,
      r.confirmed_sessions,
      r.total_jtm,
      r.total_short_leave_minutes,
      r.avg_presence_pct != null ? `${r.avg_presence_pct}%` : '-',
    ]);
    const objects = filteredGuru.map((r, idx) => ({
      No: idx + 1,
      'Nama Guru': r.full_name,
      NIP: r.nip || '-',
      'Hari Hadir': r.total_days_present,
      'Sesi Mengajar': r.teaching_sessions,
      'Sesi Piket': r.picket_sessions,
      'Sesi Ujian': r.exam_sessions,
      'Sesi Acara': r.event_sessions,
      Terkonfirmasi: r.confirmed_sessions,
      'Total JTM': r.total_jtm,
      'Izin Keluar (Menit)': r.total_short_leave_minutes,
      'Rata-rata Hadir (%)': r.avg_presence_pct ?? '-',
    }));
    return {
      title: getExportTitle(section, startDate, endDate),
      fileName: `rekap-absensi-guru-${startDate}-${endDate}`,
      headers,
      rows,
      objects,
    };
  }

  if (section === 'siswa-harian') {
    const headers = [
      'No',
      'Nama Siswa',
      'NIS',
      'Kelas',
      'Hadir',
      'Sakit',
      'Izin',
      'Alpa',
      'Total',
      'Persentase (%)',
    ];
    const rows = filteredDailyStudent.map((r, idx) => [
      idx + 1,
      r.full_name,
      r.nis || '-',
      r.classroom_name,
      r.hadir,
      r.sakit,
      r.izin,
      r.alpa,
      r.total,
      `${r.presence_pct}%`,
    ]);
    const objects = filteredDailyStudent.map((r, idx) => ({
      No: idx + 1,
      'Nama Siswa': r.full_name,
      NIS: r.nis || '-',
      Kelas: r.classroom_name,
      Hadir: r.hadir,
      Sakit: r.sakit,
      Izin: r.izin,
      Alpa: r.alpa,
      'Total Catatan': r.total,
      'Persentase Hadir (%)': r.presence_pct,
    }));
    return {
      title: getExportTitle(section, startDate, endDate),
      fileName: `rekap-absensi-siswa-harian-${startDate}-${endDate}`,
      headers,
      rows,
      objects,
    };
  }

  const headers = [
    'No',
    'Nama Siswa',
    'NIS',
    'Kelas',
    'Mata Pelajaran',
    'Guru Mapel',
    'Hadir',
    'Sakit',
    'Izin',
    'Alpa',
    'Total',
    'Persentase (%)',
  ];
  const rows = filteredSubjectStudent.map((r, idx) => [
    idx + 1,
    r.full_name,
    r.nis || '-',
    r.classroom_name,
    r.subject_name,
    r.teacher_name,
    r.hadir,
    r.sakit,
    r.izin,
    r.alpa,
    r.total,
    `${r.presence_pct}%`,
  ]);
  const objects = filteredSubjectStudent.map((r, idx) => ({
    No: idx + 1,
    'Nama Siswa': r.full_name,
    NIS: r.nis || '-',
    Kelas: r.classroom_name,
    'Mata Pelajaran': r.subject_name,
    'Guru Mapel': r.teacher_name,
    Hadir: r.hadir,
    Sakit: r.sakit,
    Izin: r.izin,
    Alpa: r.alpa,
    'Total Catatan': r.total,
    'Persentase Hadir (%)': r.presence_pct,
  }));
  return {
    title: getExportTitle(section, startDate, endDate),
    fileName: `rekap-absensi-siswa-mapel-${startDate}-${endDate}`,
    headers,
    rows,
    objects,
  };
}

export function exportRecapToXlsx(payload: ExportPayload): void {
  const ws = XLSX.utils.json_to_sheet(payload.objects);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
  XLSX.writeFile(wb, `${payload.fileName}.xlsx`);
}

export async function exportRecapToPdf(params: {
  payload: ExportPayload;
  section: RekapAbsensiSection;
  startDate: string;
  endDate: string;
}): Promise<void> {
  const { payload, section, startDate, endDate } = params;
  const doc = new jsPDF({ orientation: 'landscape' });
  const refCode = `RKP-${section.toUpperCase()}-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;

  doc.setFontSize(13);
  doc.text(payload.title, 14, 15);
  doc.setFontSize(9);
  doc.text(`Periode: ${startDate} s.d. ${endDate}  •  Ref: ${refCode}`, 14, 21);

  try {
    const qrUrl = buildVerificationUrl({ ref: refCode, type: 'REKAP_ABSENSI' });
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 262, 6, 20, 20);
  } catch {
    // ignore QR fallback
  }

  autoTable(doc, {
    startY: 28,
    head: [payload.headers],
    body: payload.rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [5, 150, 105] },
  });
  doc.save(`${payload.fileName}.pdf`);
}
