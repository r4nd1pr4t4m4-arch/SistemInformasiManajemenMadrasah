-- SIMMS Migration 0019: Input Manual Jam Masuk/Pulang & Izin Keluar Sebentar
-- Jalankan file ini di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.teacher_short_leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id UUID NOT NULL REFERENCES public.teacher_attendances(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_start_time TIME NOT NULL,
  leave_end_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  reason TEXT,
  recorded_by_role TEXT NOT NULL CHECK (recorded_by_role IN ('ADMIN', 'GURU_PIKET', 'PANITIA_UJIAN')),
  recorded_by_attendance_id UUID REFERENCES public.teacher_attendances(id) ON DELETE SET NULL,
  recorded_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_attendances
  ADD COLUMN IF NOT EXISTS time_updated_by_role TEXT CHECK (time_updated_by_role IN ('ADMIN', 'GURU_PIKET', 'PANITIA_UJIAN')),
  ADD COLUMN IF NOT EXISTS time_updated_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
