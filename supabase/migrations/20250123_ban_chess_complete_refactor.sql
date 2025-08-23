-- Complete Ban Chess Refactor Migration
-- This migration completely replaces the old chess.ts-based schema with ban-chess.ts

-- Drop all existing game-related tables
DROP TABLE IF EXISTS game_messages CASCADE;
DROP TABLE IF EXISTS game_moves CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS matchmaking_queue CASCADE;

-- Create new simplified games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_chess_state TEXT NOT NULL, -- Serialized BanChess engine state
  white_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  black_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  winner TEXT CHECK (winner IN ('white', 'black', 'draw', NULL)),
  result_reason TEXT,
  time_control_minutes INTEGER DEFAULT 10,
  increment_seconds INTEGER DEFAULT 0,
  white_time_remaining INTEGER,
  black_time_remaining INTEGER,
  last_move_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create new simplified moves table
CREATE TABLE game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban', 'move')),
  action_data JSONB NOT NULL, -- {from, to, promotion?}
  ply INTEGER NOT NULL,
  time_taken_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create game messages table (simplified)
CREATE TABLE game_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'system')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create matchmaking queue table
CREATE TABLE matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  time_control_minutes INTEGER DEFAULT 10,
  increment_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id)
);

-- Create indexes
CREATE INDEX idx_games_white_player ON games(white_player_id);
CREATE INDEX idx_games_black_player ON games(black_player_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX idx_game_moves_ply ON game_moves(game_id, ply);
CREATE INDEX idx_game_messages_game_id ON game_messages(game_id);
CREATE INDEX idx_matchmaking_queue_created_at ON matchmaking_queue(created_at);

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games
CREATE POLICY "Games are viewable by players and spectators" ON games
  FOR SELECT USING (true);

CREATE POLICY "Players can update their own games" ON games
  FOR UPDATE USING (
    auth.uid() IN (white_player_id, black_player_id)
  );

-- RLS Policies for game_moves
CREATE POLICY "Moves are viewable by anyone" ON game_moves
  FOR SELECT USING (true);

CREATE POLICY "Players can insert moves in their games" ON game_moves
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_moves.game_id
      AND auth.uid() IN (games.white_player_id, games.black_player_id)
    )
  );

-- RLS Policies for game_messages
CREATE POLICY "Messages are viewable by game participants" ON game_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_messages.game_id
      AND (auth.uid() IN (games.white_player_id, games.black_player_id) OR true) -- Allow spectators
    )
  );

CREATE POLICY "Players can send messages in their games" ON game_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_messages.game_id
      AND auth.uid() IN (games.white_player_id, games.black_player_id)
    )
  );

-- RLS Policies for matchmaking_queue
CREATE POLICY "Queue entries are viewable by owner" ON matchmaking_queue
  FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Players can add themselves to queue" ON matchmaking_queue
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can remove themselves from queue" ON matchmaking_queue
  FOR DELETE USING (auth.uid() = player_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating updated_at
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();