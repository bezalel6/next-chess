-- Real-time Clock System Migration
-- Implements timestamp-based time tracking based on Lichess methodology

-- Add columns for timestamp-based tracking
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS white_turn_start_time BIGINT,
  ADD COLUMN IF NOT EXISTS black_turn_start_time BIGINT,
  ADD COLUMN IF NOT EXISTS last_clock_update TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS clock_state JSONB,
  ADD COLUMN IF NOT EXISTS lag_compensation_ms INTEGER DEFAULT 0;

-- Create index for active games with running clocks
CREATE INDEX IF NOT EXISTS idx_games_active_clocks 
ON public.games(id) 
WHERE status = 'active' AND (white_turn_start_time IS NOT NULL OR black_turn_start_time IS NOT NULL);

-- Function to calculate real-time remaining (timestamp-based)
CREATE OR REPLACE FUNCTION public.calculate_time_remaining(
  initial_time BIGINT,
  turn_start_time BIGINT,
  current_ts BIGINT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  now_ms BIGINT;
  time_used BIGINT;
BEGIN
  -- Use provided timestamp or current time
  IF current_ts IS NULL THEN
    now_ms := EXTRACT(EPOCH FROM NOW()) * 1000;
  ELSE
    now_ms := current_ts;
  END IF;
  
  -- If no turn started, return initial time
  IF turn_start_time IS NULL THEN
    RETURN initial_time;
  END IF;
  
  -- Calculate time used
  time_used := now_ms - turn_start_time;
  
  -- Return remaining time (minimum 0)
  RETURN GREATEST(0, initial_time - time_used);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to start a player's clock
CREATE OR REPLACE FUNCTION public.start_player_clock(
  game_id UUID,
  player_color player_color
) RETURNS VOID AS $$
DECLARE
  now_ms BIGINT;
BEGIN
  now_ms := EXTRACT(EPOCH FROM NOW()) * 1000;
  
  IF player_color = 'white' THEN
    UPDATE games 
    SET 
      white_turn_start_time = now_ms,
      black_turn_start_time = NULL,
      last_clock_update = NOW()
    WHERE id = game_id;
  ELSE
    UPDATE games 
    SET 
      black_turn_start_time = now_ms,
      white_turn_start_time = NULL,
      last_clock_update = NOW()
    WHERE id = game_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to stop a player's clock and apply increment
CREATE OR REPLACE FUNCTION public.stop_player_clock(
  game_id UUID,
  player_color player_color,
  apply_increment BOOLEAN DEFAULT TRUE
) RETURNS BIGINT AS $$
DECLARE
  game_record RECORD;
  now_ms BIGINT;
  time_used BIGINT;
  new_time_remaining BIGINT;
  increment_ms BIGINT;
BEGIN
  now_ms := EXTRACT(EPOCH FROM NOW()) * 1000;
  
  -- Get game record
  SELECT * INTO game_record FROM games WHERE id = game_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found: %', game_id;
  END IF;
  
  -- Get increment from time control
  increment_ms := COALESCE((game_record.time_control->>'increment')::BIGINT, 0);
  
  IF player_color = 'white' THEN
    -- Calculate time used
    IF game_record.white_turn_start_time IS NOT NULL THEN
      time_used := now_ms - game_record.white_turn_start_time;
      new_time_remaining := GREATEST(0, game_record.white_time_remaining - time_used);
      
      -- Apply increment if requested
      IF apply_increment AND increment_ms > 0 THEN
        new_time_remaining := new_time_remaining + increment_ms;
      END IF;
      
      -- Update database
      UPDATE games 
      SET 
        white_time_remaining = new_time_remaining,
        white_turn_start_time = NULL,
        last_clock_update = NOW()
      WHERE id = game_id;
      
      RETURN new_time_remaining;
    END IF;
  ELSE
    -- Calculate time used for black
    IF game_record.black_turn_start_time IS NOT NULL THEN
      time_used := now_ms - game_record.black_turn_start_time;
      new_time_remaining := GREATEST(0, game_record.black_time_remaining - time_used);
      
      -- Apply increment if requested
      IF apply_increment AND increment_ms > 0 THEN
        new_time_remaining := new_time_remaining + increment_ms;
      END IF;
      
      -- Update database
      UPDATE games 
      SET 
        black_time_remaining = new_time_remaining,
        black_turn_start_time = NULL,
        last_clock_update = NOW()
      WHERE id = game_id;
      
      RETURN new_time_remaining;
    END IF;
  END IF;
  
  RETURN game_record.white_time_remaining; -- Default return
END;
$$ LANGUAGE plpgsql;

-- Function to handle move with clock update
CREATE OR REPLACE FUNCTION public.handle_move_clock_update(
  game_id UUID,
  moving_color player_color
) RETURNS JSONB AS $$
DECLARE
  game_record RECORD;
  new_time_remaining BIGINT;
  clock_update JSONB;
  now_ms BIGINT;
BEGIN
  now_ms := EXTRACT(EPOCH FROM NOW()) * 1000;
  
  -- Stop moving player's clock with increment
  new_time_remaining := public.stop_player_clock(game_id, moving_color, TRUE);
  
  -- Start opponent's clock
  IF moving_color = 'white' THEN
    PERFORM public.start_player_clock(game_id, 'black');
  ELSE
    PERFORM public.start_player_clock(game_id, 'white');
  END IF;
  
  -- Get updated game state
  SELECT * INTO game_record FROM games WHERE id = game_id;
  
  -- Build clock update message
  clock_update := jsonb_build_object(
    'type', 'clock_update',
    'gameId', game_id,
    'color', moving_color,
    'timeRemaining', new_time_remaining,
    'turnStartTime', now_ms,
    'incrementApplied', (game_record.time_control->>'increment')::BIGINT > 0,
    'whiteTime', game_record.white_time_remaining,
    'blackTime', game_record.black_time_remaining
  );
  
  -- Store clock state
  UPDATE games 
  SET clock_state = clock_update
  WHERE id = game_id;
  
  RETURN clock_update;
END;
$$ LANGUAGE plpgsql;

-- Function to check for time violations
CREATE OR REPLACE FUNCTION public.check_time_violations(
  game_id UUID
) RETURNS player_color AS $$
DECLARE
  game_record RECORD;
  white_remaining BIGINT;
  black_remaining BIGINT;
BEGIN
  SELECT * INTO game_record FROM games WHERE id = game_id;
  
  IF NOT FOUND OR game_record.status != 'active' THEN
    RETURN NULL;
  END IF;
  
  -- Calculate current time remaining for both players
  white_remaining := public.calculate_time_remaining(
    game_record.white_time_remaining,
    game_record.white_turn_start_time
  );
  
  black_remaining := public.calculate_time_remaining(
    game_record.black_time_remaining,
    game_record.black_turn_start_time
  );
  
  -- Check for violations
  IF white_remaining <= 0 AND game_record.white_turn_start_time IS NOT NULL THEN
    -- White flagged
    UPDATE games 
    SET 
      status = 'finished',
      result = 'black',
      end_reason = 'timeout',
      white_time_remaining = 0,
      updated_at = NOW()
    WHERE id = game_id;
    
    RETURN 'white'::player_color;
  ELSIF black_remaining <= 0 AND game_record.black_turn_start_time IS NOT NULL THEN
    -- Black flagged
    UPDATE games 
    SET 
      status = 'finished',
      result = 'white',
      end_reason = 'timeout',
      black_time_remaining = 0,
      updated_at = NOW()
    WHERE id = game_id;
    
    RETURN 'black'::player_color;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Periodic cleanup job for abandoned games with expired clocks
CREATE OR REPLACE FUNCTION public.cleanup_expired_clocks() RETURNS VOID AS $$
DECLARE
  expired_game RECORD;
  flagged_color player_color;
BEGIN
  -- Find all active games with potentially expired clocks
  FOR expired_game IN 
    SELECT id 
    FROM games 
    WHERE status = 'active' 
      AND (white_turn_start_time IS NOT NULL OR black_turn_start_time IS NOT NULL)
      AND last_clock_update < NOW() - INTERVAL '10 seconds'
  LOOP
    flagged_color := public.check_time_violations(expired_game.id);
    
    IF flagged_color IS NOT NULL THEN
      -- Log the timeout
      INSERT INTO game_events (game_id, event_type, event_data, created_at)
      VALUES (
        expired_game.id,
        'time_flag',
        jsonb_build_object(
          'flaggedColor', flagged_color,
          'detectedBy', 'cleanup_job'
        ),
        NOW()
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update move trigger to handle clock
CREATE OR REPLACE FUNCTION public.after_move_clock_update() 
RETURNS TRIGGER AS $$
DECLARE
  clock_update JSONB;
BEGIN
  -- Only process clock for active games with moves
  IF NEW.status = 'active' AND NEW.last_move IS NOT NULL AND OLD.last_move IS DISTINCT FROM NEW.last_move THEN
    -- Determine who just moved based on turn change
    IF OLD.turn = 'white' AND NEW.turn = 'black' THEN
      clock_update := public.handle_move_clock_update(NEW.id, 'white');
    ELSIF OLD.turn = 'black' AND NEW.turn = 'white' THEN
      clock_update := public.handle_move_clock_update(NEW.id, 'black');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for clock updates on moves
DROP TRIGGER IF EXISTS after_move_clock_trigger ON public.games;
CREATE TRIGGER after_move_clock_trigger
AFTER UPDATE ON public.games
FOR EACH ROW
WHEN (NEW.status = 'active' AND OLD.last_move IS DISTINCT FROM NEW.last_move)
EXECUTE FUNCTION public.after_move_clock_update();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_time_remaining(BIGINT, BIGINT, BIGINT) TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_player_clock(UUID, player_color) TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stop_player_clock(UUID, player_color, BOOLEAN) TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_move_clock_update(UUID, player_color) TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_time_violations(UUID) TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_clocks() TO postgres, service_role;

-- Add comment
COMMENT ON COLUMN public.games.white_turn_start_time IS 'Timestamp (ms) when white player turn started';
COMMENT ON COLUMN public.games.black_turn_start_time IS 'Timestamp (ms) when black player turn started';
COMMENT ON COLUMN public.games.last_clock_update IS 'Last time the clock state was updated';
COMMENT ON COLUMN public.games.clock_state IS 'Current clock state for real-time sync';
COMMENT ON COLUMN public.games.lag_compensation_ms IS 'Average lag compensation in milliseconds';