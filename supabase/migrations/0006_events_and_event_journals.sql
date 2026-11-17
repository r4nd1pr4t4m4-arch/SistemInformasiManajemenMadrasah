-- SIMMS Migration 0006: Manajemen Acara/Kegiatan & Jurnal Acara Guru (Jalur JTM Baru)
-- Jalankan file ini di Supabase SQL Editor.

-- 1. Tabel Acara / Kegiatan Lembaga (Rutin Mingguan atau Insidental 1 hari / rentang hari)
CREATE TABLE IF NOT EXISTS public.school_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('RUTIN_MINGGUAN', 'INSIDENTAL')),
  day_of_week INT CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Senin .. 7 = Minggu (untuk RUTIN_MINGGUAN)
  start_date DATE, -- untuk INSIDENTAL (atau tanggal mulai efektif)
  end_date DATE,   -- untuk INSIDENTAL (bisa sama dengan start_date atau rentang beberapa hari)
  start_time TIME,
  end_time TIME,
  location TEXT,
  jtm_allocated INT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Konfirmasi Kehadiran Guru pada Acara (oleh Admin atau Guru Piket hari itu)
CREATE TABLE IF NOT EXISTS public.event_teacher_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.school_events(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  confirmed_by_role TEXT NOT NULL CHECK (confirmed_by_role IN ('ADMIN', 'GURU_PIKET')),
  confirmed_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  picket_attendance_id UUID REFERENCES public.teacher_attendances(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, teacher_id, event_date)
);

-- 3. Jurnal Acara Guru (syarat agar JTM Acara dihitung ke honorarium)
CREATE TABLE IF NOT EXISTS public.event_journals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  confirmation_id UUID UNIQUE NOT NULL REFERENCES public.event_teacher_confirmations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.school_events(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  journal_date DATE NOT NULL,
  summary TEXT NOT NULL,
  outcomes TEXT,
  jtm_credited INT NOT NULL DEFAULT 0,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tambah kolom event_jtm pada teacher_honorariums
ALTER TABLE public.teacher_honorariums
  ADD COLUMN IF NOT EXISTS event_jtm INT NOT NULL DEFAULT 0;
