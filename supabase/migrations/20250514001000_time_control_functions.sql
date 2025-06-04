-- Add time control fields to the games table
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS white_time_remaining BIGINT,
  ADD COLUMN IF NOT EXISTS black_time_remaining BIGINT,
  ADD COLUMN IF NOT EXISTS time_control JSONB;

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies for the settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Only allow admins to modify settings
CREATE POLICY "Allow admins to manage settings" ON public.settings
  FOR ALL USING (auth.role() = 'service_role');
  
-- Allow anyone to read settings
CREATE POLICY "Allow anyone to read settings" ON public.settings
  FOR SELECT USING (true);

-- Insert default time control settings if they don't exist
INSERT INTO public.settings (key, value, description)
VALUES (
  'default_time_control',
  '{"initial_time": 600000, "increment": 0}'::jsonb,
  'Default time control settings for chess games (initial_time in milliseconds)'
) ON CONFLICT (key) DO NOTHING;

-- Centralized time control configuration function (now fetches from settings table)
CREATE OR REPLACE FUNCTION public.get_default_time_control()
RETURNS JSONB AS $$
DECLARE
  settings_value JSONB;
BEGIN
  -- Get time control settings from the settings table
  SELECT value INTO settings_value
  FROM public.settings
  WHERE key = 'default_time_control';
  
  -- Return default value if not found in settings table
  IF settings_value IS NULL THEN
    RETURN '{"initial_time": 600000, "increment": 0}'::jsonb;
  END IF;
  
  RETURN settings_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE; -- Changed to STABLE since it reads from DB

-- Grant access to the function via REST API
GRANT EXECUTE ON FUNCTION public.get_default_time_control() TO postgres, anon, authenticated, service_role;

-- Helper function to get the initial time value
CREATE OR REPLACE FUNCTION public.get_default_initial_time()
RETURNS BIGINT AS $$
BEGIN
  RETURN (public.get_default_time_control()->>'initial_time')::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE; -- Changed to STABLE since it reads from DB

-- Grant access to the helper function via REST API
GRANT EXECUTE ON FUNCTION public.get_default_initial_time() TO postgres, anon, authenticated, service_role;

-- Update existing games to have a default time control
UPDATE public.games
SET time_control = public.get_default_time_control()
WHERE time_control IS NULL; 

-- Add trigger to update time_control column whenever settings change
CREATE OR REPLACE FUNCTION public.sync_time_control_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- If the default time control setting was updated, log the event
  IF NEW.key = 'default_time_control' AND 
     (OLD.value IS NULL OR OLD.value IS DISTINCT FROM NEW.value) THEN
    
    -- Log the change
    INSERT INTO public.event_log 
      (event_type, entity_type, entity_id, data)
    VALUES 
      ('settings_updated', 'time_control', 'default', json_build_object(
        'old_value', OLD.value,
        'new_value', NEW.value
      ));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS sync_time_control_settings_trigger ON public.settings;
CREATE TRIGGER sync_time_control_settings_trigger
AFTER UPDATE OR INSERT ON public.settings
FOR EACH ROW
WHEN (NEW.key = 'default_time_control')
EXECUTE FUNCTION public.sync_time_control_settings();

-- Time control utility functions for chess game

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
    NEW.time_control := public.get_default_time_control();
    NEW.white_time_remaining := public.get_default_initial_time();
    NEW.black_time_remaining := public.get_default_initial_time();
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
-- Using the centralized default values
UPDATE public.games
SET 
  time_control = public.get_default_time_control(),
  white_time_remaining = public.get_default_initial_time(),
  black_time_remaining = public.get_default_initial_time()
WHERE 
  time_control IS NULL AND
  status = 'active';