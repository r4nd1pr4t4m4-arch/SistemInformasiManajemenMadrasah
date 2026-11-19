-- 0031_student_picket_schedules.sql
-- Jadwal Piket Kelas Siswa (Senin - Minggu)

CREATE TABLE IF NOT EXISTS public.student_picket_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Senin .. 7=Minggu
  task_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (classroom_id, student_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_student_picket_classroom_day
  ON public.student_picket_schedules(classroom_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_student_picket_student
  ON public.student_picket_schedules(student_id);

ALTER TABLE public.student_picket_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_picket_schedules_read_authenticated" ON public.student_picket_schedules;
CREATE POLICY "student_picket_schedules_read_authenticated"
  ON public.student_picket_schedules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "student_picket_schedules_manage_staff" ON public.student_picket_schedules;
CREATE POLICY "student_picket_schedules_manage_staff"
  ON public.student_picket_schedules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WALI_KELAS',
          'GURU'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_TU',
          'STAF_TU',
          'WAKA_KURIKULUM',
          'WAKA_KESISWAAN',
          'WALI_KELAS',
          'GURU'
        )
    )
  );
