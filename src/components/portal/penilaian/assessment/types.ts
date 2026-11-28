import {
  computeAverageScore,
  computeExamEffectiveScore,
  formatChapterLabel,
  type AssessmentCategory,
  type AssessmentMenuType,
  type ColumnNamingMode,
  type TaughtClassroomSummary,
} from '@/lib/domain/penilaian';
import { parseDecimalInput } from '@/lib/validation/decimal';

export interface StudentRow {
  id: string;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  gender: string | null;
}

export interface ChapterRow {
  id: string;
  chapter_number: number;
  title: string | null;
  sort_order: number;
}

export interface ColumnRow {
  id: string;
  category: AssessmentCategory;
  chapter_id: string | null;
  naming_mode: ColumnNamingMode;
  label: string;
  sort_order: number;
}

export interface ExamScoreState {
  score: string;
  remedial_score: string;
  enrichment_score: string;
  notes: string;
}

export interface ExamConfig {
  enable_remedial: boolean;
  enable_enrichment: boolean;
  enable_notes: boolean;
}

export interface AcademicYearInfo {
  name: string;
  semester: string;
}

export interface SubjectInfo {
  code: string;
  name: string;
}

export interface ClassroomInfo {
  id: string;
  name: string;
  grade_level: string;
}

export interface KkmInfo {
  mode: string;
  minScore: number;
}

export interface ConfirmModalState {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  variant: 'danger' | 'warning';
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export interface AssessmentWorkspaceProps {
  subjectId: string;
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  initialChapterId?: string | null;
  initialClassroomId?: string | null;
  classrooms: TaughtClassroomSummary[];
  onChaptersChanged?: () => void;
}

export const EMPTY_EXAM_ROW: ExamScoreState = {
  score: '',
  remedial_score: '',
  enrichment_score: '',
  notes: '',
};

export function parseNumericInput(val: string): number | null {
  return parseDecimalInput(val);
}

export function computeValidationErrors(params: {
  isExam: boolean;
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  students: StudentRow[];
  columns: ColumnRow[];
  columnScoresMap: Record<string, string>;
  examScoresMap: Record<string, ExamScoreState>;
  kkmMinScore: number;
}): string[] {
  const { isExam, type, students, columns, columnScoresMap, examScoresMap, kkmMinScore } = params;
  const errors: string[] = [];

  if (!isExam) {
    for (const st of students) {
      for (const col of columns) {
        const raw = columnScoresMap[`${col.id}::${st.id}`] ?? '';
        const num = parseNumericInput(raw);
        if (raw.trim() !== '' && num === null) {
          errors.push(`${st.full_name} (${col.label}): nilai harus berupa angka.`);
        } else if (num !== null && (num < 0 || num > 100)) {
          errors.push(`${st.full_name} (${col.label}): nilai harus 0–100.`);
        } else if (
          num !== null &&
          (type === 'FORMATIF' || type === 'SUMATIF') &&
          num < kkmMinScore
        ) {
          errors.push(
            `${st.full_name} (${col.label}): nilai ${num} tidak boleh di bawah KKM (${kkmMinScore}).`
          );
        }
      }
    }
    return errors;
  }

  for (const st of students) {
    const row = examScoresMap[st.id];
    if (!row) continue;
    const score = parseNumericInput(row.score);
    const rem = parseNumericInput(row.remedial_score);
    const enr = parseNumericInput(row.enrichment_score);

    if (row.score.trim() !== '' && (score === null || score < 0 || score > 100)) {
      errors.push(`${st.full_name}: nilai utama harus 0–100.`);
    }
    if (row.remedial_score.trim() !== '' && (rem === null || rem < 0 || rem > 100)) {
      errors.push(`${st.full_name}: nilai remedial harus 0–100.`);
    }
    if (row.enrichment_score.trim() !== '' && (enr === null || enr < 0 || enr > 100)) {
      errors.push(`${st.full_name}: nilai pengayaan harus 0–100.`);
    }
    if (score !== null && score < kkmMinScore && rem === null) {
      errors.push(
        `${st.full_name}: nilai (${score}) di bawah KKM (${kkmMinScore}), kolom Remedial wajib diisi.`
      );
    }
    if (((score !== null && score < kkmMinScore) || rem !== null) && enr !== null) {
      errors.push(
        `${st.full_name}: tidak dapat mengisi Pengayaan jika memiliki/wajib Remedial.`
      );
    }
    if (rem !== null) {
      const finalRem = score !== null ? Math.round(((score + rem) / 2) * 100) / 100 : rem;
      if (finalRem < kkmMinScore) {
        errors.push(
          `${st.full_name}: nilai akhir (${finalRem}) masih di bawah KKM (${kkmMinScore}). Naikkan nilai Remedial agar nilai akhir >= ${kkmMinScore}.`
        );
      }
    }
  }

  return errors;
}

export function buildAssessmentExportData(params: {
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  isExam: boolean;
  chapters: ChapterRow[];
  selectedChapterId: string | null;
  subjectInfo: SubjectInfo | null;
  classroomInfo: ClassroomInfo | null;
  academicYear: AcademicYearInfo | null;
  kkm: KkmInfo;
  students: StudentRow[];
  columns: ColumnRow[];
  columnScoresMap: Record<string, string>;
  examConfig: ExamConfig;
  examScoresMap: Record<string, ExamScoreState>;
}) {
  const {
    type,
    isExam,
    chapters,
    selectedChapterId,
    subjectInfo,
    classroomInfo,
    academicYear,
    kkm,
    students,
    columns,
    columnScoresMap,
    examConfig,
    examScoresMap,
  } = params;

  const activeChapter = chapters.find((c) => c.id === selectedChapterId);
  const typeTitleMap: Record<Exclude<AssessmentMenuType, 'RAPORT'>, string> = {
    FORMATIF: activeChapter
      ? `Formatif (${formatChapterLabel(activeChapter.chapter_number, activeChapter.title)})`
      : 'Formatif (Lingkup BAB)',
    SUMATIF: 'Sumatif (Lingkup Materi)',
    STS: 'STS (Sumatif Tengah Semester)',
    SAS: 'SAS (Sumatif Akhir Semester)',
    PRAKTIK: 'Praktik',
  };

  const title = `Penilaian ${subjectInfo?.name || ''} — ${typeTitleMap[type]}`;
  const subtitle = `Kelas ${classroomInfo?.name || ''} | TA ${academicYear?.name || ''} (${academicYear?.semester || ''}) | KKM: ${kkm.minScore}`;
  const safeName = `nilai-${subjectInfo?.code || 'mapel'}-${classroomInfo?.name || 'kelas'}-${type.toLowerCase()}`.replace(
    /[^a-zA-Z0-9-_]/g,
    '_'
  );

  if (!isExam) {
    const headers = ['No', 'NIS', 'Nama Siswa', ...columns.map((c) => c.label), 'Rata-rata'];
    const rows = students.map((st, idx) => {
      const vals = columns.map((col) =>
        parseNumericInput(columnScoresMap[`${col.id}::${st.id}`] ?? '')
      );
      const avg = computeAverageScore(vals);
      return [
        idx + 1,
        st.nis || '-',
        st.full_name,
        ...vals.map((v) => (v !== null ? v : '-')),
        avg !== null ? avg : '-',
      ];
    });
    return { fileName: safeName, title, subtitle, headers, rows };
  }

  const showRem =
    examConfig.enable_remedial ||
    students.some((st) => {
      const sc = parseNumericInput(examScoresMap[st.id]?.score ?? '');
      return sc !== null && sc < kkm.minScore;
    });

  const headers = ['No', 'NIS', 'Nama Siswa', `Nilai ${type}`];
  if (showRem) headers.push('Remedial');
  if (examConfig.enable_enrichment) headers.push('Pengayaan');
  if (examConfig.enable_notes) headers.push('Catatan');
  headers.push('Nilai Akhir');

  const rows = students.map((st, idx) => {
    const row = examScoresMap[st.id];
    const sc = parseNumericInput(row?.score ?? '');
    const rem = parseNumericInput(row?.remedial_score ?? '');
    const enr = parseNumericInput(row?.enrichment_score ?? '');
    const effective = computeExamEffectiveScore(sc, rem, enr);
    const base: Array<string | number> = [idx + 1, st.nis || '-', st.full_name, sc ?? '-'];
    if (showRem) base.push(rem ?? '-');
    if (examConfig.enable_enrichment) base.push(enr ?? '-');
    if (examConfig.enable_notes) base.push(row?.notes.trim() || '-');
    base.push(effective ?? '-');
    return base;
  });

  return { fileName: safeName, title, subtitle, headers, rows };
}
