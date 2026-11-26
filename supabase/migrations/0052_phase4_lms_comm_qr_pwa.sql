-- =============================================================================
-- Migration 0052: Phase 4 Enrichment
-- 1. LMS Ringan & CBT (Materials, Assignments, Submissions, Quizzes, Attempts)
-- 2. Komunikasi Dua Arah, Izin Cepat Orang Tua & WhatsApp Gateway Config
-- 3. Presensi QR Gerbang (Gate Scan Logs)
-- =============================================================================

-- 1. LMS Ringan & CBT
CREATE TABLE IF NOT EXISTS public.lms_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  chapter_label TEXT,
  material_type TEXT NOT NULL DEFAULT 'MODUL_PDF'
    CHECK (material_type IN ('MODUL_PDF', 'VIDEO', 'LINK', 'CATATAN')),
  file_url TEXT,
  content TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  max_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.lms_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submission_text TEXT,
  attachment_url TEXT,
  score NUMERIC(5, 2),
  teacher_feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.lms_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes >= 5 AND duration_minutes <= 180),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  correct_count INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

-- 2. Komunikasi Dua Arah, Izin Cepat Orang Tua & WhatsApp Gateway
CREATE TABLE IF NOT EXISTS public.parent_teacher_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL DEFAULT 'WALI_KELAS'
    CHECK (recipient_role IN ('WALI_KELAS', 'GURU_WALI', 'GURU_BK')),
  recipient_teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  reply_text TEXT,
  replied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'TERKIRIM' CHECK (status IN ('TERKIRIM', 'DIBALAS', 'SELESAI')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL DEFAULT CURRENT_DATE,
  leave_type TEXT NOT NULL DEFAULT 'SAKIT' CHECK (leave_type IN ('SAKIT', 'IZIN')),
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_gateway_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'DISABLED' CHECK (provider IN ('DISABLED', 'FONNTE', 'WABLAS', 'WA_CLOUD')),
  api_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  notify_alpha BOOLEAN NOT NULL DEFAULT true,
  notify_spp BOOLEAN NOT NULL DEFAULT true,
  notify_ppdb BOOLEAN NOT NULL DEFAULT true,
  notify_qr_arrival BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Presensi QR Gerbang
CREATE TABLE IF NOT EXISTS public.qr_gate_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT NOT NULL CHECK (person_type IN ('SISWA', 'GTK')),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL DEFAULT 'MASUK' CHECK (scan_type IN ('MASUK', 'PULANG')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_qr_gate_logs_scanned_at
  ON public.qr_gate_logs (scanned_at DESC);

-- Enable RLS
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'lms_materials', 'lms_assignments', 'lms_submissions', 'lms_quizzes', 'lms_quiz_attempts',
    'parent_teacher_messages', 'student_leave_requests', 'whatsapp_gateway_settings', 'qr_gate_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_service_all" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_service_all" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      tbl, tbl
    );
  END LOOP;
END $$;
