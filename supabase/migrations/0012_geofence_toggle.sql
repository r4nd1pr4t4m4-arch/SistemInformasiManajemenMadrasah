-- SIMMS Migration 0012: Pengaturan Aktif/Nonaktif Fitur Presensi Geofencing
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.institution_settings
  ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN NOT NULL DEFAULT TRUE;
