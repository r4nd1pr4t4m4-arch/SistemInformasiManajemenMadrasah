-- SIMMS Migration 0015: Laporan Harian Piket & Laporan Pertanggungjawaban Harian Panitia Ujian
-- Jalankan file ini di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.picket_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id UUID UNIQUE NOT NULL REFERENCES public.teacher_attendances(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  summary TEXT NOT NULL,
  late_students_notes TEXT,
  teacher_substitution_notes TEXT,
  incidents TEXT,
  jtm_credited NUMERIC(8,2) NOT NULL DEFAULT 0,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_committee_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id UUID UNIQUE NOT NULL REFERENCES public.teacher_attendances(id) ON DELETE CASCADE,
  exam_committee_id UUID NOT NULL REFERENCES public.exam_committees(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers_staff(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  activities_summary TEXT NOT NULL,
  logistics_notes TEXT,
  issues_and_solutions TEXT,
  jtm_credited NUMERIC(8,2) NOT NULL DEFAULT 0,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
