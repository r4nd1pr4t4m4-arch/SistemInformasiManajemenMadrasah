-- SIMMS Migration 0026: Dukungan Status Ditolak Permanen (DITOLAK_PERMANEN)
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('PENDING', 'AKTIF', 'NONAKTIF', 'DITOLAK', 'DITOLAK_PERMANEN'));
