-- =============================================================================
-- Migration 0054: Komentar Perbaikan Biodata & Dokumen (Siswa, GTK, Orang Tua)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sdm_biodata_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('SISWA', 'GTK', 'ORANG_TUA')),
  entity_id UUID NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('BIODATA_FIELD', 'DOCUMENT_TYPE')),
  target_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVISED', 'RESOLVED')),
  comment TEXT NOT NULL,
  previous_value TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  revised_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdm_biodata_reviews_entity
  ON sdm_biodata_reviews (entity_type, entity_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sdm_biodata_reviews_active_unique
  ON sdm_biodata_reviews (entity_type, entity_id, target_kind, target_key)
  WHERE status IN ('OPEN', 'REVISED');

ALTER TABLE sdm_biodata_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sdm_biodata_reviews_service_role_all" ON sdm_biodata_reviews;
CREATE POLICY "sdm_biodata_reviews_service_role_all"
  ON sdm_biodata_reviews
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
