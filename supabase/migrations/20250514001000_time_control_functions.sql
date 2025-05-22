-- Time control utility functions for chess game

-- IMPORTANT: These values must match the default time control in:
-- 1. Client-side constants: src/constants/timeControl.ts
-- 2. Server-side constants: supabase/functions/_shared/constants.ts

-- Function to calculate time remaining after a move
CREATE OR REPLACE FUNCTION public.update_time_remaining()
RETURNS TRIGGER AS $$
DECLARE
  time_used BIGINT;
  player_time_column TEXT;
  current_player_color TEXT;
BEGIN
  -- If time control is not set, or status is not active, do nothing
  IF NEW.time_control IS NULL OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  
  -- Handle time update based on turn change or banning player change
  IF OLD.turn <> NEW.turn OR OLD.banning_player IS DISTINCT FROM NEW.banning_player THEN
    -- Calculate time used (time between moves)
    time_used := EXTRACT(EPOCH FROM (NEW.updated_at - OLD.updated_at)) * 1000; -- milliseconds
    
    -- Determine which player was active (whose time was running)
    -- If there was a banning player, their time was running
    IF OLD.banning_player IS NOT NULL THEN
      IF OLD.banning_player = 'white' THEN
        player_time_column := 'white_time_remaining';
      ELSE
        player_time_column := 'black_time_remaining';
      END IF;
    ELSE
      -- Otherwise, use the player whose turn it was
      IF OLD.turn = 'white' THEN
        player_time_column := 'white_time_remaining';
      ELSE
        player_time_column := 'black_time_remaining';
      END IF;
    END IF;
    
    -- Update time remaining for the player who was active
    IF player_time_column = 'white_time_remaining' THEN
      -- Update white player time (subtract time used)
      NEW.white_time_remaining := GREATEST(0, COALESCE(OLD.white_time_remaining, (NEW.time_control->>'initial_time')::BIGINT) - time_used);
    ELSE
      -- Update black player time (subtract time used)
      NEW.black_time_remaining := GREATEST(0, COALESCE(OLD.black_time_remaining, (NEW.time_control->>'initial_time')::BIGINT) - time_used);
    END IF;
  END IF;
  
  -- No longer check for timeout here - this will be done in a separate AFTER trigger
  -- PERFORM public.check_time_forfeit(NEW);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a player has run out of time and update game status accordingly
CREATE OR REPLACE FUNCTION public.check_time_forfeit()
RETURNS TRIGGER AS $$
BEGIN
  -- If white player has run out of time
  IF NEW.white_time_remaining = 0 AND NEW.status = 'active' THEN
    UPDATE public.games
    SET 
      status = 'finished',
      result = 'black',
      end_reason = 'timeout'
    WHERE id = NEW.id;
    
    -- Log the event
    INSERT INTO public.event_log 
      (event_type, entity_type, entity_id, data)
    VALUES 
      ('game_timeout', 'game', NEW.id, json_build_object('player', 'white'));
  
  -- If black player has run out of time
  ELSIF NEW.black_time_remaining = 0 AND NEW.status = 'active' THEN
    UPDATE public.games
    SET 
      status = 'finished',
      result = 'white',
      end_reason = 'timeout'
    WHERE id = NEW.id;
    
    -- Log the event
    INSERT INTO public.event_log 
      (event_type, entity_type, entity_id, data)
    VALUES 
      ('game_timeout', 'game', NEW.id, json_build_object('player', 'black'));
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update time remaining when a move is made (BEFORE trigger)
DROP TRIGGER IF EXISTS update_time_remaining_trigger ON public.games;
CREATE TRIGGER update_time_remaining_trigger
BEFORE UPDATE ON public.games
FOR EACH ROW
WHEN (OLD.turn IS DISTINCT FROM NEW.turn OR OLD.banning_player IS DISTINCT FROM NEW.banning_player)
EXECUTE FUNCTION public.update_time_remaining();

-- Create a separate trigger to check for timeout after the time has been updated (AFTER trigger)
DROP TRIGGER IF EXISTS check_time_forfeit_trigger ON public.games;
CREATE TRIGGER check_time_forfeit_trigger
AFTER UPDATE ON public.games
FOR EACH ROW
WHEN (NEW.status = 'active' AND (NEW.white_time_remaining = 0 OR NEW.black_time_remaining = 0))
EXECUTE FUNCTION public.check_time_forfeit();

-- Function to initialize time control settings for a new game
CREATE OR REPLACE FUNCTION public.initialize_time_control()
RETURNS TRIGGER AS $$
BEGIN
  -- If time control is not set, initialize with default values
  IF NEW.time_control IS NULL THEN
    NEW.time_control := '{"initial_time": 600000, "increment": 0}'::jsonb;
    NEW.white_time_remaining := 600000;
    NEW.black_time_remaining := 600000;
  -- If time control is set, but time remaining is not initialized
  ELSIF NEW.white_time_remaining IS NULL OR NEW.black_time_remaining IS NULL THEN
    -- Set initial time for both players
    NEW.white_time_remaining := (NEW.time_control->>'initial_time')::BIGINT;
    NEW.black_time_remaining := (NEW.time_control->>'initial_time')::BIGINT;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger to fire for all new games (remove the WHEN condition)
DROP TRIGGER IF EXISTS initialize_time_control_trigger ON public.games;
CREATE TRIGGER initialize_time_control_trigger
BEFORE INSERT OR UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.initialize_time_control();

-- Add timeout as a new end reason enum option
ALTER TYPE public.end_reason ADD VALUE IF NOT EXISTS 'timeout';

-- Update existing games with default time control if not set
-- Using the default values from constants
UPDATE public.games
SET 
  time_control = '{"initial_time": 600000, "increment": 0}'::jsonb,
  white_time_remaining = 600000,
  black_time_remaining = 600000
WHERE 
  time_control IS NULL AND
  status = 'active'; 