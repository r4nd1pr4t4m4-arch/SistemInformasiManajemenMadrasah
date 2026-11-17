-- SIMMS Migration 0007: Dukungan JTM Desimal (Penalti Keterlambatan H+1..H+5) & JTM BAP
-- Jalankan file ini di Supabase SQL Editor.

ALTER TABLE public.teaching_journals
  ALTER COLUMN jtm_credited TYPE NUMERIC(8,2) USING jtm_credited::NUMERIC(8,2);

ALTER TABLE public.event_journals
  ALTER COLUMN jtm_credited TYPE NUMERIC(8,2) USING jtm_credited::NUMERIC(8,2);

ALTER TABLE public.exam_bap_reports
  ADD COLUMN IF NOT EXISTS jtm_credited NUMERIC(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jtm_percentage INT NOT NULL DEFAULT 100;

ALTER TABLE public.teaching_journals
  ADD COLUMN IF NOT EXISTS delay_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jtm_percentage INT NOT NULL DEFAULT 100;

ALTER TABLE public.event_journals
  ADD COLUMN IF NOT EXISTS delay_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jtm_percentage INT NOT NULL DEFAULT 100;

ALTER TABLE public.teacher_attendances
  ALTER COLUMN jtm_earned TYPE NUMERIC(8,2) USING jtm_earned::NUMERIC(8,2);

ALTER TABLE public.teacher_honorariums
  ALTER COLUMN teaching_jtm TYPE NUMERIC(8,2) USING teaching_jtm::NUMERIC(8,2),
  ALTER COLUMN substitute_jtm TYPE NUMERIC(8,2) USING substitute_jtm::NUMERIC(8,2),
  ALTER COLUMN exam_supervisor_jtm TYPE NUMERIC(8,2) USING exam_supervisor_jtm::NUMERIC(8,2),
  ALTER COLUMN exam_committee_jtm TYPE NUMERIC(8,2) USING exam_committee_jtm::NUMERIC(8,2),
  ALTER COLUMN event_jtm TYPE NUMERIC(8,2) USING event_jtm::NUMERIC(8,2),
  ALTER COLUMN total_jtm TYPE NUMERIC(8,2) USING total_jtm::NUMERIC(8,2);
