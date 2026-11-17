-- SIMMS Migration 0018: Pengaturan Jam Sekolah Per Hari (Senin s.d. Minggu) untuk Tunjangan Transportasi
-- Jalankan file ini di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.school_daily_hours (
  day_of_week INT PRIMARY KEY CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Senin .. 7 = Minggu
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME NOT NULL DEFAULT '07:30',
  end_time TIME NOT NULL DEFAULT '12:30',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.school_daily_hours (day_of_week, is_active, start_time, end_time) VALUES
  (1, TRUE, '07:30', '12:30'),
  (2, TRUE, '07:30', '12:30'),
  (3, TRUE, '07:30', '12:30'),
  (4, TRUE, '07:30', '12:30'),
  (5, TRUE, '07:30', '11:30'),
  (6, TRUE, '07:30', '12:00'),
  (7, FALSE, '07:30', '12:00')
ON CONFLICT (day_of_week) DO NOTHING;
