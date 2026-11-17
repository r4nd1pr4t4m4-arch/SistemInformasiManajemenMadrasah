-- SIMMS Migration 0016: Kalender Pendidikan (Libur Berbayar) & Otomasi JTM Libur Berbayar
-- Jalankan file ini di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.academic_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'LIBUR_BERBAYAR'
    CHECK (category IN ('LIBUR_BERBAYAR', 'LIBUR_TIDAK_BERBAYAR', 'HARI_EFEKTIF', 'AGENDA_KHUSUS')),
  description TEXT,
  auto_jtm_processed BOOLEAN NOT NULL DEFAULT FALSE,
  auto_jtm_processed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.paid_holiday_jtm_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_event_id UUID NOT NULL REFERENCES public.academic_calendar_events(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  teaching_jtm NUMERIC(8,2) NOT NULL DEFAULT 0,
  picket_jtm NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_jtm NUMERIC(8,2) NOT NULL DEFAULT 0,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(holiday_date, teacher_id)
);

ALTER TABLE public.teacher_honorariums
  ADD COLUMN IF NOT EXISTS paid_holiday_jtm NUMERIC(8,2) NOT NULL DEFAULT 0;
