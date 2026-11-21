'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import {
  BookOpenCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { AkademikErrorBanner, AkademikToast, useAkademikToast } from './akademik-ui';

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
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${yStr}-${mStr}-01`,
    end: `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

export type RekapAbsensiSection = 'guru' | 'siswa-harian' | 'siswa-mapel';

export function RekapAbsensiWorkspace({ section }: { section: RekapAbsensiSection }) {
  const initialMonth = getCurrentMonthValue();
  const initialRange = getMonthRange(initialMonth);

  const tab = section;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [monthValue, setMonthValue] = useState(initialMonth);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [classroomId, setClassroomId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [search, setSearch] = useState('');

  const [teacherRecap, setTeacherRecap] = useState<TeacherRecapRow[]>([]);
  const [dailyStudentRecap, setDailyStudentRecap] = useState<DailyStudentRecapRow[]>([]);
  const [subjectStudentRecap, setSubjectStudentRecap] = useState<SubjectStudentRecapRow[]>([]);
  const [classrooms, setClassrooms] = useState<FilterOption[]>([]);
  const [subjects, setSubjects] = useState<FilterOption[]>([]);
  const [teachers, setTeachers] = useState<FilterOption[]>([]);

  const isInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  const loadData = useCallback(async () => {
    if (startDate && endDate && startDate > endDate) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (classroomId) params.set('classroomId', classroomId);
      if (subjectId) params.set('subjectId', subjectId);
      if (teacherId) params.set('teacherId', teacherId);

      const res = await fetch(`/api/akademik/rekap-absensi?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat rekapitulasi absensi.');
      }
      setLoadError(null);
      setTeacherRecap(data.teacherRecap || []);
      setDailyStudentRecap(data.dailyStudentRecap || []);
      setSubjectStudentRecap(data.subjectStudentRecap || []);
      setClassrooms(data.filters?.classrooms || []);
      setSubjects(data.filters?.subjects || []);
      setTeachers(data.filters?.teachers || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, classroomId, subjectId, teacherId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
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
    const ws = XLSX.utils.json_to_sheet(payload.objects);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
    XLSX.writeFile(wb, `${payload.fileName}.xlsx`);
  }

  async function handleExportPdf() {
    const payload = getExportPayload();
    if (payload.rows.length === 0) {
      showToast('error', 'Tidak ada data pada periode ini untuk diekspor ke PDF.');
      return;
    }
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Rekapitulasi Absensi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Rekap absensi guru, absensi siswa harian (piket), dan absensi siswa per mata pelajaran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportXlsx}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export .xlsx
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>

      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      {/* Print Header */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
        <h2 className="text-lg font-bold text-slate-900">{getExportPayload().title}</h2>
        <p className="text-xs text-slate-600">
          Periode: {startDate} s.d. {endDate}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Preset Bulan</label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                if (e.target.value) {
                  const range = getMonthRange(e.target.value);
                  setStartDate(range.start);
                  setEndDate(range.end);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setMonthValue('');
                setStartDate(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setMonthValue('');
                setEndDate(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Filter Kelas</label>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="">Semua Kelas</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Filter Mapel</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Filter Guru</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="">Semua Guru</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isInvalidRange && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            Tanggal mulai tidak boleh lebih besar dari tanggal akhir.
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
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

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIP, NIS..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="glass-card rounded-3xl p-4 sm:p-5">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat rekapitulasi absensi...
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredGuru.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Tidak ada data absensi guru pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredGuru.map((r) => (
                      <tr key={r.teacher_id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{r.full_name}</p>
                          <p className="text-[11px] text-slate-400">NIP: {r.nip || '-'}</p>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">{r.total_days_present}</td>
                        <td className="py-3 px-3 text-center">{r.teaching_sessions}</td>
                        <td className="py-3 px-3 text-center">{r.picket_sessions}</td>
                        <td className="py-3 px-3 text-center">{r.exam_sessions}</td>
                        <td className="py-3 px-3 text-center">{r.event_sessions}</td>
                        <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                          {r.confirmed_sessions}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">{r.total_jtm}</td>
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
                <tbody className="divide-y divide-slate-100">
                  {filteredDailyStudent.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Tidak ada data absensi siswa harian (piket) pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredDailyStudent.map((r) => (
                      <tr key={`${r.student_id}-${r.classroom_id}`} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-semibold text-slate-900">{r.full_name}</td>
                        <td className="py-3 px-3 text-slate-600">{r.nis || '-'}</td>
                        <td className="py-3 px-3 text-slate-600">{r.classroom_name}</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700">{r.hadir}</td>
                        <td className="py-3 px-3 text-center font-semibold text-amber-700">{r.sakit}</td>
                        <td className="py-3 px-3 text-center font-semibold text-sky-700">{r.izin}</td>
                        <td className="py-3 px-3 text-center font-semibold text-rose-700">{r.alpa}</td>
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
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjectStudent.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Tidak ada data absensi siswa per mata pelajaran pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjectStudent.map((r) => (
                      <tr key={r.key} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{r.full_name}</p>
                          <p className="text-[11px] text-slate-400">NIS: {r.nis || '-'}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{r.classroom_name}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{r.subject_name}</td>
                        <td className="py-3 px-3 text-slate-600">{r.teacher_name}</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700">{r.hadir}</td>
                        <td className="py-3 px-3 text-center font-semibold text-amber-700">{r.sakit}</td>
                        <td className="py-3 px-3 text-center font-semibold text-sky-700">{r.izin}</td>
                        <td className="py-3 px-3 text-center font-semibold text-rose-700">{r.alpa}</td>
                        <td className="py-3 px-3 text-center font-semibold">{r.total}</td>
                        <td className="py-3 px-3 text-center font-bold">{r.presence_pct}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
