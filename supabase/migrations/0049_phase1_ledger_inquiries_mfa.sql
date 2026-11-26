-- =============================================================================
-- Migration 0049: Phase 1 Enrichment
-- 1. Document Verification Ledger (QR Authenticity for PDF Exports)
-- 2. Public Inquiry Ticket & Admin Response Columns
-- 3. User MFA Backup Recovery Codes
-- =============================================================================

-- 1. Ledger Verifikasi Dokumen Resmi (RKP, PNL, AGD, MUT, dll.)
CREATE TABLE IF NOT EXISTS public.document_verification_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_verif_ledger_ref
  ON public.document_verification_ledger (upper(reference_code));
CREATE INDEX IF NOT EXISTS idx_doc_verif_ledger_type
  ON public.document_verification_ledger (document_type, issued_at DESC);

ALTER TABLE public.document_verification_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_ledger_admin_all" ON public.document_verification_ledger;
CREATE POLICY "doc_ledger_admin_all"
  ON public.document_verification_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Pengayaan Tabel Inquiries (Tiket Pelacakan & Tanggapan Admin)
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS ticket_code TEXT,
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_ticket_code
  ON public.inquiries (ticket_code)
  WHERE ticket_code IS NOT NULL;

-- 3. Backup Recovery Codes MFA
CREATE TABLE IF NOT EXISTS public.user_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_user
  ON public.user_mfa_recovery_codes (user_id, used_at);

ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_recovery_service_all" ON public.user_mfa_recovery_codes;
CREATE POLICY "mfa_recovery_service_all"
  ON public.user_mfa_recovery_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
