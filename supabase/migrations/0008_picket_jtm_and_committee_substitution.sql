-- SIMMS Migration 0008: JTM Guru Piket/Pengganti & Alur Penunjukkan Panitia Ujian Pengganti
-- Jalankan file ini di Supabase SQL Editor.

-- 1. Tambah jtm_allocated pada picket_schedules & picket_jtm pada teacher_honorariums
ALTER TABLE public.picket_schedules
  ADD COLUMN IF NOT EXISTS jtm_allocated INT NOT NULL DEFAULT 2;

ALTER TABLE public.teacher_honorariums
  ADD COLUMN IF NOT EXISTS picket_jtm NUMERIC(8,2) NOT NULL DEFAULT 0;

-- 2. Tambah kolom pelacakan Panitia Ujian Pengganti pada exam_committees
ALTER TABLE public.exam_committees
  ADD COLUMN IF NOT EXISTS original_teacher_id UUID REFERENCES public.teachers_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituted_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substitution_reason TEXT,
  ADD COLUMN IF NOT EXISTS substituted_at TIMESTAMPTZ;
