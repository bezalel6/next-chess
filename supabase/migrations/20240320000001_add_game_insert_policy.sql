-- Add INSERT policy for games table
CREATE POLICY "Users can create games where they are a player"
    ON games FOR INSERT
    WITH CHECK (auth.uid() = white_player_id OR auth.uid() = black_player_id);

-- Add policy to allow service role to create games
CREATE POLICY "Service role can create games"
    ON games FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Debug policy: Allow all inserts
CREATE POLICY "Debug: Allow all inserts"
    ON games FOR INSERT
    WITH CHECK (true); 