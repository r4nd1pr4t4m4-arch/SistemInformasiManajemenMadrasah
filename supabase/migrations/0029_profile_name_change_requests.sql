-- ============================================================================
-- Migration 0029: Permintaan Perubahan Nama Lengkap (Persetujuan Admin, 1x / 30 hari)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_name_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_full_name TEXT NOT NULL,
  new_full_name TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_name_change_requests_profile
  ON profile_name_change_requests(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_name_change_requests_status
  ON profile_name_change_requests(status);

-- Hanya boleh ada 1 permintaan MENUNGGU per akun
CREATE UNIQUE INDEX IF NOT EXISTS idx_name_change_requests_one_pending
  ON profile_name_change_requests(profile_id)
  WHERE status = 'MENUNGGU';

ALTER TABLE profile_name_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "name_change_requests_read_own" ON profile_name_change_requests;
CREATE POLICY "name_change_requests_read_own"
  ON profile_name_change_requests FOR SELECT
  USING (profile_id = auth.uid());
