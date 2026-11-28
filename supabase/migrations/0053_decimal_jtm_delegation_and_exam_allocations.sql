-- =============================================================================
-- Migration 0053: Ubah kolom alokasi & transfer JTM dari INT ke NUMERIC(8,2)
-- Agar selisih JTM desimal (mis. 0.5, 1.25 JTM) pada delegasi guru,
-- panitia ujian, dan pengawas ujian tidak terpotong/terbulatkan ke integer.
-- =============================================================================

ALTER TABLE public.teacher_delegations
  ALTER COLUMN jtm_transferred TYPE NUMERIC(8,2) USING jtm_transferred::NUMERIC(8,2);

ALTER TABLE public.exam_committees
  ALTER COLUMN jtm_allocated TYPE NUMERIC(8,2) USING jtm_allocated::NUMERIC(8,2);

ALTER TABLE public.exam_supervisors
  ALTER COLUMN jtm_allocated TYPE NUMERIC(8,2) USING jtm_allocated::NUMERIC(8,2);
