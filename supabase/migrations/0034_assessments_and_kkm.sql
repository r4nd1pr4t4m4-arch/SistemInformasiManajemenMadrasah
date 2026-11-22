-- ============================================================================
-- Migration 0034: Modul Penilaian (Formatif BAB, Sumatif LM, STS, SAS, Praktik) & KKM
-- ============================================================================

-- 1. Pengaturan Mode KKM per Tahun Ajaran / Semester Aktif
CREATE TABLE IF NOT EXISTS kkm_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL UNIQUE REFERENCES academic_years(id) ON DELETE CASCADE,
  active_mode TEXT NOT NULL DEFAULT 'PER_GRADE' CHECK (active_mode IN ('PER_GRADE', 'PER_SUBJECT_GRADE')),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Aturan Nilai Minimal Ketuntasan (KKM)
CREATE TABLE IF NOT EXISTS kkm_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  min_score NUMERIC(5,2) NOT NULL DEFAULT 75 CHECK (min_score >= 0 AND min_score <= 100),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kkm_rules_per_grade
  ON kkm_rules(academic_year_id, grade_level)
  WHERE subject_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kkm_rules_per_subject_grade
  ON kkm_rules(academic_year_id, grade_level, subject_id)
  WHERE subject_id IS NOT NULL;

-- 3. Submenu BAB untuk Formatif (Lingkup BAB) per Mapel & Tingkat Kelas
CREATE TABLE IF NOT EXISTS assessment_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  chapter_number INT NOT NULL CHECK (chapter_number >= 1),
  title TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, subject_id, grade_level, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_assessment_chapters_lookup
  ON assessment_chapters(academic_year_id, subject_id, grade_level, sort_order);

-- 4. Kolom Penilaian Dinamis (Formatif TP, Sumatif LM, Praktik)
CREATE TABLE IF NOT EXISTS assessment_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('FORMATIF', 'SUMATIF', 'PRAKTIK')),
  chapter_id UUID REFERENCES assessment_chapters(id) ON DELETE CASCADE,
  naming_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (naming_mode IN ('AUTO', 'CUSTOM')),
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (category = 'FORMATIF' AND chapter_id IS NOT NULL)
    OR (category IN ('SUMATIF', 'PRAKTIK') AND chapter_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_assessment_columns_lookup
  ON assessment_columns(academic_year_id, subject_id, grade_level, category, chapter_id, sort_order);

-- 5. Nilai Siswa untuk Kolom Dinamis (Formatif, Sumatif, Praktik)
CREATE TABLE IF NOT EXISTS assessment_column_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  column_id UUID NOT NULL REFERENCES assessment_columns(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  score NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (column_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_column_scores_student
  ON assessment_column_scores(student_id, classroom_id);

-- 6. Pengaturan Kolom Opsional STS & SAS (Remedial, Pengayaan, Catatan)
CREATE TABLE IF NOT EXISTS assessment_exam_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('STS', 'SAS')),
  enable_remedial BOOLEAN NOT NULL DEFAULT FALSE,
  enable_enrichment BOOLEAN NOT NULL DEFAULT FALSE,
  enable_notes BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, subject_id, grade_level, exam_type)
);

-- 7. Nilai Siswa untuk STS & SAS
CREATE TABLE IF NOT EXISTS assessment_exam_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('STS', 'SAS')),
  score NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  remedial_score NUMERIC(5,2) CHECK (remedial_score >= 0 AND remedial_score <= 100),
  enrichment_score NUMERIC(5,2) CHECK (enrichment_score >= 0 AND enrichment_score <= 100),
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, subject_id, classroom_id, student_id, exam_type)
);

CREATE INDEX IF NOT EXISTS idx_assessment_exam_scores_lookup
  ON assessment_exam_scores(academic_year_id, subject_id, classroom_id, exam_type);
CREATE INDEX IF NOT EXISTS idx_assessment_exam_scores_student
  ON assessment_exam_scores(student_id);

-- Enable RLS
ALTER TABLE kkm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kkm_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_column_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_exam_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_exam_scores ENABLE ROW LEVEL SECURITY;

-- Basic read policies (API routes use service role with strict RBAC)
DROP POLICY IF EXISTS "kkm_settings_auth_read" ON kkm_settings;
CREATE POLICY "kkm_settings_auth_read" ON kkm_settings FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "kkm_rules_auth_read" ON kkm_rules;
CREATE POLICY "kkm_rules_auth_read" ON kkm_rules FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_chapters_auth_read" ON assessment_chapters;
CREATE POLICY "assessment_chapters_auth_read" ON assessment_chapters FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_columns_auth_read" ON assessment_columns;
CREATE POLICY "assessment_columns_auth_read" ON assessment_columns FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_column_scores_auth_read" ON assessment_column_scores;
CREATE POLICY "assessment_column_scores_auth_read" ON assessment_column_scores FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_exam_configs_auth_read" ON assessment_exam_configs;
CREATE POLICY "assessment_exam_configs_auth_read" ON assessment_exam_configs FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_exam_scores_auth_read" ON assessment_exam_scores;
CREATE POLICY "assessment_exam_scores_auth_read" ON assessment_exam_scores FOR SELECT USING (auth.uid() IS NOT NULL);
