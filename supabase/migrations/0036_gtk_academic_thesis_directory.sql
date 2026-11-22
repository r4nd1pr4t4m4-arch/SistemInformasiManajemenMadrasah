-- ============================================================================
-- Migration 0036: Data Pendidikan Terakhir (Kampus & Tahun Lulus) & Karya Ilmiah / Skripsi GTK
-- ============================================================================

ALTER TABLE teachers_staff
  ADD COLUMN IF NOT EXISTS last_campus TEXT,
  ADD COLUMN IF NOT EXISTS graduation_year INT CHECK (graduation_year IS NULL OR (graduation_year >= 1950 AND graduation_year <= 2100)),
  ADD COLUMN IF NOT EXISTS thesis_title TEXT,
  ADD COLUMN IF NOT EXISTS thesis_abstract TEXT,
  ADD COLUMN IF NOT EXISTS thesis_keywords TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS thesis_article_url TEXT;
