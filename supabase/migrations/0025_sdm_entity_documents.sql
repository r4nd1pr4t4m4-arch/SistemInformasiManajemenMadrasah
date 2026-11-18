-- ============================================================================
-- Migration 0025: Dokumen GTK & Orang Tua/Wali Siswa untuk Subhalaman Detail SDM
-- ============================================================================

CREATE TABLE IF NOT EXISTS sdm_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('GTK', 'ORANG_TUA')),
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_title TEXT,
  document_number TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  object_key TEXT,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdm_documents_entity
  ON sdm_documents(entity_type, entity_id);

ALTER TABLE sdm_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sdm_documents_manage_sdm_roles" ON sdm_documents;
CREATE POLICY "sdm_documents_manage_sdm_roles"
  ON sdm_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WAKA_HUMAS'
        )
    )
  );
