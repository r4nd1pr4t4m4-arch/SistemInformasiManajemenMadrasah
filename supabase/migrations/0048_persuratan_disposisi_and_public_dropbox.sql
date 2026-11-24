-- ============================================================================
-- Migration 0048: Disposisi Surat Masuk Digital & Drop-Box Surat Masuk Publik (Fase 4)
-- ============================================================================

-- 1. Tambahkan kolom tiket resi & kontak pengirim eksternal pada tabel letters
ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS receipt_ticket TEXT,
  ADD COLUMN IF NOT EXISTS sender_contact TEXT;

CREATE INDEX IF NOT EXISTS idx_letters_receipt_ticket
  ON letters(receipt_ticket)
  WHERE receipt_ticket IS NOT NULL;

-- 2. Tabel Disposisi Surat Masuk Digital
CREATE TABLE IF NOT EXISTS letter_dispositions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  assigned_to_teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by_name TEXT,
  instruction TEXT NOT NULL,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'BIASA' CHECK (
    priority IN ('BIASA', 'PENTING', 'SEGERA', 'RAHASIA')
  ),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'DITERUSKAN' CHECK (
    status IN ('DITERUSKAN', 'DIBACA', 'DITINDAKLANJUTI', 'SELESAI')
  ),
  completion_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_letter_dispositions_letter
  ON letter_dispositions(letter_id);

CREATE INDEX IF NOT EXISTS idx_letter_dispositions_assignee
  ON letter_dispositions(assigned_to_teacher_id, status, created_at DESC);

ALTER TABLE letter_dispositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "letter_dispositions_select_involved_or_admin" ON letter_dispositions;
CREATE POLICY "letter_dispositions_select_involved_or_admin"
  ON letter_dispositions FOR SELECT
  TO authenticated
  USING (
    assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM teachers_staff t
      WHERE t.id = letter_dispositions.assigned_to_teacher_id
        AND t.profile_id = auth.uid()
    )
    OR EXISTS (
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
          'WAKA_HUMAS',
          'WAKA_SARPRAS'
        )
    )
  );

DROP POLICY IF EXISTS "letter_dispositions_manage_admin_kamad" ON letter_dispositions;
CREATE POLICY "letter_dispositions_manage_admin_kamad"
  ON letter_dispositions FOR ALL
  TO authenticated
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
          'WAKA_HUMAS',
          'WAKA_SARPRAS'
        )
    )
    OR EXISTS (
      SELECT 1 FROM teachers_staff t
      WHERE t.id = letter_dispositions.assigned_to_teacher_id
        AND t.profile_id = auth.uid()
    )
  )
  WITH CHECK (
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
          'WAKA_HUMAS',
          'WAKA_SARPRAS'
        )
    )
    OR EXISTS (
      SELECT 1 FROM teachers_staff t
      WHERE t.id = letter_dispositions.assigned_to_teacher_id
        AND t.profile_id = auth.uid()
    )
  );
