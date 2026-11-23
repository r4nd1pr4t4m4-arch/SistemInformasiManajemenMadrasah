-- ============================================================================
-- Migration 0041: Guru Wali Setoran Hafalan & Master Daftar Hafalan
-- ============================================================================

-- 1. Perluas constraint aspek pada guru_wali_mentoring_logs agar mendukung SETORAN_HAFALAN
ALTER TABLE guru_wali_mentoring_logs
  DROP CONSTRAINT IF EXISTS guru_wali_mentoring_logs_aspect_check;

ALTER TABLE guru_wali_mentoring_logs
  ADD CONSTRAINT guru_wali_mentoring_logs_aspect_check
  CHECK (
    aspect IN (
      'AKADEMIK',
      'IBADAH_KARAKTER',
      'SETORAN_HAFALAN',
      'SOSIAL',
      'KESEHATAN',
      'LAINNYA'
    )
  );

-- 2. Tabel Master Daftar Hafalan untuk dropdown Topik pada Aspek Setoran Hafalan
CREATE TABLE IF NOT EXISTS guru_wali_hafalan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guru_wali_hafalan_active_sort
  ON guru_wali_hafalan_items (is_active, sort_order, title);

ALTER TABLE guru_wali_hafalan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active hafalan items" ON guru_wali_hafalan_items;
CREATE POLICY "Authenticated users can read active hafalan items"
  ON guru_wali_hafalan_items
  FOR SELECT
  TO authenticated
  USING (TRUE);
