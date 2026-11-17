-- SIMMS Migration 0017: Tunjangan Transportasi Guru (% Durasi Kehadiran x Jarak KM x Tarif per KM)
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.honorarium_settings
  ADD COLUMN IF NOT EXISTS transport_rate_per_km NUMERIC(14,2) NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS school_start_time TIME NOT NULL DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS school_end_time TIME NOT NULL DEFAULT '12:30';

ALTER TABLE public.teachers_staff
  ADD COLUMN IF NOT EXISTS home_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0;

ALTER TABLE public.teacher_honorariums
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(14,2) NOT NULL DEFAULT 0;
