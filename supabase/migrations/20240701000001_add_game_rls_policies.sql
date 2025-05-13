-- Enable RLS on the games table
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Players can view their own games
CREATE POLICY "Players can view their own games" ON games
  FOR SELECT
  USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

-- Players can only update games they are part of and only when it's their turn 
-- This is a backup defense - primary security should be via Edge Functions
CREATE POLICY "Players can update their games on their turn" ON games
  FOR UPDATE
  USING (
    (auth.uid() = white_player_id AND turn = 'white') OR 
    (auth.uid() = black_player_id AND turn = 'black')
  );

-- Edge Function Role can bypass RLS
CREATE POLICY "Service role can do everything" ON games
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable RLS on the moves table 
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Players can view moves for their games
CREATE POLICY "Players can view moves for their games" ON moves
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = moves.game_id 
      AND (auth.uid() = games.white_player_id OR auth.uid() = games.black_player_id)
    )
  );

-- Only Edge Functions should insert moves
CREATE POLICY "Service role can insert moves" ON moves
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role'); 