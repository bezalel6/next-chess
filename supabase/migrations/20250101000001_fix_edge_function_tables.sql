-- Fix tables to match what edge functions expect

-- Rename matchmaking_queue to matchmaking
ALTER TABLE matchmaking_queue RENAME TO matchmaking;

-- Add missing columns that edge functions expect
ALTER TABLE matchmaking 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Update primary key if needed
ALTER TABLE matchmaking DROP CONSTRAINT IF EXISTS matchmaking_queue_pkey;
ALTER TABLE matchmaking ADD PRIMARY KEY (id);
ALTER TABLE matchmaking ADD UNIQUE (player_id);

-- Add missing columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_online TIMESTAMPTZ DEFAULT now();

-- Add missing columns to games  
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS current_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  ADD COLUMN IF NOT EXISTS pgn TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS turn TEXT DEFAULT 'white',
  ADD COLUMN IF NOT EXISTS banning_player TEXT DEFAULT 'black',
  ADD COLUMN IF NOT EXISTS time_control JSONB DEFAULT '{"initial_time": 600, "increment": 0}',
  ADD COLUMN IF NOT EXISTS white_time_remaining INTEGER DEFAULT 600,
  ADD COLUMN IF NOT EXISTS black_time_remaining INTEGER DEFAULT 600,
  ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ DEFAULT now();

-- Create event_log table for debugging
CREATE TABLE IF NOT EXISTS event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create time_controls table
CREATE TABLE IF NOT EXISTS time_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initial_time INTEGER NOT NULL,
  increment INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default time control
INSERT INTO time_controls (name, initial_time, increment, is_default)
VALUES ('Standard 10+0', 600, 0, true)
ON CONFLICT DO NOTHING;

-- Add RLS policies for new tables
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_controls ENABLE ROW LEVEL SECURITY;

-- Allow all to read time controls
CREATE POLICY "time_controls_read" ON time_controls FOR SELECT USING (true);

-- Allow authenticated users to read event logs
CREATE POLICY "event_log_read" ON event_log FOR SELECT TO authenticated USING (true);

-- Allow service role to insert event logs
CREATE POLICY "event_log_insert" ON event_log FOR INSERT TO service_role WITH CHECK (true);

-- Update RLS policies for matchmaking
CREATE POLICY "matchmaking_read_own" ON matchmaking FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "matchmaking_insert_own" ON matchmaking FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "matchmaking_update_own" ON matchmaking FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "matchmaking_delete_own" ON matchmaking FOR DELETE USING (auth.uid() = player_id);