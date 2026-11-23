-- 0044: Enable Supabase Realtime Publication on in_app_notifications
-- Menggantikan kebutuhan polling HTTP 45 detik pada NotificationBell dengan push event WebSocket (postgres_changes)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'in_app_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
    END IF;
  END IF;
END
$$;
