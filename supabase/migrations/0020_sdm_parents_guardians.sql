-- ============================================================================
-- Migration 0020: Manajemen SDM - Tabel Orang Tua / Wali Siswa
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_guardians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  relationship TEXT NOT NULL DEFAULT 'WALI' CHECK (relationship IN ('AYAH', 'IBU', 'WALI')),
  full_name TEXT NOT NULL,
  nik TEXT,
  phone TEXT,
  email TEXT,
  occupation TEXT,
  address TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_profile ON student_guardians(profile_id);

ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_guardians_read_staff_or_owner" ON student_guardians;
CREATE POLICY "student_guardians_read_staff_or_owner"
  ON student_guardians FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU', 'WAKA_KURIKULUM', 'WAKA_KESISWAAN', 'WAKA_HUMAS', 'GURU')
    )
  );

DROP POLICY IF EXISTS "student_guardians_manage_admin" ON student_guardians;
CREATE POLICY "student_guardians_manage_admin"
  ON student_guardians FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU', 'WAKA_KESISWAAN')
    )
  );
