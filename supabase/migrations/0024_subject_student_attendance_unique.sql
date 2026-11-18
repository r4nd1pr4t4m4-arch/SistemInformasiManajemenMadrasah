-- ============================================================================
-- Migration 0024: Indeks Unik Absensi Siswa Harian & Per Mata Pelajaran
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_attendances_daily_unique
  ON student_attendances(student_id, attendance_date)
  WHERE schedule_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_attendances_subject_unique
  ON student_attendances(student_id, schedule_id, attendance_date)
  WHERE schedule_id IS NOT NULL;
