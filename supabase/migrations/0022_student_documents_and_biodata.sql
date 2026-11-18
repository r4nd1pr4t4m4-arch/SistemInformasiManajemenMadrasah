-- ============================================================================
-- Migration 0022: Biodata Lengkap & Upload Scan Dokumen Pribadi Siswa
-- ============================================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS kk_number TEXT,
  ADD COLUMN IF NOT EXISTS birth_certificate_number TEXT,
  ADD COLUMN IF NOT EXISTS child_order INT,
  ADD COLUMN IF NOT EXISTS siblings_count INT,
  ADD COLUMN IF NOT EXISTS rt_rw TEXT,
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS previous_school TEXT,
  ADD COLUMN IF NOT EXISTS previous_school_npsn TEXT,
  ADD COLUMN IF NOT EXISTS kip_number TEXT,
  ADD COLUMN IF NOT EXISTS kis_number TEXT,
  ADD COLUMN IF NOT EXISTS kks_number TEXT,
  ADD COLUMN IF NOT EXISTS pkh_number TEXT,
  ADD COLUMN IF NOT EXISTS father_nik TEXT,
  ADD COLUMN IF NOT EXISTS mother_nik TEXT,
  ADD COLUMN IF NOT EXISTS guardian_nik TEXT,
  ADD COLUMN IF NOT EXISTS guardian_job TEXT;

CREATE TABLE IF NOT EXISTS student_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'KK',
      'AKTA_KELAHIRAN',
      'IJAZAH_MI_SD',
      'IJAZAH_RA_TK',
      'KTP_AYAH',
      'KTP_IBU',
      'KTP_WALI',
      'KIP',
      'BPJS_KIS',
      'KKS',
      'PKH',
      'LAINNYA'
    )
  ),
  document_title TEXT,
  document_number TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  object_key TEXT,
  mime_type TEXT,
  file_size BIGINT,
  verification_status TEXT NOT NULL DEFAULT 'MENUNGGU'
    CHECK (verification_status IN ('MENUNGGU', 'TERVERIFIKASI', 'DITOLAK')),
  verification_notes TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_documents_unique_type
  ON student_documents(student_id, document_type)
  WHERE document_type <> 'LAINNYA';

ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_documents_read_owner_or_staff" ON student_documents;
CREATE POLICY "student_documents_read_owner_or_staff"
  ON student_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_documents.student_id
        AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU', 'WAKA_KESISWAAN')
    )
  );

DROP POLICY IF EXISTS "student_documents_manage_owner_or_staff" ON student_documents;
CREATE POLICY "student_documents_manage_owner_or_staff"
  ON student_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_documents.student_id
        AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU', 'WAKA_KESISWAAN')
    )
  );
