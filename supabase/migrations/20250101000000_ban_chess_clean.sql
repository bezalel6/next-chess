-- Ban Chess Complete Schema
-- Clean slate migration - no legacy cruft

-- Create profiles table for users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create games table - simplified for Ban Chess
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_chess_state TEXT NOT NULL, -- BanChess engine state (FEN)
  white_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  black_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  winner TEXT CHECK (winner IN ('white', 'black', 'draw', NULL)),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create game moves table for history
CREATE TABLE game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban', 'move')),
  action_data JSONB NOT NULL, -- {from, to, promotion?}
  ply INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create matchmaking queue
CREATE TABLE matchmaking_queue (
  player_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_games_players ON games(white_player_id, black_player_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX idx_game_moves_ply ON game_moves(game_id, ply);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Games policies
CREATE POLICY "Games are viewable by everyone" ON games
  FOR SELECT USING (true);

CREATE POLICY "Players can update their games" ON games
  FOR UPDATE USING (
    auth.uid() = white_player_id OR 
    auth.uid() = black_player_id
  );

-- Game moves policies
CREATE POLICY "Moves are viewable by everyone" ON game_moves
  FOR SELECT USING (true);

CREATE POLICY "Players can insert moves" ON game_moves
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = game_moves.game_id 
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

-- Matchmaking queue policies
CREATE POLICY "Queue entries are viewable by owner" ON matchmaking_queue
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "Players can add themselves to queue" ON matchmaking_queue
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "Players can remove themselves from queue" ON matchmaking_queue
  FOR DELETE USING (player_id = auth.uid());

-- Function to handle profile creation on signup
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_moves;
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_queue;