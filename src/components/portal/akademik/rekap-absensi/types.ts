export type RekapAbsensiSection = 'guru' | 'siswa-harian' | 'siswa-mapel';

export interface TeacherRecapRow {
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

export interface DailyStudentRecapRow {
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

export interface SubjectStudentRecapRow {
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

export interface FilterOption {
  id: string;
  name?: string;
  full_name?: string;
}

export interface GuruRecapStats {
  totalTeachers: number;
  totalTeaching: number;
  totalJtm: number;
  avgPct: number | null;
}

export interface StudentRecapStats {
  totalRows: number;
  totalHadir: number;
  totalAbsence: number;
  avgPct: number | null;
}

export const PAGE_SIZE = 12;

export const SECTION_META: Record<
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

export function getCurrentMonthValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getMonthRange(ym: string): { start: string; end: string } {
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

export function computeGuruRecapStats(rows: TeacherRecapRow[]): GuruRecapStats {
  const totalTeaching = rows.reduce((acc, r) => acc + r.teaching_sessions, 0);
  const totalJtm = Number(
    rows.reduce((acc, r) => acc + Number(r.total_jtm || 0), 0).toFixed(2)
  );
  const withPct = rows.filter((r) => r.avg_presence_pct != null);
  const avgPct =
    withPct.length > 0
      ? Math.round(
          (withPct.reduce((acc, r) => acc + (r.avg_presence_pct || 0), 0) / withPct.length) *
            10
        ) / 10
      : null;
  return {
    totalTeachers: rows.length,
    totalTeaching,
    totalJtm,
    avgPct,
  };
}

export function computeStudentRecapStats(
  rows: Array<{ hadir: number; sakit: number; izin: number; alpa: number; presence_pct: number }>
): StudentRecapStats {
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
