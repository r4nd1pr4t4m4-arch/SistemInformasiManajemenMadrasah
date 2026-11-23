-- 0040: Immutable Security & Financial Audit Logs (Append-Only)

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_roles TEXT[] NOT NULL DEFAULT '{}',
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_module_created
  ON public.security_audit_logs (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor_created
  ON public.security_audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_entity
  ON public.security_audit_logs (entity_type, entity_id);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Pastikan log audit benar-benar immutable (append-only): tolak UPDATE & DELETE
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_logs bersifat immutable (append-only) dan tidak dapat diubah atau dihapus.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON public.security_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update
  BEFORE UPDATE ON public.security_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON public.security_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_delete
  BEFORE DELETE ON public.security_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();
