-- Add abandonment tracking fields to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS abandoned_by player_color DEFAULT NULL,
ADD COLUMN IF NOT EXISTS abandoned_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS abandonment_warning_at timestamp with time zone DEFAULT NULL;

-- Index for finding abandoned games
CREATE INDEX IF NOT EXISTS idx_games_abandoned 
ON public.games(abandoned_by) 
WHERE abandoned_by IS NOT NULL;

-- Function to check and mark game abandonment
CREATE OR REPLACE FUNCTION check_game_abandonment(game_id text)
RETURNS void AS $$
DECLARE
  game_record RECORD;
  current_player_id uuid;
  player_last_active timestamp with time zone;
  minutes_inactive integer;
  ABANDONMENT_THRESHOLD_MINUTES constant integer := 5;
  WARNING_THRESHOLD_MINUTES constant integer := 2;
BEGIN
  -- Get game details
  SELECT g.*, 
         CASE 
           WHEN g.turn = 'white' THEN g.white_player_id
           ELSE g.black_player_id
         END as current_player_id
  INTO game_record
  FROM public.games g
  WHERE g.id = game_id
    AND g.status = 'active';
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get player's last activity
  SELECT last_active INTO player_last_active
  FROM public.profiles
  WHERE id = game_record.current_player_id;
  
  IF player_last_active IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate minutes since last active
  minutes_inactive := EXTRACT(EPOCH FROM (now() - player_last_active)) / 60;
  
  -- Check for abandonment (5+ minutes inactive during turn)
  IF minutes_inactive >= ABANDONMENT_THRESHOLD_MINUTES AND game_record.abandoned_by IS NULL THEN
    UPDATE public.games
    SET 
      abandoned_by = game_record.turn,
      abandoned_at = now()
    WHERE id = game_id;
    
    -- Log abandonment event
    INSERT INTO public.event_log (event_type, event_data, user_id)
    VALUES (
      'game_abandoned',
      jsonb_build_object(
        'game_id', game_id,
        'abandoned_by', game_record.turn,
        'minutes_inactive', minutes_inactive
      ),
      game_record.current_player_id
    );
    
  -- Check for warning (2+ minutes inactive)
  ELSIF minutes_inactive >= WARNING_THRESHOLD_MINUTES 
    AND game_record.abandonment_warning_at IS NULL 
    AND game_record.abandoned_by IS NULL THEN
    
    UPDATE public.games
    SET abandonment_warning_at = now()
    WHERE id = game_id;
    
  -- Clear warning if player becomes active again
  ELSIF minutes_inactive < WARNING_THRESHOLD_MINUTES 
    AND (game_record.abandonment_warning_at IS NOT NULL OR game_record.abandoned_by IS NOT NULL) THEN
    
    UPDATE public.games
    SET 
      abandonment_warning_at = NULL,
      abandoned_by = NULL,
      abandoned_at = NULL
    WHERE id = game_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically forfeit abandoned games (optional, not auto-enabled)
CREATE OR REPLACE FUNCTION forfeit_abandoned_games()
RETURNS void AS $$
DECLARE
  FORFEIT_AFTER_MINUTES constant integer := 10;
BEGIN
  UPDATE public.games
  SET 
    status = 'completed',
    result = CASE 
      WHEN abandoned_by = 'white' THEN 'black_wins'
      ELSE 'white_wins'
    END,
    end_reason = 'abandonment'
  WHERE 
    status = 'active'
    AND abandoned_by IS NOT NULL
    AND abandoned_at < now() - (FORFEIT_AFTER_MINUTES || ' minutes')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_game_abandonment TO authenticated;
GRANT EXECUTE ON FUNCTION check_game_abandonment TO service_role;
GRANT EXECUTE ON FUNCTION forfeit_abandoned_games TO service_role;

-- Add RLS policy for abandonment fields (using comprehensive approach from previous migration)
-- These are already covered by existing policies but adding for clarity
COMMENT ON COLUMN public.games.abandoned_by IS 'Player color who abandoned the game';
COMMENT ON COLUMN public.games.abandoned_at IS 'Timestamp when game was marked as abandoned';
COMMENT ON COLUMN public.games.abandonment_warning_at IS 'Timestamp when abandonment warning was issued';