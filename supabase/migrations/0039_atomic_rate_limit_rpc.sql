-- 0039: Atomic Postgres RPC for race-condition-free rate limiting

CREATE OR REPLACE FUNCTION public.increment_security_rate_limit(
  p_key TEXT,
  p_ttl_seconds INT,
  p_lockout_threshold INT DEFAULT NULL,
  p_lockout_duration_ms BIGINT DEFAULT NULL
)
RETURNS TABLE(count INT, locked_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_ttl_interval INTERVAL := make_interval(secs => GREATEST(1, p_ttl_seconds));
  v_lock_interval INTERVAL :=
    CASE
      WHEN p_lockout_duration_ms IS NOT NULL AND p_lockout_duration_ms > 0
      THEN (p_lockout_duration_ms::NUMERIC / 1000.0) * INTERVAL '1 second'
      ELSE NULL
    END;
  v_initial_locked TIMESTAMPTZ :=
    CASE
      WHEN p_lockout_threshold IS NOT NULL AND v_lock_interval IS NOT NULL AND 1 >= p_lockout_threshold
      THEN v_now + v_lock_interval
      ELSE NULL
    END;
  v_initial_expires TIMESTAMPTZ := GREATEST(v_now + v_ttl_interval, COALESCE(v_initial_locked, v_now));
BEGIN
  RETURN QUERY
  INSERT INTO public.security_rate_limits AS srl (key, count, locked_until, expires_at, updated_at)
  VALUES (p_key, 1, v_initial_locked, v_initial_expires, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN srl.expires_at <= v_now THEN 1
      ELSE srl.count + 1
    END,
    locked_until = CASE
      WHEN p_lockout_threshold IS NOT NULL
        AND v_lock_interval IS NOT NULL
        AND (CASE WHEN srl.expires_at <= v_now THEN 1 ELSE srl.count + 1 END) >= p_lockout_threshold
      THEN v_now + v_lock_interval
      WHEN srl.expires_at <= v_now THEN NULL
      WHEN srl.locked_until IS NOT NULL AND srl.locked_until > v_now THEN srl.locked_until
      ELSE NULL
    END,
    expires_at = GREATEST(
      v_now + v_ttl_interval,
      COALESCE(
        CASE
          WHEN p_lockout_threshold IS NOT NULL
            AND v_lock_interval IS NOT NULL
            AND (CASE WHEN srl.expires_at <= v_now THEN 1 ELSE srl.count + 1 END) >= p_lockout_threshold
          THEN v_now + v_lock_interval
          WHEN srl.expires_at <= v_now THEN NULL
          WHEN srl.locked_until IS NOT NULL AND srl.locked_until > v_now THEN srl.locked_until
          ELSE NULL
        END,
        v_now
      )
    ),
    updated_at = v_now
  RETURNING srl.count, srl.locked_until;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_security_rate_limit(TEXT, INT, INT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_security_rate_limit(TEXT, INT, INT, BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_security_rate_limit(TEXT, INT, INT, BIGINT) TO service_role;
