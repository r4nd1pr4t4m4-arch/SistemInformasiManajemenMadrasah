-- Cegah guru yang sama diberikan tugas tambahan yang sama pada semester & tahun ajaran yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_additional_duties_unique_active_period
  ON teacher_additional_duties (teacher_id, duty_type_id, academic_year_id)
  WHERE is_active = TRUE AND academic_year_id IS NOT NULL;
