import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type KkmMode = 'PER_GRADE' | 'PER_SUBJECT_GRADE';
export type AssessmentCategory = 'FORMATIF' | 'SUMATIF' | 'PRAKTIK';
export type AssessmentExamType = 'STS' | 'SAS';
export type AssessmentMenuType = AssessmentCategory | AssessmentExamType;
export type ColumnNamingMode = 'AUTO' | 'CUSTOM';

export const DEFAULT_KKM_SCORE = 75;

export interface TaughtChapterSummary {
  id: string;
  gradeLevel: string;
  chapterNumber: number;
  title: string | null;
  sortOrder: number;
}

export interface TaughtClassroomSummary {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface TaughtSubjectMenu {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classrooms: TaughtClassroomSummary[];
  chapters: TaughtChapterSummary[];
}

export function formatChapterLabel(chapterNumber: number, title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? `BAB ${chapterNumber} - ${trimmed}` : `BAB ${chapterNumber}`;
}

export function getAutoColumnPrefix(category: AssessmentCategory): string {
  switch (category) {
    case 'FORMATIF':
      return 'TP';
    case 'SUMATIF':
      return 'LM';
    case 'PRAKTIK':
      return 'Praktik';
  }
}

export function formatAutoColumnLabel(category: AssessmentCategory, index1Based: number): string {
  return `${getAutoColumnPrefix(category)} ${index1Based}`;
}

export function computeAverageScore(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

export async function getActiveAcademicYear(
  db: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ id: string; name: string; semester: string } | null> {
  const { data } = await db
    .from('academic_years')
    .select('id, name, semester')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    semester: data.semester as string,
  };
}

export async function resolveEffectiveKkm(
  db: ReturnType<typeof createSupabaseAdminClient>,
  academicYearId: string,
  gradeLevel: string,
  subjectId: string
): Promise<{ mode: KkmMode; minScore: number }> {
  const { data: setting } = await db
    .from('kkm_settings')
    .select('active_mode')
    .eq('academic_year_id', academicYearId)
    .maybeSingle();

  const mode: KkmMode =
    setting?.active_mode === 'PER_SUBJECT_GRADE' ? 'PER_SUBJECT_GRADE' : 'PER_GRADE';

  if (mode === 'PER_SUBJECT_GRADE') {
    const { data: subjectRule } = await db
      .from('kkm_rules')
      .select('min_score')
      .eq('academic_year_id', academicYearId)
      .eq('grade_level', gradeLevel)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectRule && subjectRule.min_score !== null && subjectRule.min_score !== undefined) {
      return { mode, minScore: Number(subjectRule.min_score) };
    }
  }

  const { data: gradeRule } = await db
    .from('kkm_rules')
    .select('min_score')
    .eq('academic_year_id', academicYearId)
    .eq('grade_level', gradeLevel)
    .is('subject_id', null)
    .maybeSingle();

  return {
    mode,
    minScore:
      gradeRule && gradeRule.min_score !== null && gradeRule.min_score !== undefined
        ? Number(gradeRule.min_score)
        : DEFAULT_KKM_SCORE,
  };
}

export function validateColumnScoreAgainstKkm(
  category: AssessmentCategory,
  score: number | null,
  kkmMinScore: number,
  studentName: string
): string | null {
  if (score === null) return null;
  if (score < 0 || score > 100) {
    return `Nilai ${studentName} harus berada di rentang 0–100.`;
  }
  if ((category === 'FORMATIF' || category === 'SUMATIF') && score < kkmMinScore) {
    return `Nilai ${studentName} (${score}) tidak boleh di bawah KKM (${kkmMinScore}) untuk penilaian ${category === 'FORMATIF' ? 'Formatif' : 'Sumatif'}.`;
  }
  return null;
}

export function validateExamScoreAgainstKkm(
  score: number | null,
  remedialScore: number | null,
  enrichmentScore: number | null,
  kkmMinScore: number,
  studentName: string
): string | null {
  if (score !== null && (score < 0 || score > 100)) {
    return `Nilai ${studentName} harus berada di rentang 0–100.`;
  }
  if (remedialScore !== null && (remedialScore < 0 || remedialScore > 100)) {
    return `Nilai remedial ${studentName} harus berada di rentang 0–100.`;
  }
  if (enrichmentScore !== null && (enrichmentScore < 0 || enrichmentScore > 100)) {
    return `Nilai pengayaan ${studentName} harus berada di rentang 0–100.`;
  }
  if (score !== null && score < kkmMinScore && remedialScore === null) {
    return `Nilai ${studentName} (${score}) di bawah KKM (${kkmMinScore}), sehingga kolom Remedial wajib diisi.`;
  }
  return null;
}
