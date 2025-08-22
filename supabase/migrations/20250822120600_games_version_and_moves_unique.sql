-- Add version column to games and enforce single move per ply
DO $$ BEGIN
  ALTER TABLE public.games ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN
  -- ignore
END $$;

-- Unique index to ensure a single move row per ply per game
CREATE UNIQUE INDEX IF NOT EXISTS uniq_moves_game_ply ON public.moves (game_id, ply_number);

-- Optional: drop RPC no longer used by client
DO $$ BEGIN
  DROP FUNCTION IF EXISTS public.get_game_moves(uuid);
EXCEPTION WHEN undefined_function THEN
  -- ignore
END $$;
