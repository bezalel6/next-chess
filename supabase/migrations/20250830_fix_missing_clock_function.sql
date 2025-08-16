-- Emergency fix: Add missing handle_move_clock_update function
-- This function was missing in production causing 500 errors

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_move_clock_update(UUID, player_color);

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
  
  -- Get game record
  SELECT * INTO game_record FROM public.games WHERE id = game_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;
  
  -- For now, just return a simple clock update without modifying times
  -- This prevents the 500 error while we properly implement clock functionality
  clock_update := jsonb_build_object(
    'white_time_remaining', COALESCE(game_record.white_time_remaining, game_record.initial_time),
    'black_time_remaining', COALESCE(game_record.black_time_remaining, game_record.initial_time),
    'last_update', now_ms,
    'turn', game_record.turn
  );
  
  RETURN clock_update;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_move_clock_update(UUID, player_color) TO postgres, authenticated, service_role, anon;

-- Add comment
COMMENT ON FUNCTION public.handle_move_clock_update IS 'Handles clock updates when a move is made (simplified version for emergency fix)';