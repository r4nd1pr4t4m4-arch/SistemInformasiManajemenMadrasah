-- 0058_ppdb_pathway_documents.sql
-- Menyimpan konfigurasi standar dokumen persyaratan umum & khusus per jalur PPDB

ALTER TABLE public.institution_settings
  ADD COLUMN IF NOT EXISTS ppdb_pathway_documents JSONB DEFAULT NULL;

ALTER TABLE public.ppdb_periods
  ADD COLUMN IF NOT EXISTS pathway_documents JSONB DEFAULT NULL;
