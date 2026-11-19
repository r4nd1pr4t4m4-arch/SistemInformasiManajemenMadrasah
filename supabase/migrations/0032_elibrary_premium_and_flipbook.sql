-- 0032_elibrary_premium_and_flipbook.sql
-- Fitur Buku Premium E-Library & Izin Akses Berdurasi dari Admin

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_pages INT NOT NULL DEFAULT 20;

CREATE TABLE IF NOT EXISTS public.ebook_access_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_hours INT NOT NULL CHECK (duration_hours > 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebook_access_grants_user_book
  ON public.ebook_access_grants(user_id, book_id, expires_at);

ALTER TABLE public.ebook_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ebook_grants_read_own_or_admin" ON public.ebook_access_grants;
CREATE POLICY "ebook_grants_read_own_or_admin"
  ON public.ebook_access_grants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'PUSTAKAWAN')
    )
  );

DROP POLICY IF EXISTS "ebook_grants_manage_admin" ON public.ebook_access_grants;
CREATE POLICY "ebook_grants_manage_admin"
  ON public.ebook_access_grants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_TU', 'PUSTAKAWAN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('SUPERADMIN', 'OPERATOR', 'KEPALA_TU', 'PUSTAKAWAN')
    )
  );
