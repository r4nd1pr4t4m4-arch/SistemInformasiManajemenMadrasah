-- SIMMS Migration 0005: Konfirmasi Admin Piket/Panitia Ujian, Jurnal Pembelajaran, BAP Ujian & Pengganti Pengawas
-- Jalankan file ini di Supabase SQL Editor.

-- 1. Tambah kolom konfirmasi admin pada teacher_attendances (untuk Guru Piket & Panitia Ujian)
ALTER TABLE public.teacher_attendances
  ADD COLUMN IF NOT EXISTS admin_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 2. Tabel Jurnal Pembelajaran (syarat agar JTM Mengajar & Guru Pengganti dihitung)
CREATE TABLE IF NOT EXISTS public.teaching_journals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  attendance_id UUID UNIQUE NOT NULL REFERENCES public.teacher_attendances(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  delegation_id UUID REFERENCES public.teacher_delegations(id) ON DELETE SET NULL,
  journal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic TEXT NOT NULL,
  learning_activities TEXT,
  jtm_credited INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Berita Acara Pengawasan (BAP) Ujian (syarat agar JTM Pengawas Ujian dihitung)
CREATE TABLE IF NOT EXISTS public.exam_bap_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_supervisor_id UUID UNIQUE NOT NULL REFERENCES public.exam_supervisors(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES public.teacher_attendances(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  present_students_count INT NOT NULL DEFAULT 0,
  absent_students_count INT NOT NULL DEFAULT 0,
  incidents TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tambah kolom pelacakan pengawas pengganti pada exam_supervisors
ALTER TABLE public.exam_supervisors
  ADD COLUMN IF NOT EXISTS original_teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituted_by_committee_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substitution_reason TEXT,
  ADD COLUMN IF NOT EXISTS substituted_at TIMESTAMPTZ;
