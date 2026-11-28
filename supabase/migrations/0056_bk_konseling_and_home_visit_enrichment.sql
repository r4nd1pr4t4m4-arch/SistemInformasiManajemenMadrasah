-- =============================================================================
-- Migration 0056: BK Konseling & Home Visit Enrichment
-- - Tipe Konseling, Kategori Topik Konseling, BAP Laporan & Bukti Foto (max 5)
-- - Home Visit: Peserta yang ikut kegiatan & Bukti Foto Kunjungan (max 5)
-- =============================================================================

ALTER TABLE public.bk_counseling_bookings
  ADD COLUMN IF NOT EXISTS counseling_type TEXT,
  ADD COLUMN IF NOT EXISTS counseling_type_other TEXT,
  ADD COLUMN IF NOT EXISTS topic_category TEXT,
  ADD COLUMN IF NOT EXISTS topic_other TEXT,
  ADD COLUMN IF NOT EXISTS bap_summary TEXT,
  ADD COLUMN IF NOT EXISTS bap_follow_up TEXT,
  ADD COLUMN IF NOT EXISTS evidence_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.bk_home_visits
  ADD COLUMN IF NOT EXISTS participants TEXT,
  ADD COLUMN IF NOT EXISTS evidence_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
