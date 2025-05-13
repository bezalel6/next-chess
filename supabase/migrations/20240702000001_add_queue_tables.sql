-- Create the queue table for users waiting to be matched
CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, matched, cancelled
  preferences JSONB DEFAULT '{}'::jsonb, -- optional preferences for matching
  UNIQUE (user_id)
);

-- Create notifications table for queue events
CREATE TABLE IF NOT EXISTS queue_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  white_player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  black_player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB DEFAULT NULL
);

-- Add RLS policies
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue position
CREATE POLICY "Users can view their own queue position" ON queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own queue entry
CREATE POLICY "Users can remove themselves from queue" ON queue
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can insert themselves into the queue
CREATE POLICY "Users can add themselves to the queue" ON queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view notifications for their own games
CREATE POLICY "Users can view their own notifications" ON queue_notifications
  FOR SELECT
  USING (
    auth.uid() = white_player_id OR 
    auth.uid() = black_player_id
  );

-- Only service role can insert notifications
CREATE POLICY "Service role can insert notifications" ON queue_notifications
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Index for performance
CREATE INDEX IF NOT EXISTS queue_joined_at_idx ON queue (joined_at);
CREATE INDEX IF NOT EXISTS queue_status_idx ON queue (status);
CREATE INDEX IF NOT EXISTS queue_notifications_game_id_idx ON queue_notifications (game_id);

-- Function to automatically match players in the queue
CREATE OR REPLACE FUNCTION match_players() RETURNS TRIGGER AS $$
BEGIN
  -- Check if we have at least 2 players in the queue
  IF (SELECT COUNT(*) FROM queue WHERE status = 'waiting') >= 2 THEN
    -- Get the two oldest players in the queue
    WITH matched_players AS (
      SELECT id, user_id 
      FROM queue 
      WHERE status = 'waiting' 
      ORDER BY joined_at ASC 
      LIMIT 2
    )
    UPDATE queue
    SET status = 'matched'
    WHERE id IN (SELECT id FROM matched_players);
    
    -- Notify through the notification system could happen here
    -- or via a trigger on queue update
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run the matching function when a new player joins
CREATE TRIGGER match_players_trigger
AFTER INSERT ON queue
FOR EACH ROW
EXECUTE FUNCTION match_players();

-- Trigger to run the matching function when a player leaves (might free up a spot)
CREATE TRIGGER match_players_leave_trigger
AFTER UPDATE OR DELETE ON queue
FOR EACH ROW
EXECUTE FUNCTION match_players(); 