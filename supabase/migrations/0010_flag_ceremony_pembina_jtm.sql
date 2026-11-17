-- SIMMS Migration 0010: Jalur JTM Pembina Upacara Bendera Hari Senin & Pembina Pengganti
-- Jalankan file ini di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.ceremony_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ceremony_date DATE NOT NULL UNIQUE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  original_teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  substituted_by_role TEXT CHECK (substituted_by_role IN ('ADMIN', 'GURU_PIKET')),
  substituted_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  picket_attendance_id UUID REFERENCES public.teacher_attendances(id) ON DELETE SET NULL,
  substitution_reason TEXT,
  substituted_at TIMESTAMPTZ,
  jtm_allocated INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'TERJADWAL' CHECK (status IN ('TERJADWAL', 'TERLAKSANA', 'DIBATALKAN')),
  confirmed_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_honorariums
  ADD COLUMN IF NOT EXISTS ceremony_jtm NUMERIC(8,2) NOT NULL DEFAULT 0;
