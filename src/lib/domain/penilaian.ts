import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type KkmMode = 'PER_GRADE' | 'PER_SUBJECT_GRADE';
export type AssessmentCategory = 'FORMATIF' | 'SUMATIF' | 'PRAKTIK';
export type AssessmentExamType = 'STS' | 'SAS';
export type AssessmentMenuType = AssessmentCategory | AssessmentExamType | 'RAPORT';
export type ColumnNamingMode = 'AUTO' | 'CUSTOM';

export interface RaportWeights {
  weight_formatif: number;
  weight_sumatif: number;
  weight_sts: number;
  weight_sas: number;
  weight_praktik: number;
}

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

const ROMAN_GRADE_ORDER: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

function getGradeRank(gradeLevel: string): number {
  const upper = gradeLevel.trim().toUpperCase();
  if (ROMAN_GRADE_ORDER[upper] !== undefined) return ROMAN_GRADE_ORDER[upper];
  const parsed = Number.parseInt(upper, 10);
  return Number.isNaN(parsed) ? 999 : parsed;
}

export function sortGradeLevelsAsc(gradeLevels: readonly string[]): string[] {
  return [...gradeLevels].sort((a, b) => {
    const rankDiff = getGradeRank(a) - getGradeRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
  });
}

export function sortClassroomsAsc<T extends { name: string; gradeLevel: string }>(
  classrooms: readonly T[]
): T[] {
  return [...classrooms].sort((a, b) => {
    const rankDiff = getGradeRank(a.gradeLevel) - getGradeRank(b.gradeLevel);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' });
  });
}

function getAutoColumnPrefix(category: AssessmentCategory): string {
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
  if (score === null && (remedialScore !== null || enrichmentScore !== null)) {
    return `${studentName}: nilai utama harus diisi terlebih dahulu sebelum mengisi Remedial atau Pengayaan.`;
  }
  if (score !== null && score >= kkmMinScore && remedialScore !== null) {
    return `${studentName}: nilai (${score}) sudah memenuhi KKM (${kkmMinScore}), sehingga tidak dapat mengisi nilai Remedial.`;
  }
  if (score !== null && score < kkmMinScore && remedialScore === null) {
    return `Nilai ${studentName} (${score}) di bawah KKM (${kkmMinScore}), sehingga kolom Remedial wajib diisi.`;
  }
  if ((score !== null && score < kkmMinScore) || remedialScore !== null) {
    if (enrichmentScore !== null) {
      return `${studentName}: tidak dapat mengisi nilai Pengayaan jika memiliki atau wajib mengisi nilai Remedial.`;
    }
  }
  if (remedialScore !== null && score !== null) {
    const finalAfterRemedial = Math.round(((score + remedialScore) / 2) * 100) / 100;
    if (finalAfterRemedial < kkmMinScore) {
      return `${studentName}: nilai akhir setelah remedial (${finalAfterRemedial}) masih di bawah KKM (${kkmMinScore}). Ubah nilai remedial agar nilai akhir >= ${kkmMinScore}.`;
    }
  }
  return null;
}

export function computeExamEffectiveScore(
  score: number | null | undefined,
  remedialScore: number | null | undefined,
  enrichmentScore: number | null | undefined
): number | null {
  const base = typeof score === 'number' && !Number.isNaN(score) ? score : null;
  const rem =
    typeof remedialScore === 'number' && !Number.isNaN(remedialScore) ? remedialScore : null;
  const enr =
    typeof enrichmentScore === 'number' && !Number.isNaN(enrichmentScore)
      ? enrichmentScore
      : null;

  if (base === null && rem === null && enr === null) return null;

  let result = base;
  if (rem !== null) {
    result = result !== null ? (result + rem) / 2 : rem;
  }
  if (enr !== null) {
    result = result !== null ? Math.max(result, enr) : enr;
  }

  return result !== null ? Math.round(result * 100) / 100 : null;
}

function hasMaxTwoDecimals(val: number): boolean {
  return Math.abs(Math.round(val * 100) - val * 100) < 1e-6;
}

export function validateRaportWeights(
  weights: RaportWeights,
  hasPraktik: boolean
): string | null {
  const entries: Array<[string, number]> = [
    ['Formatif', weights.weight_formatif],
    ['Sumatif', weights.weight_sumatif],
    ['STS', weights.weight_sts],
    ['SAS', weights.weight_sas],
    ...(hasPraktik ? ([['Praktik', weights.weight_praktik]] as Array<[string, number]>) : []),
  ];

  for (const [label, val] of entries) {
    if (typeof val !== 'number' || Number.isNaN(val) || val < 0 || val > 100) {
      return `Bobot ${label} harus berada di rentang 0–100%.`;
    }
    if (!hasMaxTwoDecimals(val)) {
      return `Bobot ${label} maksimal 2 angka di belakang koma.`;
    }
  }

  const total = entries.reduce((sum, [, val]) => sum + val, 0);
  if (Math.abs(total - 100) > 0.001) {
    return `Total bobot harus tepat 100% (saat ini ${Math.round(total * 100) / 100}%).`;
  }
  return null;
}

export function computeRaportScore(
  components: {
    formatifAvg: number | null;
    sumatifAvg: number | null;
    stsEffective: number | null;
    sasEffective: number | null;
    praktikAvg: number | null;
  },
  weights: RaportWeights,
  hasPraktik: boolean
): number | null {
  const activePairs: Array<[number | null, number]> = [
    [components.formatifAvg, weights.weight_formatif],
    [components.sumatifAvg, weights.weight_sumatif],
    [components.stsEffective, weights.weight_sts],
    [components.sasEffective, weights.weight_sas],
    ...(hasPraktik ? ([[components.praktikAvg, weights.weight_praktik]] as Array<[number | null, number]>) : []),
  ];

  for (const [val, w] of activePairs) {
    if (w > 0 && val === null) {
      return null;
    }
  }

  const totalWeight = activePairs.reduce((acc, [, w]) => acc + w, 0);
  if (Math.abs(totalWeight - 100) > 0.001) return null;

  const weightedSum = activePairs.reduce((acc, [val, w]) => acc + (val ?? 0) * w, 0);
  return Math.round((weightedSum / 100) * 100) / 100;
}
