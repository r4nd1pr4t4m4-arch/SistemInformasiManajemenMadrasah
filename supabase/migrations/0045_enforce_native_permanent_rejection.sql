-- 0045: Enforce Native DITOLAK_PERMANEN Status & Clean Legacy [TOLAK_PERMANEN] Prefix
-- Memastikan constraint database mendukung 'DITOLAK_PERMANEN' secara native
-- dan membersihkan prefix '[TOLAK_PERMANEN]' dari kolom rejection_reason pada data lama.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('PENDING', 'AKTIF', 'NONAKTIF', 'DITOLAK', 'DITOLAK_PERMANEN'));

UPDATE public.profiles
SET
  account_status = 'DITOLAK_PERMANEN',
  rejection_reason = NULLIF(TRIM(REGEXP_REPLACE(rejection_reason, '^\[TOLAK_PERMANEN\]\s*', '')), '')
WHERE rejection_reason LIKE '[TOLAK_PERMANEN]%';
