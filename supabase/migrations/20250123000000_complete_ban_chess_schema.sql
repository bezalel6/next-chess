-- Complete Ban Chess Schema Migration
-- This migration creates all necessary tables for the Ban Chess application

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS game_messages CASCADE;
DROP TABLE IF EXISTS bug_reports CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Create game_messages table for in-game chat
CREATE TABLE game_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create bug_reports table
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'other')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create settings table for user preferences
CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  sound_enabled BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  board_style TEXT DEFAULT 'default',
  piece_style TEXT DEFAULT 'default',
  auto_queen BOOLEAN DEFAULT true,
  premove_enabled BOOLEAN DEFAULT true,
  highlight_moves BOOLEAN DEFAULT true,
  show_legal_moves BOOLEAN DEFAULT true,
  show_coordinates BOOLEAN DEFAULT true,
  clock_position TEXT DEFAULT 'bottom' CHECK (clock_position IN ('top', 'bottom', 'side')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing indexes for performance
CREATE INDEX idx_game_messages_game_id ON game_messages(game_id);
CREATE INDEX idx_game_messages_created_at ON game_messages(created_at DESC);
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);

-- Add missing columns to games table if they don't exist
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS move_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ban_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS spectators UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_rated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elo_change_white INTEGER,
  ADD COLUMN IF NOT EXISTS elo_change_black INTEGER,
  ADD COLUMN IF NOT EXISTS opening_name TEXT,
  ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- Add missing columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS games_won INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS games_drawn INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS games_lost INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT CHECK (title IN ('GM', 'IM', 'FM', 'NM', 'CM', 'WGM', 'WIM', 'WFM', 'WNM', 'WCM', NULL));

-- Enable RLS on new tables
ALTER TABLE game_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_messages
CREATE POLICY "Messages are viewable by game participants" ON game_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = game_messages.game_id 
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = game_messages.game_id 
      AND games.is_public = true
    )
  );

CREATE POLICY "Players can send messages in their games" ON game_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = game_messages.game_id 
      AND games.status = 'active'
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
      AND player_id = auth.uid()
    )
  );

-- RLS Policies for bug_reports
CREATE POLICY "Users can view their own bug reports" ON bug_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create bug reports" ON bug_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own bug reports" ON bug_reports
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for settings
CREATE POLICY "Users can view their own settings" ON settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own settings" ON settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own settings" ON settings
  FOR UPDATE USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bug_reports_updated_at BEFORE UPDATE ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update player statistics
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    -- Update white player stats
    IF NEW.winner = 'white' THEN
      UPDATE profiles 
      SET games_played = games_played + 1,
          games_won = games_won + 1,
          elo_rating = COALESCE(elo_rating + NEW.elo_change_white, elo_rating)
      WHERE id = NEW.white_player_id;
      
      UPDATE profiles 
      SET games_played = games_played + 1,
          games_lost = games_lost + 1,
          elo_rating = COALESCE(elo_rating + NEW.elo_change_black, elo_rating)
      WHERE id = NEW.black_player_id;
    ELSIF NEW.winner = 'black' THEN
      UPDATE profiles 
      SET games_played = games_played + 1,
          games_lost = games_lost + 1,
          elo_rating = COALESCE(elo_rating + NEW.elo_change_white, elo_rating)
      WHERE id = NEW.white_player_id;
      
      UPDATE profiles 
      SET games_played = games_played + 1,
          games_won = games_won + 1,
          elo_rating = COALESCE(elo_rating + NEW.elo_change_black, elo_rating)
      WHERE id = NEW.black_player_id;
    ELSIF NEW.winner = 'draw' THEN
      UPDATE profiles 
      SET games_played = games_played + 1,
          games_drawn = games_drawn + 1,
          elo_rating = COALESCE(elo_rating + NEW.elo_change_white, elo_rating)
      WHERE id = NEW.white_player_id;
      
      UPDATE profiles 
      SET games_played = games_played + 1,
          games_drawn = games_drawn + 1,
          elo_rating = COALESCE(elo_rating + NEW.elo_change_black, elo_rating)
      WHERE id = NEW.black_player_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating player stats
CREATE TRIGGER update_player_stats_on_game_end
  AFTER UPDATE ON games
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status = 'completed')
  EXECUTE FUNCTION update_player_stats();

-- Function to auto-create settings for new users
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-creating settings
CREATE TRIGGER create_settings_on_profile_create
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_settings();

-- Add realtime subscriptions for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE bug_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- Create view for active games with player info
CREATE OR REPLACE VIEW active_games_view AS
SELECT 
  g.*,
  wp.username as white_username,
  bp.username as black_username,
  wp.elo_rating as white_elo,
  bp.elo_rating as black_elo,
  wp.is_online as white_online,
  bp.is_online as black_online
FROM games g
LEFT JOIN profiles wp ON g.white_player_id = wp.id
LEFT JOIN profiles bp ON g.black_player_id = bp.id
WHERE g.status = 'active';

-- Grant permissions on the view
GRANT SELECT ON active_games_view TO authenticated;
GRANT SELECT ON active_games_view TO anon;

-- Create function to clean up abandoned games
CREATE OR REPLACE FUNCTION cleanup_abandoned_games()
RETURNS void AS $$
BEGIN
  UPDATE games 
  SET status = 'abandoned',
      end_reason = 'timeout'
  WHERE status = 'active' 
    AND last_move_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's active game
CREATE OR REPLACE FUNCTION get_user_active_game(user_id UUID)
RETURNS UUID AS $$
DECLARE
  game_id UUID;
BEGIN
  SELECT id INTO game_id
  FROM games
  WHERE status = 'active'
    AND (white_player_id = user_id OR black_player_id = user_id)
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN game_id;
END;
$$ LANGUAGE plpgsql;

-- Create index for the matchmaking table (was missing)
CREATE INDEX IF NOT EXISTS idx_matchmaking_player_id ON matchmaking(player_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_status ON matchmaking(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_joined_at ON matchmaking(joined_at);

-- Ensure all necessary columns exist in matchmaking table
ALTER TABLE matchmaking
  ADD COLUMN IF NOT EXISTS rating_min INTEGER,
  ADD COLUMN IF NOT EXISTS rating_max INTEGER,
  ADD COLUMN IF NOT EXISTS time_control_id UUID REFERENCES time_controls(id);

-- Create composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_active_players ON games(white_player_id, black_player_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_games_completed_recent ON games(created_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(is_online, last_seen) WHERE is_online = true;

-- Add constraint to ensure game has both players
ALTER TABLE games 
  ADD CONSTRAINT check_players_different 
  CHECK (white_player_id != black_player_id);

-- Add constraint for valid ban_chess_state
ALTER TABLE games 
  ADD CONSTRAINT check_ban_chess_state_not_empty 
  CHECK (ban_chess_state IS NOT NULL AND ban_chess_state != '');

-- Ensure game_moves has proper ordering
ALTER TABLE game_moves 
  ADD CONSTRAINT unique_game_ply 
  UNIQUE (game_id, ply);

-- Function to validate move before insertion
CREATE OR REPLACE FUNCTION validate_game_move()
RETURNS TRIGGER AS $$
DECLARE
  current_ply INTEGER;
  game_status TEXT;
BEGIN
  -- Get current game status and last ply
  SELECT status, COALESCE(MAX(gm.ply), -1) 
  INTO game_status, current_ply
  FROM games g
  LEFT JOIN game_moves gm ON gm.game_id = g.id
  WHERE g.id = NEW.game_id
  GROUP BY g.status;
  
  -- Check game is active
  IF game_status != 'active' THEN
    RAISE EXCEPTION 'Cannot add moves to non-active game';
  END IF;
  
  -- Check ply is sequential
  IF NEW.ply != current_ply + 1 THEN
    RAISE EXCEPTION 'Move ply must be sequential. Expected %, got %', current_ply + 1, NEW.ply;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for move validation
CREATE TRIGGER validate_move_before_insert
  BEFORE INSERT ON game_moves
  FOR EACH ROW
  EXECUTE FUNCTION validate_game_move();

-- Add comment documentation for tables
COMMENT ON TABLE profiles IS 'User profiles with statistics and preferences';
COMMENT ON TABLE games IS 'Ban Chess games with state and metadata';
COMMENT ON TABLE game_moves IS 'Individual moves and bans in games';
COMMENT ON TABLE matchmaking IS 'Queue for finding opponents';
COMMENT ON TABLE game_messages IS 'In-game chat messages';
COMMENT ON TABLE bug_reports IS 'User-submitted bug reports and feedback';
COMMENT ON TABLE settings IS 'User preferences and settings';
COMMENT ON TABLE time_controls IS 'Available time control presets';
COMMENT ON TABLE event_log IS 'System event logging for debugging';

-- Final check: ensure all tables have RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;