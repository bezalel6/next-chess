-- Add new columns to the games table for draw offers, game end reason, and rematch functionality

-- Add column for draw offers
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS draw_offered_by TEXT CHECK (draw_offered_by IN ('white', 'black'));

-- Add column for game end reason
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS end_reason TEXT CHECK (
    end_reason IN (
        'checkmate', 
        'resignation', 
        'draw_agreement', 
        'stalemate', 
        'insufficient_material', 
        'threefold_repetition', 
        'fifty_move_rule'
    )
);

-- Add column for rematch offers
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS rematch_offered_by TEXT CHECK (rematch_offered_by IN ('white', 'black'));

-- Add column for parent game ID (original game that led to a rematch)
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS parent_game_id TEXT REFERENCES public.games(id);

-- Handle banningPlayer column - first check if it exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'games' 
        AND column_name = 'banningPlayer'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.games 
        ADD COLUMN "banningPlayer" TEXT CHECK ("banningPlayer" IN ('white', 'black'));
    ELSE
        -- If it exists, we'll validate that it has the proper constraint
        -- Drop any existing constraint first to avoid conflicts
        ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_banningplayer_check;
        
        -- Add the constraint back
        ALTER TABLE public.games 
        ADD CONSTRAINT games_banningplayer_check CHECK ("banningPlayer" IN ('white', 'black'));
    END IF;
END
$$;

-- Update COMMENT for new columns
COMMENT ON COLUMN public.games.draw_offered_by IS 'The color of the player who offered a draw';
COMMENT ON COLUMN public.games.end_reason IS 'The reason the game ended (checkmate, resignation, etc.)';
COMMENT ON COLUMN public.games.rematch_offered_by IS 'The color of the player who offered a rematch';
COMMENT ON COLUMN public.games.parent_game_id IS 'The ID of the original game that led to this rematch';
COMMENT ON COLUMN public.games."banningPlayer" IS 'The color of the player who is currently banning a move';

-- Create index for parent game lookups
CREATE INDEX IF NOT EXISTS idx_games_parent_game_id ON public.games(parent_game_id); 