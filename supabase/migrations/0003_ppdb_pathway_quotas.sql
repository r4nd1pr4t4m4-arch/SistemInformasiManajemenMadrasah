-- SIMMS Migration 0003: Kuota per Jalur Pendaftaran PPDB (Domisili, Afirmasi, Prestasi)
ALTER TABLE ppdb_periods
ADD COLUMN IF NOT EXISTS pathway_quotas JSONB NOT NULL DEFAULT '{"DOMISILI": 100, "AFIRMASI": 40, "PRESTASI": 40}'::jsonb;
