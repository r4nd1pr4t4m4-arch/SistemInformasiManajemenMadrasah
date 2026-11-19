-- ============================================================================
-- Migration 0033: Pengajuan Perubahan Foto Profil (Persetujuan Admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_avatar_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_avatar_url TEXT,
  new_avatar_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatar_change_requests_profile
  ON public.profile_avatar_change_requests(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatar_change_requests_status
  ON public.profile_avatar_change_requests(status);

-- Hanya boleh ada 1 pengajuan foto profil berstatus MENUNGGU per akun
CREATE UNIQUE INDEX IF NOT EXISTS idx_avatar_change_requests_one_pending
  ON public.profile_avatar_change_requests(profile_id)
  WHERE status = 'MENUNGGU';

ALTER TABLE public.profile_avatar_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avatar_change_requests_read_own" ON public.profile_avatar_change_requests;
CREATE POLICY "avatar_change_requests_read_own"
  ON public.profile_avatar_change_requests
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
