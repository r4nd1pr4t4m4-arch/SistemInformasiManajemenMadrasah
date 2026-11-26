-- =============================================================================
-- Migration 0051: Phase 3 Enrichment
-- 1. BK: Rule Catalog, Counseling Bookings, Home Visits
-- 2. Guru Wali & Tahfidz: Quality scores, Parent Feedback, Tahfidz Progress
-- 3. Extracurriculars & Student Portfolios
-- 4. Library DDC/Shelf & E-Book Requests + Persuratan Custom Templates
-- 5. Finance: BOS/RKAS Budget Plans & General Cashbook (BKU)
-- 6. SDM GTK: Leaves, PKG/Supervision/Training Evaluations
-- =============================================================================

-- 1. BK
CREATE TABLE IF NOT EXISTS public.bk_rule_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('PELANGGARAN', 'PRESTASI')),
  title TEXT NOT NULL,
  default_points INT NOT NULL DEFAULT 5,
  sanction_hint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_counseling_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  counselor_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  preferred_date DATE NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU'
    CHECK (status IN ('MENUNGGU', 'DIJADWALKAN', 'SELESAI', 'DIBATALKAN')),
  counselor_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_home_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  counselor_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visited_address TEXT,
  met_with TEXT,
  summary TEXT NOT NULL,
  follow_up TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Guru Wali & Tahfidz
ALTER TABLE public.guru_wali_mentoring_logs
  ADD COLUMN IF NOT EXISTS hafalan_fluency TEXT,
  ADD COLUMN IF NOT EXISTS hafalan_tajwid_score INT,
  ADD COLUMN IF NOT EXISTS parent_feedback TEXT,
  ADD COLUMN IF NOT EXISTS parent_signed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.tahfidz_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  surah_or_juz TEXT NOT NULL,
  target_semester TEXT,
  status TEXT NOT NULL DEFAULT 'PROSES' CHECK (status IN ('BELUM', 'PROSES', 'TUNTAS')),
  fluency TEXT DEFAULT 'LANCAR' CHECK (fluency IN ('LANCAR', 'CUKUP', 'MURAJAAH')),
  tajwid_score INT CHECK (tajwid_score IS NULL OR (tajwid_score >= 0 AND tajwid_score <= 100)),
  tasmi_score INT CHECK (tasmi_score IS NULL OR (tasmi_score >= 0 AND tasmi_score <= 100)),
  tasmi_date DATE,
  examiner_name TEXT,
  notes TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, surah_or_juz)
);

-- 3. Ekstrakurikuler & Portofolio Prestasi
CREATE TABLE IF NOT EXISTS public.extracurriculars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'UMUM',
  coach_teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  schedule_info TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extracurricular_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extracurricular_id UUID NOT NULL REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  grade TEXT DEFAULT 'Baik',
  attendance_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (extracurricular_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.student_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'AKADEMIK',
  level TEXT NOT NULL DEFAULT 'KABUPATEN',
  achieved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  organizer TEXT,
  certificate_url TEXT,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Perpustakaan DDC/Rak, Permintaan E-Book Premium & Template Persuratan
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS ddc_code TEXT,
  ADD COLUMN IF NOT EXISTS shelf_location TEXT;

CREATE TABLE IF NOT EXISTS public.ebook_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.letter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'SURAT_KETERANGAN_AKTIF',
  classification_code TEXT DEFAULT 'PP.00.6',
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Keuangan Lembaga: RKAS/BOS & Buku Kas Umum (BKU)
CREATE TABLE IF NOT EXISTS public.budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INT NOT NULL,
  funding_source TEXT NOT NULL DEFAULT 'BOS' CHECK (funding_source IN ('BOS', 'KOMITE', 'YAYASAN', 'LAINNYA')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  allocated_amount NUMERIC(14, 2) NOT NULL CHECK (allocated_amount >= 0),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('MASUK', 'KELUAR')),
  funding_source TEXT NOT NULL DEFAULT 'BOS' CHECK (funding_source IN ('BOS', 'KOMITE', 'YAYASAN', 'LAINNYA')),
  budget_plan_id UUID REFERENCES public.budget_plans(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  reference_no TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SDM GTK Modern: Cuti & PKG/Supervisi/Diklat
CREATE TABLE IF NOT EXISTS public.gtk_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'TAHUNAN'
    CHECK (leave_type IN ('TAHUNAN', 'SAKIT', 'MELAHIRKAN', 'DINAS', 'LAINNYA')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gtk_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL DEFAULT 'PKG'
    CHECK (record_type IN ('PKG', 'SUPERVISI', 'DIKLAT', 'SERTIFIKASI')),
  title TEXT NOT NULL,
  period_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
  score NUMERIC(5, 2),
  organizer TEXT,
  certificate_url TEXT,
  notes TEXT,
  evaluated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (service_role full access pattern consistent with SIMMS)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bk_rule_catalog', 'bk_counseling_bookings', 'bk_home_visits',
    'tahfidz_progress', 'extracurriculars', 'extracurricular_members',
    'student_portfolios', 'ebook_access_requests', 'letter_templates',
    'budget_plans', 'cashbook_entries', 'gtk_leaves', 'gtk_evaluations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_service_all" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_service_all" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      tbl, tbl
    );
  END LOOP;
END $$;
