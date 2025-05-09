-- This is the complete schema definition for the chess app
-- It defines all tables, functions, and policies in one file

-- Create function to generate random short IDs
CREATE OR REPLACE FUNCTION public.generate_short_id(length integer DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Create games table with short IDs and PGN
CREATE TABLE public.games (
    id TEXT PRIMARY KEY DEFAULT public.generate_short_id(),
    white_player_id UUID REFERENCES auth.users(id),
    black_player_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'finished', 'abandoned')),
    result TEXT CHECK (result IN ('white', 'black', 'draw')),
    current_fen TEXT NOT NULL,
    pgn TEXT NOT NULL DEFAULT '',
    last_move JSONB,
    turn TEXT NOT NULL CHECK (turn IN ('white', 'black')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create moves table with short IDs
CREATE TABLE public.moves (
    id TEXT PRIMARY KEY DEFAULT public.generate_short_id(10),
    game_id TEXT REFERENCES public.games(id) ON DELETE CASCADE,
    move JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_games_white_player ON public.games(white_player_id);
CREATE INDEX idx_games_black_player ON public.games(black_player_id);
CREATE INDEX idx_moves_game_id ON public.moves(game_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for games table
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Users can view their own games"
    ON public.games FOR SELECT
    USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

CREATE POLICY "Users can update their own games"
    ON public.games FOR UPDATE
    USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

CREATE POLICY "Users can insert games"
    ON public.games FOR INSERT
    WITH CHECK (
        auth.uid() = white_player_id OR auth.uid() = black_player_id
    );

-- Moves policies
CREATE POLICY "Users can view moves in their games"
    ON public.moves FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.games
            WHERE public.games.id = public.moves.game_id
            AND (public.games.white_player_id = auth.uid() OR public.games.black_player_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert moves in their games"
    ON public.moves FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games
            WHERE public.games.id = public.moves.game_id
            AND (public.games.white_player_id = auth.uid() OR public.games.black_player_id = auth.uid())
        )
    );

-- Add column description
COMMENT ON COLUMN public.games.pgn IS 'Portable Game Notation (PGN) for the chess game, storing the move history'; 