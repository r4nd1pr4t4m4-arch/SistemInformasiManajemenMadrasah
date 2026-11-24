-- ============================================================================
-- Migration 0046: Pengayaan Modul Persuratan & Arsip Digital (Fase 1)
-- ============================================================================

-- 1. Perluas kategori surat pada tabel letters agar mendukung kebutuhan administrasi madrasah/sekolah yang lengkap
ALTER TABLE letters DROP CONSTRAINT IF EXISTS letters_category_check;

ALTER TABLE letters
  ADD CONSTRAINT letters_category_check CHECK (
    category IN (
      'SURAT_KETERANGAN_AKTIF',
      'SURAT_MUTASI',
      'SURAT_TUGAS',
      'SURAT_UNDANGAN',
      'SURAT_EDARAN',
      'SURAT_KEPUTUSAN',
      'SURAT_REKOMENDASI',
      'SURAT_IZIN',
      'SURAT_PANGGILAN',
      'SURAT_PENGANTAR',
      'LAINNYA'
    )
  );

-- 2. Tambahkan kolom metadata tata naskah dinas & lampiran arsip
ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS classification_code TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'BIASA'
    CHECK (priority IN ('BIASA', 'PENTING', 'SEGERA', 'RAHASIA')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'TERBIT'
    CHECK (status IN ('DRAFT', 'TERBIT', 'DIARSIPKAN', 'DIBATALKAN')),
  ADD COLUMN IF NOT EXISTS signatory_name TEXT,
  ADD COLUMN IF NOT EXISTS signatory_title TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Indeks pencarian & filter arsip persuratan
CREATE INDEX IF NOT EXISTS idx_letters_direction_date
  ON letters(direction, letter_date DESC);

CREATE INDEX IF NOT EXISTS idx_letters_category
  ON letters(category);

CREATE INDEX IF NOT EXISTS idx_letters_student_id
  ON letters(student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_letters_teacher_id
  ON letters(teacher_id)
  WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_letters_letter_number
  ON letters(letter_number);

-- 4. Kebijakan RLS untuk pengelolaan & pembacaan arsip surat
DROP POLICY IF EXISTS "letters_select_authorized" ON letters;
CREATE POLICY "letters_select_authorized"
  ON letters FOR SELECT
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
      SELECT 1 FROM students s
      WHERE s.id = letters.student_id
        AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM teachers_staff t
      WHERE t.id = letters.teacher_id
        AND t.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "letters_manage_tu_admin" ON letters;
CREATE POLICY "letters_manage_tu_admin"
  ON letters FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_TU', 'STAF_TU')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_TU', 'STAF_TU')
    )
  );
