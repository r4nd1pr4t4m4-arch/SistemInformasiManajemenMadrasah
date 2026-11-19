-- ============================================================================
-- Migration 0028: Kolom Alamat Terstruktur untuk teachers_staff & student_guardians
-- (Provinsi, Kab/Kota, Kecamatan, Kelurahan/Desa, RT/RW)
-- ============================================================================

ALTER TABLE teachers_staff
  ADD COLUMN IF NOT EXISTS rt_rw TEXT,
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS rt_rw TEXT,
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;
