-- SIMMS Migration 0009: Catatan Absensi Siswa di dalam Jurnal Pembelajaran (terpisah dari Absensi Siswa Guru Piket)
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.teaching_journals
  ADD COLUMN IF NOT EXISTS present_students_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_students_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_attendance_notes TEXT;
