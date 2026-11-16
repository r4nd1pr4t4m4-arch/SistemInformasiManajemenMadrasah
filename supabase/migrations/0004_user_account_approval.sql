-- SIMMS Migration 0004: Persetujuan Akun Pengguna Baru & Status Aktivasi
-- Jalankan file ini di Supabase SQL Editor.

-- 1. Tambah kolom status persetujuan akun pada public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'AKTIF'
    CHECK (account_status IN ('PENDING', 'AKTIF', 'NONAKTIF', 'DITOLAK')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Sinkronkan data lama: jika is_active = false maka NONAKTIF, selain itu AKTIF
UPDATE public.profiles
SET account_status = CASE WHEN is_active THEN 'AKTIF' ELSE 'NONAKTIF' END
WHERE account_status IS NULL OR account_status = 'AKTIF';

-- 2. Perbarui trigger handle_new_user agar pendaftar baru berstatus PENDING & belum aktif
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, primary_role, is_active, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'UMUM',
    FALSE,
    'PENDING'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'UMUM')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
