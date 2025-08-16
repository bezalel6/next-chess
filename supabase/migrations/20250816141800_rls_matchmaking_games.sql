-- RLS policies to allow authenticated users to participate in matchmaking and games creation

-- Allow authenticated users to insert a game only if they are one of the players
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND policyname = 'games_insert_participants'
  ) THEN
    CREATE POLICY games_insert_participants
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = white_player_id OR auth.uid() = black_player_id
);
  END IF;
END $$;

-- Allow authenticated users to update a game only if they are one of the players (optional, restrictive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND policyname = 'games_update_participants'
  ) THEN
    CREATE POLICY games_update_participants
ON public.games
FOR UPDATE
TO authenticated
USING (
  auth.uid() = white_player_id OR auth.uid() = black_player_id
)
WITH CHECK (
  auth.uid() = white_player_id OR auth.uid() = black_player_id
);
  END IF;
END $$;

-- Matchmaking: allow players to manage their own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matchmaking' AND policyname = 'matchmaking_crud_owner'
  ) THEN
    CREATE POLICY matchmaking_crud_owner
ON public.matchmaking
FOR ALL
TO authenticated
USING (
  player_id = auth.uid()
)
WITH CHECK (
  player_id = auth.uid()
);
  END IF;
END $$;

