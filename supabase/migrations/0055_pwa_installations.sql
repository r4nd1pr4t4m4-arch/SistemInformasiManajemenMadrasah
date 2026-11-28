-- =============================================================================
-- Migration 0055: Pelacakan & Monitoring Instalasi PWA Pengguna
-- =============================================================================

CREATE TABLE IF NOT EXISTS pwa_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (
    platform IN (
      'android-chrome',
      'ios-safari',
      'desktop-chromium',
      'desktop-safari',
      'other'
    )
  ),
  device_label TEXT NOT NULL DEFAULT '',
  user_agent TEXT,
  install_source TEXT NOT NULL DEFAULT 'STANDALONE_LAUNCH' CHECK (
    install_source IN ('APPINSTALLED_EVENT', 'STANDALONE_LAUNCH', 'DEFERRED_LINK')
  ),
  display_mode TEXT NOT NULL DEFAULT 'standalone',
  app_version TEXT,
  launch_count INTEGER NOT NULL DEFAULT 1,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pwa_installations_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_pwa_installations_user_seen
  ON pwa_installations (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_pwa_installations_platform_seen
  ON pwa_installations (platform, last_seen_at DESC);

ALTER TABLE pwa_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pwa_installations_service_role_all" ON pwa_installations;
CREATE POLICY "pwa_installations_service_role_all"
  ON pwa_installations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
