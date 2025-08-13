-- Fix Ban Chess game flow to properly implement continuous banning
-- Add proper banned moves tracking

-- Add column to track current banned move for this turn
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS current_banned_move jsonb DEFAULT NULL;

-- Add table to track ban history for analysis and replay
CREATE TABLE IF NOT EXISTS public.ban_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    move_number integer NOT NULL,
    banned_by player_color NOT NULL,
    banned_move jsonb NOT NULL, -- {from: 'e2', to: 'e4'}
    banned_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for fast lookups
CREATE INDEX idx_ban_history_game_id ON public.ban_history(game_id, move_number);

-- Update the game flow: Correct ban phase
-- Games should start with turn='white' and banning_player='black' (Black bans before White's first move)
UPDATE public.games 
SET banning_player = 'black'::player_color  -- Black bans before White's first move
WHERE status = 'active' 
  AND (pgn IS NULL OR pgn = '');  -- No moves made yet

-- Add RLS policies for ban_history
ALTER TABLE public.ban_history ENABLE ROW LEVEL SECURITY;

-- Players can view ban history for games they're in
CREATE POLICY "ban_history_select" ON public.ban_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games
            WHERE games.id = ban_history.game_id
            AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
        )
    );

-- Service role has full access
CREATE POLICY "ban_history_service" ON public.ban_history
    TO service_role USING (true) WITH CHECK (true);