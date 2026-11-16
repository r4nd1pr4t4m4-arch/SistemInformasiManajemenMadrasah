-- SIMMS (Sistem Informasi Manajemen Madrasah / Sekolah)
-- Complete Initial PostgreSQL Schema for Supabase
-- Covers:
-- 1. Core Identity, Institution Settings (Fleksibel Madrasah/Sekolah) & Multi-Role RBAC
-- 2. Website Resmi & CMS (Profil, Berita/Blog, Galeri, Direktori, PPDB Online, Kontak/FAQ)
-- 3. Portal Akademik (Buku Induk, Kelas & Jadwal, Piket, Presensi + Geofencing + Delegasi, Ujian + JTM Pengawas/Panitia)
-- 4. Administrasi, Keuangan & Layanan (SPP/Komite, Tabungan Umum/Warga, Honorarium JTM & Tunjangan, Persuratan, E-Library, BK, Guru Wali, Tracer Study)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE IDENTITY, INSTITUTION SETTINGS & RBAC
-- ============================================================================

CREATE TYPE institution_type AS ENUM ('MADRASAH', 'SEKOLAH');

CREATE TYPE app_role AS ENUM (
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_KESISWAAN',
  'WAKA_KURIKULUM',
  'WAKA_HUMAS',
  'WAKA_SARPRAS',
  'KEPALA_TU',
  'STAF_TU',
  'GURU',
  'WALI_KELAS',
  'GURU_WALI',
  'GURU_BK',
  'BENDAHARA',
  'BENDAHARA_KOMITE',
  'PENGELOLA_TABUNGAN',
  'PEMBINA_OSIM',
  'PEMBINA_EKSTRAKURIKULER',
  'PUSTAKAWAN',
  'SISWA',
  'ORANG_TUA',
  'ALUMNI',
  'UMUM'
);

CREATE TABLE institution_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_type institution_type NOT NULL DEFAULT 'MADRASAH',
  name TEXT NOT NULL DEFAULT 'Madrasah Aliyah Negeri Contoh',
  short_name TEXT DEFAULT 'MAN Contoh',
  npsn TEXT,
  nsm TEXT, -- Nomor Statistik Madrasah (opsional untuk sekolah umum)
  accreditation TEXT DEFAULT 'A',
  accreditation_year INT,
  student_org_label TEXT NOT NULL DEFAULT 'OSIM', -- OSIM untuk Madrasah, OSIS untuk Sekolah
  head_title_label TEXT NOT NULL DEFAULT 'Kepala Madrasah', -- Kepala Madrasah / Kepala Sekolah
  logo_url TEXT,
  hero_image_url TEXT,
  history TEXT,
  vision TEXT,
  mission JSONB DEFAULT '[]'::jsonb,
  org_structure_url TEXT,
  org_structure_data JSONB DEFAULT '[]'::jsonb,
  headmaster_name TEXT,
  headmaster_photo_url TEXT,
  headmaster_greeting TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website_url TEXT,
  google_maps_embed_url TEXT,
  geofence_lat DOUBLE PRECISION,
  geofence_lng DOUBLE PRECISION,
  geofence_radius_meters INT NOT NULL DEFAULT 100,
  social_links JSONB DEFAULT '{}'::jsonb, -- { youtube, instagram, facebook, tiktok }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  primary_role app_role NOT NULL DEFAULT 'UMUM',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Master Tugas Tambahan Guru & Konfigurasi Tunjangan Honorarium
CREATE TABLE additional_duty_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  receives_allowance BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE untuk Bendahara Komite & Pengelola Tabungan
  monthly_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ACADEMIC YEARS & BUKU INDUK DIGITAL (GTK & SISWA)
-- ============================================================================

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- contoh: "2026/2027"
  semester TEXT NOT NULL CHECK (semester IN ('GANJIL', 'GENAP')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teachers_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  staff_type TEXT NOT NULL DEFAULT 'GURU' CHECK (staff_type IN ('GURU', 'TATA_USAHA', 'LAINNYA')),
  full_name TEXT NOT NULL,
  nip TEXT,
  nuptk TEXT,
  nik TEXT,
  gender TEXT CHECK (gender IN ('L', 'P')),
  birth_place TEXT,
  birth_date DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  education_level TEXT,
  major TEXT,
  employment_status TEXT DEFAULT 'GTY', -- PNS, PPPK, GTY, GTT, PTY, PTT
  join_date DATE,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_public_directory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE employment_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  position_title TEXT NOT NULL,
  unit_or_institution TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  decree_number TEXT, -- Nomor SK
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_additional_duties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  duty_type_id UUID NOT NULL REFERENCES additional_duty_types(id) ON DELETE RESTRICT,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  decree_number TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  nis TEXT UNIQUE,
  nisn TEXT UNIQUE,
  nik TEXT,
  full_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('L', 'P')),
  birth_place TEXT,
  birth_date DATE,
  religion TEXT DEFAULT 'Islam',
  address TEXT,
  phone TEXT,
  email TEXT,
  father_name TEXT,
  father_job TEXT,
  father_phone TEXT,
  mother_name TEXT,
  mother_job TEXT,
  mother_phone TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  entry_year INT,
  graduation_year INT,
  status TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'MUTASI', 'LULUS', 'NONAKTIF')),
  photo_url TEXT,
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. WEBSITE RESMI & CMS
-- ============================================================================

CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  quantity INT NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'BAIK',
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('BERITA', 'ARTIKEL', 'PENGUMUMAN', 'KARYA_GURU', 'KARYA_SISWA')),
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_display_name TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE media_gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('FOTO', 'VIDEO_PROFIL', 'YOUTUBE')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  event_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('SEKOLAH', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL')),
  rank TEXT, -- Juara 1, Harapan 1, Medali Emas, dll
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  achieved_at DATE NOT NULL,
  organizer TEXT,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ppdb_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- PPDB Tahun Ajaran 2026/2027
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  open_date DATE NOT NULL,
  close_date DATE NOT NULL,
  announcement_date DATE,
  quota INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ppdb_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES ppdb_periods(id) ON DELETE CASCADE,
  registration_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  nisn TEXT,
  nik TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('L', 'P')),
  birth_place TEXT NOT NULL,
  birth_date DATE NOT NULL,
  previous_school TEXT,
  address TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  pathway TEXT DEFAULT 'REGULER', -- REGULER, PRESTASI, AFIRMASI
  status TEXT NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI' CHECK (
    status IN ('MENUNGGU_VERIFIKASI', 'TERVERIFIKASI', 'PERLU_PERBAIKAN', 'LULUS', 'CADANGAN', 'TIDAK_LULUS')
  ),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ppdb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES ppdb_registrations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('KK', 'AKTA_KELAHIRAN', 'IJAZAH_SKL', 'PAS_FOTO', 'SERTIFIKAT_PRESTASI', 'LAINNYA')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  sender_phone TEXT,
  category TEXT NOT NULL DEFAULT 'ASPIRASI' CHECK (category IN ('ASPIRASI', 'PENGADUAN', 'INFORMASI')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'BARU' CHECK (status IN ('BARU', 'DIPROSES', 'SELESAI')),
  response TEXT,
  responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. PORTAL AKADEMIK (KELAS, JADWAL, PIKET, PRESENSI, DELEGASI, UJIAN)
-- ============================================================================

CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- contoh: X-A, XI IPA 1
  grade_level TEXT NOT NULL, -- VII, VIII, IX, X, XI, XII
  homeroom_teacher_id UUID REFERENCES teachers_staff(id) ON DELETE SET NULL, -- Wali Kelas
  room_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id)
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject_group TEXT, -- Umum, Agama/PAI, Kejuruan, Muatan Lokal
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Senin .. 7=Minggu
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  jtm_count INT NOT NULL DEFAULT 2, -- Jumlah Jam Tatap Muka untuk sesi ini
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE picket_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL, -- NULL jika absensi harian
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('HADIR', 'SAKIT', 'IZIN', 'ALPA')),
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delegasi Guru Pengganti (Mengajar atau Piket)
CREATE TABLE teacher_delegations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delegation_date DATE NOT NULL,
  delegation_type TEXT NOT NULL CHECK (delegation_type IN ('MENGAJAR', 'PIKET')),
  original_teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  substitute_teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  picket_schedule_id UUID REFERENCES picket_schedules(id) ON DELETE SET NULL,
  jtm_transferred INT NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Periode & Jadwal Ujian (Pengawas & Panitia mendapat JTM sesuai pengaturan admin)
CREATE TABLE exam_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- UTS Ganjil, PAS Genap, Asesmen Madrasah
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_period_id UUID NOT NULL REFERENCES exam_periods(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 30
);

CREATE TABLE exam_supervisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_period_id UUID NOT NULL REFERENCES exam_periods(id) ON DELETE CASCADE,
  exam_room_id UUID REFERENCES exam_rooms(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  session_name TEXT NOT NULL, -- Sesi 1, Sesi 2
  subject_name TEXT,
  jtm_allocated INT NOT NULL DEFAULT 2, -- Diatur admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_period_id UUID NOT NULL REFERENCES exam_periods(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  committee_role TEXT NOT NULL, -- Ketua, Sekretaris, Anggota, Proktor, Teknisi
  jtm_allocated INT NOT NULL DEFAULT 4, -- Diatur admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_student_attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_period_id UUID NOT NULL REFERENCES exam_periods(id) ON DELETE CASCADE,
  exam_room_id UUID REFERENCES exam_rooms(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  session_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HADIR', 'SAKIT', 'IZIN', 'ALPA')),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Absensi Guru (Geofencing GPS + Mengajar/Piket/Pengawas Ujian/Panitia Ujian)
CREATE TABLE teacher_attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  attendance_type TEXT NOT NULL CHECK (attendance_type IN ('HARIAN', 'MENGAJAR', 'PIKET', 'PENGAWAS_UJIAN', 'PANITIA_UJIAN')),
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  picket_schedule_id UUID REFERENCES picket_schedules(id) ON DELETE SET NULL,
  exam_supervisor_id UUID REFERENCES exam_supervisors(id) ON DELETE SET NULL,
  exam_committee_id UUID REFERENCES exam_committees(id) ON DELETE SET NULL,
  delegation_id UUID REFERENCES teacher_delegations(id) ON DELETE SET NULL,
  jtm_earned INT NOT NULL DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  is_within_geofence BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'HADIR' CHECK (status IN ('HADIR', 'IZIN', 'SAKIT', 'DINAS_LUAR')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. KEUANGAN: SPP / KOMITE, TABUNGAN & HONORARIUM GURU
-- ============================================================================

CREATE TABLE fee_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- SPP Bulanan, Iuran Komite, Uang Gedung
  category TEXT NOT NULL CHECK (category IN ('SPP', 'KOMITE', 'UANG_GEDUNG', 'LAINNYA')),
  default_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_recurring_monthly BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_type_id UUID NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  billing_month INT CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INT,
  amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'BELUM_LUNAS' CHECK (status IN ('BELUM_LUNAS', 'CICILAN', 'LUNAS')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bill_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID NOT NULL REFERENCES student_bills(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE NOT NULL,
  amount_paid NUMERIC(14,2) NOT NULL,
  payment_method TEXT DEFAULT 'TUNAI' CHECK (payment_method IN ('TUNAI', 'TRANSFER', 'QRIS')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Bendahara Komite
  notes TEXT
);

-- Tabungan (Siswa, Guru, TU, dan Masyarakat Umum) - dikelola Pengelola Tabungan
CREATE TABLE savings_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number TEXT UNIQUE NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('SISWA', 'GURU', 'TU', 'UMUM')),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers_staff(id) ON DELETE SET NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT,
  owner_address TEXT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE savings_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SETOR', 'TARIK')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(14,2) NOT NULL,
  reference_number TEXT UNIQUE NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Pengelola Tabungan
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Honorarium Guru (JTM x Tarif + Tunjangan Tugas Tambahan yang berhak)
CREATE TABLE honorarium_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  rate_per_jtm NUMERIC(14,2) NOT NULL DEFAULT 25000,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_honorariums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL,
  teaching_jtm INT NOT NULL DEFAULT 0,
  substitute_jtm INT NOT NULL DEFAULT 0,
  exam_supervisor_jtm INT NOT NULL DEFAULT 0,
  exam_committee_jtm INT NOT NULL DEFAULT 0,
  total_jtm INT NOT NULL DEFAULT 0,
  rate_per_jtm NUMERIC(14,2) NOT NULL,
  jtm_honorarium_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  additional_duty_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, period_month, period_year)
);

CREATE TABLE teacher_honorarium_duty_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  honorarium_id UUID NOT NULL REFERENCES teacher_honorariums(id) ON DELETE CASCADE,
  duty_type_id UUID NOT NULL REFERENCES additional_duty_types(id) ON DELETE RESTRICT,
  duty_name TEXT NOT NULL,
  allowance_amount NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ============================================================================
-- 6. PERSURATAN, E-LIBRARY, BK, GURU WALI, TRACER STUDY
-- ============================================================================

CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction TEXT NOT NULL CHECK (direction IN ('MASUK', 'KELUAR')),
  category TEXT NOT NULL CHECK (category IN (
    'SURAT_KETERANGAN_AKTIF',
    'SURAT_MUTASI',
    'SURAT_TUGAS',
    'SURAT_UNDANGAN',
    'SURAT_EDARAN',
    'LAINNYA'
  )),
  letter_number TEXT NOT NULL,
  letter_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject TEXT NOT NULL,
  counterparty TEXT, -- Pengirim (surat masuk) atau Tujuan (surat keluar)
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers_staff(id) ON DELETE SET NULL,
  summary TEXT,
  file_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Perpustakaan Digital (E-Library)
CREATE TABLE library_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_code TEXT UNIQUE NOT NULL,
  member_type TEXT NOT NULL CHECK (member_type IN ('SISWA', 'GTK', 'UMUM')),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers_staff(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_auto_registered BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'NONAKTIF')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE library_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  isbn TEXT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  publish_year INT,
  category TEXT,
  book_format TEXT NOT NULL DEFAULT 'FISIK' CHECK (book_format IN ('FISIK', 'EBOOK', 'KEDUANYA')),
  shelf_location TEXT,
  total_copies INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  cover_url TEXT,
  ebook_file_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE library_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES library_members(id) ON DELETE CASCADE,
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  fine_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DIPINJAM' CHECK (status IN ('DIPINJAM', 'DIKEMBALIKAN', 'TERLAMBAT')),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bimbingan Konseling (BK) & Poin Pelanggaran / Prestasi
CREATE TABLE bk_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  counselor_id UUID REFERENCES teachers_staff(id) ON DELETE SET NULL, -- Guru BK
  record_type TEXT NOT NULL CHECK (record_type IN ('PELANGGARAN', 'PRESTASI', 'KONSULTASI')),
  title TEXT NOT NULL,
  points INT NOT NULL DEFAULT 0, -- positif untuk prestasi, negatif/poin untuk pelanggaran
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  follow_up TEXT,
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manajemen Guru Wali (Terpisah dari Guru BK)
CREATE TABLE guru_wali_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers_staff(id) ON DELETE CASCADE, -- Guru Wali
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(academic_year_id, student_id)
);

CREATE TABLE guru_wali_mentoring_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES guru_wali_assignments(id) ON DELETE CASCADE,
  mentoring_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic TEXT NOT NULL,
  aspect TEXT CHECK (aspect IN ('AKADEMIK', 'IBADAH_KARAKTER', 'SOSIAL', 'KESEHATAN', 'LAINNYA')),
  notes TEXT NOT NULL,
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracer Study / Portal Alumni
CREATE TABLE alumni_tracers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  graduation_year INT NOT NULL,
  phone TEXT,
  email TEXT,
  current_activity TEXT NOT NULL CHECK (current_activity IN ('KULIAH', 'BEKERJA', 'WIRAUSAHA', 'PESANTREN', 'MENCARI_KERJA', 'LAINNYA')),
  institution_or_company TEXT,
  major_or_position TEXT,
  city TEXT,
  testimonial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. SEED MASTER DATA: JENIS TUGAS TAMBAHAN & PENGATURAN AWAL
-- ============================================================================

INSERT INTO additional_duty_types (code, name, receives_allowance, monthly_allowance, description) VALUES
  ('KEPALA_MADRASAH', 'Kepala Madrasah / Sekolah', TRUE, 1500000, 'Pimpinan tertinggi satuan pendidikan'),
  ('WAKA_KURIKULUM', 'Wakil Kepala Bidang Kurikulum', TRUE, 750000, 'Mengelola kurikulum, jadwal, dan asesmen'),
  ('WAKA_KESISWAAN', 'Wakil Kepala Bidang Kesiswaan', TRUE, 750000, 'Mengelola pembinaan siswa dan kegiatan kesiswaan'),
  ('WAKA_HUMAS', 'Wakil Kepala Bidang Humas', TRUE, 650000, 'Mengelola hubungan masyarakat dan publikasi'),
  ('WAKA_SARPRAS', 'Wakil Kepala Bidang Sarana Prasarana', TRUE, 650000, 'Mengelola aset dan fasilitas lembaga'),
  ('KEPALA_TU', 'Kepala Tata Usaha', TRUE, 800000, 'Pimpinan administrasi ketatausahaan'),
  ('OPERATOR', 'Operator Sekolah / Madrasah', TRUE, 600000, 'Pengelola data EMIS/Dapodik dan sistem informasi'),
  ('BENDAHARA', 'Bendahara Lembaga / BOS', TRUE, 650000, 'Pengelola keuangan operasional lembaga'),
  ('WALI_KELAS', 'Wali Kelas', TRUE, 300000, 'Penanggung jawab rombongan belajar'),
  ('GURU_WALI', 'Guru Wali', TRUE, 250000, 'Pendampingan personal siswa di luar BK'),
  ('PEMBINA_OSIM', 'Pembina OSIM / OSIS', TRUE, 250000, 'Pembina organisasi siswa'),
  ('PEMBINA_EKSTRAKURIKULER', 'Pembina Ekstrakurikuler', TRUE, 200000, 'Pembina kegiatan ekstrakurikuler'),
  ('BENDAHARA_KOMITE', 'Bendahara Komite / SPP', FALSE, 0, 'Mengelola SPP & Iuran Komite (tanpa tambahan tunjangan honorarium)'),
  ('PENGELOLA_TABUNGAN', 'Pengelola Tabungan', FALSE, 0, 'Mengelola tabungan siswa/guru/TU/umum (tanpa tambahan tunjangan honorarium)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO institution_settings (
  institution_type,
  name,
  short_name,
  student_org_label,
  head_title_label,
  accreditation,
  geofence_lat,
  geofence_lng,
  geofence_radius_meters
) VALUES (
  'MADRASAH',
  'Madrasah Aliyah Negeri 1 Nusantara',
  'MAN 1 Nusantara',
  'OSIM',
  'Kepala Madrasah',
  'A',
  -6.200000,
  106.816666,
  100
);

INSERT INTO honorarium_settings (rate_per_jtm, is_active) VALUES (25000, TRUE);
