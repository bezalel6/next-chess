-- Allow clients to read moves so move history populates
-- Previously only service_role could access moves; that caused empty results via RPC

ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='moves' AND policyname='moves_select_all'
  ) THEN
    CREATE POLICY moves_select_all ON public.moves
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

