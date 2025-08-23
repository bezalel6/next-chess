-- Nuke and recreate matchmaking table properly

-- Drop the table completely
DROP TABLE IF EXISTS matchmaking CASCADE;

-- Recreate it fresh with correct constraints
CREATE TABLE matchmaking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'waiting',
  joined_at TIMESTAMPTZ DEFAULT now(),
  preferences JSONB DEFAULT '{}',
  rating_min INTEGER,
  rating_max INTEGER,
  time_control_id UUID REFERENCES time_controls(id),
  UNIQUE(player_id)
);

-- Create indexes
CREATE INDEX idx_matchmaking_player_id ON matchmaking(player_id);
CREATE INDEX idx_matchmaking_status ON matchmaking(status);
CREATE INDEX idx_matchmaking_joined_at ON matchmaking(joined_at);

-- Enable RLS
ALTER TABLE matchmaking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own matchmaking entries" ON matchmaking
  FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Users can insert their own matchmaking entries" ON matchmaking
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own matchmaking entries" ON matchmaking
  FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Users can delete their own matchmaking entries" ON matchmaking
  FOR DELETE USING (auth.uid() = player_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking;

COMMENT ON TABLE matchmaking IS 'Queue for players looking for matches';