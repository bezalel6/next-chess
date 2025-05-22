-- Time control utility functions for chess game

-- Function to calculate time remaining after a move
CREATE OR REPLACE FUNCTION public.update_time_remaining()
RETURNS TRIGGER AS $$
DECLARE
  time_used BIGINT;
  player_time_column TEXT;
  time_increment BIGINT;
  current_player_color TEXT;
BEGIN
  -- If time control is not set, or status is not active, do nothing
  IF NEW.time_control IS NULL OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  
  -- Only process if turn has changed (a move was made)
  IF OLD.turn = NEW.turn THEN
    RETURN NEW;
  END IF;
  
  -- Calculate time used (time between moves)
  time_used := EXTRACT(EPOCH FROM (NEW.updated_at - OLD.updated_at)) * 1000; -- milliseconds
  
  -- Determine which player just moved (opposite of current turn)
  current_player_color := NEW.turn;
  
  -- Player who just moved is the opposite of current turn
  IF current_player_color = 'white' THEN
    player_time_column := 'black_time_remaining';
  ELSE
    player_time_column := 'white_time_remaining';
  END IF;
  
  -- Get increment from time control settings
  time_increment := COALESCE((NEW.time_control->>'increment')::BIGINT, 0);
  
  -- Update time remaining for the player who just moved
  IF player_time_column = 'white_time_remaining' THEN
    -- Update white player time (subtract time used, add increment)
    NEW.white_time_remaining := GREATEST(0, COALESCE(OLD.white_time_remaining, (NEW.time_control->>'initial_time')::BIGINT) - time_used) + time_increment;
  ELSE
    -- Update black player time (subtract time used, add increment)
    NEW.black_time_remaining := GREATEST(0, COALESCE(OLD.black_time_remaining, (NEW.time_control->>'initial_time')::BIGINT) - time_used) + time_increment;
  END IF;
  
  -- Check for timeout
  PERFORM public.check_time_forfeit(NEW);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a player has run out of time and update game status accordingly
CREATE OR REPLACE FUNCTION public.check_time_forfeit(game_row games)
RETURNS void AS $$
BEGIN
  -- If white player has run out of time
  IF game_row.white_time_remaining = 0 AND game_row.status = 'active' THEN
    UPDATE public.games
    SET 
      status = 'finished',
      result = 'black',
      end_reason = 'timeout'
    WHERE id = game_row.id;
    
    -- Log the event
    INSERT INTO public.event_log 
      (event_type, entity_type, entity_id, data)
    VALUES 
      ('game_timeout', 'game', game_row.id, json_build_object('player', 'white'));
  
  -- If black player has run out of time
  ELSIF game_row.black_time_remaining = 0 AND game_row.status = 'active' THEN
    UPDATE public.games
    SET 
      status = 'finished',
      result = 'white',
      end_reason = 'timeout'
    WHERE id = game_row.id;
    
    -- Log the event
    INSERT INTO public.event_log 
      (event_type, entity_type, entity_id, data)
    VALUES 
      ('game_timeout', 'game', game_row.id, json_build_object('player', 'black'));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update time remaining when a move is made
DROP TRIGGER IF EXISTS update_time_remaining_trigger ON public.games;
CREATE TRIGGER update_time_remaining_trigger
BEFORE UPDATE ON public.games
FOR EACH ROW
WHEN (OLD.turn IS DISTINCT FROM NEW.turn) -- Only trigger when turn changes (a move was made)
EXECUTE FUNCTION public.update_time_remaining();

-- Function to initialize time control settings for a new game
CREATE OR REPLACE FUNCTION public.initialize_time_control()
RETURNS TRIGGER AS $$
BEGIN
  -- If time control is set, but time remaining is not initialized
  IF NEW.time_control IS NOT NULL 
     AND (NEW.white_time_remaining IS NULL OR NEW.black_time_remaining IS NULL) THEN
    
    -- Set initial time for both players
    NEW.white_time_remaining := (NEW.time_control->>'initial_time')::BIGINT;
    NEW.black_time_remaining := (NEW.time_control->>'initial_time')::BIGINT;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to initialize time control for new games
DROP TRIGGER IF EXISTS initialize_time_control_trigger ON public.games;
CREATE TRIGGER initialize_time_control_trigger
BEFORE INSERT OR UPDATE ON public.games
FOR EACH ROW
WHEN (NEW.time_control IS NOT NULL AND 
     (NEW.white_time_remaining IS NULL OR NEW.black_time_remaining IS NULL))
EXECUTE FUNCTION public.initialize_time_control();

-- Add timeout as a new end reason enum option
ALTER TYPE public.end_reason ADD VALUE IF NOT EXISTS 'timeout';

-- Update existing games with default time control if not set
UPDATE public.games
SET 
  time_control = '{"initial_time": 600000, "increment": 0}'::jsonb,
  white_time_remaining = 600000,
  black_time_remaining = 600000
WHERE 
  time_control IS NULL AND
  status = 'active'; 