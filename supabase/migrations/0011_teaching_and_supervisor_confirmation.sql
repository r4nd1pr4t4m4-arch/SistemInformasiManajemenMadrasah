-- SIMMS Migration 0011: Pelacakan Peran Pengonfirmasi Kehadiran Guru Mengajar & Pengawas Ujian
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.teacher_attendances
  ADD COLUMN IF NOT EXISTS confirmed_by_role TEXT CHECK (confirmed_by_role IN ('ADMIN', 'GURU_PIKET', 'PANITIA_UJIAN')),
  ADD COLUMN IF NOT EXISTS confirmed_by_attendance_id UUID REFERENCES public.teacher_attendances(id) ON DELETE SET NULL;
