-- ============================================================================
-- 0042_web_push_notifications.sql
-- Native Web Push Notification (VAPID), In-App Notification Center,
-- User Preferences + Admin Lock Policy, Queue & Batching, Delivery/Click Analytics
-- ============================================================================

-- 1. Master Kategori Notifikasi & Kebijakan Admin
CREATE TABLE IF NOT EXISTS public.notification_categories (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  allow_user_opt_out BOOLEAN NOT NULL DEFAULT true,
  is_public_eligible BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed kategori default SIMMS
INSERT INTO public.notification_categories
  (key, label, description, default_enabled, allow_user_opt_out, is_public_eligible, sort_order)
VALUES
  ('PENGUMUMAN_BROADCAST', 'Pengumuman & Broadcast Resmi', 'Pengumuman penting dari pimpinan, operator, atau madrasah/sekolah.', true, false, true, 10),
  ('KEAMANAN_AKUN', 'Keamanan & Persetujuan Akun', 'Persetujuan perubahan nama/foto profil, reset MFA, dan peringatan keamanan akun.', true, false, false, 20),
  ('PRESENSI_SISWA', 'Presensi & Kehadiran Siswa', 'Pemberitahuan ketidakhadiran (Alpa, Sakit, Izin) atau keterlambatan siswa.', true, false, false, 30),
  ('LAYANAN_BK', 'Bimbingan Konseling (BK)', 'Catatan pembinaan, konseling, prestasi, atau pelanggaran siswa.', true, false, false, 40),
  ('KEUANGAN_SPP', 'Tagihan & Pembayaran SPP', 'Tagihan SPP baru, pengingat jatuh tempo, dan konfirmasi pembayaran lunas.', true, false, false, 50),
  ('BERITA_CMS', 'Berita & Artikel Website', 'Publikasi berita, artikel, atau informasi terbaru di website resmi.', true, true, true, 60),
  ('PPDB', 'PPDB Online', 'Pendaftaran peserta didik baru dan perubahan status verifikasi PPDB.', true, true, false, 70),
  ('GURU_WALI_HAFALAN', 'Guru Wali & Hafalan', 'Catatan pendampingan guru wali dan perkembangan setoran hafalan siswa.', true, true, false, 80),
  ('PENILAIAN_RAPORT', 'Penilaian & Raport', 'Pembaruan nilai mata pelajaran dan publikasi raport siswa.', true, true, false, 90),
  ('TABUNGAN', 'Tabungan Siswa', 'Notifikasi transaksi setoran dan penarikan tabungan.', true, true, false, 100),
  ('SDM_HONORARIUM', 'SDM, GTK & Honorarium', 'Pembaruan honorarium, JTM hari libur berbayar, dan administrasi GTK.', true, true, false, 110),
  ('PERPUSTAKAAN_SURAT', 'Perpustakaan, Persuratan & Kontak', 'Peminjaman/pengembalian buku, status persuratan, dan pesan kontak masuk.', true, true, false, 120),
  ('PENGINGAT_TERJADWAL', 'Pengingat Terjadwal', 'Pengingat harian agenda kalender akademik, jatuh tempo buku, dan tagihan.', true, true, false, 130)
ON CONFLICT (key) DO NOTHING;

-- 2. Langganan Web Push (Multi-Device, Login & Pengunjung Publik, Soft-Deactivate on Logout)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  audience_type TEXT NOT NULL DEFAULT 'USER' CHECK (audience_type IN ('USER', 'PUBLIC')),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other',
  device_label TEXT NOT NULL DEFAULT 'Perangkat Web',
  user_agent TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivated_reason TEXT NULL CHECK (
    deactivated_reason IS NULL OR
    deactivated_reason IN ('LOGOUT', 'USER_DISABLED', 'EXPIRED_410', 'ADMIN_REVOKED')
  ),
  deactivated_at TIMESTAMPTZ NULL,
  failure_count INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_audience_active
  ON public.push_subscriptions (audience_type, is_active);

-- 3. Preferensi Notifikasi Per User & Pengaturan Jam Tenang
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL REFERENCES public.notification_categories(key) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_key)
);

CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_start TEXT NOT NULL DEFAULT '22:00',
  quiet_end TEXT NOT NULL DEFAULT '05:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Campaign / Induk Pengiriman Push & Analitik
CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'SYSTEM_EVENT' CHECK (source_type IN ('BROADCAST', 'SYSTEM_EVENT', 'CRON', 'TEST')),
  category_key TEXT NOT NULL REFERENCES public.notification_categories(key) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/portal',
  icon_url TEXT NULL,
  target_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  scheduled_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  total_targets INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  clicked_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  expired_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_push_campaigns_created_at
  ON public.push_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_campaigns_category_status
  ON public.push_campaigns (category_key, status);

-- 5. In-App Notification Center (Ikon Lonceng Portal)
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL REFERENCES public.notification_categories(key) ON DELETE RESTRICT,
  campaign_id UUID NULL REFERENCES public.push_campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/portal',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  dedupe_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_created
  ON public.in_app_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread
  ON public.in_app_notifications (user_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_dedupe
  ON public.in_app_notifications (user_id, dedupe_key, created_at DESC)
  WHERE dedupe_key IS NOT NULL;

-- 6. Antrean Pengiriman Push Per Perangkat (Queue + Retry + Delivery/Click Tracking)
CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  in_app_notification_id UUID NULL REFERENCES public.in_app_notifications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED')
  ),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ NULL,
  http_status INT NULL,
  last_error TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  clicked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_queue
  ON public.push_deliveries (status, next_retry_at, created_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_push_deliveries_campaign
  ON public.push_deliveries (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_subscription
  ON public.push_deliveries (subscription_id);

-- ============================================================================
-- RPC Atomik untuk Queue Worker (Anti Double-Send & Anti Timeout Vercel)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_pending_push_deliveries(
  p_limit INT DEFAULT 40,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS TABLE (
  delivery_id UUID,
  campaign_id UUID,
  subscription_id UUID,
  user_id UUID,
  in_app_notification_id UUID,
  attempts INT,
  max_attempts INT,
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT,
  category_key TEXT,
  title TEXT,
  body TEXT,
  url TEXT,
  icon_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT d.id
    FROM public.push_deliveries d
    INNER JOIN public.push_campaigns c ON c.id = d.campaign_id
    INNER JOIN public.push_subscriptions s ON s.id = d.subscription_id
    WHERE s.is_active = true
      AND (c.scheduled_at IS NULL OR c.scheduled_at <= now())
      AND (p_campaign_id IS NULL OR d.campaign_id = p_campaign_id)
      AND (
        d.status = 'PENDING'
        OR (
          d.status = 'FAILED'
          AND d.attempts < d.max_attempts
          AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
        )
      )
    ORDER BY d.created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 100))
    FOR UPDATE OF d SKIP LOCKED
  ),
  updated AS (
    UPDATE public.push_deliveries d
    SET
      status = 'PROCESSING',
      attempts = d.attempts + 1,
      updated_at = now()
    FROM claimed
    WHERE d.id = claimed.id
    RETURNING d.*
  )
  SELECT
    u.id AS delivery_id,
    u.campaign_id,
    u.subscription_id,
    u.user_id,
    u.in_app_notification_id,
    u.attempts,
    u.max_attempts,
    s.endpoint,
    s.p256dh,
    s.auth,
    c.category_key,
    c.title,
    c.body,
    c.url,
    c.icon_url
  FROM updated u
  INNER JOIN public.push_subscriptions s ON s.id = u.subscription_id
  INNER JOIN public.push_campaigns c ON c.id = u.campaign_id;
END;
$$;

-- RPC Recompute Statistik Campaign
CREATE OR REPLACE FUNCTION public.recompute_push_campaign_stats(p_campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_sent INT;
  v_delivered INT;
  v_clicked INT;
  v_failed INT;
  v_expired INT;
  v_remaining INT;
  v_new_status TEXT;
BEGIN
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE status IN ('SENT', 'DELIVERED'))::INT,
    COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status = 'DELIVERED')::INT,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::INT,
    COUNT(*) FILTER (WHERE status = 'FAILED')::INT,
    COUNT(*) FILTER (WHERE status = 'EXPIRED')::INT,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'PROCESSING')
         OR (status = 'FAILED' AND attempts < max_attempts)
    )::INT
  INTO v_total, v_sent, v_delivered, v_clicked, v_failed, v_expired, v_remaining
  FROM public.push_deliveries
  WHERE campaign_id = p_campaign_id;

  IF v_total = 0 THEN
    v_new_status := 'COMPLETED';
  ELSIF v_remaining > 0 THEN
    v_new_status := 'PROCESSING';
  ELSIF v_sent > 0 AND (v_failed > 0 OR v_expired > 0) THEN
    v_new_status := 'PARTIAL';
  ELSIF v_sent = 0 AND (v_failed > 0 OR v_expired > 0) THEN
    v_new_status := 'FAILED';
  ELSE
    v_new_status := 'COMPLETED';
  END IF;

  UPDATE public.push_campaigns
  SET
    total_targets = v_total,
    sent_count = v_sent,
    delivered_count = v_delivered,
    clicked_count = v_clicked,
    failed_count = v_failed,
    expired_count = v_expired,
    status = v_new_status,
    completed_at = CASE
      WHEN v_remaining = 0 AND completed_at IS NULL THEN now()
      ELSE completed_at
    END
  WHERE id = p_campaign_id;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.notification_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

-- Kategori dapat dibaca publik / authenticated
DROP POLICY IF EXISTS "notification_categories_select_all" ON public.notification_categories;
CREATE POLICY "notification_categories_select_all"
  ON public.notification_categories FOR SELECT
  USING (true);

-- User hanya bisa baca in-app notification & preferensi miliknya sendiri
DROP POLICY IF EXISTS "in_app_notifications_select_own" ON public.in_app_notifications;
CREATE POLICY "in_app_notifications_select_own"
  ON public.in_app_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "in_app_notifications_update_own" ON public.in_app_notifications;
CREATE POLICY "in_app_notifications_update_own"
  ON public.in_app_notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_notification_preferences_own" ON public.user_notification_preferences;
CREATE POLICY "user_notification_preferences_own"
  ON public.user_notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_notification_settings_own" ON public.user_notification_settings;
CREATE POLICY "user_notification_settings_own"
  ON public.user_notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
