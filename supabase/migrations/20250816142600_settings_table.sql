-- Settings table for app configuration

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default time control: 10 minutes, 0 increment (milliseconds)
INSERT INTO public.settings (key, value)
VALUES (
  'default_time_control',
  '{"initial_time": 600000, "increment": 0}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- RLS policies
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Read for everyone
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_select_all'
  ) THEN
    CREATE POLICY settings_select_all ON public.settings FOR SELECT USING (true);
  END IF;
END $$;

-- Write for service_role only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_service_all'
  ) THEN
    CREATE POLICY settings_service_all ON public.settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

