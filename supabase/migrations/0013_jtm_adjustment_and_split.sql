-- SIMMS Migration 0013: Penyesuaian JTM saat Konfirmasi Kehadiran & Alokasi Selisih JTM
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.teacher_attendances
  ADD COLUMN IF NOT EXISTS approved_jtm NUMERIC(8,2);
