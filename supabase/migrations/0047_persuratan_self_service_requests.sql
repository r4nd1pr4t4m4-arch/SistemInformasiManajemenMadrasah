-- ============================================================================
-- Migration 0047: Layanan Mandiri (Self-Service) Pengajuan Surat & Alur Approval (Fase 3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS letter_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number TEXT UNIQUE NOT NULL,
  requester_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requester_role TEXT NOT NULL CHECK (
    requester_role IN ('SISWA', 'ORANG_TUA', 'GTK', 'ALUMNI', 'UMUM', 'ADMIN')
  ),
  requester_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
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
  ),
  subject TEXT NOT NULL,
  purpose TEXT NOT NULL,
  counterparty TEXT,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers_staff(id) ON DELETE SET NULL,
  leave_type TEXT CHECK (leave_type IN ('SAKIT', 'IZIN', 'DISPENSASI')),
  leave_start_date DATE,
  leave_end_date DATE,
  attachment_url TEXT,
  attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'DIAJUKAN' CHECK (
    status IN ('DIAJUKAN', 'DIVERIFIKASI_TU', 'DISETUJUI', 'DITOLAK')
  ),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  issued_letter_id UUID REFERENCES letters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_letter_requests_status_created
  ON letter_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_letter_requests_requester
  ON letter_requests(requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_letter_requests_student
  ON letter_requests(student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_letter_requests_teacher
  ON letter_requests(teacher_id)
  WHERE teacher_id IS NOT NULL;

ALTER TABLE letter_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "letter_requests_select_own_or_admin" ON letter_requests;
CREATE POLICY "letter_requests_select_own_or_admin"
  ON letter_requests FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid()
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
          'WAKA_HUMAS'
        )
    )
    OR EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = letter_requests.student_id
        AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = letter_requests.student_id
        AND sg.profile_id = auth.uid()
        AND sg.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM teachers_staff t
      WHERE t.id = letter_requests.teacher_id
        AND t.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "letter_requests_insert_authenticated" ON letter_requests;
CREATE POLICY "letter_requests_insert_authenticated"
  ON letter_requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "letter_requests_manage_admin_tu" ON letter_requests;
CREATE POLICY "letter_requests_manage_admin_tu"
  ON letter_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU')
    )
  );
