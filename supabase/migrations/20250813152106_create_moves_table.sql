-- Create moves table for efficient move history tracking
CREATE TABLE IF NOT EXISTS moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  ply_number INTEGER NOT NULL, -- 0-indexed: 0=white's first, 1=black's first, etc
  player_color TEXT NOT NULL CHECK (player_color IN ('white', 'black')),
  
  -- Move data
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  promotion TEXT,
  san TEXT NOT NULL, -- Standard Algebraic Notation (e.g., "Nf3", "e4")
  fen_after TEXT NOT NULL, -- Position after this move
  
  -- Ban data (if this ply had a ban before it)
  banned_from TEXT,
  banned_to TEXT,
  banned_by TEXT CHECK (banned_by IN ('white', 'black', NULL)),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  time_taken_ms INTEGER, -- Time taken to make this move in milliseconds
  
  -- Ensure moves are unique per game
  UNIQUE(game_id, ply_number)
);

-- Create indexes for fast queries
CREATE INDEX idx_moves_game_id ON moves(game_id);
CREATE INDEX idx_moves_game_ply ON moves(game_id, ply_number);
CREATE INDEX idx_moves_created_at ON moves(created_at);

-- Enable RLS
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Players can view moves for games they're in or public games
CREATE POLICY "View game moves" ON moves
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = moves.game_id
      AND (
        games.white_player_id = auth.uid() 
        OR games.black_player_id = auth.uid()
        OR games.status = 'finished' -- Allow viewing finished games
      )
    )
  );

-- Only server can insert moves (via service role)
CREATE POLICY "Server inserts moves" ON moves
  FOR INSERT
  WITH CHECK (false);

-- Function to get moves for a game in order
CREATE OR REPLACE FUNCTION get_game_moves(p_game_id TEXT)
RETURNS TABLE (
  id UUID,
  move_number INTEGER,
  ply_number INTEGER,
  player_color TEXT,
  from_square TEXT,
  to_square TEXT,
  promotion TEXT,
  san TEXT,
  fen_after TEXT,
  banned_from TEXT,
  banned_to TEXT,
  banned_by TEXT,
  time_taken_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.move_number,
    m.ply_number,
    m.player_color,
    m.from_square,
    m.to_square,
    m.promotion,
    m.san,
    m.fen_after,
    m.banned_from,
    m.banned_to,
    m.banned_by,
    m.time_taken_ms
  FROM moves m
  WHERE m.game_id = p_game_id
  ORDER BY m.ply_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to broadcast move updates
CREATE OR REPLACE FUNCTION broadcast_move_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Broadcast the new move to the game channel
  PERFORM pg_notify(
    'game_move_' || NEW.game_id::text,
    json_build_object(
      'id', NEW.id,
      'ply_number', NEW.ply_number,
      'player_color', NEW.player_color,
      'san', NEW.san,
      'from_square', NEW.from_square,
      'to_square', NEW.to_square,
      'fen_after', NEW.fen_after,
      'banned_from', NEW.banned_from,
      'banned_to', NEW.banned_to
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_broadcast_move
AFTER INSERT ON moves
FOR EACH ROW
EXECUTE FUNCTION broadcast_move_update();