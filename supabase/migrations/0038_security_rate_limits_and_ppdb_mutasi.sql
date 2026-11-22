-- 0038: Server-side rate limiting, single-use security nonces (OTP/CAPTCHA), & PPDB Mutasi nullable period_id

-- 1. Tabel rate-limit server-side (login attempts, OTP failed attempts, dll.)
CREATE TABLE IF NOT EXISTS security_rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_expires_at
  ON security_rate_limits (expires_at);

ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Tabel nonce sekali pakai (CAPTCHA PoW nonce & OTP jti) untuk mencegah replay lintas instance serverless
CREATE TABLE IF NOT EXISTS security_used_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_used_nonces_expires_at
  ON security_used_nonces (expires_at);

ALTER TABLE security_used_nonces ENABLE ROW LEVEL SECURITY;

-- 3. Izinkan pendaftaran Mutasi Masuk (pathway = 'MUTASI') meskipun belum ada periode PPDB aktif
ALTER TABLE ppdb_registrations
  ALTER COLUMN period_id DROP NOT NULL;
