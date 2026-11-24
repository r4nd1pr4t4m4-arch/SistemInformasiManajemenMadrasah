export interface Opt {
  id: string;
  full_name: string;
  nis?: string | null;
}

export interface AssignmentRow {
  id: string;
  teacher_id?: string;
  student_id?: string;
  classroom_name?: string | null;
  is_my_mentee?: boolean;
  teacher?: { id?: string; full_name: string } | null;
  student?: { id?: string; full_name: string; nis?: string | null } | null;
}

export interface MentoringLogRow {
  id: string;
  mentoring_date: string;
  topic: string;
  aspect?: string | null;
  notes: string;
  recommendation?: string | null;
  assignment?: {
    teacher?: { full_name: string } | null;
    student?: { full_name: string } | null;
  } | null;
}

export interface HafalanItem {
  id: string;
  title: string;
  category?: string | null;
}

export interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export type MentoringAspect =
  | 'AKADEMIK'
  | 'IBADAH_KARAKTER'
  | 'SETORAN_HAFALAN'
  | 'SOSIAL'
  | 'KESEHATAN'
  | 'LAINNYA';

export const ASPECT_LABELS: Record<MentoringAspect, string> = {
  AKADEMIK: 'Akademik',
  IBADAH_KARAKTER: 'Ibadah & Karakter',
  SETORAN_HAFALAN: 'Setoran Hafalan',
  SOSIAL: 'Sosial',
  KESEHATAN: 'Kesehatan',
  LAINNYA: 'Lainnya',
};

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAspectLabel(aspect?: string | null): string {
  if (aspect && aspect in ASPECT_LABELS) {
    return ASPECT_LABELS[aspect as MentoringAspect];
  }
  return aspect || 'Akademik';
}
