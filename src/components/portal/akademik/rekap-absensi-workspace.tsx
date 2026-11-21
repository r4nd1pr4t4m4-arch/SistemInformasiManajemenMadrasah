'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

interface TeacherRecapRow {
  teacher_id: string;
  full_name: string;
  nip: string | null;
  total_days_present: number;
  teaching_sessions: number;
  picket_sessions: number;
  exam_sessions: number;
  event_sessions: number;
  confirmed_sessions: number;
  total_jtm: number;
  total_short_leave_minutes: number;
  avg_presence_pct: number | null;
}

interface DailyStudentRecapRow {
  student_id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  classroom_id: string;
  classroom_name: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  total: number;
  presence_pct: number;
}

interface SubjectStudentRecapRow {
  key: string;
  student_id: string;
  full_name: string;
  nis: string | null;
  classroom_id: string;
  classroom_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  total: number;
  presence_pct: number;
}

interface FilterOption {
  id: string;
  name?: string;
  full_name?: string;
}

function getCurrentMonthValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthRange(ym: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    const fallback = getCurrentMonthValue();
    return getMonthRange(fallback);
  }
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${yStr}-${mStr}-01`,
    end: `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

function computeStudentRecapStats(
  rows: Array<{ hadir: number; sakit: number; izin: number; alpa: number; presence_pct: number }>
) {
  const totalHadir = rows.reduce((acc, r) => acc + r.hadir, 0);
  const totalAbsence = rows.reduce((acc, r) => acc + r.sakit + r.izin + r.alpa, 0);
  const avgPct =
    rows.length > 0
      ? Math.round((rows.reduce((acc, r) => acc + r.presence_pct, 0) / rows.length) * 10) / 10
      : null;
  return {
    totalRows: rows.length,
    totalHadir,
    totalAbsence,
    avgPct,
  };
}

const PAGE_SIZE = 12;

const SECTION_META: Record<
  RekapAbsensiSection,
  { heading: string; description: string }
> = {
  guru: {
    heading: 'Rekapitulasi Absensi Guru',
    description:
      'Ringkasan kehadiran harian, sesi mengajar, piket, ujian, acara, izin keluar, dan perolehan JTM guru.',
  },
  'siswa-harian': {
    heading: 'Rekapitulasi Absensi Siswa Harian',
    description: 'Rekap kehadiran harian (piket) siswa berdasarkan kelas dan rentang tanggal.',
  },
  'siswa-mapel': {
    heading: 'Rekapitulasi Absensi Siswa per Mapel',
    description:
      'Rekap kehadiran siswa berdasarkan mata pelajaran, kelas, dan guru pengampu.',
  },
};

export type RekapAbsensiSection = 'guru' | 'siswa-harian' | 'siswa-mapel';

export function RekapAbsensiWorkspace({ section }: { section: RekapAbsensiSection }) {
  const initialMonth = useMemo(() => getCurrentMonthValue(), []);
  const initialRange = useMemo(() => getMonthRange(initialMonth), [initialMonth]);

  const tab = section;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [monthValue, setMonthValue] = useState(initialMonth);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [classroomId, setClassroomId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [teacherRecap, setTeacherRecap] = useState<TeacherRecapRow[]>([]);
  const [dailyStudentRecap, setDailyStudentRecap] = useState<DailyStudentRecapRow[]>([]);
  const [subjectStudentRecap, setSubjectStudentRecap] = useState<SubjectStudentRecapRow[]>([]);
  const [classrooms, setClassrooms] = useState<FilterOption[]>([]);
  const [subjects, setSubjects] = useState<FilterOption[]>([]);
  const [teachers, setTeachers] = useState<FilterOption[]>([]);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const isMissingDate = !startDate || !endDate;
  const isInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  const loadData = useCallback(
    async (isManualRefresh = false, signal?: AbortSignal) => {
      if (!startDate || !endDate || startDate > endDate) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      if (isManualRefresh || hasLoadedOnceRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ startDate, endDate });
        if (tab !== 'guru' && classroomId) params.set('classroomId', classroomId);
        if (tab === 'siswa-mapel' && subjectId) params.set('subjectId', subjectId);
        if (tab !== 'siswa-harian' && teacherId) params.set('teacherId', teacherId);

        const res = await fetch(`/api/akademik/rekap-absensi?${params.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();
        if (currentRequestId !== requestIdRef.current) return;
        if (!res.ok) {
          throw new Error(data.error || 'Gagal memuat rekapitulasi absensi.');
        }
        hasLoadedOnceRef.current = true;
        setLoadError(null);
        setTeacherRecap(data.teacherRecap || []);
        setDailyStudentRecap(data.dailyStudentRecap || []);
        setSubjectStudentRecap(data.subjectStudentRecap || []);
        setClassrooms(data.filters?.classrooms || []);
        setSubjects(data.filters?.subjects || []);
        setTeachers(data.filters?.teachers || []);
      } catch (err) {
        if (signal?.aborted || currentRequestId !== requestIdRef.current) return;
        setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [startDate, endDate, classroomId, subjectId, teacherId, tab]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadData(false, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  const filteredGuru = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teacherRecap;
    return teacherRecap.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) || (r.nip || '').toLowerCase().includes(q)
    );
  }, [teacherRecap, search]);

  const filteredDailyStudent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dailyStudentRecap;
    return dailyStudentRecap.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.nis || '').toLowerCase().includes(q) ||
        (r.nisn || '').toLowerCase().includes(q) ||
        r.classroom_name.toLowerCase().includes(q)
    );
  }, [dailyStudentRecap, search]);

  const filteredSubjectStudent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjectStudentRecap;
    return subjectStudentRecap.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.nis || '').toLowerCase().includes(q) ||
        r.subject_name.toLowerCase().includes(q) ||
        r.teacher_name.toLowerCase().includes(q) ||
        r.classroom_name.toLowerCase().includes(q)
    );
  }, [subjectStudentRecap, search]);

  function getExportPayload(): {
    title: string;
    fileName: string;
    headers: string[];
    rows: (string | number)[][];
    objects: Record<string, string | number>[];
  } {
    if (tab === 'guru') {
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
        title: `Rekapitulasi Absensi Guru (${startDate} s.d. ${endDate})`,
        fileName: `rekap-absensi-guru-${startDate}-${endDate}`,
        headers,
        rows,
        objects,
      };
    }

    if (tab === 'siswa-harian') {
      const headers = ['No', 'Nama Siswa', 'NIS', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total', 'Persentase (%)'];
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
        title: `Rekapitulasi Absensi Siswa Harian/Piket (${startDate} s.d. ${endDate})`,
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
      title: `Rekapitulasi Absensi Siswa per Mata Pelajaran (${startDate} s.d. ${endDate})`,
      fileName: `rekap-absensi-siswa-mapel-${startDate}-${endDate}`,
      headers,
      rows,
      objects,
    };
  }

  function handleExportXlsx() {
    const payload = getExportPayload();
    if (payload.rows.length === 0) {
      showToast('error', 'Tidak ada data pada periode ini untuk diekspor ke Excel.');
      return;
    }
    try {
      const ws = XLSX.utils.json_to_sheet(payload.objects);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
      XLSX.writeFile(wb, `${payload.fileName}.xlsx`);
      showToast('success', 'File Excel berhasil diunduh.');
    } catch {
      showToast('error', 'Gagal mengekspor data ke Excel.');
    }
  }

  async function handleExportPdf() {
    const payload = getExportPayload();
    if (payload.rows.length === 0) {
      showToast('error', 'Tidak ada data pada periode ini untuk diekspor ke PDF.');
      return;
    }
    setExportingPdf(true);
    try {
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
      showToast('success', 'File PDF berhasil diunduh.');
    } catch {
      showToast('error', 'Gagal membuat file PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  const activeRowsCount =
    tab === 'guru'
      ? filteredGuru.length
      : tab === 'siswa-harian'
      ? filteredDailyStudent.length
      : filteredSubjectStudent.length;

  const totalPages = Math.max(1, Math.ceil(activeRowsCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const pagedGuru = useMemo(
    () => filteredGuru.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredGuru, pageStart]
  );
  const pagedDailyStudent = useMemo(
    () => filteredDailyStudent.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredDailyStudent, pageStart]
  );
  const pagedSubjectStudent = useMemo(
    () => filteredSubjectStudent.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredSubjectStudent, pageStart]
  );

  const guruStats = useMemo(() => {
    const totalTeaching = filteredGuru.reduce((acc, r) => acc + r.teaching_sessions, 0);
    const totalJtm = Number(
      filteredGuru.reduce((acc, r) => acc + Number(r.total_jtm || 0), 0).toFixed(2)
    );
    const withPct = filteredGuru.filter((r) => r.avg_presence_pct != null);
    const avgPct =
      withPct.length > 0
        ? Math.round(
            (withPct.reduce((acc, r) => acc + (r.avg_presence_pct || 0), 0) / withPct.length) *
              10
          ) / 10
        : null;
    return {
      totalTeachers: filteredGuru.length,
      totalTeaching,
      totalJtm,
      avgPct,
    };
  }, [filteredGuru]);

  const dailyStudentStats = useMemo(
    () => computeStudentRecapStats(filteredDailyStudent),
    [filteredDailyStudent]
  );

  const subjectStudentStats = useMemo(
    () => computeStudentRecapStats(filteredSubjectStudent),
    [filteredSubjectStudent]
  );

  const hasCustomFilter =
    monthValue !== initialMonth ||
    startDate !== initialRange.start ||
    endDate !== initialRange.end ||
    Boolean(classroomId) ||
    Boolean(subjectId) ||
    Boolean(teacherId) ||
    Boolean(search.trim());

  function handleResetFilters() {
    setMonthValue(initialMonth);
    setStartDate(initialRange.start);
    setEndDate(initialRange.end);
    setClassroomId('');
    setSubjectId('');
    setTeacherId('');
    setSearch('');
    setPage(1);
  }

  const sectionMeta = SECTION_META[tab];
  const disableActions = loading || activeRowsCount === 0 || isInvalidRange || isMissingDate;

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {sectionMeta.heading}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            {sectionMeta.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing || isInvalidRange || isMissingDate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleExportXlsx}
            disabled={disableActions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export .xlsx
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={disableActions || exportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={disableActions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>

      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={() => void loadData(true)} />

      {/* Print Header */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
        <h2 className="text-lg font-bold text-slate-900">{getExportPayload().title}</h2>
        <p className="text-xs text-slate-600">
          Periode: {startDate} s.d. {endDate}
        </p>
      </div>

      {/* Summary Cards for Guru */}
      {tab === 'guru' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Total Guru Tercatat</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {guruStats.totalTeachers}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Total Sesi Mengajar</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
              {guruStats.totalTeaching}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Akumulasi JTM</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {guruStats.totalJtm}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Rata-rata Kehadiran</p>
            <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
              {guruStats.avgPct != null ? `${guruStats.avgPct}%` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards for Siswa Harian & Siswa Mapel */}
      {(tab === 'siswa-harian' || tab === 'siswa-mapel') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">
              {tab === 'siswa-harian' ? 'Total Siswa Tercatat' : 'Total Catatan Mapel'}
            </p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {tab === 'siswa-harian'
                ? dailyStudentStats.totalRows
                : subjectStudentStats.totalRows}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Total Kehadiran (H)</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
              {tab === 'siswa-harian'
                ? dailyStudentStats.totalHadir
                : subjectStudentStats.totalHadir}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Total S / I / A</p>
            <p className="text-lg sm:text-xl font-bold text-rose-700 mt-1 tabular-nums">
              {tab === 'siswa-harian'
                ? dailyStudentStats.totalAbsence
                : subjectStudentStats.totalAbsence}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5 sm:p-4">
            <p className="text-[11px] font-medium text-slate-500">Rata-rata Kehadiran</p>
            <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 tabular-nums">
              {(tab === 'siswa-harian' ? dailyStudentStats.avgPct : subjectStudentStats.avgPct) !=
              null
                ? `${
                    tab === 'siswa-harian' ? dailyStudentStats.avgPct : subjectStudentStats.avgPct
                  }%`
                : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3.5 print:hidden">
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs ${
            tab === 'guru'
              ? 'lg:grid-cols-4'
              : tab === 'siswa-harian'
              ? 'lg:grid-cols-4'
              : 'lg:grid-cols-6'
          }`}
        >
          <div>
            <label htmlFor="rekap-month" className="block font-semibold text-slate-600 mb-1">
              Preset Bulan
            </label>
            <input
              id="rekap-month"
              type="month"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                if (e.target.value) {
                  const range = getMonthRange(e.target.value);
                  setStartDate(range.start);
                  setEndDate(range.end);
                  setPage(1);
                }
              }}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="rekap-start" className="block font-semibold text-slate-600 mb-1">
              Tanggal Mulai
            </label>
            <input
              id="rekap-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setMonthValue('');
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="rekap-end" className="block font-semibold text-slate-600 mb-1">
              Tanggal Akhir
            </label>
            <input
              id="rekap-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setMonthValue('');
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          {tab !== 'guru' && (
            <div>
              <label htmlFor="rekap-class" className="block font-semibold text-slate-600 mb-1">
                Filter Kelas
              </label>
              <select
                id="rekap-class"
                value={classroomId}
                onChange={(e) => {
                  setClassroomId(e.target.value);
                  setPage(1);
                }}
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Kelas</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tab === 'siswa-mapel' && (
            <div>
              <label htmlFor="rekap-subject" className="block font-semibold text-slate-600 mb-1">
                Filter Mapel
              </label>
              <select
                id="rekap-subject"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setPage(1);
                }}
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tab !== 'siswa-harian' && (
            <div>
              <label htmlFor="rekap-teacher" className="block font-semibold text-slate-600 mb-1">
                Filter Guru
              </label>
              <select
                id="rekap-teacher"
                value={teacherId}
                onChange={(e) => {
                  setTeacherId(e.target.value);
                  setPage(1);
                }}
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Guru</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {(isInvalidRange || isMissingDate) && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            {isMissingDate
              ? 'Tanggal mulai dan tanggal akhir wajib diisi.'
              : 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir.'}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              {tab === 'guru' ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Rekap Absensi Guru ({filteredGuru.length})</span>
                </>
              ) : tab === 'siswa-harian' ? (
                <>
                  <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Rekap Siswa Harian/Piket ({filteredDailyStudent.length})</span>
                </>
              ) : (
                <>
                  <BookOpenCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Rekap Siswa per Mapel ({filteredSubjectStudent.length})</span>
                </>
              )}
            </div>
            {hasCustomFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filter
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={
                tab === 'guru'
                  ? 'Cari nama guru atau NIP...'
                  : tab === 'siswa-harian'
                  ? 'Cari nama, NIS, NISN, kelas...'
                  : 'Cari nama, NIS, kelas, mapel...'
              }
              aria-label="Cari data rekap absensi"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat rekapitulasi absensi...
          </div>
        ) : (
          <>
            {tab === 'guru' && (
              <div className="md:hidden print:hidden space-y-3">
                {pagedGuru.length === 0 ? (
                  <AkademikEmptyState
                    compact
                    icon={<UserCheck className="w-6 h-6 text-slate-300" />}
                    message="Tidak ada data absensi guru pada periode ini."
                  />
                ) : (
                  pagedGuru.map((r) => (
                    <div
                      key={r.teacher_id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words">
                            {r.full_name}
                          </p>
                          <p className="text-[11px] text-slate-400">NIP: {r.nip || '-'}</p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                          {r.total_jtm} JTM
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] bg-slate-50 rounded-xl p-2">
                        <div>
                          <p className="text-slate-400">Hari Hadir</p>
                          <p className="font-bold text-slate-800 tabular-nums">
                            {r.total_days_present}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Terkonfirmasi</p>
                          <p className="font-bold text-emerald-700 tabular-nums">
                            {r.confirmed_sessions}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Rata-rata</p>
                          <p className="font-bold text-sky-700 tabular-nums">
                            {r.avg_presence_pct != null ? `${r.avg_presence_pct}%` : '-'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100">
                          Mengajar: <b>{r.teaching_sessions}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100">
                          Piket: <b>{r.picket_sessions}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100">
                          Ujian: <b>{r.exam_sessions}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100">
                          Acara: <b>{r.event_sessions}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100">
                          Izin Keluar: <b>{r.total_short_leave_minutes} mnt</b>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'siswa-harian' && (
              <div className="md:hidden print:hidden space-y-3">
                {pagedDailyStudent.length === 0 ? (
                  <AkademikEmptyState
                    compact
                    icon={<Users className="w-6 h-6 text-slate-300" />}
                    message="Tidak ada data absensi siswa harian (piket) pada periode ini."
                  />
                ) : (
                  pagedDailyStudent.map((r) => (
                    <div
                      key={`${r.student_id}-${r.classroom_id}`}
                      className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words">
                            {r.full_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            NIS: {r.nis || '-'} • {r.classroom_name}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                          {r.presence_pct}%
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] bg-slate-50 rounded-xl p-2 tabular-nums">
                        <div>
                          <p className="text-slate-400">Hadir</p>
                          <p className="font-bold text-emerald-700">{r.hadir}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Sakit</p>
                          <p className="font-bold text-amber-700">{r.sakit}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Izin</p>
                          <p className="font-bold text-sky-700">{r.izin}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Alpa</p>
                          <p className="font-bold text-rose-700">{r.alpa}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Total</p>
                          <p className="font-bold text-slate-800">{r.total}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'siswa-mapel' && (
              <div className="md:hidden print:hidden space-y-3">
                {pagedSubjectStudent.length === 0 ? (
                  <AkademikEmptyState
                    compact
                    icon={<BookOpenCheck className="w-6 h-6 text-slate-300" />}
                    message="Tidak ada data absensi siswa per mata pelajaran pada periode ini."
                  />
                ) : (
                  pagedSubjectStudent.map((r) => (
                    <div
                      key={r.key}
                      className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words">
                            {r.full_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            NIS: {r.nis || '-'} • {r.classroom_name}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                          {r.presence_pct}%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium">
                          {r.subject_name}
                        </span>
                        <span className="text-slate-500">Guru: {r.teacher_name}</span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] bg-slate-50 rounded-xl p-2 tabular-nums">
                        <div>
                          <p className="text-slate-400">H</p>
                          <p className="font-bold text-emerald-700">{r.hadir}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">S</p>
                          <p className="font-bold text-amber-700">{r.sakit}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">I</p>
                          <p className="font-bold text-sky-700">{r.izin}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">A</p>
                          <p className="font-bold text-rose-700">{r.alpa}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Total</p>
                          <p className="font-bold text-slate-800">{r.total}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 hidden md:block print:block">
              {tab === 'guru' ? (
                <table className="w-full text-xs min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">
                      <th className="py-3 px-3">Nama Guru</th>
                      <th className="py-3 px-3 text-center">Hari Hadir</th>
                      <th className="py-3 px-3 text-center">Mengajar</th>
                      <th className="py-3 px-3 text-center">Piket</th>
                      <th className="py-3 px-3 text-center">Ujian</th>
                      <th className="py-3 px-3 text-center">Acara</th>
                      <th className="py-3 px-3 text-center">Terkonfirmasi</th>
                      <th className="py-3 px-3 text-center">Total JTM</th>
                      <th className="py-3 px-3 text-center">Izin Keluar</th>
                      <th className="py-3 px-3 text-center">Rata-rata Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {pagedGuru.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-6">
                          <AkademikEmptyState
                            compact
                            icon={<UserCheck className="w-6 h-6 text-slate-300" />}
                            message="Tidak ada data absensi guru pada periode ini."
                          />
                        </td>
                      </tr>
                    ) : (
                      pagedGuru.map((r) => (
                        <tr key={r.teacher_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-900">{r.full_name}</p>
                            <p className="text-[11px] text-slate-400">NIP: {r.nip || '-'}</p>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold">
                            {r.total_days_present}
                          </td>
                          <td className="py-3 px-3 text-center">{r.teaching_sessions}</td>
                          <td className="py-3 px-3 text-center">{r.picket_sessions}</td>
                          <td className="py-3 px-3 text-center">{r.exam_sessions}</td>
                          <td className="py-3 px-3 text-center">{r.event_sessions}</td>
                          <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                            {r.confirmed_sessions}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">
                            {r.total_jtm}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {r.total_short_leave_minutes} mnt
                          </td>
                          <td className="py-3 px-3 text-center font-semibold">
                            {r.avg_presence_pct != null ? `${r.avg_presence_pct}%` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : tab === 'siswa-harian' ? (
                <table className="w-full text-xs min-w-[680px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">
                      <th className="py-3 px-3">Nama Siswa</th>
                      <th className="py-3 px-3">NIS</th>
                      <th className="py-3 px-3">Kelas</th>
                      <th className="py-3 px-3 text-center text-emerald-700">Hadir</th>
                      <th className="py-3 px-3 text-center text-amber-700">Sakit</th>
                      <th className="py-3 px-3 text-center text-sky-700">Izin</th>
                      <th className="py-3 px-3 text-center text-rose-700">Alpa</th>
                      <th className="py-3 px-3 text-center">Total</th>
                      <th className="py-3 px-3 text-center">Persentase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {pagedDailyStudent.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6">
                          <AkademikEmptyState
                            compact
                            icon={<Users className="w-6 h-6 text-slate-300" />}
                            message="Tidak ada data absensi siswa harian (piket) pada periode ini."
                          />
                        </td>
                      </tr>
                    ) : (
                      pagedDailyStudent.map((r) => (
                        <tr
                          key={`${r.student_id}-${r.classroom_id}`}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-3 font-semibold text-slate-900">{r.full_name}</td>
                          <td className="py-3 px-3 text-slate-600">{r.nis || '-'}</td>
                          <td className="py-3 px-3 text-slate-600">{r.classroom_name}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">
                            {r.hadir}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-amber-700">
                            {r.sakit}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-sky-700">
                            {r.izin}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-rose-700">
                            {r.alpa}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold">{r.total}</td>
                          <td className="py-3 px-3 text-center font-bold">{r.presence_pct}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs min-w-[780px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">
                      <th className="py-3 px-3">Nama Siswa</th>
                      <th className="py-3 px-3">Kelas</th>
                      <th className="py-3 px-3">Mata Pelajaran</th>
                      <th className="py-3 px-3">Guru Mapel</th>
                      <th className="py-3 px-3 text-center text-emerald-700">H</th>
                      <th className="py-3 px-3 text-center text-amber-700">S</th>
                      <th className="py-3 px-3 text-center text-sky-700">I</th>
                      <th className="py-3 px-3 text-center text-rose-700">A</th>
                      <th className="py-3 px-3 text-center">Total</th>
                      <th className="py-3 px-3 text-center">Persentase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {pagedSubjectStudent.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-6">
                          <AkademikEmptyState
                            compact
                            icon={<BookOpenCheck className="w-6 h-6 text-slate-300" />}
                            message="Tidak ada data absensi siswa per mata pelajaran pada periode ini."
                          />
                        </td>
                      </tr>
                    ) : (
                      pagedSubjectStudent.map((r) => (
                        <tr key={r.key} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-900">{r.full_name}</p>
                            <p className="text-[11px] text-slate-400">NIS: {r.nis || '-'}</p>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{r.classroom_name}</td>
                          <td className="py-3 px-3 font-medium text-slate-800">{r.subject_name}</td>
                          <td className="py-3 px-3 text-slate-600">{r.teacher_name}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">
                            {r.hadir}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-amber-700">
                            {r.sakit}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-sky-700">
                            {r.izin}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-rose-700">
                            {r.alpa}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold">{r.total}</td>
                          <td className="py-3 px-3 text-center font-bold">{r.presence_pct}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {activeRowsCount > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 print:hidden">
                <span>
                  Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, activeRowsCount)} dari{' '}
                  {activeRowsCount} data
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Halaman sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label="Halaman berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
