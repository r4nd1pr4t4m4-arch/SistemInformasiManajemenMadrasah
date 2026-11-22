-- ============================================================================
-- Migration 0035: Pengaturan Bobot Nilai Raport per Mapel & Tingkat Kelas
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_raport_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  weight_formatif NUMERIC(5,2) NOT NULL DEFAULT 25 CHECK (weight_formatif >= 0 AND weight_formatif <= 100),
  weight_sumatif NUMERIC(5,2) NOT NULL DEFAULT 25 CHECK (weight_sumatif >= 0 AND weight_sumatif <= 100),
  weight_sts NUMERIC(5,2) NOT NULL DEFAULT 25 CHECK (weight_sts >= 0 AND weight_sts <= 100),
  weight_sas NUMERIC(5,2) NOT NULL DEFAULT 25 CHECK (weight_sas >= 0 AND weight_sas <= 100),
  weight_praktik NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weight_praktik >= 0 AND weight_praktik <= 100),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, subject_id, grade_level)
);

ALTER TABLE assessment_raport_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessment_raport_weights_auth_read" ON assessment_raport_weights;
CREATE POLICY "assessment_raport_weights_auth_read"
  ON assessment_raport_weights FOR SELECT
  USING (auth.uid() IS NOT NULL);
