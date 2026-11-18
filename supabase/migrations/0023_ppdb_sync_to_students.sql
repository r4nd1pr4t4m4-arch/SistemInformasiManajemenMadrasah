-- ============================================================================
-- Migration 0023: Sinkronisasi Pendaftar PPDB & Mutasi Masuk (LULUS) ke Buku Induk Siswa
-- ============================================================================

ALTER TABLE ppdb_registrations
  ADD COLUMN IF NOT EXISTS synced_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ppdb_registrations_synced_student
  ON ppdb_registrations(synced_student_id);
