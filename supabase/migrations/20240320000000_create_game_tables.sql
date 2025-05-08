-- Create games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    white_player_id UUID REFERENCES auth.users(id),
    black_player_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'finished', 'abandoned')),
    result TEXT CHECK (result IN ('white', 'black', 'draw')),
    current_fen TEXT NOT NULL,
    last_move JSONB,
    turn TEXT NOT NULL CHECK (turn IN ('white', 'black')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create moves table
CREATE TABLE moves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    move JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Users can view their own games"
    ON games FOR SELECT
    USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

CREATE POLICY "Users can update their own games"
    ON games FOR UPDATE
    USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

-- Moves policies
CREATE POLICY "Users can view moves in their games"
    ON moves FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM games
            WHERE games.id = moves.game_id
            AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert moves in their games"
    ON moves FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM games
            WHERE games.id = moves.game_id
            AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for games table
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 