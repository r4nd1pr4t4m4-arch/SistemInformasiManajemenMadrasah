-- ============================================================================
-- Migration 0027: Penempatan Siswa ke Ruang Ujian per Periode Ujian
-- (Terpisah dari Rombel / student_enrollments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS exam_room_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_period_id UUID NOT NULL REFERENCES exam_periods(id) ON DELETE CASCADE,
  exam_room_id UUID NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  seat_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_period_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_room_students_period
  ON exam_room_students(exam_period_id);

CREATE INDEX IF NOT EXISTS idx_exam_room_students_room
  ON exam_room_students(exam_room_id);

ALTER TABLE exam_room_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_room_students_read_all" ON exam_room_students;
CREATE POLICY "exam_room_students_read_all"
  ON exam_room_students FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "exam_room_students_manage_roles" ON exam_room_students;
CREATE POLICY "exam_room_students_manage_roles"
  ON exam_room_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_KURIKULUM',
          'KEPALA_TU',
          'STAF_TU'
        )
    )
  );
