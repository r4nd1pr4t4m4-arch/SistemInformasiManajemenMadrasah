-- SIMMS Migration 0002: Auth Trigger untuk Profiles & Row Level Security (RLS)
-- Jalankan file ini di Supabase SQL Editor sebelum Go-Live.

-- 1. Otomatis membuat baris di public.profiles saat user baru mendaftar di auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, primary_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'UMUM'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'UMUM')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Aktifkan Row Level Security (RLS) pada tabel-tabel sensitif
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_honorariums ENABLE ROW LEVEL SECURITY;
ALTER TABLE bk_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru_wali_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru_wali_mentoring_logs ENABLE ROW LEVEL SECURITY;

-- Policy dasar: user login dapat membaca profil & perannya sendiri
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Catatan:
-- Seluruh operasi tulis & baca lintas-data pada API Next.js menggunakan service_role
-- setelah melewati verifikasi RBAC (requireApiRoles) di server.
-- Dengan RLS aktif tanpa policy anon, akses langsung via anon key ke tabel sensitif otomatis ditolak.

-- Contoh query untuk menjadikan akun pertama Anda sebagai SUPERADMIN (ganti email-nya):
-- UPDATE public.profiles SET primary_role = 'SUPERADMIN' WHERE email = 'admin@lembaga.sch.id';
-- INSERT INTO public.user_roles (user_id, role)
--   SELECT id, 'SUPERADMIN'::app_role FROM public.profiles WHERE email = 'admin@lembaga.sch.id'
--   ON CONFLICT DO NOTHING;
