-- =============================================================================
-- Migration 0057: Ikat Seluruh Data BK ke Tahun Pelajaran (academic_years)
-- - Menambahkan kolom academic_year_id pada:
--   1. public.bk_records
--   2. public.bk_rule_catalog
--   3. public.bk_counseling_bookings
--   4. public.bk_home_visits
-- - Backfill data eksisting ke tahun pelajaran aktif saat ini
-- =============================================================================

-- 1. bk_records
ALTER TABLE public.bk_records
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bk_records_academic_year_id
  ON public.bk_records(academic_year_id);

UPDATE public.bk_records
SET academic_year_id = (
  SELECT id FROM public.academic_years WHERE is_active = true ORDER BY created_at DESC LIMIT 1
)
WHERE academic_year_id IS NULL;

-- 2. bk_rule_catalog
ALTER TABLE public.bk_rule_catalog
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bk_rule_catalog_academic_year_id
  ON public.bk_rule_catalog(academic_year_id);

UPDATE public.bk_rule_catalog
SET academic_year_id = (
  SELECT id FROM public.academic_years WHERE is_active = true ORDER BY created_at DESC LIMIT 1
)
WHERE academic_year_id IS NULL;

ALTER TABLE public.bk_rule_catalog
  DROP CONSTRAINT IF EXISTS bk_rule_catalog_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bk_rule_catalog_year_code_unique
  ON public.bk_rule_catalog(academic_year_id, code);

-- 3. bk_counseling_bookings
ALTER TABLE public.bk_counseling_bookings
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bk_counseling_bookings_academic_year_id
  ON public.bk_counseling_bookings(academic_year_id);

UPDATE public.bk_counseling_bookings
SET academic_year_id = (
  SELECT id FROM public.academic_years WHERE is_active = true ORDER BY created_at DESC LIMIT 1
)
WHERE academic_year_id IS NULL;

-- 4. bk_home_visits
ALTER TABLE public.bk_home_visits
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bk_home_visits_academic_year_id
  ON public.bk_home_visits(academic_year_id);

UPDATE public.bk_home_visits
SET academic_year_id = (
  SELECT id FROM public.academic_years WHERE is_active = true ORDER BY created_at DESC LIMIT 1
)
WHERE academic_year_id IS NULL;
