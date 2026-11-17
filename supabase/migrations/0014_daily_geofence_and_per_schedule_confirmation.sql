-- SIMMS Migration 0014: Presensi Geofencing 1x/Hari & Konfirmasi Kehadiran Per Jadwal
-- Jalankan file ini di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.schedule_session_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_type TEXT NOT NULL CHECK (session_type IN ('MENGAJAR', 'PENGAWAS_UJIAN')),
  session_date DATE NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  daily_attendance_id UUID NOT NULL REFERENCES public.teacher_attendances(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  delegation_id UUID REFERENCES public.teacher_delegations(id) ON DELETE CASCADE,
  exam_supervisor_id UUID REFERENCES public.exam_supervisors(id) ON DELETE CASCADE,
  expected_jtm NUMERIC(8,2) NOT NULL DEFAULT 2,
  approved_jtm NUMERIC(8,2) NOT NULL DEFAULT 2,
  confirmed_by_role TEXT NOT NULL CHECK (confirmed_by_role IN ('ADMIN', 'GURU_PIKET', 'PANITIA_UJIAN')),
  confirmed_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_by_attendance_id UUID REFERENCES public.teacher_attendances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_conf_schedule_date
  ON public.schedule_session_confirmations (schedule_id, session_date, teacher_id)
  WHERE schedule_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_conf_delegation_date
  ON public.schedule_session_confirmations (delegation_id, session_date, teacher_id)
  WHERE delegation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_conf_exam_sup
  ON public.schedule_session_confirmations (exam_supervisor_id, teacher_id)
  WHERE exam_supervisor_id IS NOT NULL;

-- Izinkan 1 presensi harian dipakai oleh beberapa jurnal pada jadwal yang berbeda di hari yang sama
ALTER TABLE public.teaching_journals
  DROP CONSTRAINT IF EXISTS teaching_journals_attendance_id_key;

ALTER TABLE public.teaching_journals
  ADD COLUMN IF NOT EXISTS session_confirmation_id UUID UNIQUE REFERENCES public.schedule_session_confirmations(id) ON DELETE CASCADE;
