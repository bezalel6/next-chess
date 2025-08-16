-- Fix: Add text overload for handle_move_clock_update function
-- The games.id column is TEXT but the function expects UUID

-- Create text version of the function that converts to UUID internally
CREATE OR REPLACE FUNCTION public.handle_move_clock_update(
  p_game_id text,
  p_moving_color text
)
RETURNS jsonb AS $$
DECLARE
  clock_update jsonb;
  game_uuid uuid;
  color_enum player_color;
BEGIN
  -- Convert text parameters to proper types
  BEGIN
    game_uuid := p_game_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid game_id format: %', p_game_id;
  END;
  
  -- Convert text color to enum
  IF p_moving_color = 'white' THEN
    color_enum := 'white'::player_color;
  ELSIF p_moving_color = 'black' THEN
    color_enum := 'black'::player_color;
  ELSE
    RAISE EXCEPTION 'Invalid color: %', p_moving_color;
  END IF;
  
  -- Call the original UUID version
  SELECT public.handle_move_clock_update(game_uuid, color_enum) INTO clock_update;
  
  RETURN clock_update;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_move_clock_update(text, text) TO postgres, authenticated, service_role, anon;

-- Add comment
COMMENT ON FUNCTION public.handle_move_clock_update(text, text) IS 'Text overload for handle_move_clock_update to handle games.id being TEXT';