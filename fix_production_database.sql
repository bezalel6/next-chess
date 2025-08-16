-- EMERGENCY FIX FOR PRODUCTION DATABASE
-- Run this SQL in Supabase Dashboard SQL Editor to fix the 500 error

-- First ensure the player_color type exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_color') THEN
        CREATE TYPE player_color AS ENUM ('white', 'black');
    END IF;
END$$;

-- Drop function if exists (in case of partial deployment)
DROP FUNCTION IF EXISTS public.handle_move_clock_update(UUID, player_color);
DROP FUNCTION IF EXISTS public.handle_move_clock_update(text, text);

-- Create the missing function with text parameters to avoid type issues
CREATE OR REPLACE FUNCTION public.handle_move_clock_update(
  p_game_id text,
  p_moving_color text
) RETURNS JSONB AS $$
BEGIN
  -- Minimal implementation to prevent 500 errors
  -- Just return empty JSON for now
  RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_move_clock_update(text, text) TO anon, authenticated, service_role;

-- Also create UUID version if the type exists
CREATE OR REPLACE FUNCTION public.handle_move_clock_update(
  p_game_id UUID,
  p_moving_color player_color
) RETURNS JSONB AS $$
BEGIN
  -- Minimal implementation to prevent 500 errors
  -- Just return empty JSON for now
  RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions for UUID version
GRANT EXECUTE ON FUNCTION public.handle_move_clock_update(UUID, player_color) TO anon, authenticated, service_role;

-- Verify the functions were created
SELECT proname, pronargs, proargtypes
FROM pg_proc 
WHERE proname = 'handle_move_clock_update';