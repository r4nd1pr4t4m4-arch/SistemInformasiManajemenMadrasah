-- ============================================================================
-- Migration 0021: Kelompok Saudara untuk Perhitungan SPP & Iuran Komite
-- Pola: N saudara aktif -> bayar untuk (N - 1) siswa, 1 siswa gratis (N >= 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sibling_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sibling_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES sibling_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  is_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sibling_group_members_group ON sibling_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sibling_group_members_student ON sibling_group_members(student_id);

ALTER TABLE student_bills
  ADD COLUMN IF NOT EXISTS sibling_group_id UUID REFERENCES sibling_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_sibling_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE sibling_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sibling_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sibling_groups_read_authenticated" ON sibling_groups;
CREATE POLICY "sibling_groups_read_authenticated"
  ON sibling_groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sibling_groups_manage_finance_admin" ON sibling_groups;
CREATE POLICY "sibling_groups_manage_finance_admin"
  ON sibling_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU', 'BENDAHARA_KOMITE')
    )
  );

DROP POLICY IF EXISTS "sibling_group_members_read_authenticated" ON sibling_group_members;
CREATE POLICY "sibling_group_members_read_authenticated"
  ON sibling_group_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sibling_group_members_manage_finance_admin" ON sibling_group_members;
CREATE POLICY "sibling_group_members_manage_finance_admin"
  ON sibling_group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU', 'BENDAHARA_KOMITE')
    )
  );
