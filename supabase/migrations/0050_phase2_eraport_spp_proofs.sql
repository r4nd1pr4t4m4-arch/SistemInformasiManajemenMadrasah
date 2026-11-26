-- =============================================================================
-- Migration 0050: Phase 2 Enrichment
-- 1. Consolidated Student Report Cards (Non-academic & Promotion Metadata)
-- 2. SPP Self-Service Payment Proofs (Parent/Student Transfer Verification)
-- =============================================================================

-- 1. Metadata E-Raport Konsolidasi per Siswa per Tahun Ajaran
CREATE TABLE IF NOT EXISTS public.student_report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  attitude_spiritual TEXT,
  attitude_social TEXT,
  p5_summary TEXT,
  extracurricular_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements_notes TEXT,
  homeroom_notes TEXT,
  promotion_status TEXT NOT NULL DEFAULT 'MENUNGGU'
    CHECK (promotion_status IN ('MENUNGGU', 'NAIK_KELAS', 'TINGGAL_KELAS', 'LULUS', 'TIDAK_LULUS')),
  next_grade_label TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_report_cards_year_class
  ON public.student_report_cards (academic_year_id, classroom_id);

ALTER TABLE public.student_report_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_report_cards_service_all" ON public.student_report_cards;
CREATE POLICY "student_report_cards_service_all"
  ON public.student_report_cards
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Bukti Transfer Mandiri Pembayaran SPP / Komite (Orang Tua & Siswa)
CREATE TABLE IF NOT EXISTS public.spp_payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.student_bills(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_claimed NUMERIC(12, 2) NOT NULL CHECK (amount_claimed > 0),
  payment_method TEXT NOT NULL DEFAULT 'TRANSFER' CHECK (payment_method IN ('TRANSFER', 'QRIS')),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  proof_file_url TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI'
    CHECK (status IN ('MENUNGGU_VERIFIKASI', 'DISETUJUI', 'DITOLAK')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spp_payment_proofs_status
  ON public.spp_payment_proofs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spp_payment_proofs_student
  ON public.spp_payment_proofs (student_id, created_at DESC);

ALTER TABLE public.spp_payment_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spp_payment_proofs_service_all" ON public.spp_payment_proofs;
CREATE POLICY "spp_payment_proofs_service_all"
  ON public.spp_payment_proofs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
